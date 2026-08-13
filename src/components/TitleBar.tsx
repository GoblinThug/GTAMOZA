import { useEffect, useState } from 'react'
import { Badge } from './Badge'
import { StatusIndicator } from './StatusIndicator'
import { APP_DISPLAY_NAME } from '../config'
import { useI18n } from '../i18n/useI18n'

type Props = {
  deviceConnected: boolean
  deviceName: string
}

export function TitleBar({ deviceConnected, deviceName }: Props) {
  const { t } = useI18n()
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    const syncChrome = (state: { maximized: boolean; fullscreen: boolean }) => {
      const next = state.maximized || state.fullscreen
      setMaximized(next)
      document.documentElement.classList.toggle('is-maximized', next)
    }

    void window.gtamoza?.windowIsMaximized().then((value) => {
      syncChrome({ maximized: value, fullscreen: false })
    })

    return window.gtamoza?.onWindowState(syncChrome)
  }, [])

  return (
    <header className="titlebar">
      <div
        className="titlebar__drag"
        onDoubleClick={() => void window.gtamoza?.windowMaximizeToggle()}
      />

      <div className="titlebar__status">
        <Badge tone={deviceConnected ? 'success' : 'warning'}>
          <StatusIndicator status={deviceConnected ? 'online' : 'offline'} />
          {deviceConnected ? deviceName : t('common.disconnected')}
        </Badge>
      </div>

      <div className="titlebar__brand">{APP_DISPLAY_NAME}</div>

      <div className="traffic-lights" aria-label={t('window.controls')}>
        <button
          type="button"
          className="traffic-light traffic-light--minimize"
          title={t('window.minimize')}
          aria-label={t('window.minimize')}
          onClick={(e) => {
            e.stopPropagation()
            void window.gtamoza?.windowMinimize()
          }}
        >
          <span className="traffic-light__dot" />
        </button>
        <button
          type="button"
          className="traffic-light traffic-light--maximize"
          title={maximized ? t('window.restore') : t('window.maximize')}
          aria-label={maximized ? t('window.restore') : t('window.maximize')}
          onClick={(e) => {
            e.stopPropagation()
            void window.gtamoza?.windowMaximizeToggle()
          }}
        >
          <span className="traffic-light__dot" />
        </button>
        <button
          type="button"
          className="traffic-light traffic-light--close"
          title={t('window.close')}
          aria-label={t('window.close')}
          onClick={(e) => {
            e.stopPropagation()
            void window.gtamoza?.windowClose()
          }}
        >
          <span className="traffic-light__dot" />
        </button>
      </div>
    </header>
  )
}
