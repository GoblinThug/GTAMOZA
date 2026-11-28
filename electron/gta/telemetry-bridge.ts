/**
 * GTA Story Mode telemetry (UDP 29755) → live sample + FFB commands (UDP 29756).
 */
import dgram from 'node:dgram'
import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { app, BrowserWindow } from 'electron'
import { sleepSync } from '../win-sleep'
import type { EffectsSettings, FfbSettings } from '../../shared/types'
import {
  closeFfbEffectLog,
  getFfbEffectLogPath,
  logFfbSample,
  logFfbSettings,
  type FfbEffectParts,
} from './ffb-effect-log'

export type GtaTelemetry = {
  v: number
  t: number
  inVehicle: boolean
  speed: number
  rpm: number
  gear: number
  steer: number
  throttle: number
  brake: number
  lateral: number
  yawRate: number
  wheelSlip: number
  collision: number
  /** 0 soft (bush/ped) … 1 hard (concrete/metal/building) */
  colHard?: number
  /** Vertical / suspension bump 0..1 */
  bump?: number
  surface: string
  vehicle: string
  /** v2: dashboard wheel speed (m/s) for real slip */
  wheelSpeed?: number
  /** v2: forward / lateral body accel (m/s²-ish) */
  accelFwd?: number
  accelLat?: number
  /** v2: local angular rates */
  pitchRate?: number
  rollRate?: number
  /** v2: car not on all wheels */
  airborne?: boolean
  /** v2: count of wheels touching surface */
  wheelsDown?: number
  /** v2: normalized tire temp 0..1 */
  tireHeat?: number
  /** v2: left / right surface class */
  surfL?: string
  surfR?: string
  /** v2: mid material hash (number) */
  matId?: number
}

export type GtaLinkStatus = {
  connected: boolean
  lastAt: number | null
  inVehicle: boolean
  vehicle: string
  speedKmh: number
  ffbHostRunning: boolean
  /** GTA5_Enhanced.exe is running (Story/hooks may still be unloaded). */
  gameRunning: boolean
  /** Game is up but no fresh plugin telemetry — Script Hook / plugin not live. */
  pluginMissing: boolean
  /** UDP 29755 could not be bound (another GTAMOZA instance). */
  telemetryPortBusy: boolean
}

const TELEMETRY_PORT = 29755
const FFB_CMD_PORT = 29756
const CONTROL_PORT = 29757
const STALE_MS = 1500

let socket: dgram.Socket | null = null
let controlSocket: dgram.Socket | null = null
let lastTelemetry: GtaTelemetry | null = null
let lastAt = 0
let ffbProc: ChildProcess | null = null
let ffbSettings: FfbSettings | null = null
let effects: EffectsSettings | null = null
let cmdSocket: dgram.Socket | null = null
let tickTimer: NodeJS.Timeout | null = null
/** When false, FFB host is not auto-started (avoids stealing the wheel from the game). */
let ffbHostEnabled = false
let lastMagLogAt = 0
let lastLoggedMag = 0
let ffbStopRequested = false
let ffbRestartTimer: NodeJS.Timeout | null = null
let ffbRestartAttempts = 0
let magSm = 0
let tireSm = 0
let bumpSm = 0
let slipSm = 0
let collisionSm = 0
let collisionImpulse = 0
let prevCollisionTel = 0
/** Sticky collision shove direction — prevents L/R yank when latAccel flips. */
let collisionDir = 1
let latLoadSm = 0
let prevDiMag = 0
/** Distance-coupled road texture phases (Forza-style multi-band grain). */
let roadPhase = 0
let roadPhase2 = 0
let roadPhase3 = 0
let roadPhase4 = 0
/** Rising-edge bump / kerb strike impulse (attack → decay). */
let bumpImpulse = 0
let prevBumpRaw = 0
let prevSurfKind = ''
/** Smoothed brake for FFB only — kills the rim yank on pedal bite. */
let brakeFeelSm = 0
let dampCmdSm = 0

let lastStatusEmitAt = 0
let lastTelemetryEmitAt = 0
let telemetryPortBusy = false
let telemetryBindAttempts = 0
const STATUS_EMIT_MS = 1000
const TELEMETRY_EMIT_MS = 50

function emitStatus(force = false) {
  const now = Date.now()
  if (!force && now - lastStatusEmitAt < STATUS_EMIT_MS) return
  lastStatusEmitAt = now
  const status = getGtaLinkStatus()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('gta:link', status)
  }
}

function emitTelemetry(sample: GtaTelemetry) {
  const now = Date.now()
  if (now - lastTelemetryEmitAt < TELEMETRY_EMIT_MS) return
  lastTelemetryEmitAt = now
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('gta:telemetry', sample)
  }
}

export function getGtaLinkStatus(): GtaLinkStatus {
  const connected = Boolean(lastAt && Date.now() - lastAt < STALE_MS)
  // Lazy require avoids circular init with mod-manager at module load.
  let gameRunning = false
  try {
    gameRunning = (
      require('./mod-manager') as typeof import('./mod-manager')
    ).isGtaProcessRunning()
  } catch {
    gameRunning = false
  }
  return {
    connected,
    lastAt: lastAt || null,
    inVehicle: connected ? Boolean(lastTelemetry?.inVehicle) : false,
    vehicle: connected ? (lastTelemetry?.vehicle ?? '') : '',
    speedKmh: connected && lastTelemetry ? Math.round(lastTelemetry.speed * 3.6) : 0,
    ffbHostRunning: Boolean(ffbProc && !ffbProc.killed),
    gameRunning,
    pluginMissing: gameRunning && !connected,
    telemetryPortBusy,
  }
}

export function getLastGtaTelemetry(): GtaTelemetry | null {
  if (!lastAt || Date.now() - lastAt >= STALE_MS) return null
  return lastTelemetry
}

export function setGtaFfbContext(next: {
  ffb?: FfbSettings | null
  effects?: EffectsSettings | null
}) {
  if (next.ffb !== undefined) ffbSettings = next.ffb
  if (next.effects !== undefined) effects = next.effects
  if (ffbSettings || effects) logFfbSettings(ffbSettings, effects)
}

export function getFfbEffectLogFile(): string | null {
  return getFfbEffectLogPath()
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
}

function effectStrength(id: keyof EffectsSettings): number {
  const e = effects?.[id]
  if (!e || !e.enabled) return 0
  return clamp(e.strength / 100, 0, 1)
}

/** Rough class from GTA display name — sports get heavier SAT / spring. */
function vehicleFeel(name: string): { sat: number; spring: number; road: number; live: number } {
  const n = (name || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const sport = [
    'ADDER', 'ZENTORNO', 'T20', 'OSIRIS', 'ENTITY', 'TURISMO', 'COMET', 'ELEGY',
    'SULTAN', 'BANSHEE', 'NERO', 'TEMPESTA', 'VACCA', 'BULLET', 'CARBONIZZARE',
    'FELTZER', 'JESTER', 'MASSACRO', 'ITALI', 'TYRUS', 'REAPER', 'XA21', 'AUTARCH',
    'VAGNER', 'THRAX', 'EMERUS', 'KRIEGER', 'IGNUS', 'TORERO', 'COQUETTE', 'RAPIDGT',
    'NINEF', 'PARIAH', 'NEON', 'SCHLAGEN', 'DRAFTER', 'JUGULAR', 'GROWLER', 'FURIA',
    'ITALIGTO', 'ITALIRSX', 'COMET6', 'COMET7', 'CYCLONE', 'SC1', 'LOCUST', 'NEO',
    'PARAGON', 'SUGOI', 'KURUMA', 'BUFFALO', 'DOMINATOR', 'GAUNTLET', 'ELLIE',
  ]
  const offroad = [
    'BODHI', 'SANDKING', 'INSURGENT', 'REBEL', 'DUBSTA', 'MESA', 'RANCHER', 'BIFF',
    'SQUADDIE', 'DRAUGUR', 'PATRIOT', 'BALLER', 'CONTENDER',
  ]
  if (sport.some((h) => n.includes(h))) {
    return { sat: 1.18, spring: 1.14, road: 1.1, live: 1.08 }
  }
  if (offroad.some((h) => n.includes(h))) {
    return { sat: 0.92, spring: 1.0, road: 1.08, live: 0.95 }
  }
  return { sat: 1.05, spring: 1.06, road: 1.04, live: 1.0 }
}

/** Accept plugin v1 / v2 packets; fill safe defaults for missing v2 fields. */
function normalizeTelemetry(raw: unknown): GtaTelemetry | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const v = Number(o.v)
  if (v !== 1 && v !== 2) return null

  const num = (key: string, fallback = 0) => {
    const x = o[key]
    return typeof x === 'number' && Number.isFinite(x) ? x : fallback
  }
  const str = (key: string, fallback = '') => {
    const x = o[key]
    return typeof x === 'string' ? x : fallback
  }
  const bool = (key: string, fallback = false) => {
    const x = o[key]
    return typeof x === 'boolean' ? x : fallback
  }

  const accelLat = o.accelLat !== undefined ? num('accelLat') : num('lateral')
  return {
    v,
    t: num('t', Date.now()),
    inVehicle: bool('inVehicle'),
    speed: num('speed'),
    rpm: num('rpm'),
    gear: num('gear'),
    steer: num('steer'),
    throttle: num('throttle'),
    brake: num('brake'),
    lateral: num('lateral'),
    yawRate: num('yawRate'),
    wheelSlip: clamp(num('wheelSlip'), 0, 1),
    collision: clamp(num('collision'), 0, 1),
    colHard: clamp(num('colHard', 0.55), 0, 1),
    bump: clamp(num('bump'), 0, 1),
    surface: str('surface', 'asphalt'),
    vehicle: str('vehicle'),
    wheelSpeed: o.wheelSpeed !== undefined ? num('wheelSpeed') : undefined,
    accelFwd: o.accelFwd !== undefined ? num('accelFwd') : undefined,
    accelLat: o.accelLat !== undefined || o.lateral !== undefined ? accelLat : undefined,
    pitchRate: o.pitchRate !== undefined ? num('pitchRate') : undefined,
    rollRate: o.rollRate !== undefined ? num('rollRate') : undefined,
    airborne: o.airborne !== undefined ? bool('airborne') : undefined,
    wheelsDown: o.wheelsDown !== undefined ? Math.round(num('wheelsDown', 4)) : undefined,
    tireHeat: o.tireHeat !== undefined ? clamp(num('tireHeat'), 0, 1) : undefined,
    surfL: o.surfL !== undefined ? str('surfL', 'asphalt') : undefined,
    surfR: o.surfR !== undefined ? str('surfR', 'asphalt') : undefined,
    matId: o.matId !== undefined ? Math.round(num('matId')) : undefined,
  }
}

/** Material hash → subtle asphalt grain (0.85..1.2). Stable across frames. */
function matGrain(matId: number | undefined): number {
  if (matId === undefined || matId === 0) return 1
  const u = Math.abs(matId) % 97
  return 0.88 + (u / 96) * 0.28
}

function surfaceAmp(kind: string, speedF: number, feelRoad: number): number {
  if (kind === 'kerb') return (0.26 + speedF * 0.48) * effectStrength('kerb')
  if (kind === 'dirt')
    return (
      (0.16 + speedF * 0.28) *
      (effectStrength('grass') * 0.65 + effectStrength('road') * 0.3)
    )
  if (kind === 'grass') return (0.15 + speedF * 0.26) * effectStrength('grass')
  if (kind === 'sand') return (0.16 + speedF * 0.26) * effectStrength('grass')
  // Forza-busy asphalt grain — readable at cruise, still unsigned (no DC pull)
  return (0.055 + speedF * 0.095) * effectStrength('road') * feelRoad
}

/** Surface grip scalar for the tire model (asphalt ≈ 1, kerb lower traction / more grain). */
function surfaceGrip(kind: string): number {
  if (kind === 'kerb') return 0.72
  if (kind === 'dirt' || kind === 'sand') return 0.55
  if (kind === 'grass') return 0.48
  return 1
}

/** Map telemetry → game-effect magnitude (mechanical column lives in ffb-host). */
function computeMagnitude(t: GtaTelemetry): { mag: number; parts: FfbEffectParts } {
  const empty = (diMag: number): FfbEffectParts => ({
    suspensionLat: 0,
    suspensionYaw: 0,
    understeer: 0,
    surface: 0,
    bump: 0,
    wheelSlip: 0,
    collision: 0,
    engine: 0,
    abs: 0,
    rawSum: 0,
    scaled: 0,
    smoothed: magSm,
    diMag,
  })

  if (!ffbSettings || ffbSettings.enabled === false) {
    magSm = 0
    tireSm = 0
    prevDiMag = 0
    latLoadSm = 0
    bumpImpulse = 0
    prevBumpRaw = 0
    return { mag: 0, parts: empty(0) }
  }
  if (!t.inVehicle) {
    magSm *= 0.85
    tireSm *= 0.85
    brakeFeelSm *= 0.85
    dampCmdSm *= 0.85
    latLoadSm *= 0.85
    bumpImpulse *= 0.5
    prevBumpRaw = 0
    const diMag = Math.round(magSm * 10000)
    prevDiMag = diMag
    return { mag: diMag, parts: empty(diMag) }
  }

  const master = clamp(ffbSettings.overallStrength / 100, 0, 1)
  const smoothSet = clamp((ffbSettings.smoothing ?? 30) / 100, 0, 1)
  const speedF = clamp(t.speed / 28, 0, 1)
  const steer = clamp(t.steer, -1, 1)
  const feel = vehicleFeel(t.vehicle || '')
  const airborne = Boolean(t.airborne)
  const wheelsDown = t.wheelsDown ?? (airborne ? 2 : 4)
  const contactGate = airborne || wheelsDown < 2 ? 0 : clamp((wheelsDown - 1.5) / 2.5, 0.25, 1)
  const crawlGate = clamp((t.speed - 1.2) / 5.5, 0, 1) * contactGate
  const movingGate = clamp((t.speed - 0.45) / 1.8, 0, 1)

  const susp = effectStrength('suspension') * feel.sat
  const latAccel = t.accelLat !== undefined ? t.accelLat : t.lateral
  const latAbs = clamp(Math.abs(latAccel) / 14, 0, 1)
  const yawLoad = clamp(Math.abs(t.yawRate) / 2.4, 0, 1)
  const brakeRaw = clamp(t.brake ?? 0, 0, 1)
  // Soft brake attack — hard bite was yanking the rim sideways
  const brakeAtk = brakeRaw > brakeFeelSm ? 0.045 : 0.14
  brakeFeelSm += (brakeRaw - brakeFeelSm) * brakeAtk
  const brakeF = brakeFeelSm
  const throttle = clamp(t.throttle, 0, 1)
  const steerAbs = Math.abs(steer)
  const turnActivity = clamp(steerAbs * 1.35 + yawLoad * 0.85, 0, 1)
  /** Straight / mild-turn braking — mute lateral FFB artifacts (was yanking on brake bite). */
  const brakeStraight = brakeF > 0.18 && steerAbs < 0.28 && yawLoad < 0.42
  /** Any meaningful brake — kill signed lateral cues even if yaw noise is present. */
  const brakeMuteLat = brakeF > 0.22 && steerAbs < 0.45
  const latLoadIn =
    latAbs * clamp(turnActivity * 1.15 + (brakeMuteLat ? 0.05 : 0.35), 0, 1)
  latLoadSm += (latLoadIn - latLoadSm) * (latLoadIn > latLoadSm ? 0.08 : 0.16)
  if (brakeMuteLat && brakeF > 0.35) latLoadSm *= 0.88

  const surf = t.surface || 'asphalt'
  const plainRoad = surf === 'asphalt' || surf === 'none' || surf === 'concrete'
  const heat = clamp(t.tireHeat ?? 0, 0, 1)
  const slipRaw = clamp(t.wheelSlip, 0, 1)
  const slipIn = plainRoad && slipRaw < 0.08 ? 0 : slipRaw
  slipSm += (slipIn - slipSm) * 0.28

  // Tire model load only modulates host spring (sendFfbCommand). Do NOT send signed
  // ±steer Mz as game mag — ForcePolarity vs GTA invert made it yank INTO the turn.
  const tireLoadHint =
    crawlGate *
    (0.22 + 0.58 * speedF) *
    (1 + brakeF * 0.35 + throttle * 0.08) *
    (0.88 + 0.28 * latLoadSm) *
    (1 - slipSm * 0.35) *
    surfaceGrip(surf)
  tireSm += (tireLoadHint - tireSm) * (0.12 + (1 - smoothSet) * 0.1)
  const suspensionLat = 0
  const understeer = 0
  const suspensionYaw = 0

  const grain = plainRoad ? 0.92 + (matGrain(t.matId) - 1) * 0.35 : matGrain(t.matId)
  const dt = 1 / 60
  // Distance-coupled multi-band grain — pitch tracks road speed (Forza / sim style)
  const dist = Math.max(0, t.speed) * dt
  const matSeed = (Math.abs(t.matId ?? 0) % 97) / 96
  if (plainRoad) {
    roadPhase += dist * (0.42 + 0.08 * grain)
    roadPhase2 += dist * (1.35 + 0.25 * grain)
    roadPhase3 += dist * (3.2 + 0.55 * matSeed)
    roadPhase4 += dist * (7.8 + 1.2 * grain)
  } else {
    roadPhase += dist * (0.85 + 0.2 * grain)
    roadPhase2 += dist * (2.4 + 0.4 * grain)
    roadPhase3 += dist * (5.5 + 0.8 * matSeed)
    roadPhase4 += dist * (11 + 1.5 * grain)
  }
  const twoPi = Math.PI * 2
  const tex = plainRoad
    ? Math.sin(roadPhase * twoPi) * 0.38 +
      Math.sin(roadPhase2 * twoPi) * 0.32 +
      Math.sin(roadPhase3 * twoPi) * 0.22 * grain +
      Math.sin(roadPhase4 * twoPi) * 0.08 * (0.85 + 0.15 * matSeed)
    : Math.sin(roadPhase * twoPi) * 0.42 +
      Math.sin(roadPhase2 * twoPi) * 0.28 +
      Math.sin(roadPhase3 * twoPi) * 0.2 * grain +
      Math.sin(roadPhase4 * twoPi) * 0.1

  let surface = tex * surfaceAmp(surf, speedF, feel.road) * crawlGate * grain
  const sL = t.surfL || surf
  const sR = t.surfR || surf
  // Tiny L/R bias only while turning — DC mismatch was pumping L/R ring when released
  if (sL !== sR && crawlGate > 0.4 && !brakeMuteLat && turnActivity > 0.35) {
    const aL = surfaceAmp(sL, speedF, feel.road)
    const aR = surfaceAmp(sR, speedF, feel.road)
    surface += clamp((aR - aL) * 0.14, -0.03, 0.03)
  }
  if ((surf === 'kerb' || surf === 'dirt') && brakeF < 0.55) {
    surface += Math.sin(Date.now() / 48) * Math.abs(surface) * 0.1
  }

  const bumpRaw = clamp(t.bump ?? 0, 0, 1)
  const bumpIn = plainRoad && bumpRaw < 0.05 ? 0 : bumpRaw
  bumpSm += (bumpIn - bumpSm) * (bumpIn > bumpSm ? 0.55 : 0.18)
  // Attack/decay impulse on rising heave and asphalt→kerb edges
  if (bumpIn > prevBumpRaw + 0.04) {
    bumpImpulse = Math.max(
      bumpImpulse,
      clamp(bumpIn * (plainRoad ? 0.55 : 0.9), 0.12, 0.95),
    )
  }
  if (surf === 'kerb' && prevSurfKind !== 'kerb' && crawlGate > 0.3) {
    bumpImpulse = Math.max(bumpImpulse, 0.35 + 0.28 * speedF)
  }
  prevBumpRaw = bumpIn
  prevSurfKind = surf
  bumpImpulse *= 0.82
  // Signed roll lean under brake = hard L/R yank — only when turning, never under brakeMuteLat
  const roll = t.rollRate ?? 0
  const rollLean =
    !brakeMuteLat && Math.abs(roll) > 0.55 && turnActivity > 0.3
      ? -Math.sign(roll) *
        clamp(Math.abs(roll) * 0.12, 0, 0.04) *
        susp *
        feel.live *
        crawlGate
      : 0
  const bumpBrakeGate = brakeMuteLat
    ? clamp(1 - brakeF * 0.85, 0.08, 1)
    : 1 - brakeF * 0.25
  // Bump body is unsigned pulse (AC) — signed DC body was fighting the spring
  const bumpPulse = 0.5 + 0.5 * Math.sin(Date.now() / 36)
  const bumpBody =
    bumpSm < 0.05
      ? 0
      : bumpPulse * bumpSm * (plainRoad ? 0.34 : 0.5) * susp * feel.live * crawlGate
  const bumpHit =
    bumpImpulse *
    (0.55 + 0.45 * Math.sin(Date.now() / 28)) *
    (surf === 'kerb' ? 1.1 : 1) *
    susp *
    feel.live *
    crawlGate
  const bump = (bumpBody + bumpHit + rollLean) * bumpBrakeGate

  const slipAmp = slipSm * (0.9 + 0.55 * heat)
  // Always unsigned slip buzz — signed sin was alternating L/R when released / braking
  const wheelSlip =
    slipSm < 0.07
      ? 0
      : (0.5 + 0.5 * Math.sin(Date.now() / 48)) *
        slipAmp *
        (plainRoad ? 0.2 : 0.36) *
        effectStrength('wheelSlip') *
        feel.live *
        crawlGate *
        (brakeMuteLat ? clamp(1 - brakeF * 0.7, 0.15, 1) : 1)

  const colRaw = clamp(t.collision ?? 0, 0, 1)
  const colHard = clamp(t.colHard ?? 0.55, 0, 1)
  // Brake decelerations are NOT wall hits — require real damage / hard lateral impact
  const colArm =
    !(brakeMuteLat && colHard < 0.82) &&
    (colHard > 0.72 ||
      colRaw > 0.28 ||
      (turnActivity > 0.4 && colRaw > 0.18 && colHard > 0.55))
  const colTarget = colArm && colRaw > 0.08 ? colRaw : 0
  const rise = colHard > 0.7 ? 0.7 : 0.4
  collisionSm += (colTarget - collisionSm) * (colTarget > collisionSm ? rise : 0.14)
  if (colArm && colRaw > 0.1 && colRaw > prevCollisionTel + 0.04) {
    const spike = colRaw * (0.65 + 0.45 * colHard)
    collisionImpulse = Math.max(
      collisionImpulse,
      clamp(spike, 0.18 + 0.12 * colHard, 0.65 + 0.2 * colHard),
    )
    if (!brakeMuteLat && turnActivity > 0.35) {
      const dirHint = -Math.sign(latAccel || collisionDir || 1)
      if (dirHint !== 0) collisionDir = dirHint
    }
  }
  prevCollisionTel = colRaw
  collisionImpulse *= colHard > 0.7 ? 0.76 : 0.82
  if (!colArm) {
    collisionSm *= 0.4
    collisionImpulse *= 0.3
  }
  if (brakeMuteLat) {
    collisionSm *= 0.25
    collisionImpulse *= 0.2
  }
  const colGain = effectStrength('collision')
  let collision = 0
  if (movingGate < 0.12 && collisionImpulse < 0.25) {
    collisionSm *= 0.6
    collisionImpulse *= 0.45
  } else if (collisionSm > 0.02 || collisionImpulse > 0.02) {
    const body = collisionSm * (0.22 + 0.18 * (1 - colHard * 0.4))
    const thump = collisionImpulse * (0.48 + 0.35 * colHard)
    const chatter =
      !brakeMuteLat &&
      colHard > 0.7 &&
      collisionImpulse > 0.25 &&
      movingGate > 0.35
        ? Math.sin(Date.now() / 20) * collisionImpulse * 0.1 * colHard
        : 0
    const crawlMute =
      collisionImpulse > 0.35 || colHard > 0.75
        ? clamp(0.55 + t.speed / 14, 0.55, 1)
        : clamp((t.speed - 1.2) / 7, 0.2, 1)
    // Under brake: unsigned thump only (no sticky L/R shove)
    const signed =
      brakeMuteLat || turnActivity < 0.2
        ? 0.5 + 0.5 * Math.sin(Date.now() / 22)
        : collisionDir
    collision = clamp((body + thump + chatter) * signed * colGain * crawlMute, -0.75, 0.75)
    if (brakeMuteLat) collision *= 0.35
  }

  const engineGate =
    throttle > 0.1 || t.rpm > 0.65 ? clamp(throttle * 0.9 + (t.rpm - 0.5) * 0.5, 0, 1) : 0
  const engine =
    engineGate <= 0
      ? 0
      : Math.sin(Date.now() / 24) *
        t.rpm *
        0.055 *
        effectStrength('engine') *
        (0.28 + throttle * 0.65) *
        engineGate *
        movingGate
  let abs = 0
  if (brakeF > 0.65 && t.speed > 5 && slipSm > 0.14) {
    // Real ABS pulses resistance — unsigned so the rim does not alternate L/R on a straight
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 26)
    const absAmp = brakeStraight ? 0.052 : 0.08
    abs = pulse * absAmp * effectStrength('abs') * slipSm
  }

  const roadBrakeCalm = brakeMuteLat
    ? clamp(0.32 + 0.18 * turnActivity - brakeF * 0.14, 0.22, 0.5)
    : 1
  if (brakeMuteLat) surface *= roadBrakeCalm

  // Forza-busy cruise — calm under brake so signed grain cannot yank
  const textureBrakeGate = brakeMuteLat ? clamp(1 - brakeF * 0.55, 0.28, 1) : 1
  const textureSum = (surface + bump + wheelSlip + engine + abs) * textureBrakeGate
  const impactHit =
    !brakeMuteLat &&
    (collisionImpulse > 0.2 || bumpSm > 0.32 || bumpImpulse > 0.28 || surf === 'kerb')
  const cruiseCalm =
    plainRoad && !impactHit
      ? brakeMuteLat
        ? clamp(0.4 + 0.22 * turnActivity, 0.35, 0.65)
        : 0.78 + 0.12 * turnActivity + 0.06 * brakeF + 0.06 * throttle
      : 1
  const tirePart = (suspensionLat + suspensionYaw + understeer) * master * 0.82 * feel.live
  const texPart = textureSum * master * 0.95 * feel.live * clamp(cruiseCalm, 0.68, 1)
  const colPart =
    collision * master * 0.75 * feel.live * (brakeMuteLat ? 0.2 : 1)
  let scaled =
    (tirePart + texPart + colPart) * (brakeMuteLat ? 1 - brakeF * 0.4 : 1 - brakeF * 0.15)
  if (movingGate < 0.12) {
    scaled *= movingGate / 0.12
    magSm *= 0.72
    tireSm *= 0.85
  }
  const reconBoost = brakeMuteLat
    ? clamp((1 - turnActivity) * 0.1 + brakeF * 0.12, 0, 0.28)
    : clamp(brakeF * 0.12 + (1 - turnActivity) * (plainRoad ? 0.08 : 0.04), 0, 0.28)
  const alphaBase = 0.14 + (1 - smoothSet) * 0.24
  const alpha = impactHit
    ? Math.min(0.88, alphaBase + 0.42 + 0.18 * colHard)
    : alphaBase * (1 - reconBoost * 0.45)
  magSm += (scaled - magSm) * Math.max(0.06, alpha)
  // Kill residual signed bias near center / under brake (stops L/R pump)
  if (brakeMuteLat || (steerAbs < 0.08 && Math.abs(magSm) < 0.04)) {
    magSm *= brakeMuteLat ? 0.72 : 0.85
  }
  if (Math.abs(magSm) < 0.01 && movingGate < 0.25) magSm = 0

  const diCap = impactHit ? 8500 : brakeMuteLat ? 4200 : plainRoad ? 6200 : 7200
  let diMag = Math.round(clamp(magSm * 10000, -diCap, diCap))
  const slewSet = clamp((ffbSettings.slewRate ?? 40) / 100, 0, 1)
  // Under brake: very slow game-force slew — kills the sharp sideways snap
  const brakeSlewCut = brakeMuteLat ? 1 - brakeF * 0.78 : 1 - brakeF * 0.35
  const cruiseSlewCut = plainRoad && !impactHit ? (brakeMuteLat ? 0.55 : 0.88) : 1
  const maxStep = Math.round(
    (550 + 2600 * slewSet + (impactHit ? 3200 : 0)) * brakeSlewCut * cruiseSlewCut,
  )
  const delta = diMag - prevDiMag
  if (Math.abs(delta) > maxStep) {
    diMag = prevDiMag + Math.sign(delta || 1) * maxStep
  }
  prevDiMag = diMag

  const rawSum = suspensionLat + suspensionYaw + understeer + textureSum + collision
  return {
    mag: diMag,
    parts: {
      suspensionLat,
      suspensionYaw,
      understeer,
      surface,
      bump,
      wheelSlip,
      collision,
      engine,
      abs,
      rawSum,
      scaled,
      smoothed: magSm,
      diMag,
    },
  }
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000
}

function logEffectBreakdown(t: GtaTelemetry, parts: FfbEffectParts) {
  const gains = {
    master: clamp((ffbSettings?.overallStrength ?? 0) / 100, 0, 1),
    smoothing: clamp((ffbSettings?.smoothing ?? 30) / 100, 0, 1),
    center: clamp((ffbSettings?.selfAligningTorque ?? 60) / 100, 0, 1),
    damp: clamp((ffbSettings?.damping ?? 25) / 100, 0, 1),
    friction: clamp((ffbSettings?.friction ?? 15) / 100, 0, 1),
    effects: {
      road: effectStrength('road'),
      kerb: effectStrength('kerb'),
      grass: effectStrength('grass'),
      suspension: effectStrength('suspension'),
      wheelSlip: effectStrength('wheelSlip'),
      abs: effectStrength('abs'),
      collision: effectStrength('collision'),
      engine: effectStrength('engine'),
    },
  }
  logFfbSample({
    tel: {
      inVehicle: t.inVehicle,
      speed: round4(t.speed),
      speedKmh: Math.round(t.speed * 3.6),
      rpm: round4(t.rpm),
      gear: t.gear,
      steer: round4(t.steer),
      throttle: round4(t.throttle),
      brake: round4(t.brake),
      lateral: round4(t.lateral),
      yawRate: round4(t.yawRate),
      wheelSlip: round4(t.wheelSlip),
      collision: round4(t.collision),
      colHard: round4(t.colHard ?? 0.55),
      bump: round4(t.bump ?? 0),
      surface: t.surface,
      vehicle: t.vehicle,
    },
    gains,
    parts: {
      suspensionLat: round4(parts.suspensionLat),
      suspensionYaw: round4(parts.suspensionYaw),
      understeer: round4(parts.understeer),
      surface: round4(parts.surface),
      bump: round4(parts.bump),
      wheelSlip: round4(parts.wheelSlip),
      collision: round4(parts.collision),
      engine: round4(parts.engine),
      abs: round4(parts.abs),
      rawSum: round4(parts.rawSum),
      scaled: round4(parts.scaled),
      smoothed: round4(parts.smoothed),
      diMag: parts.diMag,
    },
  })
}

let lastControlsFileWrite = 0

export function sendGtaControls(controls: {
  steer: number
  throttle: number
  brake: number
  clutch: number
  wheelAngle?: number
  /** Clutch-paddle turn signals (toggle state). */
  indL?: boolean
  indR?: boolean
}) {
  if (!controlSocket) {
    controlSocket = dgram.createSocket('udp4')
  }
  const body = {
    steer: Number(controls.steer.toFixed(4)),
    throttle: Number(controls.throttle.toFixed(4)),
    brake: Number(controls.brake.toFixed(4)),
    clutch: Number(controls.clutch.toFixed(4)),
    wheelAngle: controls.wheelAngle ?? null,
    indL: controls.indL ? 1 : 0,
    indR: controls.indR ? 1 : 0,
  }
  const payload = Buffer.from(JSON.stringify(body), 'utf8')
  // Hot path: UDP only — never block the main thread for the file fallback
  controlSocket.send(payload, CONTROL_PORT, '127.0.0.1')

  const now = Date.now()
  if (now - lastControlsFileWrite > 250) {
    lastControlsFileWrite = now
    const file = path.join(app.getPath('temp'), 'gtamoza_controls.json')
    fs.promises.writeFile(file, payload).catch(() => {
      /* ignore */
    })
  }
}

export function setFfbHostEnabled(enabled: boolean) {
  ffbHostEnabled = enabled
  if (enabled) {
    ffbRestartAttempts = 0
    // Effect logs are opt-in (Settings → Open FFB logs) — sync disk I/O stalls FFB
    logFfbSettings(ffbSettings, effects)
    const ok = startFfbHost()
    if (!ok) console.warn('[gta-ffb] host enabled but exe failed to start')
  } else {
    stopFfbHost()
  }
}

function scheduleFfbRestart() {
  if (!ffbHostEnabled || ffbStopRequested) return
  if (ffbRestartTimer) return
  // Missing native deps used to crash-loop every ~1s and freeze the UI
  if (ffbRestartAttempts >= 12) {
    console.error('[gta-ffb] host keep dying — stop auto-restart (check resources/ffb-host DLLs)')
    return
  }
  const delay = Math.min(15_000, 1200 + ffbRestartAttempts * 1200)
  ffbRestartAttempts += 1
  console.warn(`[gta-ffb] restarting host in ${delay}ms (try ${ffbRestartAttempts})`)
  ffbRestartTimer = setTimeout(() => {
    ffbRestartTimer = null
    if (!ffbHostEnabled || ffbStopRequested) return
    startFfbHost()
  }, delay)
}

function sendFfbCommand(magnitude: number) {
  if (!ffbHostEnabled) return
  if (!ffbProc || ffbProc.killed) {
    scheduleFfbRestart()
    return
  }
  if (!cmdSocket) {
    cmdSocket = dgram.createSocket('udp4')
  }
  /**
   * Sim column (iRacing / ACC style):
   * - center = ONLY return-to-center spring (Pit House Wheel Spring = 0%)
   * - tire load from telemetry makes spring heavier — never signed ±steer in gameMag
   * - damp = stability + brake weight (not lateral yank)
   * - when GTA/plugin telemetry is stale: mute ALL mechanical gains (stops idle rattle)
   */
  const telemLive = Boolean(lastAt && Date.now() - lastAt <= STALE_MS)
  if (!telemLive) {
    magSm = 0
    tireSm = 0
    brakeFeelSm = 0
    dampCmdSm = 0
    latLoadSm = 0
    prevDiMag = 0
    const mute = Buffer.from(
      JSON.stringify({
        magnitude: 0,
        center: 0,
        damp: 0,
        friction: 0,
        inertia: 0,
      }),
      'utf8',
    )
    cmdSocket.send(mute, FFB_CMD_PORT, '127.0.0.1')
    return
  }

  const satGain = clamp((ffbSettings?.selfAligningTorque ?? 46) / 100, 0, 1)
  const speedMs = lastTelemetry?.speed ?? 0
  const speedF = clamp(speedMs / 28, 0, 1)
  const speedSat = clamp((speedMs - 0.6) / 12, 0, 1)
  const steerAbs = Math.abs(lastTelemetry?.steer ?? 0)
  const yawAbs = clamp(Math.abs(lastTelemetry?.yawRate ?? 0) / 2.4, 0, 1)
  const turnGate = clamp(steerAbs * 1.3 + yawAbs * 0.8, 0, 1)
  const brakeStraightLive =
    brakeFeelSm > 0.18 && steerAbs < 0.32
  const latLoad = latLoadSm * (0.12 + 0.8 * turnGate) * (brakeStraightLive ? 0.2 : 1)
  const tireLoad = clamp(tireSm, 0, 1.35)
  const feel = vehicleFeel(lastTelemetry?.vehicle ?? '')
  // Host-only centering — soften under brake so release doesn't slingshot L/R
  const center = clamp(
    satGain *
      (0.08 + 0.58 * speedSat) *
      (0.9 + 0.1 * latLoad * speedSat + 0.16 * tireLoad * (1 - brakeFeelSm * 0.5)) *
      feel.spring *
      (1 - brakeFeelSm * 0.22),
    0,
    0.72,
  )
  const dampBase =
    ((ffbSettings?.damping ?? 55) / 100) * (0.75 + 0.25 * speedF)
  // Extra damp under brake + near-center — kills hands-off ring and brake yank
  const dampTarget = clamp(
    dampBase +
      brakeFeelSm * (brakeStraightLive ? 0.36 : 0.2) +
      (1 - turnGate) * 0.14 +
      (brakeStraightLive ? brakeFeelSm * 0.18 : 0),
    0,
    1,
  )
  if (dampCmdSm <= 0.001 && dampBase > 0) dampCmdSm = dampBase
  dampCmdSm += (dampTarget - dampCmdSm) * (dampTarget > dampCmdSm ? 0.09 : 0.2)
  const damp = dampCmdSm
  // Kill friction/inertia chatter when parked / crawling (noise → rim buzz)
  const mechGate = clamp((speedMs - 0.35) / 2.2, 0, 1)
  const friction = clamp(
    ((ffbSettings?.friction ?? 12) / 100) * mechGate * (brakeStraightLive ? 0.55 : 1),
    0,
    1,
  )
  const inertia = clamp(
    ((ffbSettings?.inertia ?? 14) / 100) * mechGate * (brakeStraightLive ? 0.4 : 1),
    0,
    1,
  )
  const payload = Buffer.from(
    JSON.stringify({
      magnitude,
      center,
      damp: damp * (0.35 + 0.65 * Math.max(mechGate, lastTelemetry?.inVehicle ? 0.25 : 0)),
      friction,
      inertia,
    }),
    'utf8',
  )
  cmdSocket.send(payload, FFB_CMD_PORT, '127.0.0.1')
}

function resolveFfbHostExe(): string | null {
  const candidates = [
    // Packaged: extraResources → resources/ffb-host/
    path.join(process.resourcesPath, 'ffb-host', 'gtamoza-ffb.exe'),
    path.join(app.getAppPath(), 'tools', 'ffb-host', 'dist', 'gtamoza-ffb.exe'),
    path.join(__dirname, '..', '..', 'tools', 'ffb-host', 'dist', 'gtamoza-ffb.exe'),
    path.join(process.cwd(), 'tools', 'ffb-host', 'dist', 'gtamoza-ffb.exe'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return null
}

function killStrayFfbHosts(opts?: { waitMs?: number }) {
  let killed = false
  try {
    execFileSync('taskkill', ['/F', '/IM', 'gtamoza-ffb.exe'], {
      windowsHide: true,
      stdio: 'ignore',
    })
    killed = true
  } catch {
    /* no process — fine */
  }
  // Only wait when something was actually killed (UDP release)
  if (killed) sleepSync(opts?.waitMs ?? 450)
}

export function startFfbHost(): boolean {
  if (ffbProc && !ffbProc.killed) return true
  const exe = resolveFfbHostExe()
  if (!exe) {
    console.warn('[gta-ffb] gtamoza-ffb.exe not found — build tools/ffb-host')
    return false
  }
  try {
    ffbStopRequested = false
    // Must finish BEFORE spawn — async taskkill was killing the new process (exit 1)
    killStrayFfbHosts()
    // Only attach host JSONL when logging was explicitly enabled (see ffb-effect-log)
    const logFile = getFfbEffectLogPath()
    ffbProc = spawn(exe, [], {
      cwd: path.dirname(exe),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...(logFile ? { GTAMOZA_FFB_LOG: logFile } : {}),
      },
    })
    const proc = ffbProc
    proc.stdout?.on('data', (b) => {
      const s = String(b).trim()
      if (s) console.log('[ffb-host]', s)
    })
    proc.stderr?.on('data', (b) => {
      const s = String(b).trim()
      if (s) console.warn('[ffb-host]', s)
    })
    proc.on('exit', (code) => {
      console.warn('[gta-ffb] host exited', code === null ? 'null' : code)
      ffbProc = null
      emitStatus(true)
      if (ffbHostEnabled && !ffbStopRequested) scheduleFfbRestart()
    })
    console.log('[gta-ffb] host started', exe)
    ffbRestartAttempts = 0
    emitStatus(true)
    return true
  } catch (err) {
    console.warn('[gta-ffb] failed to start host', err)
    ffbProc = null
    if (ffbHostEnabled) scheduleFfbRestart()
    return false
  }
}

export function stopFfbHost() {
  ffbStopRequested = true
  if (ffbRestartTimer) {
    clearTimeout(ffbRestartTimer)
    ffbRestartTimer = null
  }
  if (ffbProc && !ffbProc.killed) {
    try {
      ffbProc.kill()
    } catch {
      /* ignore */
    }
  }
  ffbProc = null
  killStrayFfbHosts()
  try {
    if (!cmdSocket) cmdSocket = dgram.createSocket('udp4')
    cmdSocket.send(Buffer.from(JSON.stringify({ magnitude: 0 })), FFB_CMD_PORT, '127.0.0.1')
  } catch {
    /* ignore */
  }
}

function onTelemetryMessage(msg: Buffer) {
  try {
    const sample = normalizeTelemetry(JSON.parse(msg.toString('utf8')))
    if (!sample) return
    lastTelemetry = sample
    lastAt = Date.now()
    telemetryPortBusy = false
    // FFB first — UI IPC must never delay the force / input path
    const { mag, parts } = computeMagnitude(sample)
    sendFfbCommand(mag)
    logEffectBreakdown(sample, parts)
    emitTelemetry(sample)
    emitStatus()
    const now = Date.now()
    if (now - lastMagLogAt > 1500 && (Math.abs(mag) > 200 || Math.abs(lastLoggedMag) > 200)) {
      lastMagLogAt = now
      lastLoggedMag = mag
      console.log(
        '[gta-ffb] mag=',
        mag,
        'v=',
        sample.v,
        'spd=',
        Math.round(sample.speed * 3.6),
        'surf=',
        sample.surface,
        'slip=',
        sample.wheelSlip?.toFixed?.(2),
        'wd=',
        sample.wheelsDown,
        'alive=',
        Boolean(ffbProc && !ffbProc.killed),
        'log=',
        getFfbEffectLogPath() ? 'on' : 'off',
      )
    }
  } catch {
    /* ignore bad packets */
  }
}

function bindTelemetrySocket() {
  try {
    socket?.close()
  } catch {
    /* ignore */
  }
  socket = dgram.createSocket({ type: 'udp4', reuseAddr: false })
  socket.on('message', onTelemetryMessage)
  socket.on('error', (err) => {
    console.warn('[gta-telemetry]', err.message)
    if (!String(err.message).includes('EADDRINUSE')) return
    telemetryPortBusy = true
    emitStatus(true)
    if (telemetryBindAttempts < 12) {
      telemetryBindAttempts += 1
      setTimeout(() => bindTelemetrySocket(), 250)
      return
    }
    console.warn(
      '[gta-telemetry] port 29755 busy — close other GTA Moza Drive / Electron instances, then restart this app',
    )
  })
  socket.bind({ port: TELEMETRY_PORT, address: '127.0.0.1', exclusive: true }, () => {
    telemetryPortBusy = false
    telemetryBindAttempts = 0
    console.log('[gta-telemetry] listening 127.0.0.1:29755')
    emitStatus(true)
  })
}

export function initGtaTelemetryBridge() {
  if (socket) return
  bindTelemetrySocket()

  // Host is started from profile sync via setFfbHostEnabled(ffb.enabled)

  tickTimer = setInterval(() => {
    // Link UI at 1 Hz — was 2 Hz + sync tasklist and hitching the whole app
    emitStatus()
    if (!lastAt || Date.now() - lastAt > STALE_MS) {
      sendFfbCommand(0)
    }
  }, 1000)
}

export function disposeGtaTelemetryBridge() {
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
  stopFfbHost()
  closeFfbEffectLog()
  try {
    socket?.close()
  } catch {
    /* ignore */
  }
  socket = null
  try {
    cmdSocket?.close()
  } catch {
    /* ignore */
  }
  cmdSocket = null
  try {
    controlSocket?.close()
  } catch {
    /* ignore */
  }
  controlSocket = null
}

export function resolvePluginDll(): string | null {
  // Packaged: only extraResources. Never pick a random cwd/gta-mod/dist
  // (launching the installed exe from the repo would steal the dev DLL).
  if (app.isPackaged) {
    const packaged = path.join(process.resourcesPath, 'gta-mod', 'GTAMOZA.dll')
    try {
      if (fs.existsSync(packaged) && fs.statSync(packaged).isFile()) return packaged
    } catch {
      /* ignore */
    }
    return null
  }

  const candidates = [
    path.join(app.getAppPath(), 'gta-mod', 'dist', 'GTAMOZA.dll'),
    path.join(__dirname, '..', '..', 'gta-mod', 'dist', 'GTAMOZA.dll'),
    path.join(process.cwd(), 'gta-mod', 'dist', 'GTAMOZA.dll'),
  ]
  let best: { file: string; mtime: number } | null = null
  const seen = new Set<string>()
  for (const c of candidates) {
    const resolved = path.resolve(c)
    if (seen.has(resolved)) continue
    seen.add(resolved)
    try {
      if (!fs.existsSync(resolved)) continue
      const st = fs.statSync(resolved)
      if (!st.isFile()) continue
      if (!best || st.mtimeMs > best.mtime) best = { file: resolved, mtime: st.mtimeMs }
    } catch {
      /* ignore */
    }
  }
  return best?.file ?? null
}
