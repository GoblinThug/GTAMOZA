import type { GtaStatus } from '../types'

export interface GtaService {
  getStatus(): Promise<GtaStatus>
  subscribe(listener: (status: GtaStatus) => void): () => void
}
