import { useCallback, useSyncExternalStore } from 'react'
import { translate, type MessageKey } from './messages'

let localeSnapshot: 'en' | 'ru' = 'en'
const localeListeners = new Set<() => void>()

/** Keep i18n off AppStore — high-freq store updates were re-rendering every translated node. */
export function syncI18nLocale(locale: 'en' | 'ru') {
  if (localeSnapshot === locale) return
  localeSnapshot = locale
  for (const l of localeListeners) l()
}

export function useI18n() {
  const locale = useSyncExternalStore(
    (onChange) => {
      localeListeners.add(onChange)
      return () => {
        localeListeners.delete(onChange)
      }
    },
    () => localeSnapshot,
    () => localeSnapshot,
  )

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  )

  return { t, locale }
}
