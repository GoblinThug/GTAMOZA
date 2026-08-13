import { useCallback, useSyncExternalStore } from 'react'
import { services } from '../services'
import type { TelemetrySample } from '../types'

/**
 * High-frequency wheel/pedal samples — NOT in AppStore.
 * Putting these in React context re-rendered the whole app (~30 Hz) and hitch-scrolled.
 */
export function useLiveTelemetry(): TelemetrySample {
  const subscribe = useCallback((onStoreChange: () => void) => {
    return services.telemetry.subscribe(() => onStoreChange())
  }, [])

  return useSyncExternalStore(
    subscribe,
    () => services.telemetry.getSnapshot(),
    () => services.telemetry.getSnapshot(),
  )
}
