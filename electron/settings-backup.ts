/**
 * Factory settings backup — locked ideal snapshot for full restore.
 * Source: config/settings-backup.json (do not confuse with live userData).
 */
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { AppSettings, Profile, ProfileSettings, ProfilesStore } from './types'
import { loadProfiles, saveProfiles } from './profile-store'
import { loadSettings, saveSettings } from './settings-store'

export type SettingsBackupFile = {
  version: number
  label?: string
  description?: string
  createdAt?: string
  tuningRevision?: number
  profiles: {
    selectedProfileId: string
    tuningRevision?: number
    profiles: Array<{
      id: string
      name: string
      settings: ProfileSettings
    }>
  }
  appSettings: Partial<AppSettings>
}

function backupCandidates(): string[] {
  return [
    // Dev / unpackaged
    path.join(app.getAppPath(), 'config', 'settings-backup.json'),
    path.join(process.cwd(), 'config', 'settings-backup.json'),
    // Packaged extraResources
    path.join(process.resourcesPath, 'config', 'settings-backup.json'),
  ]
}

export function resolveSettingsBackupPath(): string | null {
  for (const p of backupCandidates()) {
    if (fs.existsSync(p)) return p
  }
  return null
}

export function loadSettingsBackup(): SettingsBackupFile | null {
  const file = resolveSettingsBackupPath()
  if (!file) {
    console.warn('[settings-backup] config/settings-backup.json not found')
    return null
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as SettingsBackupFile
  } catch (err) {
    console.warn('[settings-backup] failed to parse', err)
    return null
  }
}

export function getBackupProfileSettings(id: string): ProfileSettings | null {
  const backup = loadSettingsBackup()
  const entry = backup?.profiles?.profiles?.find((p) => p.id === id)
  return entry ? structuredClone(entry.settings) : null
}

/**
 * Restore every profile + selected id from the locked backup.
 * Custom user profiles (non-backup ids) are kept but factory ones are replaced.
 */
export function restoreProfilesFromBackup(): ProfilesStore {
  const backup = loadSettingsBackup()
  if (!backup?.profiles?.profiles?.length) {
    return loadProfiles()
  }

  const stamp = new Date().toISOString()
  const current = loadProfiles()
  const byId = new Map(current.profiles.map((p) => [p.id, p]))
  const restored: Profile[] = backup.profiles.profiles.map((p) => {
    const prev = byId.get(p.id)
    return {
      id: p.id,
      name: p.name,
      settings: structuredClone(p.settings),
      createdAt: prev?.createdAt ?? stamp,
      updatedAt: stamp,
    }
  })

  // Keep custom profiles that are not in the backup
  const backupIds = new Set(restored.map((p) => p.id))
  for (const p of current.profiles) {
    if (!backupIds.has(p.id)) restored.push(p)
  }

  const selected =
    backup.profiles.selectedProfileId &&
    restored.some((p) => p.id === backup.profiles.selectedProfileId)
      ? backup.profiles.selectedProfileId
      : restored[0]?.id ?? 'default'

  return saveProfiles({
    profiles: restored,
    selectedProfileId: selected,
    tuningRevision: backup.tuningRevision ?? backup.profiles.tuningRevision,
  })
}

/**
 * Restore app settings from backup.
 * Keeps the current gtaGamePath (machine-specific) unless missing.
 */
export function restoreAppSettingsFromBackup(): AppSettings {
  const backup = loadSettingsBackup()
  const current = loadSettings()
  if (!backup?.appSettings) return current

  const patch = structuredClone(backup.appSettings)
  // Never wipe a configured game folder with null from the snapshot
  if (!patch.gtaGamePath) {
    delete patch.gtaGamePath
  }

  return saveSettings({
    ...patch,
    gtaGamePath: current.gtaGamePath ?? patch.gtaGamePath ?? null,
    selectedProfileId:
      patch.selectedProfileId ?? current.selectedProfileId ?? 'default',
  })
}

/** Full restore: all profiles + app settings from config/settings-backup.json */
export function restoreAllFromBackup(): {
  profiles: ProfilesStore
  settings: AppSettings
  ok: boolean
  path: string | null
} {
  const file = resolveSettingsBackupPath()
  const profiles = restoreProfilesFromBackup()
  const settings = restoreAppSettingsFromBackup()
  return { profiles, settings, ok: Boolean(file), path: file }
}
