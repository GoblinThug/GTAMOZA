import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import {
  createDefaultProfileSettings,
  DEFAULT_EFFECTS,
  DEFAULT_FFB,
  DEFAULT_STEERING,
  FFB_TUNE_REVISION,
  type Profile,
  type ProfileSettings,
  type ProfilesStore,
} from './types'

const FILE_NAME = 'profiles.json'

function profilesPath() {
  return path.join(app.getPath('userData'), FILE_NAME)
}

function nowIso() {
  return new Date().toISOString()
}

function makeId() {
  return `profile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function createBuiltinProfiles(): Profile[] {
  const stamp = nowIso()
  // All presets start from DEFAULT_* (current Default baseline), then diverge by role.
  const builtins: Array<{ id: string; name: string; tweak?: (s: ProfileSettings) => void }> = [
    { id: 'default', name: 'Default' },
    {
      id: 'sports',
      name: 'Sports',
      tweak: (s) => {
        // Quicker street cars — livelier rim, more kerb/road, slightly less park-magnet SAT
        s.steering.sensitivity = 72
        s.steering.linearity = 24
        s.ffb.overallStrength = 100
        s.ffb.selfAligningTorque = 44
        s.ffb.damping = 48
        s.ffb.friction = 14
        s.ffb.inertia = 14
        s.ffb.smoothing = 24
        s.effects.road.strength = 24
        s.effects.kerb.strength = 64
        s.effects.suspension.strength = 64
        s.effects.wheelSlip.strength = 34
        s.effects.collision.strength = 66
        s.effects.engine.strength = 10
      },
    },
    {
      id: 'supercars',
      name: 'Supercars',
      tweak: (s) => {
        // Heavy front-end / high-speed stability — stronger SAT + damper, sharper detail
        s.steering.sensitivity = 68
        s.steering.linearity = 34
        s.ffb.overallStrength = 100
        s.ffb.selfAligningTorque = 48
        s.ffb.damping = 58
        s.ffb.friction = 15
        s.ffb.inertia = 18
        s.ffb.smoothing = 22
        s.effects.road.strength = 20
        s.effects.kerb.strength = 68
        s.effects.suspension.strength = 70
        s.effects.wheelSlip.strength = 30
        s.effects.collision.strength = 70
        s.effects.abs.strength = 24
        s.effects.engine.strength = 8
      },
    },
    {
      id: 'drift',
      name: 'Drift',
      tweak: (s) => {
        // Loose rear — weak SAT, lots of slip texture, quieter road, more lock
        s.steering.wheelAngle = 1080
        s.steering.sensitivity = 100
        s.steering.linearity = 22
        s.steering.deadzone = 0
        s.ffb.overallStrength = 92
        s.ffb.selfAligningTorque = 38
        s.ffb.damping = 16
        s.ffb.friction = 8
        s.ffb.inertia = 8
        s.ffb.smoothing = 18
        s.effects.road.strength = 36
        s.effects.kerb.strength = 70
        s.effects.suspension.strength = 58
        s.effects.wheelSlip.strength = 88
        s.effects.collision.strength = 58
        s.effects.abs.strength = 28
        s.effects.engine.strength = 42
      },
    },
    {
      id: 'offroad',
      name: 'Offroad',
      tweak: (s) => {
        // Soft / weighty — grass + suspension + hits, more mechanical drag
        s.steering.sensitivity = 52
        s.steering.linearity = 32
        s.steering.deadzone = 3
        s.ffb.overallStrength = 94
        s.ffb.selfAligningTorque = 54
        s.ffb.damping = 42
        s.ffb.friction = 20
        s.ffb.inertia = 18
        s.ffb.smoothing = 24
        s.effects.road.strength = 48
        s.effects.kerb.strength = 72
        s.effects.grass.strength = 78
        s.effects.suspension.strength = 88
        s.effects.wheelSlip.strength = 62
        s.effects.collision.strength = 86
        s.effects.engine.strength = 28
      },
    },
  ]

  return builtins.map(({ id, name, tweak }) => {
    const settings = createDefaultProfileSettings()
    tweak?.(settings)
    return { id, name, settings, createdAt: stamp, updatedAt: stamp }
  })
}

function normalizeProfile(raw: Partial<Profile>): Profile | null {
  if (!raw || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null
  const base = createDefaultProfileSettings()
  const settings: ProfileSettings = {
    steering: { ...base.steering, ...(raw.settings?.steering ?? {}) },
    ffb: { ...base.ffb, ...(raw.settings?.ffb ?? {}) },
    effects: {
      ...base.effects,
      ...(raw.settings?.effects ?? {}),
    },
  }
  return {
    id: raw.id,
    name: raw.name,
    settings,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : nowIso(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : nowIso(),
  }
}

function normalizeStore(raw: Partial<ProfilesStore> | null | undefined): ProfilesStore {
  const defaults = createBuiltinProfiles()
  const parsed = Array.isArray(raw?.profiles)
    ? (raw!.profiles.map(normalizeProfile).filter(Boolean) as Profile[])
    : []

  const byId = new Map<string, Profile>()
  for (const profile of defaults) byId.set(profile.id, profile)
  for (const profile of parsed) byId.set(profile.id, profile)

  let profiles = Array.from(byId.values())
  const selectedProfileId =
    typeof raw?.selectedProfileId === 'string' &&
    profiles.some((p) => p.id === raw.selectedProfileId)
      ? raw.selectedProfileId
      : 'default'

  const prevRev = typeof raw?.tuningRevision === 'number' ? raw.tuningRevision : 0
  let tuningRevision = prevRev
  if (prevRev < FFB_TUNE_REVISION) {
    const stamp = nowIso()
    const builtinById = new Map(defaults.map((p) => [p.id, p]))
    profiles = profiles.map((p) => {
      const builtin = builtinById.get(p.id)
      if (builtin) {
        return {
          ...p,
          settings: structuredClone(builtin.settings),
          updatedAt: stamp,
        }
      }
      // Custom profiles keep steering identity; FFB/effects get the feedback baseline
      return {
        ...p,
        settings: {
          ...p.settings,
          steering: { ...DEFAULT_STEERING, ...p.settings.steering },
          ffb: {
            ...structuredClone(DEFAULT_FFB),
            enabled: p.settings.ffb?.enabled !== false,
          },
          effects: structuredClone(DEFAULT_EFFECTS),
        },
        updatedAt: stamp,
      }
    })
    tuningRevision = FFB_TUNE_REVISION
    console.log(`[profiles] applied FFB tune revision ${FFB_TUNE_REVISION}`)
  }

  return { profiles, selectedProfileId, tuningRevision }
}

function writeStore(store: ProfilesStore): ProfilesStore {
  const file = profilesPath()
  const dir = path.dirname(file)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(file, JSON.stringify(store, null, 2), 'utf8')
  return store
}

export function loadProfiles(): ProfilesStore {
  const file = profilesPath()
  if (!fs.existsSync(file)) {
    return writeStore(normalizeStore(null))
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<ProfilesStore>
    return writeStore(normalizeStore(parsed))
  } catch {
    return writeStore(normalizeStore(null))
  }
}

export function saveProfiles(store: ProfilesStore): ProfilesStore {
  return writeStore(normalizeStore(store))
}

export function createProfile(name: string, _fromId?: string): ProfilesStore {
  const store = loadProfiles()
  const stamp = nowIso()
  // Always start from factory DEFAULT_* (current Default baseline) — not a clone of the active profile.
  const profile: Profile = {
    id: makeId(),
    name: name.trim() || 'New Profile',
    settings: createDefaultProfileSettings(),
    createdAt: stamp,
    updatedAt: stamp,
  }

  store.profiles.push(profile)
  store.selectedProfileId = profile.id
  return writeStore(store)
}

export function deleteProfile(id: string): ProfilesStore {
  const store = loadProfiles()
  if (id === 'default') return store
  store.profiles = store.profiles.filter((p) => p.id !== id)
  if (store.selectedProfileId === id) {
    store.selectedProfileId = 'default'
  }
  return writeStore(store)
}

export function renameProfile(id: string, name: string): ProfilesStore {
  const store = loadProfiles()
  const profile = store.profiles.find((p) => p.id === id)
  if (!profile) return store
  profile.name = name.trim() || profile.name
  profile.updatedAt = nowIso()
  return writeStore(store)
}

export function selectProfile(id: string): ProfilesStore {
  const store = loadProfiles()
  if (!store.profiles.some((p) => p.id === id)) return store
  store.selectedProfileId = id
  return writeStore(store)
}

export function updateProfileSettings(
  id: string,
  settings: ProfileSettings,
): ProfilesStore {
  const store = loadProfiles()
  const profile = store.profiles.find((p) => p.id === id)
  if (!profile) return store
  profile.settings = structuredClone(settings)
  profile.updatedAt = nowIso()
  return writeStore(store)
}

export function resetProfile(id: string): ProfilesStore {
  const store = loadProfiles()
  const profile = store.profiles.find((p) => p.id === id)
  if (!profile) return store

  // Prefer locked backup snapshot when present (ideal factory lock).
  try {
    // Lazy require avoids circular import with settings-backup → profile-store
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getBackupProfileSettings } = require('./settings-backup') as {
      getBackupProfileSettings: (id: string) => ProfileSettings | null
    }
    const fromBackup = getBackupProfileSettings(id)
    if (fromBackup) {
      profile.settings = fromBackup
      profile.updatedAt = nowIso()
      return writeStore(store)
    }
  } catch {
    /* fall through */
  }

  // Builtin presets (Sports / Drift / …) restore their template; everything else → factory Default.
  const builtins = createBuiltinProfiles()
  const builtin = builtins.find((p) => p.id === id)
  profile.settings = builtin
    ? structuredClone(builtin.settings)
    : createDefaultProfileSettings()
  profile.updatedAt = nowIso()
  return writeStore(store)
}
