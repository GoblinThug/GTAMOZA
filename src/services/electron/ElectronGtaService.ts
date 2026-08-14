import type { GtaService } from '../GtaService'
import type { GtaStatus } from '../../types'

type GtaLinkStatus = {
  connected: boolean
  lastAt: number | null
  inVehicle: boolean
  vehicle: string
  speedKmh: number
  ffbHostRunning: boolean
  gameRunning?: boolean
  pluginMissing?: boolean
  telemetryPortBusy?: boolean
}

function fromLink(link: GtaLinkStatus): GtaStatus {
  return {
    connected: link.connected,
    mode: link.connected ? 'story' : 'unknown',
    vehicle: link.connected && link.vehicle ? link.vehicle : '—',
    gameRunning: Boolean(link.gameRunning),
    pluginMissing: Boolean(link.pluginMissing),
    telemetryPortBusy: Boolean(link.telemetryPortBusy),
  }
}

export class ElectronGtaService implements GtaService {
  private listeners = new Set<(status: GtaStatus) => void>()
  private last: GtaStatus = { connected: false, mode: 'unknown', vehicle: '—' }
  private unsub: (() => void) | null = null

  constructor() {
    if (window.gtamoza?.onGtaLink) {
      this.unsub = window.gtamoza.onGtaLink((link: GtaLinkStatus) => {
        const next = fromLink(link)
        if (
          next.connected === this.last.connected &&
          next.mode === this.last.mode &&
          next.vehicle === this.last.vehicle &&
          next.gameRunning === this.last.gameRunning &&
          next.pluginMissing === this.last.pluginMissing &&
          next.telemetryPortBusy === this.last.telemetryPortBusy
        ) {
          return
        }
        this.last = next
        this.emit()
      })
      void window.gtamoza.gtaGetLinkStatus?.().then((link) => {
        this.last = fromLink(link)
        this.emit()
      })
    }
  }

  async getStatus() {
    return this.last
  }

  subscribe(listener: (status: GtaStatus) => void) {
    this.listeners.add(listener)
    listener(this.last)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit() {
    for (const listener of this.listeners) listener(this.last)
  }

  dispose() {
    this.unsub?.()
    this.unsub = null
  }
}
