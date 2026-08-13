/**
 * Read base settings from MOZA Pit House local CoAP server.
 * Works while Pit House holds the COM port — no serial open needed.
 */

import { execFile } from 'node:child_process'
import dgram from 'node:dgram'
import { promisify } from 'node:util'
import type { MozaBaseSync } from '../../shared/types'

const execFileAsync = promisify(execFile)

const COAP_TIMEOUT_MS = 900
let cachedPort: number | null = null
let lastCoapError: string | null = null

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

function buildCoapGet(uriPath: string, mid: number): Buffer {
  const segs = uriPath.split('/').filter(Boolean)
  const hdr = Buffer.alloc(4)
  hdr[0] = 0x40 // CON, tkl 0
  hdr[1] = 0x01 // GET
  hdr.writeUInt16BE(mid & 0xffff, 2)
  const opts: Buffer[] = []
  let last = 0
  for (const seg of segs) {
    const b = Buffer.from(seg)
    const delta = 11 - last // Uri-Path = 11
    last = 11
    let d = delta
    let l = b.length
    let fd: number
    let ed = Buffer.alloc(0)
    if (d < 13) fd = d
    else {
      fd = 13
      ed = Buffer.from([d - 13])
    }
    let fl: number
    let el = Buffer.alloc(0)
    if (l < 13) fl = l
    else {
      fl = 13
      el = Buffer.from([l - 13])
    }
    opts.push(Buffer.from([(fd << 4) | fl]), ed, el, b)
  }
  return Buffer.concat([hdr, ...opts])
}

function coapPayload(msg: Buffer): Buffer {
  const ff = msg.indexOf(0xff)
  return ff >= 0 ? msg.subarray(ff + 1) : msg.subarray(4)
}

function coapCode(msg: Buffer): number {
  return msg[1] ?? 0
}

function isCoapSuccess(code: number): boolean {
  // 2.05 Content = 69 (0x45)
  return code >= 0x40 && code < 0x60
}

async function coapGet(port: number, uriPath: string): Promise<Buffer | null> {
  return await new Promise((resolve) => {
    const sock = dgram.createSocket('udp4')
    const mid = Math.floor(Math.random() * 65535)
    const pkt = buildCoapGet(uriPath, mid)
    const timer = setTimeout(() => {
      try {
        sock.close()
      } catch {
        // ignore
      }
      resolve(null)
    }, COAP_TIMEOUT_MS)
    sock.on('message', (msg) => {
      clearTimeout(timer)
      try {
        sock.close()
      } catch {
        // ignore
      }
      resolve(Buffer.from(msg))
    })
    sock.on('error', () => {
      clearTimeout(timer)
      try {
        sock.close()
      } catch {
        // ignore
      }
      resolve(null)
    })
    sock.send(pkt, port, '127.0.0.1')
  })
}

/** Decode CBOR unsigned int right after a text key, or plain ASCII digits. */
function readIntAfterKey(buf: Buffer, key: string): number | null {
  const ascii = buf.toString('utf8').trim()
  if (/^\d+$/.test(ascii)) return Number(ascii)

  const keyBuf = Buffer.from(key)
  const idx = buf.indexOf(keyBuf)
  if (idx < 0) return null
  let i = idx + keyBuf.length
  // skip possible CBOR text length already consumed; next is value
  while (i < buf.length) {
    const b = buf[i]!
    const major = b >> 5
    const add = b & 0x1f
    if (major === 0) {
      if (add < 24) return add
      if (add === 24 && i + 1 < buf.length) return buf[i + 1]!
      if (add === 25 && i + 2 < buf.length) return buf.readUInt16BE(i + 1)
      if (add === 26 && i + 4 < buf.length) return buf.readUInt32BE(i + 1)
      return null
    }
    // skip unexpected text/bytes headers
    if (major === 3 || major === 2) {
      let len = add
      let hdr = 1
      if (add === 24) {
        len = buf[i + 1]!
        hdr = 2
      } else if (add === 25) {
        len = buf.readUInt16BE(i + 1)
        hdr = 3
      }
      i += hdr + len
      continue
    }
    i++
  }
  return null
}

async function listPitHouseUdpPorts(): Promise<number[]> {
  try {
    const { stdout: taskOut } = await execFileAsync(
      'tasklist',
      ['/FI', 'IMAGENAME eq MOZA Pit House.exe', '/FO', 'CSV', '/NH'],
      { windowsHide: true },
    )
    const pids = new Set<number>()
    for (const line of taskOut.split(/\r?\n/)) {
      const m = line.match(/"MOZA Pit House\.exe","(\d+)"/i)
      if (m) pids.add(Number(m[1]))
    }
    if (pids.size === 0) return []

    const { stdout: netOut } = await execFileAsync(
      'netstat',
      ['-ano', '-p', 'udp'],
      { windowsHide: true },
    )
    const ports = new Set<number>()
    for (const line of netOut.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 4) continue
      const local = parts[1] ?? ''
      const pid = Number(parts[parts.length - 1])
      if (!pids.has(pid)) continue
      const portStr = local.includes(']:')
        ? local.slice(local.lastIndexOf(']:') + 2)
        : local.slice(local.lastIndexOf(':') + 1)
      const port = Number(portStr)
      if (Number.isFinite(port) && port > 0) ports.add(port)
    }
    return [...ports]
  } catch {
    return []
  }
}

async function discoverCoapPort(): Promise<number | null> {
  if (cachedPort != null) {
    const probe = await coapGet(cachedPort, 'MOZARacing/ProductDevice')
    if (probe && isCoapSuccess(coapCode(probe))) return cachedPort
    cachedPort = null
  }

  const ports = await listPitHouseUdpPorts()
  for (const port of ports) {
    const probe = await coapGet(port, 'MOZARacing/ProductDevice')
    if (!probe || !isCoapSuccess(coapCode(probe))) continue
    cachedPort = port
    lastCoapError = null
    return port
  }
  lastCoapError = ports.length
    ? 'Pit House CoAP not responding'
    : 'Pit House not running'
  return null
}

async function listMotorDeviceIds(port: number): Promise<string[]> {
  const msg = await coapGet(port, 'MOZARacing/ProductDevice')
  if (!msg || !isCoapSuccess(coapCode(msg))) return []
  const body = coapPayload(msg).toString('utf8')
  // Payload mixes CBOR/binary with ascii ids — extract 16-hex tokens.
  const ids = [...body.matchAll(/[a-f0-9]{16}/gi)].map((m) => m[0].toLowerCase())
  return [...new Set(ids)]
}

export function getPitHouseCoapStatus(): {
  available: boolean
  port: number | null
  lastError: string | null
} {
  return {
    available: cachedPort != null,
    port: cachedPort,
    lastError: lastCoapError,
  }
}

/**
 * Pull wheel angle (+ a few base fields) from Pit House CoAP.
 * Safe while Pit House owns COM.
 */
export async function syncBaseFromPitHouseCoap(
  maxTorqueNm = 5.5,
): Promise<MozaBaseSync | null> {
  const port = await discoverCoapPort()
  if (port == null) return null

  const deviceIds = await listMotorDeviceIds(port)
  if (deviceIds.length === 0) {
    lastCoapError = 'No CoAP devices'
    return null
  }

  for (const id of deviceIds) {
    const limitMsg = await coapGet(
      port,
      `MOZARacing/ProductDevice/${id}/LimitAngle`,
    )
    if (!limitMsg || !isCoapSuccess(coapCode(limitMsg))) continue
    const limitBody = coapPayload(limitMsg)
    const wheelAngleDeg =
      readIntAfterKey(limitBody, 'LimitAngle') ??
      readIntAfterKey(limitBody, 'GameMaximumAngle')
    if (wheelAngleDeg == null || wheelAngleDeg < 90 || wheelAngleDeg > 2700) {
      continue
    }
    // Pit House UI uses whole degrees for the limit setting
    const angle = Math.round(wheelAngleDeg)

    const readPlain = async (name: string): Promise<number | null> => {
      const m = await coapGet(port, `MOZARacing/ProductDevice/${id}/${name}`)
      if (!m || !isCoapSuccess(coapCode(m))) return null
      const body = coapPayload(m)
      const t = body.toString('utf8').trim()
      if (/^\d+(\.\d+)?$/.test(t)) return Number(t)
      return readIntAfterKey(body, name)
    }

    const ffbStrength = (await readPlain('FfbStrength')) ?? 70
    const torquePct = (await readPlain('PeakTorque')) ?? 100
    const damper = (await readPlain('NaturalDamper')) ?? 25
    const friction = (await readPlain('NaturalFriction')) ?? 15
    const spring = (await readPlain('SpringStrength')) ?? 0
    const inertia = (await readPlain('NaturalInertia')) ?? 20

    const overallStrength = Math.max(0, Math.min(100, Math.round(ffbStrength)))
    const damping = Math.max(0, Math.min(100, Math.round(damper)))
    const frictionPct = Math.max(0, Math.min(100, Math.round(friction)))
    const springPct = Math.max(0, Math.min(100, Math.round(spring)))
    const inertiaPct = Math.max(0, Math.min(100, Math.round(inertia > 100 ? inertia / 50 : inertia)))

    // Do NOT map Pit House SpringStrength → selfAligningTorque.
    // Pit House spring is often 0 (base feel off); syncing that zeros GTAMOZA
    // game centering and makes FFB feel completely dead.
    const sync: MozaBaseSync = {
      at: Date.now(),
      connected: true,
      steering: {
        wheelAngle: angle,
      },
      ffb: {
        overallStrength,
        maximumTorque: Math.round(maxTorqueNm * (Math.max(50, Math.min(100, torquePct)) / 100) * 10) / 10,
        damping,
        friction: frictionPct,
        inertia: inertiaPct,
      },
      raw: {
        limitHalf: Math.round(angle / 2),
        wheelAngleDeg: angle,
        ffbStrength: overallStrength,
        torquePct: Math.max(50, Math.min(100, Math.round(torquePct))),
        damper: damping,
        friction: frictionPct,
        spring: springPct,
        inertia: inertiaPct,
        softLock: true,
      },
    }

    lastCoapError = null
    return sync
  }

  lastCoapError = 'LimitAngle not found on CoAP devices'
  return null
}

/** Tiny helper so callers can yield between polls. */
export async function waitBrief(ms = 50) {
  await sleep(ms)
}
