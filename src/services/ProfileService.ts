import type { AppSettings, Profile, ProfileSettings, ProfilesStore } from '../types'

export interface ProfileService {
  load(): Promise<ProfilesStore>
  create(name: string, fromId?: string): Promise<ProfilesStore>
  remove(id: string): Promise<ProfilesStore>
  rename(id: string, name: string): Promise<ProfilesStore>
  select(id: string): Promise<ProfilesStore>
  updateSettings(id: string, settings: ProfileSettings): Promise<ProfilesStore>
  reset(id: string): Promise<ProfilesStore>
  getSelected(store: ProfilesStore): Profile | undefined
}

export interface SettingsService {
  load(): Promise<AppSettings>
  save(patch: Partial<AppSettings>): Promise<AppSettings>
  restoreBackup(): Promise<{
    profiles: ProfilesStore
    settings: AppSettings
    ok: boolean
  }>
}

export interface UpdateService {
  getVersion(): Promise<string>
  check(): Promise<unknown>
  download(): Promise<boolean>
  install(): Promise<void>
  openReleases(): Promise<void>
  onStatus(callback: (status: import('../types').UpdateStatus) => void): () => void
}
