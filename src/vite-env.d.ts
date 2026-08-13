/// <reference types="vite/client" />

import type {
  AppSettings,
  EffectsSettings,
  FfbSettings,
  GtaModStatus,
  MozaBaseSync,
  MozaSerialStatus,
  PedalAxisMap,
  PedalFloors,
  ProfileSettings,
  ProfilesStore,
  SteeringSettings,
  UpdateStatus,
} from '../shared/types'

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
  rawAxis: number
  steeringAngle: number
  torque: number
  throttle: number
  brake: number
  clutch: number
  throttleRaw: number
  brakeRaw: number
  clutchRaw: number
  rawAxes: number[]
  connected: boolean
}

export type MozaFfbTestState = {
  active: boolean
  mode: 'constant' | 'sine' | 'spring' | 'damper' | 'pulse'
  strength: number
}

export type GtamozaApi = {
  loadSettings: () => Promise<AppSettings>
  saveSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>
  loadProfiles: () => Promise<ProfilesStore>
  createProfile: (name: string, fromId?: string) => Promise<ProfilesStore>
  deleteProfile: (id: string) => Promise<ProfilesStore>
  renameProfile: (id: string, name: string) => Promise<ProfilesStore>
  selectProfile: (id: string) => Promise<ProfilesStore>
  updateProfileSettings: (
    id: string,
    settings: ProfileSettings,
  ) => Promise<ProfilesStore>
  resetProfile: (id: string) => Promise<ProfilesStore>
  restoreSettingsBackup: () => Promise<{
    profiles: ProfilesStore
    settings: AppSettings
    ok: boolean
    path: string | null
  }>
  openExternal: (url: string) => Promise<void>
  windowMinimize: () => Promise<void>
  windowMaximizeToggle: () => Promise<boolean>
  windowClose: () => Promise<void>
  windowIsMaximized: () => Promise<boolean>
  onWindowState: (
    callback: (state: { maximized: boolean; fullscreen: boolean }) => void,
  ) => (() => void) | undefined
  shouldUseDarkColors: () => Promise<boolean>
  onSystemThemeChanged: (
    callback: (payload: { shouldUseDarkColors: boolean }) => void,
  ) => () => void
  getAppVersion: () => Promise<string>
  checkForUpdates: () => Promise<UpdateStatus | null>
  downloadUpdate: () => Promise<boolean>
  installUpdate: () => Promise<void>
  openReleasesPage: () => Promise<void>
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void
  mozaGetStatus: () => Promise<MozaHardwareStatus>
  mozaGetSample: () => Promise<MozaLiveSample>
  mozaSetProfileSettings: (payload: {
    steering: SteeringSettings
    ffb: FfbSettings
    effects?: EffectsSettings
  }) => Promise<boolean>
  mozaSetPedalAxisMap: (map: PedalAxisMap) => Promise<PedalAxisMap>
  mozaGetPedalAxisMap: () => Promise<PedalAxisMap>
  mozaSetPedalFloors: (floors: PedalFloors) => Promise<PedalFloors>
  mozaGetPedalFloors: () => Promise<PedalFloors>
  mozaBeginPedalCalStep: () => Promise<{ ok: boolean; baseline: number[] | null }>
  mozaEndPedalCalStep: () => Promise<{
    ok: boolean
    floors: PedalFloors
    axisMap: PedalAxisMap
  }>
  mozaLockPedalFloor: (role: 'throttle' | 'brake' | 'clutch') => Promise<{
    ok: boolean
    reason?: string
    floors: PedalFloors
    axisMap: PedalAxisMap
  }>
  mozaStartFfbTest: (payload: {
    mode: MozaFfbTestState['mode']
    strength: number
  }) => Promise<MozaFfbTestState>
  mozaStopFfbTest: () => Promise<MozaFfbTestState>
  mozaGetFfbTestState: () => Promise<MozaFfbTestState>
  mozaGetBaseSync: () => Promise<MozaBaseSync | null>
  mozaGetSerialStatus: () => Promise<MozaSerialStatus>
  mozaRefreshBaseSync: () => Promise<{
    status: MozaSerialStatus
    sync: MozaBaseSync | null
  }>
  onMozaStatus: (callback: (status: MozaHardwareStatus) => void) => () => void
  onMozaSample: (callback: (sample: MozaLiveSample) => void) => () => void
  onMozaBaseSync: (callback: (sync: MozaBaseSync) => void) => () => void
  gtaGetStatus: () => Promise<GtaModStatus>
  gtaPickFolder: () => Promise<{ ok: boolean; status: GtaModStatus; error?: string }>
  gtaEnable: () => Promise<{ ok: boolean; status: GtaModStatus; error?: string }>
  gtaDisable: () => Promise<{ ok: boolean; status: GtaModStatus; error?: string }>
  gtaUninstall: (
    leaveOnlineSafe?: boolean,
  ) => Promise<{ ok: boolean; status: GtaModStatus; error?: string }>
  gtaHotReload: () => Promise<{
    ok: boolean
    status: GtaModStatus
    error?: string
    keySent?: boolean
  }>
  gtaOpenHookHelp: () => Promise<void>
  gtaLaunchStory: () => Promise<{
    ok: boolean
    error?: string
    exe?: string
    store?: 'steam' | 'epic' | 'rockstar' | 'unknown'
    note?: 'disable_battleye_in_launcher' | 'set_epic_launch_options'
  }>
  gtaGetLinkStatus: () => Promise<{
    connected: boolean
    lastAt: number | null
    inVehicle: boolean
    vehicle: string
    speedKmh: number
    ffbHostRunning: boolean
    gameRunning: boolean
    pluginMissing: boolean
  }>
  gtaStartFfbHost: () => Promise<boolean>
  gtaOpenFfbLogs: () => Promise<{ ok: boolean; path: string | null; dir: string }>
  onGtaLink: (
    callback: (status: {
      connected: boolean
      lastAt: number | null
      inVehicle: boolean
      vehicle: string
      speedKmh: number
      ffbHostRunning: boolean
      gameRunning: boolean
      pluginMissing: boolean
    }) => void,
  ) => () => void
  onGtaTelemetry: (
    callback: (sample: {
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
      surface: string
      vehicle: string
    }) => void,
  ) => () => void
}

declare global {
  interface Window {
    gtamoza?: GtamozaApi
  }
}

export {}
