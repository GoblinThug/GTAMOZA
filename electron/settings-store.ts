import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_CHEATS,
  DEFAULT_PEDAL_AXIS_MAP,
  DEFAULT_PEDAL_FLOORS,
  type AppLocale,
  type AppSettings,
  type AppTheme,
  type CheatFeatureSettings,
  type CheatsSettings,
  type PedalAxisMap,
  type PedalFloorPoint,
  type PedalFloors,
  type UpdateChannel,
} from './types'
import { writeCheatsConfig } from './gta/cheats-bridge'

const FILE_NAME = 'settings.json'

function settingsPath() {
  return path.join(app.getPath('userData'), FILE_NAME)
}

function isTheme(value: unknown): value is AppTheme {
  return value === 'dark' || value === 'light' || value === 'system'
}

function isLocale(value: unknown): value is AppLocale {
  return value === 'en' || value === 'ru'
}

function isChannel(value: unknown): value is UpdateChannel {
  return value === 'stable' || value === 'beta'
}

function normalizePedalMap(raw: Partial<PedalAxisMap> | null | undefined): PedalAxisMap {
  const clampIdx = (n: unknown, fallback: number) =>
    typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 7 ? Math.round(n) : fallback
  return {
    throttle: clampIdx(raw?.throttle, DEFAULT_PEDAL_AXIS_MAP.throttle),
    brake: clampIdx(raw?.brake, DEFAULT_PEDAL_AXIS_MAP.brake),
    clutch: clampIdx(raw?.clutch, DEFAULT_PEDAL_AXIS_MAP.clutch),
  }
}

function normalizeFloorPoint(raw: unknown): PedalFloorPoint | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Partial<PedalFloorPoint>
  if (
    typeof p.axis !== 'number' ||
    typeof p.rest !== 'number' ||
    typeof p.extreme !== 'number' ||
    (p.dir !== 1 && p.dir !== -1)
  ) {
    return null
  }
  const axis = Math.round(p.axis)
  if (axis < 1 || axis > 7) return null

  const linear = Math.abs(p.extreme - p.rest)
  let maxTravel =
    typeof p.maxTravel === 'number' && Number.isFinite(p.maxTravel)
      ? Math.max(0, Math.round(p.maxTravel))
      : 0

  // Full unwrap travel is ~0..64000; modular 65535 junk saves are rejected.
  if (maxTravel >= 65_000) return null
  if (maxTravel > 64_000) maxTravel = 64_000

  if (linear < 800) {
    if (maxTravel < 10_000) return null
    return {
      axis,
      rest: p.rest,
      extreme: p.extreme,
      dir: p.dir,
      maxTravel,
    }
  }

  const direct =
    p.dir === 1
      ? Math.max(0, p.extreme - p.rest)
      : Math.max(0, p.rest - p.extreme)
  if (!maxTravel) maxTravel = direct
  if (maxTravel < 800 && direct < 800) return null
  maxTravel = Math.min(64_000, Math.max(maxTravel, direct))

  return {
    axis,
    rest: p.rest,
    extreme: p.extreme,
    dir: p.dir,
    maxTravel,
  }
}

function normalizePedalFloors(raw: Partial<PedalFloors> | null | undefined): PedalFloors {
  return {
    throttle: normalizeFloorPoint(raw?.throttle) ?? DEFAULT_PEDAL_FLOORS.throttle,
    brake: normalizeFloorPoint(raw?.brake) ?? DEFAULT_PEDAL_FLOORS.brake,
    clutch: normalizeFloorPoint(raw?.clutch) ?? DEFAULT_PEDAL_FLOORS.clutch,
  }
}

function normalizeFeature(
  raw: Partial<CheatFeatureSettings> | null | undefined,
  fallback: CheatFeatureSettings,
): CheatFeatureSettings {
  return {
    enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : fallback.enabled,
    hotkey:
      typeof raw?.hotkey === 'string' && raw.hotkey.trim()
        ? raw.hotkey.trim()
        : fallback.hotkey,
  }
}

function normalizeCheats(raw: Partial<CheatsSettings> | null | undefined): CheatsSettings {
  return {
    enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : DEFAULT_CHEATS.enabled,
    godMode: normalizeFeature(raw?.godMode, DEFAULT_CHEATS.godMode),
    noPolice: normalizeFeature(raw?.noPolice, DEFAULT_CHEATS.noPolice),
    spawnCar: normalizeFeature(raw?.spawnCar, DEFAULT_CHEATS.spawnCar),
    timeOfDay: normalizeFeature(raw?.timeOfDay, DEFAULT_CHEATS.timeOfDay),
  }
}

function normalize(raw: Partial<AppSettings> | null | undefined): AppSettings {
  return {
    theme: isTheme(raw?.theme) ? raw.theme : DEFAULT_APP_SETTINGS.theme,
    locale: isLocale(raw?.locale) ? raw.locale : DEFAULT_APP_SETTINGS.locale,
    startWithWindows:
      typeof raw?.startWithWindows === 'boolean'
        ? raw.startWithWindows
        : DEFAULT_APP_SETTINGS.startWithWindows,
    minimizeToTray:
      typeof raw?.minimizeToTray === 'boolean'
        ? raw.minimizeToTray
        : DEFAULT_APP_SETTINGS.minimizeToTray,
    autoUpdates:
      typeof raw?.autoUpdates === 'boolean'
        ? raw.autoUpdates
        : DEFAULT_APP_SETTINGS.autoUpdates,
    updateChannel: isChannel(raw?.updateChannel)
      ? raw.updateChannel
      : DEFAULT_APP_SETTINGS.updateChannel,
    selectedProfileId:
      typeof raw?.selectedProfileId === 'string' && raw.selectedProfileId
        ? raw.selectedProfileId
        : DEFAULT_APP_SETTINGS.selectedProfileId,
    pedalAxisMap: normalizePedalMap(raw?.pedalAxisMap),
    pedalFloors: normalizePedalFloors(raw?.pedalFloors),
    gtaGamePath:
      typeof raw?.gtaGamePath === 'string' && raw.gtaGamePath.trim()
        ? raw.gtaGamePath.trim()
        : null,
    cheats: normalizeCheats(raw?.cheats),
    // Missing field ⇒ existing install — don't force the wizard again
    onboardingCompleted:
      typeof raw?.onboardingCompleted === 'boolean'
        ? raw.onboardingCompleted
        : raw != null
          ? true
          : DEFAULT_APP_SETTINGS.onboardingCompleted,
  }
}

export function loadSettings(): AppSettings {
  const file = settingsPath()
  const dir = path.dirname(file)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  if (!fs.existsSync(file)) {
    const settings = normalize(DEFAULT_APP_SETTINGS)
    fs.writeFileSync(file, JSON.stringify(settings, null, 2), 'utf8')
    writeCheatsConfig(settings.cheats)
    return settings
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<AppSettings>
    const settings = normalize(parsed)
    writeCheatsConfig(settings.cheats)
    return settings
  } catch {
    const settings = normalize(DEFAULT_APP_SETTINGS)
    writeCheatsConfig(settings.cheats)
    return settings
  }
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const current = loadSettings()
  const next = normalize({
    ...current,
    ...patch,
    cheats: patch.cheats ? normalizeCheats({ ...current.cheats, ...patch.cheats }) : current.cheats,
  })
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), 'utf8')
  writeCheatsConfig(next.cheats)
  return next
}
