import type { DiagnosticsService, TelemetryService } from '../TelemetryService'
import type { DiagnosticsStatus, TelemetrySample } from '../../types'

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

const IDLE_SAMPLE: TelemetrySample = {
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

export class MockTelemetryService implements TelemetryService {
  private simulated = false
  private sample: TelemetrySample = { ...IDLE_SAMPLE }
  private listeners = new Set<(sample: TelemetrySample) => void>()
  private timer: number | null = null

  setSimulated(enabled: boolean) {
    this.simulated = enabled
    if (enabled) {
      this.startTimer()
    } else {
      this.stopTimer()
      this.sample = { ...IDLE_SAMPLE, timestamp: Date.now() }
      this.emit()
    }
  }

  isSimulated() {
    return this.simulated
  }

  async getLatest() {
    return this.sample
  }

  getSnapshot() {
    return this.sample
  }

  subscribe(listener: (sample: TelemetrySample) => void) {
    this.listeners.add(listener)
    listener(this.sample)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private startTimer() {
    this.stopTimer()
    this.timer = window.setInterval(() => {
      if (!this.simulated) return
      const t = Date.now() / 1000
      this.sample = {
        timestamp: Date.now(),
        speed: clamp(118 + Math.sin(t * 0.7) * 18 + Math.sin(t * 2.1) * 4, 0, 220),
        steeringAngle: clamp(Math.sin(t * 0.9) * 28 + Math.sin(t * 2.4) * 6, -90, 90),
        torque: clamp(2.4 + Math.sin(t * 1.3) * 1.1 + Math.cos(t * 0.5) * 0.4, 0, 5.5),
        throttle: clamp(0.55 + Math.sin(t * 1.4) * 0.35, 0, 1),
        brake: clamp(Math.max(0, Math.sin(t * 0.55) * 0.7), 0, 1),
        clutch: clamp(Math.max(0, Math.sin(t * 0.35 + 1) * 0.4), 0, 1),
        throttleRaw: Math.round(
          clamp(0.55 + Math.sin(t * 1.4) * 0.35, 0, 1) * 32000,
        ),
        brakeRaw: Math.round(
          clamp(Math.max(0, Math.sin(t * 0.55) * 0.7), 0, 1) * 32000,
        ),
        clutchRaw: Math.round(
          clamp(Math.max(0, Math.sin(t * 0.35 + 1) * 0.4), 0, 1) * 32000,
        ),
        lateralG: clamp(Math.sin(t * 1.1) * 0.7, -1.5, 1.5),
        yawRate: clamp(Math.sin(t * 0.95) * 18, -45, 45),
      }
      this.emit()
    }, 100)
  }

  private stopTimer() {
    if (this.timer != null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
  }

  private emit() {
    for (const listener of this.listeners) listener(this.sample)
  }

  dispose() {
    this.stopTimer()
  }
}

export class MockDiagnosticsService implements DiagnosticsService {
  private simulated = false
  private listeners = new Set<(status: DiagnosticsStatus) => void>()

  private get status(): DiagnosticsStatus {
    return this.simulated
      ? {
          gta: 'connected',
          moza: 'connected',
          ffbEngine: 'running',
          telemetryHz: 120,
          ffbHz: 500,
          ipc: 'connected',
        }
      : {
          gta: 'disconnected',
          moza: 'disconnected',
          ffbEngine: 'stopped',
          telemetryHz: 0,
          ffbHz: 0,
          ipc: 'disconnected',
        }
  }

  setSimulated(enabled: boolean) {
    this.simulated = enabled
    this.emit()
  }

  isSimulated() {
    return this.simulated
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
    const status = this.status
    for (const listener of this.listeners) listener(status)
  }
}
