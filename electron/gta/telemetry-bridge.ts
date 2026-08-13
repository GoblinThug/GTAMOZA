/**
 * GTA Story Mode telemetry (UDP 29755) → live sample + FFB commands (UDP 29756).
 */
import dgram from 'node:dgram'
import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { app, BrowserWindow } from 'electron'
import type { EffectsSettings, FfbSettings } from '../../shared/types'
import {
  closeFfbEffectLog,
  ensureFfbEffectLogSession,
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
let bumpSm = 0
let slipSm = 0
let collisionSm = 0
let collisionImpulse = 0
let prevCollisionTel = 0
/** Sticky collision shove direction — prevents L/R yank when latAccel flips. */
let collisionDir = 1
let latLoadSm = 0
let prevDiMag = 0
let roadPhase = 0
let roadPhase2 = 0
/** Smoothed brake for FFB only — kills the rim yank on pedal bite. */
let brakeFeelSm = 0
let dampCmdSm = 0

function emitStatus() {
  const status = getGtaLinkStatus()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('gta:link', status)
  }
}

function emitTelemetry(sample: GtaTelemetry) {
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
  if (kind === 'kerb') return (0.14 + speedF * 0.26) * effectStrength('kerb')
  if (kind === 'dirt') return (0.095 + speedF * 0.16) * (effectStrength('grass') * 0.65 + effectStrength('road') * 0.3)
  if (kind === 'grass') return (0.085 + speedF * 0.145) * effectStrength('grass')
  if (kind === 'sand') return (0.09 + speedF * 0.15) * effectStrength('grass')
  return (0.052 + speedF * 0.088) * effectStrength('road') * feelRoad
}

/** Map telemetry → game-effect magnitude (centering is applied in ffb-host from physical axis). */
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
    prevDiMag = 0
    latLoadSm = 0
    return { mag: 0, parts: empty(0) }
  }
  if (!t.inVehicle) {
    magSm *= 0.85
    brakeFeelSm *= 0.85
    dampCmdSm *= 0.85
    latLoadSm *= 0.85
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
  // Mute road / slip texture in air or on 1–2 wheels
  const contactGate = airborne || wheelsDown < 2 ? 0 : clamp((wheelsDown - 1.5) / 2.5, 0.25, 1)
  const crawlGate = clamp((t.speed - 1.2) / 5.5, 0, 1) * contactGate
  // Parked / idle: kill oscillating game forces (engine buzz, false collision chatter)
  const movingGate = clamp((t.speed - 0.45) / 1.8, 0, 1)

  // SAT / load: prefer real lateral accel when present (smoothed — raw spikes yank the rim)
  const susp = effectStrength('suspension') * feel.sat
  const latAccel = t.accelLat !== undefined ? t.accelLat : t.lateral
  latLoadSm += (clamp(Math.abs(latAccel) / 12, 0, 1) - latLoadSm) * 0.22
  const load = latLoadSm
  const yawLoad = clamp(Math.abs(t.yawRate) / 2.1, 0, 1)
  const brakeRaw = clamp(t.brake ?? 0, 0, 1)
  const brakeAtk = brakeRaw > brakeFeelSm ? 0.14 : 0.28
  brakeFeelSm += (brakeRaw - brakeFeelSm) * brakeAtk
  const brakeF = brakeFeelSm
  // SAT only while rolling — at standstill host spring centers; steer-based SAT
  // was a DC bias (mag≠0 at spd=0) that walked the rim off to one side.
  const satLoad = Math.max(load, yawLoad * 0.45) * movingGate
  const suspensionLat =
    -steer *
    (0.1 + 0.34 * speedF) *
    (0.2 + 0.7 * Math.max(satLoad, speedF * 0.35)) *
    susp *
    (1 + brakeF * 0.1) *
    movingGate
  const suspensionYaw = -steer * yawLoad * 0.09 * susp * speedF * movingGate
  const under = clamp(Math.abs(steer) - Math.abs(t.yawRate) * 0.35, 0, 1)
  const understeer = -steer * under * 0.08 * susp * speedF * movingGate

  const surf = t.surface || 'asphalt'
  const grain = matGrain(t.matId)
  const dt = 1 / 60
  // Mid grain dominant; HF light — avoids buzz on asphalt (MOZA-style equalizer)
  const roadHz = (4.8 + t.speed * 0.48) * (0.92 + 0.08 * grain)
  roadPhase += roadHz * dt
  roadPhase2 += (2.1 + t.speed * 0.16) * dt
  const roadPhase3 = roadPhase * 1.45
  const tex =
    Math.sin(roadPhase * Math.PI * 2) * 0.62 +
    Math.sin(roadPhase2 * Math.PI * 2) * 0.26 +
    Math.sin(roadPhase3 * Math.PI * 2) * 0.12 * grain

  let surface = tex * surfaceAmp(surf, speedF, feel.road) * crawlGate * grain
  // Split L/R: one wheel on kerb/grass pulls lightly toward that side
  const sL = t.surfL || surf
  const sR = t.surfR || surf
  if (sL !== sR && crawlGate > 0.2) {
    const aL = surfaceAmp(sL, speedF, feel.road)
    const aR = surfaceAmp(sR, speedF, feel.road)
    const bias = clamp((aR - aL) * 0.55, -0.12, 0.12)
    const midPulse = Math.sin(Date.now() / 68) * Math.abs(aR - aL) * 0.35 * crawlGate
    surface += bias + midPulse * Math.sign(bias || 1)
  }
  // Mid band boost for kerb / dirt (more expressive than HF road)
  if (surf === 'kerb' || surf === 'dirt') {
    surface += Math.sin(Date.now() / 55) * Math.abs(surface) * 0.12
  }

  // Suspension: bump spikes + low-freq pitch/roll/longitudinal load transfer
  bumpSm += (clamp(t.bump ?? 0, 0, 1) - bumpSm) * 0.24
  const pitch = t.pitchRate ?? 0
  const roll = t.rollRate ?? 0
  const accelFwd = t.accelFwd ?? 0
  const bodyHeave =
    Math.sin(Date.now() / 95) *
    clamp(Math.abs(pitch) * 0.35 + Math.abs(roll) * 0.4 + Math.abs(accelFwd) / 28, 0, 1) *
    0.1 *
    susp *
    feel.live *
    crawlGate
  const bump =
    Math.sin(Date.now() / 48) * bumpSm * 0.28 * susp * feel.live * crawlGate + bodyHeave

  // Wheel slip: real slip + tire heat texture (no throttle fake)
  const heat = clamp(t.tireHeat ?? 0, 0, 1)
  slipSm += (clamp(t.wheelSlip, 0, 1) - slipSm) * 0.18
  const slipAmp = slipSm * (0.85 + 0.45 * heat)
  const wheelSlip =
    Math.sin(Date.now() / 58) *
    slipAmp *
    0.17 *
    effectStrength('wheelSlip') *
    feel.live *
    crawlGate

  const colRaw = clamp(t.collision ?? 0, 0, 1)
  const colHard = clamp(t.colHard ?? 0.55, 0, 1)
  const colTarget = colRaw > 0.05 ? colRaw : 0
  const rise = colHard > 0.65 ? 0.62 : 0.38
  collisionSm += (colTarget - collisionSm) * (colTarget > collisionSm ? rise : 0.14)
  if (colRaw > 0.08 && colRaw > prevCollisionTel + 0.04) {
    // Clear impact spike — capped so scrapes don't become full-lock yanks
    const spike = colRaw * (0.55 + 0.55 * colHard)
    collisionImpulse = Math.max(
      collisionImpulse,
      clamp(spike, 0.14 + 0.12 * colHard, 0.55 + 0.25 * colHard),
    )
    const dirHint = -Math.sign(latAccel || steer || collisionDir || 1)
    if (dirHint !== 0) collisionDir = dirHint
  }
  prevCollisionTel = colRaw
  collisionImpulse *= colHard > 0.65 ? 0.68 : 0.8
  const colGain = effectStrength('collision')
  let collision = 0
  // Idle telemetry jitter was re-triggering soft collisions → HF chatter on the rim
  if (movingGate < 0.15 && collisionImpulse < 0.2) {
    collisionSm *= 0.65
    collisionImpulse *= 0.5
  } else if (collisionSm > 0.02 || collisionImpulse > 0.02) {
    // Keep shove direction sticky for the whole impulse (no L↔R flip mid-hit)
    const body = collisionSm * (0.22 + 0.2 * (1 - colHard * 0.5))
    const thump = collisionImpulse * (0.55 + 0.4 * colHard)
    const chatter =
      colHard > 0.7 && collisionImpulse > 0.25 && movingGate > 0.45
        ? Math.sin(Date.now() / 22) * collisionImpulse * 0.1 * colHard
        : 0
    const crawlMute =
      collisionImpulse > 0.4 || colHard > 0.75
        ? clamp(0.45 + t.speed / 16, 0.45, 1)
        : clamp((t.speed - 1.5) / 8, 0.15, 1)
    collision = clamp(
      collisionDir * (body + thump + chatter) * colGain * crawlMute,
      -0.55,
      0.55,
    )
  }

  // Engine shake only when rolling or revving — idle RPM sine was buzzing the wheel at standstill
  const engineGate = Math.max(movingGate, clamp(t.throttle, 0, 1) * 0.55)
  const engine =
    Math.sin(Date.now() / 24) *
    t.rpm *
    0.055 *
    effectStrength('engine') *
    (0.25 + t.throttle * 0.45) *
    engineGate
  let abs = 0
  if (brakeF > 0.82 && t.speed > 5) {
    abs = Math.sin(Date.now() / 26) * 0.075 * effectStrength('abs')
  }

  const rawSum =
    suspensionLat +
    suspensionYaw +
    understeer +
    surface +
    bump +
    wheelSlip +
    collision +
    engine +
    abs
  let scaled = rawSum * master * 0.95 * feel.live
  // Kill leftover DC bias when stopped (was pressing rim a few degrees off-center)
  if (movingGate < 0.12) {
    scaled *= movingGate / 0.12
    magSm *= 0.72
  }
  const alphaBase = 0.18 + (1 - smoothSet) * 0.26
  // Impacts readable, but not an unsmoothed full-lock yank
  const alpha =
    collisionImpulse > 0.18
      ? Math.min(0.72, alphaBase + 0.28 + 0.18 * colHard)
      : alphaBase
  magSm += (scaled - magSm) * alpha
  if (Math.abs(magSm) < 0.008 && movingGate < 0.2) magSm = 0
  const diCap = collisionImpulse > 0.25 ? 7800 : 6500
  let diMag = Math.round(clamp(magSm * 10000, -diCap, diCap))
  // Soft slew — settings.slewRate 0=soft … 100=fast; stops sudden side yanks
  const slewSet = clamp((ffbSettings.slewRate ?? 50) / 100, 0, 1)
  const maxStep = Math.round(900 + 4200 * slewSet + (collisionImpulse > 0.2 ? 1800 : 0))
  const delta = diMag - prevDiMag
  if (Math.abs(delta) > maxStep) {
    diMag = prevDiMag + Math.sign(delta) * maxStep
  }
  prevDiMag = diMag

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
  }
  const payload = Buffer.from(JSON.stringify(body), 'utf8')
  // Hot path: UDP only (sync file I/O was adding input lag every tick)
  controlSocket.send(payload, CONTROL_PORT, '127.0.0.1')

  const now = Date.now()
  if (now - lastControlsFileWrite > 80) {
    lastControlsFileWrite = now
    try {
      const file = path.join(app.getPath('temp'), 'gtamoza_controls.json')
      fs.writeFileSync(file, payload)
    } catch {
      /* ignore */
    }
  }
}

export function setFfbHostEnabled(enabled: boolean) {
  ffbHostEnabled = enabled
  if (enabled) {
    ffbRestartAttempts = 0
    ensureFfbEffectLogSession()
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
  const delay = Math.min(8000, 800 + ffbRestartAttempts * 700)
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
   * MOZA model for titles without FFB physics:
   * - center = tire self-aligning torque (grows with speed + lateral load), not a park magnet
   * - damp = Wheel Damper (stability; rises a bit with speed / brake)
   * - friction / inertia = mechanical filters (were missing from the host path)
   */
  const satGain = clamp((ffbSettings?.selfAligningTorque ?? 64) / 100, 0, 1)
  const speedMs = lastTelemetry?.speed ?? 0
  const speedF = clamp(speedMs / 28, 0, 1)
  // Light park spring; real SAT bite comes with speed (heavy floor was walking the rim off-center).
  const speedSat = clamp((speedMs - 0.6) / 12, 0, 1)
  const latLoad = lastTelemetry
    ? clamp(Math.abs(lastTelemetry.lateral) / 12, 0, 1)
    : 0
  const feel = vehicleFeel(lastTelemetry?.vehicle ?? '')
  const center = clamp(
    satGain * (0.14 + 0.86 * speedSat) * (0.85 + 0.25 * latLoad * speedSat) * feel.spring,
    0,
    1,
  )
  // Speed-dependent damping + a bit more at crawl to stop center hunting.
  const dampBase =
    ((ffbSettings?.damping ?? 34) / 100) * (0.7 + 0.3 * speedF)
  const dampTarget = clamp(dampBase + brakeFeelSm * 0.2, 0, 1)
  if (dampCmdSm <= 0.001 && dampBase > 0) dampCmdSm = dampBase
  dampCmdSm += (dampTarget - dampCmdSm) * (dampTarget > dampCmdSm ? 0.18 : 0.28)
  const damp = dampCmdSm
  // Mild friction — heavy coulomb was fighting return and tipping the rim off center.
  const friction = clamp((ffbSettings?.friction ?? 10) / 100, 0, 1)
  const inertia = clamp((ffbSettings?.inertia ?? 12) / 100, 0, 1)
  const payload = Buffer.from(
    JSON.stringify({
      magnitude,
      center,
      damp,
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

function killStrayFfbHosts() {
  try {
    execFileSync('taskkill', ['/F', '/IM', 'gtamoza-ffb.exe'], {
      windowsHide: true,
      stdio: 'ignore',
    })
  } catch {
    /* no process — fine */
  }
  // Let Windows release UDP 29756 before the next bind
  try {
    execFileSync(
      'powershell.exe',
      ['-NoProfile', '-Command', 'Start-Sleep -Milliseconds 450'],
      { windowsHide: true, stdio: 'ignore' },
    )
  } catch {
    const until = Date.now() + 450
    while (Date.now() < until) {
      /* spin */
    }
  }
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
    const logFile = ensureFfbEffectLogSession()
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
      emitStatus()
      if (ffbHostEnabled && !ffbStopRequested) scheduleFfbRestart()
    })
    console.log('[gta-ffb] host started', exe)
    ffbRestartAttempts = 0
    emitStatus()
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

export function initGtaTelemetryBridge() {
  if (socket) return
  socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
  socket.on('message', (msg) => {
    try {
      const sample = normalizeTelemetry(JSON.parse(msg.toString('utf8')))
      if (!sample) return
      lastTelemetry = sample
      lastAt = Date.now()
      emitTelemetry(sample)
      emitStatus()
      const { mag, parts } = computeMagnitude(sample)
      sendFfbCommand(mag)
      logEffectBreakdown(sample, parts)
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
  })
  socket.on('error', (err) => {
    console.warn('[gta-telemetry]', err.message)
    if (String(err.message).includes('EADDRINUSE')) {
      console.warn(
        '[gta-telemetry] port 29755 busy — close other GTA Moza Drive / Electron instances, then restart this app',
      )
    }
  })
  socket.bind({ port: TELEMETRY_PORT, address: '127.0.0.1', exclusive: false })

  // Host is started from profile sync via setFfbHostEnabled(ffb.enabled)

  tickTimer = setInterval(() => {
    emitStatus()
    if (!lastAt || Date.now() - lastAt > STALE_MS) {
      sendFfbCommand(0)
    }
  }, 500)
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
  const candidates = [
    // Packaged: extraResources → resources/gta-mod/
    path.join(process.resourcesPath, 'gta-mod', 'GTAMOZA.dll'),
    path.join(app.getAppPath(), 'gta-mod', 'dist', 'GTAMOZA.dll'),
    path.join(__dirname, '..', '..', 'gta-mod', 'dist', 'GTAMOZA.dll'),
    path.join(process.cwd(), 'gta-mod', 'dist', 'GTAMOZA.dll'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return null
}
