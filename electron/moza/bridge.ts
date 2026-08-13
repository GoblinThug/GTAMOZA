import { BrowserWindow, ipcMain, app } from 'electron'
import path from 'node:path'
import dgram from 'node:dgram'
import { createRequire } from 'node:module'
import { MOZA_VID, resolveMozaBase } from './ids'
import type {
  EffectsSettings,
  FfbSettings,
  PedalAxisMap,
  PedalFloorPoint,
  PedalFloors,
  SteeringSettings,
} from '../../shared/types'
import { DEFAULT_PEDAL_AXIS_MAP, DEFAULT_PEDAL_FLOORS } from '../../shared/types'
import {
  PEDAL_ARM,
  PEDAL_LOCK_MIN_TRAVEL,
  PEDAL_PROVISIONAL_FULL,
  PEDAL_REST_NOISE,
  applyFloorToCal,
  circularTravel,
  directedTravel,
  firstDirPeak,
  freshPedalCal,
  learnDirFromDelta,
  normalizePedalSample,
  resetUnwrap,
  scaleTravel,
  seedFloorEngagement,
  snapToRest,
  wrappedDelta,
  type PedalAxisCal,
} from './pedal-math'
import {
  disposeSerialPedals,
  getSerialBaseSync,
  getSerialPedals,
  getSerialStatus,
  onSerialBaseSync,
  setSerialMaxTorqueHint,
  syncBaseSettings,
  tickBaseSettingsPoll,
  type MozaBaseSync,
} from './serial-pedals'
import { sendGtaControls, setFfbHostEnabled, setGtaFfbContext } from '../gta/telemetry-bridge'

type HidDeviceInfo = {
  vendorId?: number
  productId?: number
  path?: string
  serialNumber?: string
  product?: string
  release?: number
  usagePage?: number
  usage?: number
}

type HidModule = {
  devices: () => HidDeviceInfo[]
  HID: new (path: string) => {
    on: (event: 'data' | 'error', cb: (data: Buffer | Error) => void) => void
    removeAllListeners: (event?: string) => void
    close: () => void
  }
}

function loadHid(): HidModule {
  const candidates = [
    path.join(process.cwd(), 'package.json'),
    path.join(app.getAppPath(), 'package.json'),
    path.join(__dirname, '..', 'package.json'),
  ]
  let lastError: unknown
  for (const pkg of candidates) {
    try {
      const require = createRequire(pkg)
      const mod = require('node-hid') as HidModule
      if (mod && typeof mod.devices === 'function') return mod
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to load node-hid')
}

let hidModule: HidModule | null = null
function getHid(): HidModule {
  if (!hidModule) hidModule = loadHid()
  return hidModule
}


export type MozaHardwareStatus = {
  connected: boolean
  name: string
  model: string
  firmware?: string
  productId?: number
  serialNumber?: string
  maxTorqueNm?: number
  path?: string
}

export type MozaLiveSample = {
  timestamp: number
  /** Raw HID steering axis 0..1 (0.5 = center) */
  rawAxis: number
  /** Degrees after steering mapping */
  steeringAngle: number
  /** Estimated torque proxy from FFB gains (not measured Nm yet) */
  torque: number
  /** Pedal travel 0..1 */
  throttle: number
  brake: number
  clutch: number
  /** Raw uint16 HID values for mapped pedal axes. */
  throttleRaw: number
  brakeRaw: number
  clutchRaw: number
  /** Raw uint16 axes 0..7 (for pedal learn UI). */
  rawAxes: number[]
  connected: boolean
}

export type MozaFfbTestRequest = {
  mode: 'constant' | 'sine' | 'spring' | 'damper' | 'pulse'
  strength: number
}

let device: InstanceType<HidModule['HID']> | null = null
let openPath: string | null = null
/** After Exclusive/FFB-host busy open, don't re-enumerate/open every 1.5s (UI hitch). */
let hidOpenBackoffUntil = 0
let lastHidEnumAt = 0
let lastBasePollAt = 0
const HID_OPEN_BACKOFF_MS = 10_000
const HID_ENUM_MIN_MS = 5_000
const BASE_SETTINGS_POLL_MS = 10_000
let lastStatus: MozaHardwareStatus = {
  connected: false,
  name: 'MOZA R5',
  model: 'R5',
}
let lastRawAxis = 0.5
let lastThrottle = 0
let lastBrake = 0
let lastClutch = 0
let lastRawAxes: number[] = []
/** HID Y = combined clutch paddles (when Pit House mode = combined axis). */
const PADDLE_AXIS = 1
const PADDLE_DEADZONE = 2800
const PADDLE_NORM_DEAD = 0.12
let paddleRest = 32768
let paddleRestLearn = 0
let padLHeld = false
let padRHeld = false
/** Sticky turn-signal state sent to the GTA plugin. */
let indicatorLeft = false
let indicatorRight = false
/**
 * Shift / clutch paddles are often DI *buttons* (Pit House "Button" mode), not Y.
 * Auto-learn: first distinct button press → left, second → right.
 */
let learnedPadBtnL = -1
let learnedPadBtnR = -1
let prevBtnMask = 0

/**
 * Rising-edge toggle:
 * left = left indicator, right = right, both = hazards, same again = off.
 */
function applyPaddleEdges(padL: boolean, padR: boolean): boolean {
  let changed = false
  if (padL && padR) {
    if (!(padLHeld && padRHeld)) {
      const hazOn = !(indicatorLeft && indicatorRight)
      indicatorLeft = hazOn
      indicatorRight = hazOn
      changed = true
    }
  } else {
    if (padL && !padLHeld) {
      if (indicatorLeft && !indicatorRight) indicatorLeft = false
      else {
        indicatorLeft = true
        indicatorRight = false
      }
      changed = true
    }
    if (padR && !padRHeld) {
      if (indicatorRight && !indicatorLeft) indicatorRight = false
      else {
        indicatorRight = true
        indicatorLeft = false
      }
      changed = true
    }
  }
  padLHeld = padL
  padRHeld = padR
  return changed
}

function toggleIndicatorLeft(): boolean {
  if (indicatorLeft && !indicatorRight) indicatorLeft = false
  else {
    indicatorLeft = true
    indicatorRight = false
  }
  return true
}

function toggleIndicatorRight(): boolean {
  if (indicatorRight && !indicatorLeft) indicatorRight = false
  else {
    indicatorRight = true
    indicatorLeft = false
  }
  return true
}

function updatePaddleIndicators(rawAxes: number[]): boolean {
  const raw = rawAxes[PADDLE_AXIS]
  if (raw == null || !Number.isFinite(raw)) return false

  if (Math.abs(raw - paddleRest) < 2200) {
    paddleRestLearn++
    if (paddleRestLearn < 200) paddleRest = paddleRest * 0.97 + raw * 0.03
    else paddleRest = paddleRest * 0.995 + raw * 0.005
  }

  const delta = raw - paddleRest
  return applyPaddleEdges(delta < -PADDLE_DEADZONE, delta > PADDLE_DEADZONE)
}

/** Combined-axis clutch paddles: normalized −1…1 from FFB-host. */
function updatePaddleFromNorm(y: number): boolean {
  if (!Number.isFinite(y)) return false
  const n = Math.max(-1, Math.min(1, y))
  return applyPaddleEdges(n < -PADDLE_NORM_DEAD, n > PADDLE_NORM_DEAD)
}

/**
 * Independent axes (left+, right+) or multi-axis probe from FFB-host.
 * Values are 0…1 travel per side.
 */
function updatePaddleFromSides(left: number, right: number): boolean {
  const l = Number.isFinite(left) ? left : 0
  const r = Number.isFinite(right) ? right : 0
  return applyPaddleEdges(l > PADDLE_NORM_DEAD, r > PADDLE_NORM_DEAD)
}

/**
 * Button bitmask from FFB-host (bit i = DI button i).
 * Learns the first two distinct paddle buttons as L/R turn signals.
 */
function updatePaddleFromBtnMask(mask: number): boolean {
  if (!Number.isFinite(mask)) return false
  const m = mask >>> 0
  let changed = false
  const rising: number[] = []
  for (let i = 0; i < 32; i++) {
    const bit = 1 << i
    if (m & bit && !(prevBtnMask & bit)) rising.push(i)
  }
  prevBtnMask = m

  for (const i of rising) {
    if (learnedPadBtnL < 0) {
      learnedPadBtnL = i
      changed = toggleIndicatorLeft() || changed
      console.log(`[moza] turn-signal left paddle learned as button ${i}`)
      continue
    }
    if (learnedPadBtnR < 0 && i !== learnedPadBtnL) {
      learnedPadBtnR = i
      changed = toggleIndicatorRight() || changed
      console.log(`[moza] turn-signal right paddle learned as button ${i}`)
      continue
    }
    if (i === learnedPadBtnL) changed = toggleIndicatorLeft() || changed
    else if (i === learnedPadBtnR) changed = toggleIndicatorRight() || changed
  }
  return changed
}

function pedalRaws() {
  const serial = getSerialPedals()
  if (serial) {
    return {
      throttleRaw: serial.throttleRaw < PEDAL_REST_NOISE ? 0 : serial.throttleRaw,
      brakeRaw: serial.brakeRaw < PEDAL_REST_NOISE ? 0 : serial.brakeRaw,
      clutchRaw: serial.clutchRaw < PEDAL_REST_NOISE ? 0 : serial.clutchRaw,
    }
  }
  const valueFor = (role: 'throttle' | 'brake' | 'clutch') => {
    const axis = pedalAxisMap[role]
    const raw = lastRawAxes[axis]
    if (raw == null) return 0
    const cal = calFor(axis)
    // Unwrapped engagement counts (0 at rest). Grows through HID wrap.
    if (cal.dirKnown) {
      const n = Math.round(cal.lastEngagement)
      return n < PEDAL_REST_NOISE ? 0 : n
    }
    const rest = pedalFloors[role]?.rest ?? cal.rest ?? 32768
    const dir = pedalFloors[role]?.dir
    if (dir === 1 || dir === -1) {
      const n = Math.round(circularTravel(raw, rest, dir))
      return n < PEDAL_REST_NOISE ? 0 : n
    }
    const n = Math.round(Math.abs(raw - rest))
    return n < PEDAL_REST_NOISE ? 0 : n
  }
  return {
    throttleRaw: valueFor('throttle'),
    brakeRaw: valueFor('brake'),
    clutchRaw: valueFor('clutch'),
  }
}
let lastReportAt = 0
let smoothSteeringAngle = 0
let steering: SteeringSettings | null = null
let ffb: FfbSettings | null = null
/** Live Moza / Pit House wheel angle (deg). Source of truth for GTA mapping. */
let liveWheelAngleDeg: number | null = null
/** R5 bundle / boxflat defaults — overridden by learned map from settings. */
let pedalAxisMap: PedalAxisMap = { ...DEFAULT_PEDAL_AXIS_MAP }
let pedalFloors: PedalFloors = { ...DEFAULT_PEDAL_FLOORS }
/** Snapshot of raw axes at the start of a manual calibrate step. */
let calBaselineAxes: number[] | null = null
/** Lowest / highest raw samples per axis during the current calibrate step. */
let calStepMins: number[] | null = null
let calStepMaxs: number[] | null = null
/**
 * First press direction from baseline per axis (0 = not armed yet).
 * Opposite-side motion after uint16 wrap must not flip this.
 */
let calStepDirs: Array<0 | 1 | -1> | null = null
/** Peak sample on the first-press side (for logs / UI). */
let calStepExtremes: number[] | null = null
/** Continuous unwrap + peak engagement during calibrate step. */
let calStepUnwrap: number[] | null = null
let calStepLastRaw: number[] | null = null
let calStepMaxEng: number[] | null = null
let pollTimer: NodeJS.Timeout | null = null
let sampleTimer: NodeJS.Timeout | null = null
let testTimer: NodeJS.Timeout | null = null
let testActive = false
/** Axis feed from gtamoza-ffb when Exclusive DI owns the device. */
let ffbAxisSocket: dgram.Socket | null = null
let lastFfbAxisAt = 0
const FFB_AXIS_PORT = 29758
let testMode: MozaFfbTestRequest['mode'] = 'sine'
let testStrength = 40
let testStartedAt = 0

const AXIS_MAX = 65535
/** Display smoothing — keeps UI rotation fluid between HID packets. */
/** Light display smoothing — WheelGauge also smooths; keep this mild. */
const STEER_SMOOTH = 0.65
const PEDAL_REST_SAMPLES = 40

/** Per HID axis-index calibrations (uint16 slots after report id). */
const pedalCals = new Map<number, PedalAxisCal>()

function calFor(axisIndex: number): PedalAxisCal {
  let cal = pedalCals.get(axisIndex)
  if (!cal) {
    cal = freshPedalCal()
    pedalCals.set(axisIndex, cal)
  }
  return cal
}

function resetPedalCalibration() {
  pedalCals.clear()
}

function applyFloorPoint(point: PedalFloorPoint | null) {
  if (!point) return
  const linear = Math.abs(point.extreme - point.rest)
  const fromExtreme =
    linear < 800
      ? directedTravel(point.extreme, point.rest, point.dir)
      : Math.max(
          circularTravel(point.extreme, point.rest, point.dir),
          directedTravel(point.extreme, point.rest, point.dir),
        )
  const travel = Math.max(point.maxTravel ?? 0, fromExtreme)
  if (travel < PEDAL_LOCK_MIN_TRAVEL || travel >= 65_000) {
    console.warn('[moza] ignoring weak/corrupt pedal floor', point, travel)
    return
  }
  applyFloorToCal(calFor(point.axis), { ...point, maxTravel: travel })
}

/**
 * Map raw HID → 0..1 (primes rest / learns dir, then circular travel).
 */
function normalizePedal(raw: number, cal: PedalAxisCal): number {
  cal.samples += 1

  if (!cal.primed) {
    if (cal.samples === 1) cal.rest = raw
    else cal.rest = Math.round(cal.rest * 0.9 + raw * 0.1)
    if (cal.samples >= PEDAL_REST_SAMPLES) {
      cal.primed = true
      if (!cal.floorLocked) {
        cal.extreme = cal.rest
        cal.maxTravel = 0
      }
    }
    return 0
  }

  const delta = raw - cal.rest
  if (!cal.dirKnown && !cal.floorLocked && Math.abs(delta) >= PEDAL_ARM) {
    cal.dir = learnDirFromDelta(delta)
    cal.dirKnown = true
    // Start unwrap at rest so this sample becomes the first travel step.
    resetUnwrap(cal, cal.rest)
  }

  if (!cal.dirKnown) {
    if (Math.abs(delta) < 120) {
      cal.rest = Math.round(cal.rest * 0.99 + raw * 0.01)
      cal.extreme = cal.rest
    }
    return 0
  }

  if (!cal.floorLocked) {
    const value = normalizePedalSample(raw, cal)
    if (value === 0 && Math.abs(delta) < 120) {
      cal.rest = Math.round(cal.rest * 0.99 + raw * 0.01)
      cal.extreme = cal.rest
      cal.maxTravel = 0
      cal.dirKnown = false
    }
    return value
  }

  return normalizePedalSample(raw, cal)
}

function syncCalStepExtremes() {
  if (
    !calBaselineAxes ||
    !calStepMins ||
    !calStepMaxs ||
    !calStepExtremes ||
    !calStepDirs ||
    !calStepMaxEng
  ) {
    return
  }
  const n = Math.min(
    calBaselineAxes.length,
    calStepMins.length,
    calStepMaxs.length,
    calStepExtremes.length,
    calStepDirs.length,
  )
  for (let i = 0; i < n; i++) {
    const peak = firstDirPeak(
      calBaselineAxes[i]!,
      calStepMins[i]!,
      calStepMaxs[i]!,
      calStepDirs[i]!,
    )
    calStepExtremes[i] = peak ? peak.extreme : calBaselineAxes[i]!
    if (peak && peak.travel > (calStepMaxEng[i] ?? 0)) {
      calStepMaxEng[i] = peak.travel
    }
  }
}

function updateCalStepPeaks(axes: number[]) {
  if (
    !calBaselineAxes ||
    !calStepMins ||
    !calStepMaxs ||
    !calStepExtremes ||
    !calStepDirs ||
    !calStepUnwrap ||
    !calStepLastRaw ||
    !calStepMaxEng
  ) {
    return
  }
  const n = Math.min(
    axes.length,
    calBaselineAxes.length,
    calStepMins.length,
    calStepMaxs.length,
    calStepDirs.length,
    calStepUnwrap.length,
    calStepLastRaw.length,
    calStepMaxEng.length,
  )
  for (let i = 0; i < n; i++) {
    const base = calBaselineAxes[i]!
    const cur = axes[i]!
    const step = wrappedDelta(calStepLastRaw[i] ?? base, cur)
    calStepUnwrap[i] = (calStepUnwrap[i] ?? base) + step
    calStepLastRaw[i] = cur

    if (!calStepDirs[i]) {
      const d = cur - base
      if (Math.abs(d) >= PEDAL_ARM) {
        calStepDirs[i] = d > 0 ? 1 : -1
      }
    }
    const dir = calStepDirs[i]!
    if (dir) {
      const signed = calStepUnwrap[i]! - base
      const eng = dir > 0 ? Math.max(0, signed) : Math.max(0, -signed)
      // Grow peak only while moving further into the press (through wrap too).
      const pressing = (dir > 0 && step > 0) || (dir < 0 && step < 0)
      if (pressing && eng > calStepMaxEng[i]!) {
        calStepMaxEng[i] = eng
        calStepExtremes[i] = cur
      }
    }
    if (cur < calStepMins[i]!) calStepMins[i] = cur
    if (cur > calStepMaxs[i]!) calStepMaxs[i] = cur
  }
}

function readAxes(buf: Buffer): number[] {
  const axes: number[] = []
  for (let i = 1; i + 1 < buf.length && axes.length < 8; i += 2) {
    axes.push(buf.readUInt16LE(i))
  }
  return axes
}

function parseReport(buf: Buffer): {
  steering: number
  throttle: number
  brake: number
  clutch: number
  rawAxes: number[]
} | null {
  if (buf.length < 3) return null
  const axes = readAxes(buf)
  if (axes.length < 1) return null

  updateCalStepPeaks(axes)

  const calibrating = Boolean(
    calBaselineAxes && calStepMins && calStepMaxs && calStepDirs,
  )
  const calMapped = new Set<number>()
  if (calibrating) {
    for (const role of ['throttle', 'brake', 'clutch'] as const) {
      calMapped.add(pedalAxisMap[role])
    }
  }

  const values: number[] = new Array(axes.length).fill(0)
  for (let i = 1; i < axes.length && i <= 7; i++) {
    // During cal, mapped pedals use the preview path below.
    if (calMapped.has(i)) continue
    values[i] = normalizePedal(axes[i]!, calFor(i))
  }

  // While calibrating: keep continuous unwrap on the live cal (do NOT
  // fresh-create each sample — that killed the climb to ~64k).
  if (calibrating) {
    for (const role of ['throttle', 'brake', 'clutch'] as const) {
      const idx = pedalAxisMap[role]
      const base = calBaselineAxes![idx]
      const dir = calStepDirs![idx] ?? 0
      const cur = axes[idx]
      const maxEng = calStepMaxEng?.[idx] ?? 0
      if (base == null || cur == null) continue
      const live = calFor(idx)
      if (live.floorLocked) {
        values[idx] = normalizePedalSample(cur, live)
        continue
      }
      if (!dir || maxEng < 400) {
        values[idx] = 0
        live.lastEngagement = 0
        live.position = 0
        continue
      }
      live.rest = base
      live.dir = dir
      live.dirKnown = true
      live.primed = true
      live.floorLocked = false
      if (!live.hasLastRaw) resetUnwrap(live, base)
      normalizePedalSample(cur, live)
      if (live.lastEngagement > (calStepMaxEng?.[idx] ?? 0) && calStepMaxEng) {
        calStepMaxEng[idx] = live.lastEngagement
        if (calStepExtremes) calStepExtremes[idx] = cur
      }
      // Absolute depth vs provisional full (~64k). Relative denom made every light
      // tap look like 100% while Remember still required real travel.
      const eng = live.lastEngagement
      values[idx] = scaleTravel(eng, PEDAL_PROVISIONAL_FULL, 0.99)
    }
  }

  return {
    steering: Math.max(0, Math.min(1, axes[0]! / AXIS_MAX)),
    throttle: values[pedalAxisMap.throttle] ?? 0,
    brake: values[pedalAxisMap.brake] ?? 0,
    clutch: values[pedalAxisMap.clutch] ?? 0,
    rawAxes: axes.slice(0, 8),
  }
}

function emitStatus(status: MozaHardwareStatus) {
  lastStatus = status
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('moza:status', status)
  }
}

function emitSample(sample: MozaLiveSample) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('moza:sample', sample)
  }
}

/** Physical wheel degrees (Pit House–style), no GTA mapping curves. */
function mapPhysicalSteering(rawAxis: number): number {
  const wheelAngle = resolveWheelAngleDeg()
  const half = wheelAngle / 2
  const x = (rawAxis - 0.5) * 2 // -1..1 from HID
  let deg = x * half
  if (deg > half) deg = half
  if (deg < -half) deg = -half
  // Match Pit House display precision (tenths)
  return Math.round(deg * 10) / 10
}

/**
 * Wheel angle from the app/Moza sync — NOT a hardcoded 900.
 * Priority: live Pit House/CoAP → profile steering → 900 fallback.
 */
function resolveWheelAngleDeg(): number {
  const fromLive = liveWheelAngleDeg
  const fromProfile = steering?.wheelAngle
  const v =
    typeof fromLive === 'number' && fromLive > 0
      ? fromLive
      : typeof fromProfile === 'number' && fromProfile > 0
        ? fromProfile
        : 900
  return Math.max(90, Math.min(2700, v))
}

/**
 * Physical degrees that map to full in-game steering lock = resolveWheelAngleDeg().
 * Moza HID is scaled to that firmware limit, so ±1 HID = ±(angle/2) real degrees.
 */
function gameSteerLockDeg(): number {
  return resolveWheelAngleDeg()
}

/**
 * GTA steer axis (−1..1) over the current Moza/app wheel angle.
 * Change Pit House 900→1080 → sync updates liveWheelAngleDeg → same HID ends
 * now mean more physical degrees (base firmware), and UI/GTA stay in lockstep.
 */
function mapEtsGtaSteerAxis(rawAxis: number): number {
  const s = steering
  const wheelAngle = resolveWheelAngleDeg()
  const halfLock = wheelAngle / 2

  // HID ±1 spans the current Moza limit (900, 1080, …)
  let x = (rawAxis - 0.5) * 2
  x = Math.max(-1, Math.min(1, x))

  const offset = halfLock > 0 ? (s?.centerOffset ?? 0) / halfLock : 0
  x = Math.max(-1, Math.min(1, x + offset))

  // Profile deadzone (percent of half-lock), then re-expand to full range
  const dead = Math.max(0, Math.min(0.2, (s?.deadzone ?? 1) / 100))
  const ax0 = Math.abs(x)
  if (ax0 <= dead) return 0
  x = Math.sign(x) * ((ax0 - dead) / (1 - dead))

  // 50 = 1:1 with Moza angle; >50 reaches in-game lock before the rim
  const sens = Math.max(0.35, (s?.sensitivity ?? 50) / 50)
  x = Math.max(-1, Math.min(1, x * sens))

  // gamma < 1 = more response near center (GTA ignores tiny SteeringAngle otherwise —
  // felt like “nothing until a certain rim angle, then it bites”).
  // UI 50 → gamma 0.55; lower linearity → even quicker center; >50 → closer to linear.
  const linUi = (s?.linearity ?? 35) / 50
  const gamma = Math.min(1.05, Math.max(0.42, 0.42 + linUi * 0.4))
  x = Math.sign(x) * Math.pow(Math.abs(x), gamma)

  const sat = (s?.saturation ?? 100) / 100
  x = Math.max(-1, Math.min(1, x * sat))

  if (Math.abs(x) < 0.0008) return 0
  // Moza HID / DI X: +raw was turning the car the wrong way in Story Mode
  return -x
}

/** GTA input mapping in degrees (UI / FFB helpers). */
function mapGameSteering(rawAxis: number): number {
  return mapEtsGtaSteerAxis(rawAxis) * (resolveWheelAngleDeg() / 2)
}

/** @deprecated alias — prefer mapPhysicalSteering / mapGameSteering */
function mapSteering(rawAxis: number): number {
  return mapPhysicalSteering(rawAxis)
}

function torqueProxy(steeringAngle: number): number {
  if (!ffb?.enabled) return 0
  const maxT = ffb.maximumTorque ?? 5.5
  const overall = (ffb.overallStrength ?? 70) / 100
  const sat = (ffb.selfAligningTorque ?? 60) / 100
  const angleNorm = Math.min(1, Math.abs(steeringAngle) / (resolveWheelAngleDeg() / 2))
  return maxT * overall * sat * angleNorm * 0.35
}

function closeDevice() {
  if (device) {
    try {
      device.removeAllListeners('data')
      device.removeAllListeners('error')
      device.close()
    } catch {
      // ignore
    }
  }
  device = null
  openPath = null
}

function openBestDevice(): MozaHardwareStatus {
  const now = Date.now()
  // Already streaming HID — skip USB re-enumeration (sync and expensive).
  if (device && openPath && now - lastReportAt < 2500) {
    return lastStatus.connected
      ? lastStatus
      : { ...lastStatus, connected: true, path: openPath }
  }
  // FFB host Exclusive owns the rim — axis arrives via UDP; don't hammer HID open.
  if (!device && now - lastFfbAxisAt < 800) {
    return {
      ...lastStatus,
      connected: true,
      firmware: lastStatus.firmware || 'FFB host axis',
    }
  }
  if (!device && now < hidOpenBackoffUntil) {
    return lastStatus
  }
  // Throttle full HID device list scans
  if (device && openPath && now - lastHidEnumAt < HID_ENUM_MIN_MS) {
    return lastStatus
  }

  const api = getHid()
  lastHidEnumAt = now
  const devices = api.devices().filter(
    (d) => d.vendorId === MOZA_VID && typeof d.productId === 'number',
  )

  const preferred =
    devices.find((d) => d.usagePage === 1 && (d.usage === 4 || d.usage === 5)) ??
    devices.find((d) => (d.product || '').toLowerCase().includes('base')) ??
    devices[0]

  if (!preferred?.path) {
    closeDevice()
    return { connected: false, name: 'MOZA R5', model: 'R5' }
  }

  const info = resolveMozaBase(preferred.productId!) ?? {
    pid: preferred.productId!,
    model: 'MOZA',
    name: preferred.product || 'MOZA Wheel Base',
    maxTorqueNm: 5.5,
  }

  if (openPath !== preferred.path) {
    closeDevice()
    resetPedalCalibration()
    // Re-apply saved floors after reconnect.
    applyFloorPoint(pedalFloors.throttle)
    applyFloorPoint(pedalFloors.brake)
    applyFloorPoint(pedalFloors.clutch)
    try {
      device = new api.HID(preferred.path)
      openPath = preferred.path
      hidOpenBackoffUntil = 0
      device.on('data', (data) => {
        const parsed = parseReport(data as Buffer)
        if (!parsed) return
        lastRawAxis = parsed.steering
        lastThrottle = parsed.throttle
        lastBrake = parsed.brake
        lastClutch = parsed.clutch
        lastRawAxes = parsed.rawAxes
        updatePaddleIndicators(parsed.rawAxes)
        lastReportAt = Date.now()
        // Lowest-latency path: don't wait for the 16ms UI sample timer
        flushGtaControlsNow()
      })
      device.on('error', () => {
        closeDevice()
        hidOpenBackoffUntil = Date.now() + HID_OPEN_BACKOFF_MS
        emitStatus({ connected: false, name: info.name, model: info.model })
      })
    } catch (error) {
      console.error('[moza] open failed', error)
      closeDevice()
      hidOpenBackoffUntil = Date.now() + HID_OPEN_BACKOFF_MS
      return {
        connected: true,
        name: info.name,
        model: info.model,
        productId: info.pid,
        serialNumber: preferred.serialNumber,
        maxTorqueNm: info.maxTorqueNm,
        path: preferred.path,
        firmware: 'HID present (input busy)',
      }
    }
  }

  return {
    connected: true,
    name: preferred.product || info.name,
    model: info.model,
    productId: info.pid,
    serialNumber: preferred.serialNumber,
    maxTorqueNm: info.maxTorqueNm,
    path: preferred.path,
    firmware: preferred.release != null ? String(preferred.release) : undefined,
  }
}

function pushLiveSample() {
  // Prefer live HID; if Exclusive FFB host owns the device, use its axis feed
  const hidLive = lastStatus.connected && Date.now() - lastReportAt < 1500
  const ffbAxisLive = Date.now() - lastFfbAxisAt < 200
  const connected = hidLive || ffbAxisLive || lastStatus.connected
  const targetAngle = connected ? mapPhysicalSteering(lastRawAxis) : 0
  // Mild smoothing — heavy filtering lagged Pit House by ~1–2°.
  smoothSteeringAngle =
    smoothSteeringAngle + (targetAngle - smoothSteeringAngle) * STEER_SMOOTH
  if (!connected) smoothSteeringAngle = 0
  const steeringAngle = Math.round(smoothSteeringAngle * 10) / 10
  let torque = connected ? torqueProxy(mapGameSteering(lastRawAxis)) : 0

  if (testActive && connected && ffb?.enabled !== false) {
    const t = (Date.now() - testStartedAt) / 1000
    const amp = ((testStrength / 100) * (ffb?.overallStrength ?? 70)) / 100
    const maxT = ffb?.maximumTorque ?? lastStatus.maxTorqueNm ?? 5.5
    switch (testMode) {
      case 'constant':
        torque = maxT * amp * 0.45
        break
      case 'sine':
        torque = maxT * amp * 0.45 * Math.sin(t * Math.PI * 2)
        break
      case 'spring':
        torque = -steeringAngle * 0.02 * amp * maxT
        break
      case 'damper':
        torque = maxT * amp * 0.2 * Math.sin(t * 8)
        break
      case 'pulse':
        torque = Math.floor(t * 4) % 2 === 0 ? maxT * amp * 0.5 : 0
        break
    }
  }

  const serial = getSerialPedals()
  const useSerial = Boolean(serial)
  const throttle = connected ? (useSerial ? serial!.throttle : lastThrottle) : 0
  const brake = connected ? (useSerial ? serial!.brake : lastBrake) : 0
  const clutch = connected ? (useSerial ? serial!.clutch : lastClutch) : 0
  emitSample({
    timestamp: Date.now(),
    rawAxis: lastRawAxis,
    steeringAngle,
    torque: Math.round(torque * 100) / 100,
    throttle,
    brake,
    clutch,
    ...pedalRaws(),
    rawAxes: lastRawAxes,
    connected: Boolean(connected || lastStatus.connected),
  })

  if (connected || ffbAxisLive) flushGtaControlsNow()
}

/** Send mapped wheel/pedals to the GTA plugin immediately (UDP). */
function flushGtaControlsNow() {
  const hidLive = lastStatus.connected && Date.now() - lastReportAt < 1500
  const ffbAxisLive = Date.now() - lastFfbAxisAt < 200
  if (!hidLive && !ffbAxisLive && !lastStatus.connected) return
  const serial = getSerialPedals()
  const useSerial = Boolean(serial)
  sendGtaControls({
    steer: mapEtsGtaSteerAxis(lastRawAxis),
    throttle: useSerial ? serial!.throttle : lastThrottle,
    brake: useSerial ? serial!.brake : lastBrake,
    clutch: useSerial ? serial!.clutch : lastClutch,
    wheelAngle: resolveWheelAngleDeg(),
    indL: indicatorLeft,
    indR: indicatorRight,
  })
}

/**
 * Soft-lock / gain related output via HID feature reports is vendor-specific.
 * We keep an output path ready; for now we primarily drive UI + mapping.
 * When Pit House exclusive lock blocks HID open, status still reports connected.
 */
function applyOutputGains() {
  if (!device || !ffb) return
  // Placeholder for future MOZA vendor feature reports / SDK.
  // Intentionally no unknown HID writes — avoid unsafe vendor packets.
}

export function setMozaProfileSettings(next: {
  steering: SteeringSettings
  ffb: FfbSettings
}) {
  steering = next.steering
  ffb = next.ffb
  if (typeof next.steering?.wheelAngle === 'number' && next.steering.wheelAngle > 0) {
    liveWheelAngleDeg = Math.max(90, Math.min(2700, next.steering.wheelAngle))
  }
  applyOutputGains()
}

export function setMozaPedalAxisMap(map: PedalAxisMap) {
  pedalAxisMap = {
    throttle: map.throttle,
    brake: map.brake,
    clutch: map.clutch,
  }
  return pedalAxisMap
}

export function getMozaPedalAxisMap() {
  return pedalAxisMap
}

export function setMozaPedalFloors(floors: PedalFloors) {
  pedalFloors = {
    throttle: floors.throttle,
    brake: floors.brake,
    clutch: floors.clutch,
  }
  resetPedalCalibration()
  for (const role of ['throttle', 'brake', 'clutch'] as const) {
    const p = pedalFloors[role]
    if (!p) continue
    const saved = p.maxTravel ?? 0
    if (
      saved >= 65_000 ||
      (Math.abs(p.extreme - p.rest) < 800 && saved < PEDAL_LOCK_MIN_TRAVEL)
    ) {
      console.warn('[moza] dropping corrupt saved floor', role, p)
      pedalFloors = { ...pedalFloors, [role]: null }
      if (role === 'clutch') {
        pedalAxisMap = { ...pedalAxisMap, clutch: DEFAULT_PEDAL_AXIS_MAP.clutch }
      }
      continue
    }
    applyFloorPoint(p)
    pedalAxisMap[role] = p.axis
  }
  return pedalFloors
}

export function getMozaPedalFloors() {
  return pedalFloors
}

/** Call when entering a calibrate step — snapshot rest axes and start peak tracking. */
export function beginMozaPedalCalStep() {
  calBaselineAxes = lastRawAxes.length ? [...lastRawAxes] : null
  calStepMins = lastRawAxes.length ? [...lastRawAxes] : null
  calStepMaxs = lastRawAxes.length ? [...lastRawAxes] : null
  calStepDirs = lastRawAxes.length ? lastRawAxes.map(() => 0 as 0 | 1 | -1) : null
  calStepExtremes = lastRawAxes.length ? [...lastRawAxes] : null
  calStepUnwrap = lastRawAxes.length ? [...lastRawAxes] : null
  calStepLastRaw = lastRawAxes.length ? [...lastRawAxes] : null
  calStepMaxEng = lastRawAxes.length ? lastRawAxes.map(() => 0) : null
  // Reset unwrap on mapped pedals so this step starts from rest.
  if (calBaselineAxes) {
    for (const role of ['throttle', 'brake', 'clutch'] as const) {
      const idx = pedalAxisMap[role]
      const cal = calFor(idx)
      const raw = lastRawAxes[idx]
      if (cal.floorLocked) {
        if (raw == null || Math.abs(raw - cal.rest) < PEDAL_ARM) {
          snapToRest(cal, raw ?? cal.rest)
        }
        continue
      }
      cal.rest = calBaselineAxes[idx] ?? cal.rest
      cal.dirKnown = false
      cal.maxTravel = 0
      resetUnwrap(cal, cal.rest)
      cal.position = 0
      cal.lastEngagement = 0
    }
  }

  return { ok: true, baseline: calBaselineAxes }
}

/** Leave calibrate mode: keep locked floors, meters follow live HID from rest. */
export function endMozaPedalCalStep() {
  calBaselineAxes = null
  calStepMins = null
  calStepMaxs = null
  calStepDirs = null
  calStepExtremes = null
  calStepUnwrap = null
  calStepLastRaw = null
  calStepMaxEng = null
  setMozaPedalFloors(pedalFloors)

  return { ok: true, floors: pedalFloors, axisMap: pedalAxisMap }
}

function peakDelta(axis: number): number {
  if (!calBaselineAxes || !calStepDirs) return 0
  if (calStepMaxEng && calStepMaxEng[axis] != null) {
    return calStepMaxEng[axis]!
  }
  if (!calStepMins || !calStepMaxs) return 0
  const base = calBaselineAxes[axis]
  const minRaw = calStepMins[axis]
  const maxRaw = calStepMaxs[axis]
  const dir = calStepDirs[axis]
  if (base == null || minRaw == null || maxRaw == null || dir == null) return 0
  return firstDirPeak(base, minRaw, maxRaw, dir)?.travel ?? 0
}

function findBestAxisForRole(
  role: 'throttle' | 'brake' | 'clutch',
  used: Set<number>,
): { axis: number; delta: number } | null {
  if (!calBaselineAxes?.length || !calStepMins?.length || !calStepMaxs?.length) return null

  const preferred = DEFAULT_PEDAL_AXIS_MAP[role]
  const mapped = pedalAxisMap[role]
  const preferredDelta = peakDelta(preferred)
  const mappedDelta = mapped === preferred ? preferredDelta : peakDelta(mapped)

  // Stick to R5 defaults (Z / RZ / Throttle). Axis 1 = Y clutch paddles — not foot.
  if (preferredDelta >= PEDAL_LOCK_MIN_TRAVEL) {
    return { axis: preferred, delta: preferredDelta }
  }
  if (mapped !== preferred && mappedDelta >= PEDAL_LOCK_MIN_TRAVEL) {
    return { axis: mapped, delta: mappedDelta }
  }

  let best: { axis: number; delta: number } | null = null
  for (let i = 2; i < Math.min(8, calStepMins.length); i++) {
    if (used.has(i) && i !== mapped) continue
    const delta = peakDelta(i)
    if (!best || delta > best.delta) best = { axis: i, delta }
  }
  if (!best || best.delta < PEDAL_LOCK_MIN_TRAVEL) return null
  // Remap only when the preferred axis barely moved.
  if (Math.max(preferredDelta, mappedDelta) > best.delta - 5_000) {
    const axis = mappedDelta >= preferredDelta ? mapped : preferred
    const delta = Math.max(preferredDelta, mappedDelta)
    return delta > 0 ? { axis, delta } : best
  }
  return best
}

/**
 * Lock CURRENT press depth as 100% (shortens pedal travel).
 * Not the historical peak of the whole step — whatever the foot is at
 * when the user clicks Remember becomes full scale.
 */
export function lockMozaPedalFloor(role: 'throttle' | 'brake' | 'clutch'): {
  ok: boolean
  reason?: string
  floors: PedalFloors
  axisMap: PedalAxisMap
} {
  if (
    !calBaselineAxes?.length ||
    !calStepMins?.length ||
    !calStepMaxs?.length ||
    !calStepDirs?.length
  ) {
    beginMozaPedalCalStep()
    return {
      ok: false,
      reason: 'not-pressed',
      floors: pedalFloors,
      axisMap: pedalAxisMap,
    }
  }

  const used = new Set<number>()
  for (const r of ['throttle', 'brake', 'clutch'] as const) {
    if (r === role) continue
    const f = pedalFloors[r]
    if (f) used.add(f.axis)
    else used.add(pedalAxisMap[r])
  }

  const detected = findBestAxisForRole(role, used)
  const axis = detected?.axis ?? DEFAULT_PEDAL_AXIS_MAP[role]

  const rest = calBaselineAxes[axis]
  const dirArmed = calStepDirs[axis] ?? 0
  const liveRaw = lastRawAxes[axis]
  if (rest == null || liveRaw == null) {
    return {
      ok: false,
      reason: 'no-axis',
      floors: pedalFloors,
      axisMap: pedalAxisMap,
    }
  }

  const dir = (dirArmed || 0) as 0 | 1 | -1
  if (!dir) {
    return {
      ok: false,
      reason: 'not-pressed',
      floors: pedalFloors,
      axisMap: pedalAxisMap,
    }
  }

  // Live depth = unwrap / cal engagement (matches the meter). directedTravel
  // alone is ~0 after uint16 wrap even on a full press — do not require it.
  const unwrapNow = calStepUnwrap?.[axis]
  const fromUnwrap =
    unwrapNow != null
      ? dir > 0
        ? Math.max(0, unwrapNow - rest)
        : Math.max(0, rest - unwrapNow)
      : 0
  const cal = calFor(axis)
  const fromLive = Math.max(cal.lastEngagement, cal.position)
  const fromDirect = directedTravel(liveRaw, rest, dir)
  // Current depth only (not step peak) — Remember locks what you hold now.
  const travel = Math.max(fromUnwrap, fromLive, fromDirect)

  if (travel < PEDAL_LOCK_MIN_TRAVEL) {
    return {
      ok: false,
      reason: 'not-pressed',
      floors: pedalFloors,
      axisMap: pedalAxisMap,
    }
  }

  const extreme = liveRaw
  const maxTravel = Math.min(64_000, Math.round(travel))
  applyFloorToCal(cal, { rest, extreme, dir, maxTravel })
  seedFloorEngagement(cal, maxTravel, liveRaw)

  const point: PedalFloorPoint = {
    axis,
    rest,
    extreme,
    dir,
    maxTravel,
  }
  pedalAxisMap[role] = axis
  pedalFloors = { ...pedalFloors, [role]: point }
  if (calStepExtremes && axis < calStepExtremes.length) calStepExtremes[axis] = extreme

  return { ok: true, floors: pedalFloors, axisMap: pedalAxisMap }
}

export function startMozaFfbTest(req: MozaFfbTestRequest) {
  if (testTimer) clearTimeout(testTimer)
  testActive = true
  testMode = req.mode
  testStrength = req.strength
  testStartedAt = Date.now()
  testTimer = setTimeout(() => {
    testActive = false
    testTimer = null
  }, 4000)
  return { active: true, mode: testMode, strength: testStrength }
}

export function stopMozaFfbTest() {
  if (testTimer) clearTimeout(testTimer)
  testTimer = null
  testActive = false
  return { active: false, mode: testMode, strength: testStrength }
}

export function getMozaFfbTestState() {
  return { active: testActive, mode: testMode, strength: testStrength }
}

export function getMozaStatus() {
  return lastStatus
}

export function getMozaSerialStatus() {
  return getSerialStatus()
}

export function getMozaBaseSync(): MozaBaseSync | null {
  return getSerialBaseSync()
}

export function onMozaBaseSync(cb: ((sync: MozaBaseSync) => void) | null) {
  onSerialBaseSync(cb)
}

export function initMozaBridge() {
  ipcMain.handle('moza:getStatus', () => lastStatus)
  ipcMain.handle('moza:getSample', () => {
    const connected = lastStatus.connected
    const serial = getSerialPedals()
    return {
      timestamp: Date.now(),
      rawAxis: lastRawAxis,
      steeringAngle: connected ? mapPhysicalSteering(lastRawAxis) : 0,
      torque: connected ? torqueProxy(mapGameSteering(lastRawAxis)) : 0,
      throttle: connected ? (serial ? serial.throttle : lastThrottle) : 0,
      brake: connected ? (serial ? serial.brake : lastBrake) : 0,
      clutch: connected ? (serial ? serial.clutch : lastClutch) : 0,
      ...pedalRaws(),
      rawAxes: lastRawAxes,
      connected,
    } satisfies MozaLiveSample
  })
  ipcMain.handle('moza:getBaseSync', () => getSerialBaseSync())
  ipcMain.handle('moza:getSerialStatus', () => getSerialStatus())
  ipcMain.handle('moza:refreshBaseSync', async () => {
    const sync = await syncBaseSettings()
    return {
      status: getSerialStatus(),
      sync,
    }
  })
  ipcMain.handle('moza:setProfileSettings', (_e, payload: {
    steering: SteeringSettings
    ffb: FfbSettings
    effects?: EffectsSettings
  }) => {
    setMozaProfileSettings(payload)
    // Live-apply Game FFB sliders (effects + centering) without waiting for Save
    setGtaFfbContext({
      ffb: payload.ffb,
      effects: payload.effects,
    })
    setFfbHostEnabled(payload.ffb?.enabled !== false)
    return true
  })
  ipcMain.handle('moza:setPedalAxisMap', (_e, map: PedalAxisMap) =>
    setMozaPedalAxisMap(map),
  )
  ipcMain.handle('moza:getPedalAxisMap', () => getMozaPedalAxisMap())
  ipcMain.handle('moza:setPedalFloors', (_e, floors: PedalFloors) =>
    setMozaPedalFloors(floors),
  )
  ipcMain.handle('moza:getPedalFloors', () => getMozaPedalFloors())
  ipcMain.handle('moza:beginPedalCalStep', () => beginMozaPedalCalStep())
  ipcMain.handle('moza:endPedalCalStep', () => endMozaPedalCalStep())
  ipcMain.handle(
    'moza:lockPedalFloor',
    (_e, role: 'throttle' | 'brake' | 'clutch') => lockMozaPedalFloor(role),
  )
  ipcMain.handle('moza:startFfbTest', (_e, req: MozaFfbTestRequest) =>
    startMozaFfbTest(req),
  )
  ipcMain.handle('moza:stopFfbTest', () => stopMozaFfbTest())
  ipcMain.handle('moza:getFfbTestState', () => getMozaFfbTestState())

  onSerialBaseSync((sync) => {
    // Apply Moza angle in the main process immediately (don't wait for React)
    const deg = sync.raw?.wheelAngleDeg ?? sync.steering?.wheelAngle
    if (typeof deg === 'number' && deg > 0) {
      liveWheelAngleDeg = Math.max(90, Math.min(2700, deg))
      if (steering) {
        steering = { ...steering, wheelAngle: liveWheelAngleDeg }
      }
    }
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('moza:baseSync', sync)
    }
  })

  const tick = () => {
    try {
      const status = openBestDevice()
      if (status.maxTorqueNm) setSerialMaxTorqueHint(status.maxTorqueNm)
      if (
        status.connected !== lastStatus.connected ||
        status.path !== lastStatus.path ||
        status.name !== lastStatus.name ||
        status.firmware !== lastStatus.firmware
      ) {
        emitStatus(status)
      } else {
        lastStatus = status
      }
      const now = Date.now()
      if (now - lastBasePollAt >= BASE_SETTINGS_POLL_MS) {
        lastBasePollAt = now
        void tickBaseSettingsPoll()
      }
    } catch (error) {
      console.error('[moza] poll failed', error)
      closeDevice()
      hidOpenBackoffUntil = Date.now() + HID_OPEN_BACKOFF_MS
      emitStatus({ connected: false, name: 'MOZA R5', model: 'R5' })
    }
  }

  tick()
  // Device presence only — heavy CoAP/netstat is on its own slower cadence
  pollTimer = setInterval(tick, 4000)
  // UI samples ~10 Hz (controls still flush on HID/FFB-axis events)
  sampleTimer = setInterval(pushLiveSample, 100)

  // Axis from Exclusive FFB host (when node-hid can't open the wheel)
  try {
    ffbAxisSocket = dgram.createSocket('udp4')
    ffbAxisSocket.on('message', (msg) => {
      try {
        const j = JSON.parse(msg.toString('utf8')) as {
          steer?: number
          y?: number
          z?: number
          rz?: number
          s0?: number
          left?: number
          right?: number
          btns?: number
          padL?: number
          padR?: number
        }
        const hidLive = Boolean(device) && Date.now() - lastReportAt < 400
        // Paddles from FFB-host (Exclusive blocks HID).
        // 1) Button bitmask — shift paddles / Pit House "Button" mode (auto-learn L/R)
        // 2) Axis L/R — combined/independent clutch paddles
        let paddleChanged = false
        if (typeof j.btns === 'number') {
          paddleChanged = updatePaddleFromBtnMask(j.btns) || paddleChanged
        }
        const leftT = typeof j.left === 'number' ? j.left : 0
        const rightT = typeof j.right === 'number' ? j.right : 0
        const yAbs = Math.abs(typeof j.y === 'number' ? j.y : 0)
        const axisActive =
          leftT > PADDLE_NORM_DEAD ||
          rightT > PADDLE_NORM_DEAD ||
          yAbs > PADDLE_NORM_DEAD
        if (axisActive) {
          if (leftT > 0.02 || rightT > 0.02) {
            paddleChanged = updatePaddleFromSides(leftT, rightT) || paddleChanged
          } else if (typeof j.y === 'number') {
            paddleChanged = updatePaddleFromNorm(j.y) || paddleChanged
          }
        } else {
          const candidates = [j.z, j.rz, j.s0].filter(
            (v): v is number => typeof v === 'number' && Number.isFinite(v),
          )
          let best = 0
          for (const c of candidates) {
            if (Math.abs(c) > Math.abs(best)) best = c
          }
          if (Math.abs(best) > PADDLE_NORM_DEAD) {
            paddleChanged = updatePaddleFromNorm(best) || paddleChanged
          }
        }

        if (typeof j.steer === 'number' && !Number.isNaN(j.steer) && !hidLive) {
          const s = Math.max(-1, Math.min(1, j.steer))
          lastRawAxis = (s + 1) / 2
          lastFfbAxisAt = Date.now()
          if (!lastStatus.connected) {
            lastStatus = {
              ...lastStatus,
              connected: true,
              name: lastStatus.name || 'MOZA R5 Base',
              model: lastStatus.model || 'R5',
              firmware: 'FFB host axis',
            }
          }
          flushGtaControlsNow()
        } else if (paddleChanged) {
          lastFfbAxisAt = Date.now()
          flushGtaControlsNow()
        }
      } catch {
        /* ignore */
      }
    })
    ffbAxisSocket.on('error', (err) => {
      console.warn('[moza] ffb-axis udp', err.message)
    })
    ffbAxisSocket.bind(FFB_AXIS_PORT, '127.0.0.1')
  } catch (err) {
    console.warn('[moza] ffb-axis bind failed', err)
  }
}

export function disposeMozaBridge() {
  if (pollTimer) clearInterval(pollTimer)
  if (sampleTimer) clearInterval(sampleTimer)
  if (testTimer) clearTimeout(testTimer)
  try {
    ffbAxisSocket?.close()
  } catch {
    /* ignore */
  }
  ffbAxisSocket = null
  disposeSerialPedals()
  closeDevice()
}
