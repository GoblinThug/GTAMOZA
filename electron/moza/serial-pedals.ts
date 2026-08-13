/**
 * MOZA vendor serial (CDC ACM) — Pit House / boxflat protocol.
 * - Pedal outputs (linearized)
 * - Base settings (wheel angle, FFB, etc.) when COM is free
 */

import path from 'node:path'
import { createRequire } from 'node:module'
import { app } from 'electron'
import type { MozaBaseSync } from '../../shared/types'
import { syncBaseFromPitHouseCoap, getPitHouseCoapStatus } from './pithouse-coap'

export type { MozaBaseSync }

const START = 0x7e
const MAGIC = 13

const PEDALS_DEVICE_ID = 25
const BASE_DEVICE_ID = 19
const READ_GROUP_PEDAL_OUT = 37
const READ_GROUP_BASE = 40

const PEDAL_OUT = { throttle: 1, brake: 2, clutch: 3 } as const
const BASE_CMD = {
  limit: 1,
  ffbStrength: 2,
  inertia: 4,
  damper: 7,
  friction: 8,
  spring: 9,
  torque: 18,
  softLimitRetain: 28,
} as const

type SerialPortCtor = new (options: {
  path: string
  baudRate: number
  autoOpen?: boolean
  lock?: boolean
}) => {
  open: (cb: (err: Error | null) => void) => void
  close: (cb?: (err: Error | null) => void) => void
  write: (data: Buffer, cb?: (err: Error | null) => void) => void
  on: (event: 'data' | 'error' | 'close', cb: (data?: Buffer | Error) => void) => void
  isOpen: boolean
}

type SerialPortListItem = {
  path: string
  vendorId?: string
  productId?: string
  pnpId?: string
}

type SerialPortModule = {
  SerialPort: SerialPortCtor & {
    list: () => Promise<SerialPortListItem[]>
  }
}

export type SerialPedalSample = {
  throttle: number
  brake: number
  clutch: number
  throttleRaw: number
  brakeRaw: number
  clutchRaw: number
  at: number
}

type BaseRaw = Partial<{
  limit: number
  ffbStrength: number
  inertia: number
  damper: number
  friction: number
  spring: number
  torque: number
  softLimitRetain: number
}>

let SerialPortRef: SerialPortModule['SerialPort'] | null = null
let port: InstanceType<SerialPortCtor> | null = null
let openPath: string | null = null
let rx: Buffer = Buffer.alloc(0)
let pollTimer: NodeJS.Timeout | null = null
let lastSample: SerialPedalSample | null = null
let lastBaseSync: MozaBaseSync | null = null
let baseRaw: BaseRaw = {}
let lastErrorAt = 0
let disabledUntil = 0
let pollTick = 0
let onBaseSync: ((sync: MozaBaseSync) => void) | null = null
let lastOpenError: string | null = null
/** Last known angle even after COM closes (until next successful read). */
let lastWheelAngleDeg: number | null = null

function loadSerial(): SerialPortModule['SerialPort'] | null {
  if (SerialPortRef) return SerialPortRef
  const candidates = [
    path.join(process.cwd(), 'package.json'),
    path.join(app.getAppPath(), 'package.json'),
    path.join(__dirname, '..', 'package.json'),
  ]
  for (const pkg of candidates) {
    try {
      const require = createRequire(pkg)
      const mod = require('serialport') as SerialPortModule
      if (mod?.SerialPort) {
        SerialPortRef = mod.SerialPort
        return SerialPortRef
      }
    } catch {
      // try next
    }
  }
  return null
}

function checksum(bytes: Buffer): number {
  let v = MAGIC
  for (let i = 0; i < bytes.length; i++) v += bytes[i]!
  return v & 0xff
}

function buildRead(deviceId: number, group: number, cmdId: number): Buffer {
  const payload = Buffer.alloc(2)
  payload.writeUIntBE(1, 0, 2)
  const length = 1 + 2
  const body = Buffer.from([
    START,
    length,
    group,
    deviceId,
    cmdId,
    payload[0]!,
    payload[1]!,
  ])
  return Buffer.concat([body, Buffer.from([checksum(body)])])
}

function nibbleSwap(b: number): number {
  return ((b & 0x0f) << 4) | ((b & 0xf0) >> 4)
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function parseFrames(
  buf: Buffer,
): Array<{ group: number; device: number; payload: Buffer }> {
  const out: Array<{ group: number; device: number; payload: Buffer }> = []
  let i = 0
  while (i + 5 < buf.length) {
    if (buf[i] !== START) {
      i++
      continue
    }
    const len = buf[i + 1]!
    if (len < 2 || len > 11) {
      i++
      continue
    }
    const wire = len + 5
    if (i + wire > buf.length) break
    const group = buf[i + 2]!
    const device = buf[i + 3]!
    const payload = Buffer.from(buf.subarray(i + 4, i + 4 + len))
    out.push({ group, device, payload })
    i += wire
  }
  rx = i > 0 ? Buffer.from(buf.subarray(i)) : buf
  return out
}

async function findMozaPort(): Promise<string | null> {
  const SP = loadSerial()
  if (!SP) return null
  try {
    const list = await SP.list()
    const hit = list.find((p) => {
      const vid = (p.vendorId || '').toUpperCase()
      const pnp = (p.pnpId || '').toUpperCase()
      return vid === '346E' || pnp.includes('VID_346E')
    })
    return hit?.path ?? null
  } catch {
    return null
  }
}

function publishBaseIfReady(maxTorqueNm = 5.5) {
  // Wheel angle alone is enough — don't wait for every FFB field.
  if (baseRaw.limit == null) return

  const limit = baseRaw.limit
  const wheelAngleDeg = clamp(Math.round(limit * 2), 90, 2700)
  lastWheelAngleDeg = wheelAngleDeg

  const prev = lastBaseSync
  const overallStrength =
    baseRaw.ffbStrength != null
      ? clamp(Math.round(baseRaw.ffbStrength / 10), 0, 100)
      : (prev?.raw.ffbStrength ?? 70)
  const torquePct =
    baseRaw.torque != null
      ? clamp(baseRaw.torque, 50, 100)
      : (prev?.raw.torquePct ?? 100)
  const damping =
    baseRaw.damper != null
      ? clamp(Math.round(baseRaw.damper / 10), 0, 100)
      : (prev?.raw.damper ?? 25)
  const frictionPct =
    baseRaw.friction != null
      ? clamp(Math.round(baseRaw.friction / 10), 0, 100)
      : (prev?.raw.friction ?? 15)
  const springPct =
    baseRaw.spring != null
      ? clamp(Math.round(baseRaw.spring / 10), 0, 100)
      : (prev?.raw.spring ?? 60)
  const inertiaPct =
    baseRaw.inertia != null
      ? clamp(Math.round(baseRaw.inertia / 50), 0, 100)
      : (prev?.raw.inertia ?? 20)
  const softLock =
    baseRaw.softLimitRetain != null
      ? baseRaw.softLimitRetain !== 0
      : (prev?.raw.softLock ?? true)

  const sync: MozaBaseSync = {
    at: Date.now(),
    connected: true,
    steering: {
      wheelAngle: wheelAngleDeg,
      softLock,
    },
    ffb: {
      overallStrength,
      maximumTorque: Math.round(maxTorqueNm * (torquePct / 100) * 10) / 10,
      // Keep app centering independent of Pit House spring (often 0).
      damping,
      friction: frictionPct,
      inertia: inertiaPct,
    },
    raw: {
      limitHalf: limit,
      wheelAngleDeg,
      ffbStrength: overallStrength,
      torquePct,
      damper: damping,
      friction: frictionPct,
      spring: springPct,
      inertia: inertiaPct,
      softLock,
    },
  }

  lastBaseSync = sync
  const changed =
    !prev ||
    prev.raw.wheelAngleDeg !== sync.raw.wheelAngleDeg ||
    prev.raw.ffbStrength !== sync.raw.ffbStrength ||
    prev.raw.torquePct !== sync.raw.torquePct ||
    prev.raw.damper !== sync.raw.damper ||
    prev.raw.friction !== sync.raw.friction ||
    prev.raw.spring !== sync.raw.spring ||
    prev.raw.inertia !== sync.raw.inertia ||
    prev.raw.softLock !== sync.raw.softLock
  if (changed) {
    onBaseSync?.(sync)
  }
}

function applyFrames(
  frames: Array<{ group: number; device: number; payload: Buffer }>,
  maxTorqueNm: number,
) {
  let thr = lastSample?.throttleRaw ?? 0
  let brk = lastSample?.brakeRaw ?? 0
  let clt = lastSample?.clutchRaw ?? 0
  let gotPedal = false
  let gotBase = false

  for (const f of frames) {
    const group = f.group & 0x7f
    const dev = nibbleSwap(f.device)
    if (f.payload.length < 3) continue
    const cmd = f.payload[0]!
    const val = f.payload.readUIntBE(1, 2)

    if (group === READ_GROUP_PEDAL_OUT) {
      if (dev !== PEDALS_DEVICE_ID && dev !== 18 && dev !== 19) continue
      if (cmd === PEDAL_OUT.throttle) thr = val
      else if (cmd === PEDAL_OUT.brake) brk = val
      else if (cmd === PEDAL_OUT.clutch) clt = val
      else continue
      gotPedal = true
      continue
    }

    if (group === READ_GROUP_BASE && (dev === BASE_DEVICE_ID || dev === 18)) {
      if (cmd === BASE_CMD.limit) baseRaw.limit = val
      else if (cmd === BASE_CMD.ffbStrength) baseRaw.ffbStrength = val
      else if (cmd === BASE_CMD.inertia) baseRaw.inertia = val
      else if (cmd === BASE_CMD.damper) baseRaw.damper = val
      else if (cmd === BASE_CMD.friction) baseRaw.friction = val
      else if (cmd === BASE_CMD.spring) baseRaw.spring = val
      else if (cmd === BASE_CMD.torque) baseRaw.torque = val
      else if (cmd === BASE_CMD.softLimitRetain) baseRaw.softLimitRetain = val
      else continue
      gotBase = true
    }
  }

  if (gotPedal) {
    const norm = (v: number) => Math.max(0, Math.min(1, v / 65535))
    lastSample = {
      throttle: norm(thr),
      brake: norm(brk),
      clutch: norm(clt),
      throttleRaw: thr,
      brakeRaw: brk,
      clutchRaw: clt,
      at: Date.now(),
    }
  }
  if (gotBase) publishBaseIfReady(maxTorqueNm)
}

let maxTorqueHint = 5.5
/** When true, COM is only open for a short on-demand sync (never held for pedals). */
let syncSession = false

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

function requestBasePoll() {
  if (!port?.isOpen) return
  pollTick++
  // Angle first — what users change in Pit House
  port.write(buildRead(BASE_DEVICE_ID, READ_GROUP_BASE, BASE_CMD.limit))
  port.write(buildRead(BASE_DEVICE_ID, READ_GROUP_BASE, BASE_CMD.softLimitRetain))
  if (pollTick % 3 === 1) {
    for (const id of [
      BASE_CMD.ffbStrength,
      BASE_CMD.inertia,
      BASE_CMD.damper,
      BASE_CMD.friction,
      BASE_CMD.spring,
      BASE_CMD.torque,
    ]) {
      port.write(buildRead(BASE_DEVICE_ID, READ_GROUP_BASE, id))
    }
  }
}

function closePort() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (port) {
    try {
      if (port.isOpen) port.close()
    } catch {
      // ignore
    }
  }
  port = null
  openPath = null
  rx = Buffer.alloc(0)
  syncSession = false
}

async function openPort(): Promise<boolean> {
  if (Date.now() < disabledUntil) return false
  const SP = loadSerial()
  if (!SP) return false
  const found = await findMozaPort()
  if (!found) {
    lastOpenError = 'MOZA COM port not found'
    return false
  }
  if (port?.isOpen && openPath === found) return true

  closePort()
  return await new Promise((resolve) => {
    try {
      const next = new SP({
        path: found,
        baudRate: 115200,
        autoOpen: false,
        lock: false,
      })
      next.on('data', (chunk) => {
        if (!Buffer.isBuffer(chunk)) return
        rx = Buffer.concat([rx, chunk])
        if (rx.length > 8192) rx = rx.subarray(rx.length - 4096)
        applyFrames(parseFrames(rx), maxTorqueHint)
      })
      next.on('error', () => {
        closePort()
        lastOpenError = 'COM error'
        disabledUntil = Date.now() + 1000
      })
      next.on('close', () => {
        port = null
        openPath = null
        syncSession = false
      })
      next.open((err) => {
        if (err) {
          lastOpenError = err.message
          if (Date.now() - lastErrorAt > 8_000) {
            console.warn(
              '[moza-serial] open failed (Pit House may hold COM):',
              err.message,
            )
            lastErrorAt = Date.now()
          }
          disabledUntil = Date.now() + 1000
          resolve(false)
          return
        }
        port = next
        openPath = found
        lastOpenError = null
        syncSession = true
        console.log('[moza-serial] connected (brief sync)', found)
        resolve(true)
      })
    } catch (error) {
      console.warn('[moza-serial] exception', error)
      lastOpenError = error instanceof Error ? error.message : 'serial exception'
      disabledUntil = Date.now() + 1000
      resolve(false)
    }
  })
}

export function setSerialMaxTorqueHint(nm: number) {
  if (Number.isFinite(nm) && nm > 0) maxTorqueHint = nm
}

export function getSerialPedals(): SerialPedalSample | null {
  // Pedals stay on HID — we no longer hold COM for continuous pedal reads.
  return null
}

export function getSerialBaseSync(): MozaBaseSync | null {
  // Keep last successful pull indefinitely (COM is released after sync).
  return lastBaseSync
}

export function getSerialStatus(): {
  portOpen: boolean
  pedalsLive: boolean
  baseLive: boolean
  path: string | null
  busy: boolean
  lastError: string | null
  wheelAngleDeg: number | null
} {
  const open = Boolean(port?.isOpen)
  const coap = getPitHouseCoapStatus()
  const accessDenied = Boolean(
    lastOpenError && /access denied|отказано|занят|sharing/i.test(lastOpenError),
  )
  return {
    portOpen: open,
    pedalsLive: false,
    baseLive: lastBaseSync != null,
    path: openPath ?? (coap.port != null ? `coap://127.0.0.1:${coap.port}` : null),
    // COM busy only matters for serial fallback — CoAP works with Pit House open
    busy: !coap.available && !open && accessDenied,
    lastError: open
      ? null
      : coap.available
        ? null
        : (coap.lastError ?? lastOpenError),
    wheelAngleDeg: lastWheelAngleDeg ?? lastBaseSync?.raw.wheelAngleDeg ?? null,
  }
}

export function onSerialBaseSync(cb: ((sync: MozaBaseSync) => void) | null) {
  onBaseSync = cb
}

/**
 * Brief COM session: open → read base settings → close.
 * Must release the port so Pit House can reclaim the base.
 */
export async function syncBaseFromSerialOnce(
  timeoutMs = 3500,
): Promise<MozaBaseSync | null> {
  disabledUntil = 0
  lastOpenError = null
  baseRaw = {}
  pollTick = 0

  // Always start clean — never leave a lingering hold.
  if (port?.isOpen) closePort()

  const opened = await openPort()
  if (!opened) {
    console.warn('[moza-serial] sync aborted — COM busy or missing')
    return null
  }

  try {
    requestBasePoll()
    pollTimer = setInterval(requestBasePoll, 80)
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
      if (baseRaw.limit != null) {
        publishBaseIfReady(maxTorqueHint)
        await sleep(120) // allow a couple more packets for FFB fields
        publishBaseIfReady(maxTorqueHint)
        return lastBaseSync
      }
      await sleep(50)
    }
    console.warn('[moza-serial] sync timeout — no base-limit reply')
    return lastBaseSync
  } finally {
    closePort()
  }
}

function applyExternalSync(sync: MozaBaseSync) {
  const prev = lastBaseSync
  lastBaseSync = sync
  lastWheelAngleDeg = sync.raw.wheelAngleDeg
  lastOpenError = null
  const changed =
    !prev ||
    prev.raw.wheelAngleDeg !== sync.raw.wheelAngleDeg ||
    prev.raw.ffbStrength !== sync.raw.ffbStrength ||
    prev.raw.torquePct !== sync.raw.torquePct ||
    prev.raw.damper !== sync.raw.damper ||
    prev.raw.friction !== sync.raw.friction ||
    prev.raw.spring !== sync.raw.spring ||
    prev.raw.inertia !== sync.raw.inertia
  if (changed) onBaseSync?.(sync)
  return sync
}

/**
 * Prefer Pit House CoAP (no COM conflict). Fall back to brief serial if Pit House is closed.
 */
export async function syncBaseSettings(): Promise<MozaBaseSync | null> {
  const viaCoap = await syncBaseFromPitHouseCoap(maxTorqueHint)
  if (viaCoap) return applyExternalSync(viaCoap)

  const viaSerial = await syncBaseFromSerialOnce()
  return viaSerial
}

/** @deprecated use syncBaseSettings */
export function requestSerialBaseRefresh() {
  void syncBaseSettings()
}

/** No background COM hold — Pit House must keep exclusive access. */
export async function tickSerialPedals(): Promise<void> {
  // intentionally empty
}

/** Background CoAP poll while Pit House is open (no COM touch). */
export async function tickBaseSettingsPoll(): Promise<void> {
  try {
    const sync = await syncBaseFromPitHouseCoap(maxTorqueHint)
    if (sync) applyExternalSync(sync)
  } catch (error) {
    console.warn('[moza-coap] poll failed', error)
  }
}

export function disposeSerialPedals() {
  onBaseSync = null
  closePort()
  lastSample = null
  lastBaseSync = null
  lastWheelAngleDeg = null
  lastOpenError = null
  baseRaw = {}
}
