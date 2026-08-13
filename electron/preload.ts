import { contextBridge, ipcRenderer } from 'electron'
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

const api = {
  loadSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:load'),
  saveSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:save', patch),

  loadProfiles: (): Promise<ProfilesStore> => ipcRenderer.invoke('profiles:load'),
  createProfile: (name: string, fromId?: string): Promise<ProfilesStore> =>
    ipcRenderer.invoke('profiles:create', name, fromId),
  deleteProfile: (id: string): Promise<ProfilesStore> =>
    ipcRenderer.invoke('profiles:delete', id),
  renameProfile: (id: string, name: string): Promise<ProfilesStore> =>
    ipcRenderer.invoke('profiles:rename', id, name),
  selectProfile: (id: string): Promise<ProfilesStore> =>
    ipcRenderer.invoke('profiles:select', id),
  updateProfileSettings: (
    id: string,
    settings: ProfileSettings,
  ): Promise<ProfilesStore> =>
    ipcRenderer.invoke('profiles:updateSettings', id, settings),
  resetProfile: (id: string): Promise<ProfilesStore> =>
    ipcRenderer.invoke('profiles:reset', id),
  restoreSettingsBackup: (): Promise<{
    profiles: ProfilesStore
    settings: AppSettings
    ok: boolean
    path: string | null
  }> => ipcRenderer.invoke('settings:restoreBackup'),

  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('shell:openExternal', url),

  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximizeToggle: (): Promise<boolean> =>
    ipcRenderer.invoke('window:maximizeToggle'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: (): Promise<boolean> =>
    ipcRenderer.invoke('window:isMaximized'),
  onWindowState: (
    callback: (state: { maximized: boolean; fullscreen: boolean }) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: { maximized: boolean; fullscreen: boolean },
    ) => callback(state)
    ipcRenderer.on('window:state', listener)
    return () => ipcRenderer.removeListener('window:state', listener)
  },

  shouldUseDarkColors: (): Promise<boolean> =>
    ipcRenderer.invoke('system:shouldUseDarkColors'),
  onSystemThemeChanged: (
    callback: (payload: { shouldUseDarkColors: boolean }) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: { shouldUseDarkColors: boolean },
    ) => callback(payload)
    ipcRenderer.on('theme:systemChanged', listener)
    return () => ipcRenderer.removeListener('theme:systemChanged', listener)
  },

  getAppVersion: (): Promise<string> => ipcRenderer.invoke('update:getVersion'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: (): Promise<boolean> => ipcRenderer.invoke('update:download'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('update:install'),
  openReleasesPage: (): Promise<void> => ipcRenderer.invoke('update:openReleases'),
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus) =>
      callback(status)
    ipcRenderer.on('update:status', listener)
    return () => ipcRenderer.removeListener('update:status', listener)
  },

  mozaGetStatus: (): Promise<MozaHardwareStatus> => ipcRenderer.invoke('moza:getStatus'),
  mozaGetSample: (): Promise<MozaLiveSample> => ipcRenderer.invoke('moza:getSample'),
  mozaSetProfileSettings: (payload: {
    steering: SteeringSettings
    ffb: FfbSettings
    effects?: EffectsSettings
  }): Promise<boolean> => ipcRenderer.invoke('moza:setProfileSettings', payload),
  mozaSetPedalAxisMap: (map: PedalAxisMap): Promise<PedalAxisMap> =>
    ipcRenderer.invoke('moza:setPedalAxisMap', map),
  mozaGetPedalAxisMap: (): Promise<PedalAxisMap> =>
    ipcRenderer.invoke('moza:getPedalAxisMap'),
  mozaSetPedalFloors: (floors: PedalFloors): Promise<PedalFloors> =>
    ipcRenderer.invoke('moza:setPedalFloors', floors),
  mozaGetPedalFloors: (): Promise<PedalFloors> =>
    ipcRenderer.invoke('moza:getPedalFloors'),
  mozaBeginPedalCalStep: (): Promise<{ ok: boolean; baseline: number[] | null }> =>
    ipcRenderer.invoke('moza:beginPedalCalStep'),
  mozaEndPedalCalStep: (): Promise<{
    ok: boolean
    floors: PedalFloors
    axisMap: PedalAxisMap
  }> => ipcRenderer.invoke('moza:endPedalCalStep'),
  mozaLockPedalFloor: (
    role: 'throttle' | 'brake' | 'clutch',
  ): Promise<{
    ok: boolean
    reason?: string
    floors: PedalFloors
    axisMap: PedalAxisMap
  }> => ipcRenderer.invoke('moza:lockPedalFloor', role),
  mozaStartFfbTest: (payload: {
    mode: MozaFfbTestState['mode']
    strength: number
  }): Promise<MozaFfbTestState> => ipcRenderer.invoke('moza:startFfbTest', payload),
  mozaStopFfbTest: (): Promise<MozaFfbTestState> => ipcRenderer.invoke('moza:stopFfbTest'),
  mozaGetFfbTestState: (): Promise<MozaFfbTestState> =>
    ipcRenderer.invoke('moza:getFfbTestState'),
  mozaGetBaseSync: (): Promise<MozaBaseSync | null> =>
    ipcRenderer.invoke('moza:getBaseSync'),
  mozaGetSerialStatus: (): Promise<MozaSerialStatus> =>
    ipcRenderer.invoke('moza:getSerialStatus'),
  mozaRefreshBaseSync: (): Promise<{
    status: MozaSerialStatus
    sync: MozaBaseSync | null
  }> => ipcRenderer.invoke('moza:refreshBaseSync'),
  onMozaStatus: (callback: (status: MozaHardwareStatus) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      status: MozaHardwareStatus,
    ) => callback(status)
    ipcRenderer.on('moza:status', listener)
    return () => ipcRenderer.removeListener('moza:status', listener)
  },
  onMozaSample: (callback: (sample: MozaLiveSample) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      sample: MozaLiveSample,
    ) => callback(sample)
    ipcRenderer.on('moza:sample', listener)
    return () => ipcRenderer.removeListener('moza:sample', listener)
  },
  onMozaBaseSync: (callback: (sync: MozaBaseSync) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, sync: MozaBaseSync) =>
      callback(sync)
    ipcRenderer.on('moza:baseSync', listener)
    return () => ipcRenderer.removeListener('moza:baseSync', listener)
  },

  gtaGetStatus: (): Promise<GtaModStatus> => ipcRenderer.invoke('gta:getStatus'),
  gtaPickFolder: (): Promise<{ ok: boolean; status: GtaModStatus; error?: string }> =>
    ipcRenderer.invoke('gta:pickFolder'),
  gtaEnable: (): Promise<{ ok: boolean; status: GtaModStatus; error?: string }> =>
    ipcRenderer.invoke('gta:enable'),
  gtaDisable: (): Promise<{ ok: boolean; status: GtaModStatus; error?: string }> =>
    ipcRenderer.invoke('gta:disable'),
  gtaUninstall: (
    leaveOnlineSafe?: boolean,
  ): Promise<{ ok: boolean; status: GtaModStatus; error?: string }> =>
    ipcRenderer.invoke('gta:uninstall', leaveOnlineSafe),
  gtaHotReload: (): Promise<{
    ok: boolean
    status: GtaModStatus
    error?: string
    keySent?: boolean
  }> => ipcRenderer.invoke('gta:hotReload'),
  gtaOpenHookHelp: (): Promise<void> => ipcRenderer.invoke('gta:openHookHelp'),
  gtaLaunchStory: (): Promise<{
    ok: boolean
    error?: string
    exe?: string
    store?: 'steam' | 'epic' | 'rockstar' | 'unknown'
    note?: 'disable_battleye_in_launcher' | 'set_epic_launch_options'
  }> => ipcRenderer.invoke('gta:launchStory'),
  gtaOpenFfbLogs: (): Promise<{ ok: boolean; path: string | null; dir: string }> =>
    ipcRenderer.invoke('gta:openFfbLogs'),
  gtaGetLinkStatus: (): Promise<{
    connected: boolean
    lastAt: number | null
    inVehicle: boolean
    vehicle: string
    speedKmh: number
    ffbHostRunning: boolean
    gameRunning: boolean
    pluginMissing: boolean
  }> => ipcRenderer.invoke('gta:getLinkStatus'),
  gtaStartFfbHost: (): Promise<boolean> => ipcRenderer.invoke('gta:startFfbHost'),
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
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      status: {
        connected: boolean
        lastAt: number | null
        inVehicle: boolean
        vehicle: string
        speedKmh: number
        ffbHostRunning: boolean
        gameRunning: boolean
        pluginMissing: boolean
      },
    ) => callback(status)
    ipcRenderer.on('gta:link', listener)
    return () => ipcRenderer.removeListener('gta:link', listener)
  },
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
  ) => {
    const listener = (_event: Electron.IpcRendererEvent, sample: unknown) =>
      callback(sample as never)
    ipcRenderer.on('gta:telemetry', listener)
    return () => ipcRenderer.removeListener('gta:telemetry', listener)
  },
}

contextBridge.exposeInMainWorld('gtamoza', api)

export type GtamozaApi = typeof api
