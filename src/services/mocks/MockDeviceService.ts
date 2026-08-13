import type { DeviceService } from '../DeviceService'
import type { DeviceStatus } from '../../types'

export class MockDeviceService implements DeviceService {
  private simulated = false
  private listeners = new Set<(status: DeviceStatus) => void>()

  private get status(): DeviceStatus {
    return this.simulated
      ? {
          connected: true,
          name: 'MOZA R5',
          model: 'R5',
          firmware: '1.2.4-mock',
        }
      : {
          connected: false,
          name: 'MOZA R5',
          model: 'R5',
          firmware: undefined,
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

  subscribe(listener: (status: DeviceStatus) => void) {
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
