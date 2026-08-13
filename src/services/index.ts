import { ElectronGtaService } from './electron/ElectronGtaService'
import { MozaDeviceService } from './hardware/MozaDeviceService'
import { MozaFfbService } from './hardware/MozaFfbService'
import { MozaDiagnosticsService, MozaTelemetryService } from './hardware/MozaTelemetryService'
import {
  ElectronProfileService,
  ElectronSettingsService,
  ElectronUpdateService,
} from './electron/ElectronServices'

/**
 * Central service locator.
 * MOZA = HID bridge. GTA = UDP Story Mode plugin when enabled.
 */
export const services = {
  device: new MozaDeviceService(),
  gta: new ElectronGtaService(),
  ffb: new MozaFfbService(),
  telemetry: new MozaTelemetryService(),
  diagnostics: new MozaDiagnosticsService(),
  profiles: new ElectronProfileService(),
  settings: new ElectronSettingsService(),
  updates: new ElectronUpdateService(),
}

/** @deprecated demo simulation removed — GTA comes from the Story Mode plugin. */
export function setMockSimulation(_enabled: boolean) {
  /* no-op */
}

export function isMockSimulationEnabled() {
  return false
}
