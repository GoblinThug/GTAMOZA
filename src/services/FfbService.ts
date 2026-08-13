import type { FfbTestMode, FfbTestState } from '../types'

export interface FfbService {
  getTestState(): Promise<FfbTestState>
  startTest(mode: FfbTestMode, strength: number): Promise<FfbTestState>
  stopTest(): Promise<FfbTestState>
  subscribe(listener: (state: FfbTestState) => void): () => void
}
