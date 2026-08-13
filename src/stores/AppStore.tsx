import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { services } from '../services'
import type {
  AppSettings,
  DeviceStatus,
  GtaStatus,
  MozaBaseSync,
  MozaSerialStatus,
  PageId,
  ProfileSettings,
  ProfilesStore,
  TelemetrySample,
  UpdateStatus,
} from '../types'
import { DEFAULT_APP_SETTINGS, createDefaultProfileSettings } from '../../shared/types'

type AppStoreValue = {
  ready: boolean
  page: PageId
  setPage: (page: PageId) => void
  settings: AppSettings
  resolvedTheme: 'dark' | 'light'
  profiles: ProfilesStore
  activeSettings: ProfileSettings
  device: DeviceStatus
  gta: GtaStatus
  telemetry: TelemetrySample
  version: string
  updateStatus: UpdateStatus
  dirty: boolean
  /** Live base settings from COM (Pit House). Null if COM locked / not yet read. */
  baseSync: MozaBaseSync | null
  serialStatus: MozaSerialStatus
  refreshBaseSync: () => Promise<MozaSerialStatus>
  updateAppSettings: (patch: Partial<AppSettings>) => Promise<void>
  updateActiveSettings: (
    patch: Partial<ProfileSettings> | ((prev: ProfileSettings) => ProfileSettings),
  ) => void
  saveActiveProfile: () => Promise<void>
  selectProfile: (id: string) => Promise<void>
  createProfile: (name: string) => Promise<void>
  deleteProfile: (id: string) => Promise<void>
  renameProfile: (id: string, name: string) => Promise<void>
  resetActiveProfile: () => Promise<void>
  checkForUpdates: () => Promise<void>
  downloadUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
}

const AppStoreContext = createContext<AppStoreValue | null>(null)

function resolveTheme(
  theme: AppSettings['theme'],
  systemDark: boolean,
): 'dark' | 'light' {
  if (theme === 'system') return systemDark ? 'dark' : 'light'
  return theme
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [page, setPage] = useState<PageId>('dashboard')
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS)
  const [systemDark, setSystemDark] = useState(true)
  const [profiles, setProfiles] = useState<ProfilesStore>({
    profiles: [],
    selectedProfileId: 'default',
  })
  const [activeSettings, setActiveSettings] = useState<ProfileSettings>(
    createDefaultProfileSettings(),
  )
  const [dirty, setDirty] = useState(false)
  const [device, setDevice] = useState<DeviceStatus>({
    connected: false,
    name: 'MOZA R5',
    model: 'R5',
  })
  const [gta, setGta] = useState<GtaStatus>({
    connected: false,
    mode: 'unknown',
    vehicle: '—',
  })
  const [telemetry, setTelemetry] = useState<TelemetrySample>({
    timestamp: Date.now(),
    speed: 0,
    steeringAngle: 0,
    torque: 0,
    throttle: 0,
    brake: 0,
    clutch: 0,
    throttleRaw: 0,
    brakeRaw: 0,
    clutchRaw: 0,
    lateralG: 0,
    yawRate: 0,
  })
  const [version, setVersion] = useState('0.1.0')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: 'idle' })
  const [baseSync, setBaseSync] = useState<MozaBaseSync | null>(null)
  const [serialStatus, setSerialStatus] = useState<MozaSerialStatus>({
    portOpen: false,
    pedalsLive: false,
    baseLive: false,
    path: null,
    busy: false,
    lastError: null,
    wheelAngleDeg: null,
  })

  const resolvedTheme = resolveTheme(settings.theme, systemDark)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    let cancelled = false

    async function boot() {
      const [loadedSettings, loadedProfiles, appVersion, dark] = await Promise.all([
        services.settings.load(),
        services.profiles.load(),
        services.updates.getVersion(),
        window.gtamoza?.shouldUseDarkColors() ??
          Promise.resolve(window.matchMedia('(prefers-color-scheme: dark)').matches),
      ])
      if (cancelled) return

      setSettings(loadedSettings)
      setProfiles(loadedProfiles)
      setVersion(appVersion)
      setSystemDark(dark)

      const selected =
        loadedProfiles.profiles.find((p) => p.id === loadedProfiles.selectedProfileId) ??
        loadedProfiles.profiles[0]
      if (selected) {
        setActiveSettings(structuredClone(selected.settings))
      }
      setDirty(false)
      setReady(true)
    }

    void boot()

    const unsubDevice = services.device.subscribe(setDevice)
    const unsubGta = services.gta.subscribe(setGta)
    const unsubTelemetry = services.telemetry.subscribe(setTelemetry)
    const unsubUpdate = services.updates.onStatus(setUpdateStatus)
    const unsubSystem = window.gtamoza?.onSystemThemeChanged((payload) => {
      setSystemDark(payload.shouldUseDarkColors)
    })

    const applyBaseSync = (sync: MozaBaseSync) => {
      setBaseSync(sync)
      setSerialStatus((prev) => ({
        ...prev,
        baseLive: true,
        portOpen: true,
        busy: false,
        lastError: null,
        wheelAngleDeg: sync.raw.wheelAngleDeg,
      }))
      setActiveSettings((prev) => {
        const { selfAligningTorque: _ignoreSat, ...ffbFromBase } = sync.ffb
        return {
          ...prev,
          steering: { ...prev.steering, ...sync.steering },
          // Pit House spring must never wipe GTAMOZA auto-centering.
          ffb: {
            ...prev.ffb,
            ...ffbFromBase,
            selfAligningTorque: prev.ffb.selfAligningTorque ?? 68,
          },
        }
      })
    }

    const unsubBase = window.gtamoza?.onMozaBaseSync(applyBaseSync)
    const unsubGtaTel = window.gtamoza?.onGtaTelemetry((sample) => {
      setTelemetry((prev) => ({
        ...prev,
        timestamp: sample.t || Date.now(),
        speed: sample.speed * 3.6,
        lateralG: sample.lateral / 9.81,
        yawRate: sample.yawRate,
      }))
      if (sample.inVehicle && sample.vehicle) {
        setGta((prev) => ({
          ...prev,
          connected: true,
          mode: 'story',
          vehicle: sample.vehicle,
          pluginMissing: false,
          gameRunning: true,
        }))
      }
    })
    void window.gtamoza?.mozaGetBaseSync().then((sync) => {
      if (sync) applyBaseSync(sync)
    })
    const pullStatus = () => {
      void window.gtamoza?.mozaGetSerialStatus().then((s) => {
        if (!s) return
        setSerialStatus(s)
        // Keep last baseSync values in settings; only drop the "live" badge.
        if (!s.baseLive && !s.portOpen) setBaseSync(null)
      })
    }
    pullStatus()
    const serialPoll = window.setInterval(pullStatus, 1500)

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onMq = () => {
      if (!window.gtamoza) setSystemDark(mq.matches)
    }
    mq.addEventListener('change', onMq)

    return () => {
      cancelled = true
      unsubDevice()
      unsubGta()
      unsubTelemetry()
      unsubUpdate()
      unsubSystem?.()
      unsubBase?.()
      unsubGtaTel?.()
      window.clearInterval(serialPoll)
      mq.removeEventListener('change', onMq)
    }
  }, [])

  const updateAppSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const next = await services.settings.save(patch)
    setSettings(next)
  }, [])

  const updateActiveSettings = useCallback(
    (patch: Partial<ProfileSettings> | ((prev: ProfileSettings) => ProfileSettings)) => {
      setActiveSettings((prev) => {
        const next =
          typeof patch === 'function'
            ? patch(prev)
            : {
                steering: { ...prev.steering, ...patch.steering },
                ffb: { ...prev.ffb, ...patch.ffb },
                effects: { ...prev.effects, ...patch.effects },
              }
        return next
      })
      setDirty(true)
    },
    [],
  )

  const saveActiveProfile = useCallback(async () => {
    const next = await services.profiles.updateSettings(
      profiles.selectedProfileId,
      activeSettings,
    )
    setProfiles(next)
    setDirty(false)
  }, [profiles.selectedProfileId, activeSettings])

  const selectProfile = useCallback(
    async (id: string) => {
      if (dirty) {
        await services.profiles.updateSettings(profiles.selectedProfileId, activeSettings)
      }
      const next = await services.profiles.select(id)
      setProfiles(next)
      await services.settings.save({ selectedProfileId: next.selectedProfileId })
      const selected = next.profiles.find((p) => p.id === next.selectedProfileId)
      if (selected) setActiveSettings(structuredClone(selected.settings))
      setDirty(false)
    },
    [dirty, profiles.selectedProfileId, activeSettings],
  )

  const createProfile = useCallback(async (name: string) => {
    // Factory DEFAULT_* baseline — not a clone of the currently selected profile
    const next = await services.profiles.create(name)
    setProfiles(next)
    const selected = next.profiles.find((p) => p.id === next.selectedProfileId)
    if (selected) setActiveSettings(structuredClone(selected.settings))
    setDirty(false)
  }, [])

  const deleteProfile = useCallback(async (id: string) => {
    const next = await services.profiles.remove(id)
    setProfiles(next)
    const selected = next.profiles.find((p) => p.id === next.selectedProfileId)
    if (selected) setActiveSettings(structuredClone(selected.settings))
    setDirty(false)
  }, [])

  const renameProfile = useCallback(async (id: string, name: string) => {
    const next = await services.profiles.rename(id, name)
    setProfiles(next)
  }, [])

  const resetActiveProfile = useCallback(async () => {
    const next = await services.profiles.reset(profiles.selectedProfileId)
    setProfiles(next)
    const selected = next.profiles.find((p) => p.id === next.selectedProfileId)
    if (selected) setActiveSettings(structuredClone(selected.settings))
    setDirty(false)
  }, [profiles.selectedProfileId])

  const checkForUpdates = useCallback(async () => {
    setUpdateStatus({ state: 'checking' })
    const result = await services.updates.check()
    if (result) setUpdateStatus(result as UpdateStatus)
  }, [])

  const downloadUpdate = useCallback(async () => {
    await services.updates.download()
  }, [])

  const installUpdate = useCallback(async () => {
    await services.updates.install()
  }, [])

  const refreshBaseSync = useCallback(async () => {
    if (!window.gtamoza) {
      return {
        portOpen: false,
        pedalsLive: false,
        baseLive: false,
        path: null,
        busy: false,
        lastError: null,
        wheelAngleDeg: null,
      } satisfies MozaSerialStatus
    }
    const result = await window.gtamoza.mozaRefreshBaseSync()
    setSerialStatus(result.status)
    if (result.sync) {
      setBaseSync(result.sync)
      setActiveSettings((prev) => ({
        ...prev,
        steering: { ...prev.steering, ...result.sync!.steering },
        ffb: { ...prev.ffb, ...result.sync!.ffb },
      }))
    }
    // Status after release — COM should be free for Pit House again
    const released = await window.gtamoza.mozaGetSerialStatus()
    setSerialStatus(released)
    return released
  }, [])

  useEffect(() => {
    if (!window.gtamoza || !ready) return
    void window.gtamoza.mozaSetProfileSettings({
      steering: activeSettings.steering,
      ffb: activeSettings.ffb,
      effects: activeSettings.effects,
    })
  }, [activeSettings, ready])

  const value = useMemo<AppStoreValue>(
    () => ({
      ready,
      page,
      setPage,
      settings,
      resolvedTheme,
      profiles,
      activeSettings,
      device,
      gta,
      telemetry,
      version,
      updateStatus,
      dirty,
      baseSync,
      serialStatus,
      refreshBaseSync,
      updateAppSettings,
      updateActiveSettings,
      saveActiveProfile,
      selectProfile,
      createProfile,
      deleteProfile,
      renameProfile,
      resetActiveProfile,
      checkForUpdates,
      downloadUpdate,
      installUpdate,
    }),
    [
      ready,
      page,
      settings,
      resolvedTheme,
      profiles,
      activeSettings,
      device,
      gta,
      telemetry,
      version,
      updateStatus,
      dirty,
      baseSync,
      serialStatus,
      refreshBaseSync,
      updateAppSettings,
      updateActiveSettings,
      saveActiveProfile,
      selectProfile,
      createProfile,
      deleteProfile,
      renameProfile,
      resetActiveProfile,
      checkForUpdates,
      downloadUpdate,
      installUpdate,
    ],
  )

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

export function useAppStore() {
  const ctx = useContext(AppStoreContext)
  if (!ctx) throw new Error('useAppStore must be used within AppStoreProvider')
  return ctx
}
