import { Badge } from './Badge'
import { StatusIndicator } from './StatusIndicator'
import { APP_DISPLAY_NAME } from '../config'
import { useI18n } from '../i18n/useI18n'

type Props = {
  deviceConnected: boolean
  deviceName: string
}

export function Header({ deviceConnected, deviceName }: Props) {
  const { t } = useI18n()
  return (
    <header className="header">
      <div className="header-brand">
        <div className="header-mark" aria-hidden>
          G
        </div>
        <span>{APP_DISPLAY_NAME}</span>
      </div>
      <div className="header-right">
        <Badge tone={deviceConnected ? 'success' : 'warning'}>
          <StatusIndicator status={deviceConnected ? 'online' : 'offline'} />
          {deviceConnected ? deviceName : t('common.disconnected')}
        </Badge>
      </div>
    </header>
  )
}
