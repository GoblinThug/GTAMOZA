export type AppTheme = 'dark' | 'light' | 'system'
export type AppLocale = 'en' | 'ru'
export type UpdateChannel = 'stable' | 'beta'

export type SteeringSettings = {
  wheelAngle: number
  sensitivity: number
  linearity: number
  deadzone: number
  saturation: number
  softLock: boolean
  centerOffset: number
}

export type FfbSettings = {
  overallStrength: number
  maximumTorque: number
  selfAligningTorque: number
  damping: number
  friction: number
  inertia: number
  smoothing: number
  slewRate: number
  enabled: boolean
}

/** Base settings read from MOZA serial (Pit House / boxflat). */
export type MozaBaseSync = {
  at: number
  connected: boolean
  steering: Partial<SteeringSettings>
  ffb: Partial<FfbSettings>
  raw: {
    limitHalf: number
    wheelAngleDeg: number
    ffbStrength: number
    torquePct: number
    damper: number
    friction: number
    spring: number
    inertia: number
    softLock: boolean
  }
}

export type MozaSerialStatus = {
  portOpen: boolean
  pedalsLive: boolean
  baseLive: boolean
  path: string | null
  /** Why COM is not usable right now (Pit House typically). */
  busy: boolean
  lastError: string | null
  wheelAngleDeg: number | null
}

export type EffectId =
  | 'road'
  | 'kerb'
  | 'grass'
  | 'suspension'
  | 'wheelSlip'
  | 'abs'
  | 'collision'
  | 'engine'

export type EffectSettings = {
  enabled: boolean
  strength: number
}

export type EffectsSettings = Record<EffectId, EffectSettings>

export type ProfileSettings = {
  steering: SteeringSettings
  ffb: FfbSettings
  effects: EffectsSettings
}

export type Profile = {
  id: string
  name: string
  settings: ProfileSettings
  createdAt: string
  updatedAt: string
}

export type PedalAxisMap = {
  /** HID axis index after report id (0 = steering X). */
  throttle: number
  brake: number
  clutch: number
}

/** Locked rest/floor for one pedal after manual calibration. */
export type PedalFloorPoint = {
  axis: number
  rest: number
  extreme: number
  dir: 1 | -1
  /** Peak unwrap travel at lock — used as 100% scale after restart. */
  maxTravel: number
}

export type PedalFloors = {
  throttle: PedalFloorPoint | null
  brake: PedalFloorPoint | null
  clutch: PedalFloorPoint | null
}

/**
 * Pedals plugged into the R5 base (SR-P Lite bundle) — Linux/boxflat ABS map:
 * Z=throttle, RZ=brake, Throttle=clutch. Y is clutch paddles, not a foot pedal.
 */
export const DEFAULT_PEDAL_AXIS_MAP: PedalAxisMap = {
  throttle: 2,
  brake: 5,
  /** HID "Throttle" usage on R5 bundle — foot clutch (not Y paddles). */
  clutch: 6,
}

export const DEFAULT_PEDAL_FLOORS: PedalFloors = {
  throttle: null,
  brake: null,
  clutch: null,
}

/** WinForms Keys name, e.g. Home, PageUp, F6 */
export type CheatHotkey = string

export type CheatFeatureSettings = {
  enabled: boolean
  hotkey: CheatHotkey
}

export type CheatsSettings = {
  /** Master switch — when off, in-game cheat keys do nothing */
  enabled: boolean
  godMode: CheatFeatureSettings
  noPolice: CheatFeatureSettings
  spawnCar: CheatFeatureSettings
}

export const DEFAULT_CHEATS: CheatsSettings = {
  enabled: false,
  godMode: { enabled: true, hotkey: 'Home' },
  noPolice: { enabled: true, hotkey: 'End' },
  spawnCar: { enabled: true, hotkey: 'PageUp' },
}

export type AppSettings = {
  theme: AppTheme
  locale: AppLocale
  startWithWindows: boolean
  minimizeToTray: boolean
  autoUpdates: boolean
  updateChannel: UpdateChannel
  selectedProfileId: string
  pedalAxisMap: PedalAxisMap
  pedalFloors: PedalFloors
  /** Absolute path to GTA V Enhanced game folder. */
  gtaGamePath: string | null
  cheats: CheatsSettings
  /** First-run tutorial completed (or skipped). */
  onboardingCompleted: boolean
}

export type GtaModState = 'missing-game' | 'ready' | 'enabled' | 'parked'

/** Where the Enhanced install lives — drives Story Mode launch (-nobattleye). */
export type GtaStoreKind = 'steam' | 'epic' | 'rockstar' | 'unknown'

export type GtaModStatus = {
  gamePath: string | null
  validGame: boolean
  state: GtaModState
  onlineSafe: boolean
  hasScriptHook: boolean
  hasDotNet: boolean
  hasAsiLoader: boolean
  hasOurPlugin: boolean
  hooksParked: boolean
  /** Detected store for this game folder. */
  store: GtaStoreKind
  message: string
  canEnable: boolean
  canDisable: boolean
  canUninstall: boolean
}

export type ProfilesStore = {
  profiles: Profile[]
  selectedProfileId: string
  /** Bump when shipping a new log-tuned FFB preset (migrates saved profiles). */
  tuningRevision?: number
}

/**
 * Factory baseline — locked from the live Default profile (2026-08-13).
 * Used for new profiles, reset (non-preset), and as the base for builtin templates.
 */
export const DEFAULT_STEERING: SteeringSettings = {
  wheelAngle: 900,
  sensitivity: 95,
  linearity: 28,
  deadzone: 2,
  saturation: 100,
  softLock: true,
  centerOffset: 0,
}

/**
 * Factory FFB baseline (same as current Default profile).
 * Pit House: Wheel Spring 0% when using in-app SAT.
 */
export const DEFAULT_FFB: FfbSettings = {
  overallStrength: 100,
  maximumTorque: 5.5,
  selfAligningTorque: 64,
  damping: 34,
  friction: 10,
  inertia: 12,
  smoothing: 20,
  slewRate: 50,
  enabled: true,
}

/** Factory effects baseline (same as current Default profile). */
export const DEFAULT_EFFECTS: EffectsSettings = {
  road: { enabled: true, strength: 68 },
  kerb: { enabled: true, strength: 78 },
  grass: { enabled: true, strength: 52 },
  suspension: { enabled: true, strength: 70 },
  wheelSlip: { enabled: true, strength: 55 },
  abs: { enabled: true, strength: 40 },
  collision: { enabled: true, strength: 78 },
  engine: { enabled: true, strength: 30 },
}

/** Stored in profiles.json — bump to re-apply DEFAULT_* / builtin FFB presets. */
export const FFB_TUNE_REVISION = 20

export function createDefaultProfileSettings(): ProfileSettings {
  return {
    steering: { ...DEFAULT_STEERING },
    ffb: { ...DEFAULT_FFB },
    effects: structuredClone(DEFAULT_EFFECTS),
  }
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'dark',
  locale: 'en',
  startWithWindows: false,
  minimizeToTray: true,
  autoUpdates: true,
  updateChannel: 'stable',
  selectedProfileId: 'default',
  pedalAxisMap: { ...DEFAULT_PEDAL_AXIS_MAP },
  pedalFloors: { ...DEFAULT_PEDAL_FLOORS },
  gtaGamePath: null,
  cheats: structuredClone(DEFAULT_CHEATS),
  onboardingCompleted: false,
}

export type UpdateErrorCode =
  | 'network'
  | 'notFound'
  | 'checksum'
  | 'permission'
  | 'generic'

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'unsupported'; reason: 'dev' | 'portable' }
  | { state: 'checking' }
  | { state: 'available'; version: string; releaseNotes?: string }
  | { state: 'not-available'; version: string }
  | { state: 'downloading'; percent: number; transferred: number; total: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; code: UpdateErrorCode }
