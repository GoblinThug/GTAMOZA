import { Card, Toggle } from '../components'
import { HotkeyCapture } from '../components/HotkeyCapture'
import { useToast } from '../components/Toast'
import { useI18n } from '../i18n/useI18n'
import { useAppStore } from '../stores/AppStore'
import type { CheatFeatureSettings, CheatsSettings } from '../../shared/types'

function FeatureRow({
  title,
  hint,
  feature,
  disabled,
  onChange,
}: {
  title: string
  hint: string
  feature: CheatFeatureSettings
  disabled: boolean
  onChange: (next: CheatFeatureSettings) => void
}) {
  return (
    <div className="cheat-row">
      <div className="cheat-row-main">
        <div className="field-label">{title}</div>
        <div className="field-hint">{hint}</div>
      </div>
      <div className="cheat-row-actions">
        <HotkeyCapture
          value={feature.hotkey}
          disabled={disabled || !feature.enabled}
          onChange={(hotkey) => onChange({ ...feature, hotkey })}
        />
        <Toggle
          checked={feature.enabled}
          disabled={disabled}
          onChange={(enabled) => onChange({ ...feature, enabled })}
        />
      </div>
    </div>
  )
}

export function CheatsPage() {
  const { settings, updateAppSettings } = useAppStore()
  const toast = useToast()
  const { t } = useI18n()
  const cheats = settings.cheats

  const save = async (next: CheatsSettings, announce = false) => {
    await updateAppSettings({ cheats: next })
    if (announce) toast.push({ title: t('cheats.saved'), tone: 'success' })
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-kicker">{t('cheats.kicker')}</p>
          <h1 className="page-title">{t('cheats.title')}</h1>
          <p className="page-desc">{t('cheats.desc')}</p>
        </div>
      </div>

      <Card title={t('cheats.master')}>
        <div className="setting-row">
          <div>
            <div className="field-label">{t('cheats.masterLabel')}</div>
            <div className="field-hint">{t('cheats.masterHint')}</div>
          </div>
          <Toggle
            checked={cheats.enabled}
            onChange={(enabled) => {
              void save({ ...cheats, enabled }, true)
            }}
          />
        </div>
      </Card>

      {cheats.enabled ? (
        <Card title={t('cheats.features')}>
          <div style={{ padding: '4px 16px 8px' }}>
            <FeatureRow
              title={t('cheats.god')}
              hint={t('cheats.godHint')}
              feature={cheats.godMode}
              disabled={false}
              onChange={(godMode) => {
                void save({ ...cheats, godMode })
              }}
            />
            <FeatureRow
              title={t('cheats.police')}
              hint={t('cheats.policeHint')}
              feature={cheats.noPolice}
              disabled={false}
              onChange={(noPolice) => {
                void save({ ...cheats, noPolice })
              }}
            />
            <FeatureRow
              title={t('cheats.spawn')}
              hint={t('cheats.spawnHint')}
              feature={cheats.spawnCar}
              disabled={false}
              onChange={(spawnCar) => {
                void save({ ...cheats, spawnCar })
              }}
            />
            <FeatureRow
              title={t('cheats.time')}
              hint={t('cheats.timeHint')}
              feature={cheats.timeOfDay}
              disabled={false}
              onChange={(timeOfDay) => {
                void save({ ...cheats, timeOfDay })
              }}
            />
          </div>
        </Card>
      ) : null}
    </div>
  )
}
