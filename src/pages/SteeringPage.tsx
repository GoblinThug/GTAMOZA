import { useState } from 'react'
import { Button, Card, Slider } from '../components'
import { useToast } from '../components/Toast'
import { useI18n } from '../i18n/useI18n'
import { useAppStore } from '../stores/AppStore'

export function SteeringPage() {
  const {
    activeSettings,
    updateActiveSettings,
    saveActiveProfile,
    dirty,
    baseSync,
    serialStatus,
    refreshBaseSync,
  } = useAppStore()
  const toast = useToast()
  const { t } = useI18n()
  const s = activeSettings.steering
  const ffb = activeSettings.ffb
  const [syncing, setSyncing] = useState(false)
  const shownAngle =
    serialStatus.wheelAngleDeg ?? baseSync?.raw.wheelAngleDeg ?? s.wheelAngle

  const onSync = async () => {
    setSyncing(true)
    try {
      const status = await refreshBaseSync()
      toast.push({
        title: status.baseLive
          ? t('sync.refreshed', { angle: String(status.wheelAngleDeg ?? shownAngle) })
          : status.busy
            ? t('sync.comBusy')
            : t('sync.waitBase'),
        tone: status.baseLive ? 'success' : 'warning',
      })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-kicker">{t('steering.kicker')}</p>
          <h1 className="page-title">{t('steering.title')}</h1>
          <p className="page-desc">{t('steering.desc')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" disabled={syncing} onClick={() => void onSync()}>
            {t('sync.refresh')}
          </Button>
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
      </div>

      <div className="notice">
        {serialStatus.baseLive
          ? t('sync.steeringFromBase', { angle: String(shownAngle) })
          : serialStatus.busy || serialStatus.lastError
            ? t('sync.comBusy')
            : t('sync.waitBase')}
      </div>

      <Card title={t('steering.feelTitle')} subtitle={t('steering.feelSubtitle')}>
        <div className="stack" style={{ padding: '4px 16px 8px' }}>
          <Slider
            label={t('ffb.overall')}
            description={t('ffb.overallDesc')}
            value={ffb.overallStrength ?? 100}
            disabled={ffb.enabled === false}
            onChange={(overallStrength) =>
              updateActiveSettings({ ffb: { ...ffb, overallStrength } })
            }
          />
          <Slider
            label={t('ffb.centering')}
            description={t('ffb.centeringDesc')}
            value={ffb.selfAligningTorque ?? 62}
            disabled={ffb.enabled === false}
            onChange={(selfAligningTorque) =>
              updateActiveSettings({ ffb: { ...ffb, selfAligningTorque } })
            }
          />
          <Slider
            label={t('ffb.damping')}
            description={t('ffb.dampingDesc')}
            value={ffb.damping ?? 30}
            disabled={ffb.enabled === false}
            onChange={(damping) => updateActiveSettings({ ffb: { ...ffb, damping } })}
          />
          <Slider
            label={t('ffb.friction')}
            description={t('ffb.frictionDesc')}
            value={ffb.friction ?? 15}
            disabled={ffb.enabled === false}
            onChange={(friction) => updateActiveSettings({ ffb: { ...ffb, friction } })}
          />
          <Slider
            label={t('ffb.inertia')}
            description={t('ffb.inertiaDesc')}
            value={ffb.inertia ?? 14}
            disabled={ffb.enabled === false}
            onChange={(inertia) => updateActiveSettings({ ffb: { ...ffb, inertia } })}
          />
        </div>
      </Card>

      <Card title={t('steering.gtaMapTitle')} subtitle={t('steering.gtaMapSubtitle')}>
        <div className="stack" style={{ padding: '4px 16px 8px' }}>
          <Slider
            label={t('steering.sensitivity')}
            description={t('steering.sensitivityDesc')}
            value={s.sensitivity}
            onChange={(sensitivity) =>
              updateActiveSettings({ steering: { ...s, sensitivity } })
            }
          />
          <Slider
            label={t('steering.linearity')}
            description={t('steering.linearityDesc')}
            value={s.linearity}
            onChange={(linearity) =>
              updateActiveSettings({ steering: { ...s, linearity } })
            }
          />
          <Slider
            label={t('steering.deadzone')}
            description={t('steering.deadzoneDesc')}
            value={s.deadzone}
            max={20}
            step={0.5}
            unit="%"
            onChange={(deadzone) =>
              updateActiveSettings({ steering: { ...s, deadzone } })
            }
          />
          <Slider
            label={t('steering.saturation')}
            description={t('steering.saturationDesc')}
            value={s.saturation}
            onChange={(saturation) =>
              updateActiveSettings({ steering: { ...s, saturation } })
            }
          />
          <Slider
            label={t('steering.centerOffset')}
            description={t('steering.centerOffsetDesc')}
            value={s.centerOffset}
            min={-30}
            max={30}
            step={0.5}
            unit="°"
            onChange={(centerOffset) =>
              updateActiveSettings({ steering: { ...s, centerOffset } })
            }
          />
        </div>
      </Card>
    </div>
  )
}
