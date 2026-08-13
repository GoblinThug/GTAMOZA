import type { FfbService } from '../FfbService'
import type { FfbTestMode, FfbTestState } from '../../types'

export class MockFfbService implements FfbService {
  private state: FfbTestState = {
    active: false,
    mode: 'sine',
    strength: 40,
  }
  private listeners = new Set<(state: FfbTestState) => void>()
  private timer: number | null = null

  async getTestState() {
    return this.state
  }

  async startTest(mode: FfbTestMode, strength: number) {
    this.clearTimer()
    this.state = { active: true, mode, strength }
    this.emit()
    this.timer = window.setTimeout(() => {
      void this.stopTest()
    }, 4000)
    return this.state
  }

  async stopTest() {
    this.clearTimer()
    this.state = { ...this.state, active: false }
    this.emit()
    return this.state
  }

  subscribe(listener: (state: FfbTestState) => void) {
    this.listeners.add(listener)
    listener(this.state)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit() {
    for (const listener of this.listeners) listener(this.state)
  }

  private clearTimer() {
    if (this.timer != null) {
      window.clearTimeout(this.timer)
      this.timer = null
    }
  }
}
