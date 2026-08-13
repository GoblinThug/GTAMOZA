import type { ProfileService, SettingsService, UpdateService } from '../ProfileService'
import type { AppSettings, Profile, ProfileSettings, ProfilesStore, UpdateStatus } from '../../types'
import { DEFAULT_APP_SETTINGS, createDefaultProfileSettings } from '../../../shared/types'

function memoryProfiles(): ProfilesStore {
  const stamp = new Date().toISOString()
  const settings = createDefaultProfileSettings()
  return {
    selectedProfileId: 'default',
    profiles: [
      { id: 'default', name: 'Default', settings, createdAt: stamp, updatedAt: stamp },
      {
        id: 'sports',
        name: 'Sports',
        settings: structuredClone(settings),
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: 'supercars',
        name: 'Supercars',
        settings: structuredClone(settings),
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: 'drift',
        name: 'Drift',
        settings: structuredClone(settings),
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: 'offroad',
        name: 'Offroad',
        settings: structuredClone(settings),
        createdAt: stamp,
        updatedAt: stamp,
      },
    ],
  }
}

export class ElectronProfileService implements ProfileService {
  private fallback = memoryProfiles()

  private api() {
    return window.gtamoza
  }

  async load() {
    if (!this.api()) return this.fallback
    this.fallback = await this.api()!.loadProfiles()
    return this.fallback
  }

  async create(name: string, fromId?: string) {
    if (!this.api()) {
      const source =
        this.fallback.profiles.find((p) => p.id === fromId) ??
        this.fallback.profiles.find((p) => p.id === this.fallback.selectedProfileId)!
      const profile: Profile = {
        id: `profile_${Date.now()}`,
        name,
        settings: structuredClone(source.settings),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      this.fallback = {
        profiles: [...this.fallback.profiles, profile],
        selectedProfileId: profile.id,
      }
      return this.fallback
    }
    this.fallback = await this.api()!.createProfile(name, fromId)
    return this.fallback
  }

  async remove(id: string) {
    if (!this.api()) {
      this.fallback = {
        profiles: this.fallback.profiles.filter((p) => p.id !== id),
        selectedProfileId:
          this.fallback.selectedProfileId === id ? 'default' : this.fallback.selectedProfileId,
      }
      return this.fallback
    }
    this.fallback = await this.api()!.deleteProfile(id)
    return this.fallback
  }

  async rename(id: string, name: string) {
    if (!this.api()) {
      this.fallback = {
        ...this.fallback,
        profiles: this.fallback.profiles.map((p) =>
          p.id === id ? { ...p, name, updatedAt: new Date().toISOString() } : p,
        ),
      }
      return this.fallback
    }
    this.fallback = await this.api()!.renameProfile(id, name)
    return this.fallback
  }

  async select(id: string) {
    if (!this.api()) {
      this.fallback = { ...this.fallback, selectedProfileId: id }
      return this.fallback
    }
    this.fallback = await this.api()!.selectProfile(id)
    return this.fallback
  }

  async updateSettings(id: string, settings: ProfileSettings) {
    if (!this.api()) {
      this.fallback = {
        ...this.fallback,
        profiles: this.fallback.profiles.map((p) =>
          p.id === id
            ? { ...p, settings: structuredClone(settings), updatedAt: new Date().toISOString() }
            : p,
        ),
      }
      return this.fallback
    }
    this.fallback = await this.api()!.updateProfileSettings(id, settings)
    return this.fallback
  }

  async reset(id: string) {
    if (!this.api()) {
      this.fallback = {
        ...this.fallback,
        profiles: this.fallback.profiles.map((p) =>
          p.id === id
            ? {
                ...p,
                settings: createDefaultProfileSettings(),
                updatedAt: new Date().toISOString(),
              }
            : p,
        ),
      }
      return this.fallback
    }
    this.fallback = await this.api()!.resetProfile(id)
    return this.fallback
  }

  getSelected(store: ProfilesStore) {
    return store.profiles.find((p) => p.id === store.selectedProfileId)
  }
}

export class ElectronSettingsService implements SettingsService {
  private cache: AppSettings = { ...DEFAULT_APP_SETTINGS }

  async load() {
    if (!window.gtamoza) return this.cache
    this.cache = await window.gtamoza.loadSettings()
    return this.cache
  }

  async save(patch: Partial<AppSettings>) {
    if (!window.gtamoza) {
      this.cache = { ...this.cache, ...patch }
      return this.cache
    }
    this.cache = await window.gtamoza.saveSettings(patch)
    return this.cache
  }
}

export class ElectronUpdateService implements UpdateService {
  async getVersion() {
    if (!window.gtamoza) return '0.1.0'
    return window.gtamoza.getAppVersion()
  }

  async check() {
    if (!window.gtamoza) return { state: 'unsupported', reason: 'dev' } as const
    return window.gtamoza.checkForUpdates()
  }

  async download() {
    if (!window.gtamoza) return false
    return window.gtamoza.downloadUpdate()
  }

  async install() {
    if (!window.gtamoza) return
    await window.gtamoza.installUpdate()
  }

  async openReleases() {
    if (!window.gtamoza) return
    await window.gtamoza.openReleasesPage()
  }

  onStatus(callback: (status: UpdateStatus) => void) {
    if (!window.gtamoza) return () => undefined
    return window.gtamoza.onUpdateStatus(callback)
  }
}
