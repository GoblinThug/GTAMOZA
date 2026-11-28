import { useState } from 'react'
import { Card } from './Card'
import { Slider } from './Slider'
import { Toggle } from './Toggle'
import { useI18n } from '../i18n/useI18n'
import { useAppStore } from '../stores/AppStore'

/** Single place for GTAMOZA FFB master + mechanical column (MOZA-style stack). */
export function FfbFeelPanel() {
  const { activeSettings, updateActiveSettings } = useAppStore()
  const { t } = useI18n()
  const ffb = activeSettings.ffb
  const off = !ffb.enabled
  const [advancedOpen, setAdvancedOpen] = useState(false)

  return (
    <>
      <Card title={t('ffb.masterTitle')} subtitle={t('ffb.masterSubtitle')}>
        <div className="stack" style={{ padding: '4px 16px 8px' }}>
          <Toggle
            label={t('ffb.enabled')}
            description={t('ffb.enabledDesc')}
            checked={ffb.enabled}
            onChange={(enabled) => updateActiveSettings({ ffb: { ...ffb, enabled } })}
          />
          <Slider
            label={t('ffb.overall')}
            description={t('ffb.overallDesc')}
            value={ffb.overallStrength}
            disabled={off}
            onChange={(overallStrength) =>
              updateActiveSettings({ ffb: { ...ffb, overallStrength } })
            }
          />
        </div>
      </Card>

      <Card title={t('ffb.columnTitle')} subtitle={t('ffb.columnSubtitle')}>
        <div className="stack" style={{ padding: '4px 16px 8px' }}>
          <Slider
            label={t('ffb.centering')}
            description={t('ffb.centeringDesc')}
            value={ffb.selfAligningTorque ?? 52}
            disabled={off}
            onChange={(selfAligningTorque) =>
              updateActiveSettings({ ffb: { ...ffb, selfAligningTorque } })
            }
          />
          <Slider
            label={t('ffb.damping')}
            description={t('ffb.dampingDesc')}
            value={ffb.damping ?? 48}
            disabled={off}
            onChange={(damping) => updateActiveSettings({ ffb: { ...ffb, damping } })}
          />
          <Slider
            label={t('ffb.friction')}
            description={t('ffb.frictionDesc')}
            value={ffb.friction ?? 16}
            disabled={off}
            onChange={(friction) => updateActiveSettings({ ffb: { ...ffb, friction } })}
          />
          <Slider
            label={t('ffb.inertia')}
            description={t('ffb.inertiaDesc')}
            value={ffb.inertia ?? 18}
            disabled={off}
            onChange={(inertia) => updateActiveSettings({ ffb: { ...ffb, inertia } })}
          />
          <Slider
            label={t('ffb.smoothing')}
            description={t('ffb.smoothingDesc')}
            value={ffb.smoothing ?? 12}
            disabled={off}
            onChange={(smoothing) => updateActiveSettings({ ffb: { ...ffb, smoothing } })}
          />
        </div>
      </Card>

      <details
        className="ffb-advanced"
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="ffb-advanced-summary">{t('ffb.advancedTitle')}</summary>
        <Card subtitle={t('ffb.advancedSubtitle')}>
          <div className="stack" style={{ padding: '4px 16px 8px' }}>
            <Slider
              label={t('ffb.slewRate')}
              description={t('ffb.slewRateDesc')}
              value={ffb.slewRate ?? 60}
              disabled={off}
              onChange={(slewRate) => updateActiveSettings({ ffb: { ...ffb, slewRate } })}
            />
          </div>
        </Card>
      </details>
    </>
  )
}
