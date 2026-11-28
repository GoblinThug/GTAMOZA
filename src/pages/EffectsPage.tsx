import { Button, Card, FfbFeelPanel, Slider, Toggle } from '../components'
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
  const ffbOff = !activeSettings.ffb.enabled

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

      <FfbFeelPanel />

      <Card title={t('effects.surfacesTitle')} subtitle={t('effects.surfacesSubtitle')}>
        <div style={{ padding: '4px 16px 8px' }}>
          {EFFECT_IDS.map((id) => {
            const effect = effects[id]
            return (
              <div className="effect-row" key={id}>
                <Toggle
                  ariaLabel={t(EFFECT_KEYS[id])}
                  checked={effect.enabled}
                  disabled={ffbOff}
                  onChange={(enabled) =>
                    updateActiveSettings({
                      effects: {
                        ...effects,
                        [id]: { ...effect, enabled },
                      },
                    })
                  }
                />
                <Slider
                  label={t(EFFECT_KEYS[id])}
                  description={t(EFFECT_DESC_KEYS[id])}
                  value={effect.strength}
                  disabled={ffbOff || !effect.enabled}
                  onChange={(strength) =>
                    updateActiveSettings({
                      effects: {
                        ...effects,
                        [id]: { ...effect, strength },
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
