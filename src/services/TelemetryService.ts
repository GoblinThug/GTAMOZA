import type { DiagnosticsStatus, TelemetrySample } from '../types'

export interface TelemetryService {
  getLatest(): Promise<TelemetrySample>
  getSnapshot(): TelemetrySample
  subscribe(listener: (sample: TelemetrySample) => void): () => void
}

export interface DiagnosticsService {
  getStatus(): Promise<DiagnosticsStatus>
  subscribe(listener: (status: DiagnosticsStatus) => void): () => void
}
