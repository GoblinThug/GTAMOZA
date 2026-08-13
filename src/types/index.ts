export type {
  AppTheme,
  AppLocale,
  UpdateChannel,
  SteeringSettings,
  FfbSettings,
  MozaBaseSync,
  MozaSerialStatus,
  EffectId,
  EffectSettings,
  EffectsSettings,
  ProfileSettings,
  Profile,
  AppSettings,
  CheatsSettings,
  CheatFeatureSettings,
  ProfilesStore,
  UpdateStatus,
  UpdateErrorCode,
  GtaModStatus,
  GtaModState,
  GtaStoreKind,
} from '../../shared/types'

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error'

export type DeviceStatus = {
  connected: boolean
  name: string
  model: string
  firmware?: string
}

export type GtaStatus = {
  connected: boolean
  mode: 'story' | 'unknown'
  vehicle: string
  /** Process up but plugin UDP missing */
  pluginMissing?: boolean
  gameRunning?: boolean
}

export type TelemetrySample = {
  timestamp: number
  speed: number
  steeringAngle: number
  torque: number
  throttle: number
  brake: number
  clutch: number
  /** Pedal deflection from rest (0 = released; grows when pressed). */
  throttleRaw: number
  brakeRaw: number
  clutchRaw: number
  lateralG: number
  yawRate: number
}

export type DiagnosticsStatus = {
  gta: ConnectionStatus
  moza: ConnectionStatus
  ffbEngine: 'running' | 'stopped' | 'error'
  telemetryHz: number
  ffbHz: number
  ipc: ConnectionStatus
}

export type FfbTestMode = 'constant' | 'sine' | 'spring' | 'damper' | 'pulse'

export type FfbTestState = {
  active: boolean
  mode: FfbTestMode
  strength: number
}

export type PageId =
  | 'dashboard'
  | 'steering'
  | 'effects'
  | 'profiles'
  | 'cheats'
  | 'settings'

export const EFFECT_LABELS: Record<
  import('../../shared/types').EffectId,
  string
> = {
  road: 'Road',
  kerb: 'Kerb',
  grass: 'Grass',
  suspension: 'Suspension',
  wheelSlip: 'Wheel Slip',
  abs: 'ABS',
  collision: 'Collision',
  engine: 'Engine',
}
