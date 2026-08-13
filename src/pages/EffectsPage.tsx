import { Button, Card, Slider, Toggle } from '../components'
import { useToast } from '../components/Toast'
import { EFFECT_DESC_KEYS, EFFECT_KEYS } from '../i18n/messages'
import { useI18n } from '../i18n/useI18n'
import { useAppStore } from '../stores/AppStore'
import type { EffectId } from '../types'

const EFFECT_IDS = Object.keys(EFFECT_KEYS) as EffectId[]

export function EffectsPage() {
  const { activeSettings, updateActiveSettings, saveActiveProfile, dirty } = useAppStore()
  const toast = useToast()
  const { t } = useI18n()
  const effects = activeSettings.effects
  const ffb = activeSettings.ffb

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-kicker">{t('effects.kicker')}</p>
          <h1 className="page-title">{t('effects.title')}</h1>
          <p className="page-desc">{t('effects.desc')}</p>
        </div>
        <Button
          variant="primary"
          disabled={!dirty}
          onClick={() => {
            void saveActiveProfile().then(() =>
              toast.push({ title: t('common.profileSaved'), tone: 'success' }),
            )
          }}
        >
          {t('common.save')}
        </Button>
      </div>

      <Card>
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
            disabled={!ffb.enabled}
            onChange={(overallStrength) =>
              updateActiveSettings({ ffb: { ...ffb, overallStrength } })
            }
          />
          <Slider
            label={t('ffb.centering')}
            description={t('ffb.centeringDesc')}
            value={ffb.selfAligningTorque ?? 62}
            disabled={!ffb.enabled}
            onChange={(selfAligningTorque) =>
              updateActiveSettings({ ffb: { ...ffb, selfAligningTorque } })
            }
          />
          <Slider
            label={t('ffb.damping')}
            description={t('ffb.dampingDesc')}
            value={ffb.damping ?? 30}
            disabled={!ffb.enabled}
            onChange={(damping) => updateActiveSettings({ ffb: { ...ffb, damping } })}
          />
          <Slider
            label={t('ffb.friction')}
            description={t('ffb.frictionDesc')}
            value={ffb.friction ?? 15}
            disabled={!ffb.enabled}
            onChange={(friction) => updateActiveSettings({ ffb: { ...ffb, friction } })}
          />
          <Slider
            label={t('ffb.inertia')}
            description={t('ffb.inertiaDesc')}
            value={ffb.inertia ?? 14}
            disabled={!ffb.enabled}
            onChange={(inertia) => updateActiveSettings({ ffb: { ...ffb, inertia } })}
          />
          <Slider
            label={t('ffb.smoothing')}
            description={t('ffb.smoothingDesc')}
            value={ffb.smoothing ?? 20}
            disabled={!ffb.enabled}
            onChange={(smoothing) => updateActiveSettings({ ffb: { ...ffb, smoothing } })}
          />
        </div>
      </Card>

      <Card title={t('effects.surfacesTitle')} subtitle={t('effects.surfacesSubtitle')}>
        <div style={{ padding: '4px 16px 8px' }}>
          {EFFECT_IDS.map((id) => {
            const effect = effects[id]
            return (
              <div className="effect-row" key={id}>
                <div className="effect-name">
                  <strong>{t(EFFECT_KEYS[id])}</strong>
                  <p>{t(EFFECT_DESC_KEYS[id])}</p>
                </div>
                <Slider
                  label={t('common.strength')}
                  description={t('common.strengthDesc')}
                  value={effect.strength}
                  disabled={!ffb.enabled}
                  onChange={(strength) =>
                    updateActiveSettings({
                      effects: {
                        ...effects,
                        [id]: { ...effect, strength },
                      },
                    })
                  }
                />
                <Toggle
                  checked={effect.enabled}
                  disabled={!ffb.enabled}
                  onChange={(enabled) =>
                    updateActiveSettings({
                      effects: {
                        ...effects,
                        [id]: { ...effect, enabled },
                      },
                    })
                  }
                />
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
