import type { DeviceStatus } from '../types'

export interface DeviceService {
  getStatus(): Promise<DeviceStatus>
  subscribe(listener: (status: DeviceStatus) => void): () => void
}
