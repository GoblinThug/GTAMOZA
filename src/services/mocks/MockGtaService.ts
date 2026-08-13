import type { GtaService } from '../GtaService'
import type { GtaStatus } from '../../types'

const VEHICLES = ['Sultan RS', 'Elegy RH8', 'Comet S2', 'Banshee 900R', 'Kuruma']

export class MockGtaService implements GtaService {
  private simulated = false
  private vehicle = '—'
  private listeners = new Set<(status: GtaStatus) => void>()
  private timer: number | null = null

  private get status(): GtaStatus {
    return this.simulated
      ? { connected: true, mode: 'story', vehicle: this.vehicle }
      : { connected: false, mode: 'unknown', vehicle: '—' }
  }

  setSimulated(enabled: boolean) {
    this.simulated = enabled
    if (enabled) {
      this.vehicle = 'Sultan RS'
      this.startTimer()
    } else {
      this.stopTimer()
      this.vehicle = '—'
    }
    this.emit()
  }

  isSimulated() {
    return this.simulated
  }

  async getStatus() {
    return this.status
  }

  subscribe(listener: (status: GtaStatus) => void) {
    this.listeners.add(listener)
    listener(this.status)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private startTimer() {
    this.stopTimer()
    this.timer = window.setInterval(() => {
      if (!this.simulated) return
      if (Math.random() > 0.92) {
        this.vehicle = VEHICLES[Math.floor(Math.random() * VEHICLES.length)]
        this.emit()
      }
    }, 5000)
  }

  private stopTimer() {
    if (this.timer != null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
  }

  private emit() {
    const status = this.status
    for (const listener of this.listeners) listener(status)
  }

  dispose() {
    this.stopTimer()
  }
}
