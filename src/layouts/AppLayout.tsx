import { Sidebar } from '../components'
import { TitleBar } from '../components/TitleBar'
import { OnboardingWizard } from '../components/OnboardingWizard'
import { useI18n } from '../i18n/useI18n'
import { useAppStore } from '../stores/AppStore'
import { DashboardPage } from '../pages/DashboardPage'
import { SteeringPage } from '../pages/SteeringPage'
import { EffectsPage } from '../pages/EffectsPage'
import { ProfilesPage } from '../pages/ProfilesPage'
import { CheatsPage } from '../pages/CheatsPage'
import { SettingsPage } from '../pages/SettingsPage'
import type { PageId } from '../types'

function renderPage(page: PageId) {
  switch (page) {
    case 'dashboard':
      return <DashboardPage />
    case 'steering':
      return <SteeringPage />
    case 'effects':
      return <EffectsPage />
    case 'profiles':
      return <ProfilesPage />
    case 'cheats':
      return <CheatsPage />
    case 'settings':
      return <SettingsPage />
    default:
      return <DashboardPage />
  }
}

function LoadingScreen() {
  const { t } = useI18n()
  return (
    <div className="app-shell">
      <TitleBar deviceConnected={false} deviceName="" />
      <div
        style={{
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--text-secondary)',
        }}
      >
        {t('common.loading')}
      </div>
    </div>
  )
}

export function AppLayout() {
  const { page, setPage, device, ready, settings, updateAppSettings } = useAppStore()

  if (!ready) return <LoadingScreen />

  const showOnboarding = !settings.onboardingCompleted

  return (
    <div className="app-shell">
      <TitleBar deviceConnected={device.connected} deviceName={device.name} />
      <div className="app-body">
        <Sidebar active={page} onNavigate={setPage} />
        <main className="content">{renderPage(page)}</main>
      </div>
      <OnboardingWizard
        open={showOnboarding}
        onNavigate={setPage}
        onFinish={() => {
          void updateAppSettings({ onboardingCompleted: true })
        }}
      />
    </div>
  )
}
