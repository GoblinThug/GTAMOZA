import type { FfbService } from '../FfbService'
import type { FfbTestMode, FfbTestState } from '../../types'

export class MozaFfbService implements FfbService {
  private state: FfbTestState = {
    active: false,
    mode: 'sine',
    strength: 40,
  }
  private listeners = new Set<(state: FfbTestState) => void>()
  private unsub: (() => void) | null = null
  private pollTimer: number | null = null

  constructor() {
    void this.refresh()
  }

  private ensurePoll() {
    if (this.pollTimer != null) return
    this.pollTimer = window.setInterval(() => {
      void this.refresh().then(() => {
        if (!this.state.active && this.pollTimer != null) {
          window.clearInterval(this.pollTimer)
          this.pollTimer = null
        }
      })
    }, 200)
  }

  private async refresh() {
    if (!window.gtamoza) return
    const next = await window.gtamoza.mozaGetFfbTestState()
    this.state = next
    this.emit()
  }

  async getTestState() {
    await this.refresh()
    return this.state
  }

  async startTest(mode: FfbTestMode, strength: number) {
    if (!window.gtamoza) {
      this.state = { active: true, mode, strength }
      this.emit()
      return this.state
    }
    this.state = await window.gtamoza.mozaStartFfbTest({ mode, strength })
    this.ensurePoll()
    this.emit()
    return this.state
  }

  async stopTest() {
    if (!window.gtamoza) {
      this.state = { ...this.state, active: false }
      this.emit()
      return this.state
    }
    this.state = await window.gtamoza.mozaStopFfbTest()
    if (this.pollTimer != null) {
      window.clearInterval(this.pollTimer)
      this.pollTimer = null
    }
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

  dispose() {
    if (this.pollTimer != null) window.clearInterval(this.pollTimer)
    this.unsub?.()
  }
}
