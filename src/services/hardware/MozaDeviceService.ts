import type { DeviceService } from '../DeviceService'
import type { DeviceStatus } from '../../types'

/**
 * Real MOZA base detection via Electron HID bridge.
 */
export class MozaDeviceService implements DeviceService {
  private status: DeviceStatus = {
    connected: false,
    name: 'MOZA R5',
    model: 'R5',
  }
  private listeners = new Set<(status: DeviceStatus) => void>()
  private unsub: (() => void) | null = null

  constructor() {
    void this.boot()
  }

  private async boot() {
    if (!window.gtamoza) return
    const initial = await window.gtamoza.mozaGetStatus()
    this.apply(initial)
    this.unsub = window.gtamoza.onMozaStatus((status) => this.apply(status))
  }

  private apply(status: {
    connected: boolean
    name: string
    model: string
    firmware?: string
  }) {
    this.status = {
      connected: status.connected,
      name: status.name,
      model: status.model,
      firmware: status.firmware,
    }
    for (const listener of this.listeners) listener(this.status)
  }

  async getStatus() {
    if (window.gtamoza) {
      const status = await window.gtamoza.mozaGetStatus()
      this.apply(status)
    }
    return this.status
  }

  subscribe(listener: (status: DeviceStatus) => void) {
    this.listeners.add(listener)
    listener(this.status)
    return () => {
      this.listeners.delete(listener)
    }
  }

  dispose() {
    this.unsub?.()
  }
}
