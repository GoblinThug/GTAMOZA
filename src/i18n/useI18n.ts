import { useCallback } from 'react'
import { useAppStore } from '../stores/AppStore'
import { translate, type MessageKey } from './messages'

export function useI18n() {
  const locale = useAppStore().settings.locale

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  )

  return { t, locale }
}
