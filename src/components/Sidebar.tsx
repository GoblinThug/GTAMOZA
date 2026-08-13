import {
  Crosshair,
  Disc3,
  LayoutDashboard,
  Settings,
  Sparkles,
  Sword,
} from 'lucide-react'
import { useI18n } from '../i18n/useI18n'
import { NAV_KEYS } from '../i18n/messages'
import type { PageId } from '../types'

const NAV: Array<{ id: PageId; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', icon: LayoutDashboard },
  { id: 'steering', icon: Disc3 },
  { id: 'effects', icon: Sparkles },
  { id: 'profiles', icon: Crosshair },
  { id: 'cheats', icon: Sword },
  { id: 'settings', icon: Settings },
]

type Props = {
  active: PageId
  onNavigate: (page: PageId) => void
}

export function Sidebar({ active, onNavigate }: Props) {
  const { t } = useI18n()

  return (
    <nav className="sidebar" aria-label={t('nav.main')}>
      <div className="sidebar-label">{t('nav.main')}</div>
      {NAV.map((item) => {
        const Icon = item.icon
        const label = t(NAV_KEYS[item.id])
        return (
          <button
            key={item.id}
            type="button"
            className="nav-item"
            data-active={item.id === active}
            onClick={() => onNavigate(item.id)}
            title={label}
          >
            <Icon size={17} strokeWidth={1.75} />
            <span>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
