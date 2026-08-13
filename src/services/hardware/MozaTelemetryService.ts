import type { DiagnosticsService, TelemetryService } from '../TelemetryService'
import type { DiagnosticsStatus, TelemetrySample } from '../../types'

/**
 * Live steering/torque/pedal samples from the MOZA HID bridge.
 * Pedal floors are calibrated in the main process — renderer only displays.
 */
export class MozaTelemetryService implements TelemetryService {
  private sample: TelemetrySample = {
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
  }
  private listeners = new Set<(sample: TelemetrySample) => void>()
  private unsub: (() => void) | null = null

  constructor() {
    if (!window.gtamoza) return
    this.unsub = window.gtamoza.onMozaSample((live) => {
      this.sample = {
        timestamp: live.timestamp,
        speed: 0,
        steeringAngle: live.steeringAngle,
        torque: live.torque,
        throttle: live.throttle ?? 0,
        brake: live.brake ?? 0,
        clutch: live.clutch ?? 0,
        throttleRaw: live.throttleRaw ?? 0,
        brakeRaw: live.brakeRaw ?? 0,
        clutchRaw: live.clutchRaw ?? 0,
        lateralG: 0,
        yawRate: 0,
      }
      for (const listener of this.listeners) listener(this.sample)
    })
  }

  async getLatest() {
    return this.sample
  }

  subscribe(listener: (sample: TelemetrySample) => void) {
    this.listeners.add(listener)
    listener(this.sample)
    return () => {
      this.listeners.delete(listener)
    }
  }

  dispose() {
    this.unsub?.()
  }
}

export class MozaDiagnosticsService implements DiagnosticsService {
  private status: DiagnosticsStatus = {
    gta: 'disconnected',
    moza: 'disconnected',
    ffbEngine: 'stopped',
    telemetryHz: 0,
    ffbHz: 0,
    ipc: 'connected',
  }
  private listeners = new Set<(status: DiagnosticsStatus) => void>()
  private unsubs: Array<() => void> = []

  constructor() {
    if (!window.gtamoza) return
    this.unsubs.push(
      window.gtamoza.onMozaStatus((s) => {
        this.status = {
          ...this.status,
          moza: s.connected ? 'connected' : 'disconnected',
          ffbEngine: s.connected ? 'running' : 'stopped',
          telemetryHz: s.connected ? 20 : 0,
          ffbHz: s.connected ? 500 : 0,
          ipc: 'connected',
          gta: 'disconnected',
        }
        this.emit()
      }),
    )
    void window.gtamoza.mozaGetStatus().then((s) => {
      this.status = {
        ...this.status,
        moza: s.connected ? 'connected' : 'disconnected',
        ffbEngine: s.connected ? 'running' : 'stopped',
        telemetryHz: s.connected ? 20 : 0,
        ffbHz: s.connected ? 500 : 0,
      }
      this.emit()
    })
  }

  async getStatus() {
    return this.status
  }

  subscribe(listener: (status: DiagnosticsStatus) => void) {
    this.listeners.add(listener)
    listener(this.status)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit() {
    for (const listener of this.listeners) listener(this.status)
  }

  dispose() {
    for (const u of this.unsubs) u()
  }
}
