import { useEffect, useState } from 'react'
import { Button, Card, PedalMeters, StatusIndicator, WheelGauge } from '../components'
import { useToast } from '../components/Toast'
import { useI18n } from '../i18n/useI18n'
import type { MessageKey } from '../i18n/messages'
import { useLiveTelemetry } from '../hooks/useLiveTelemetry'
import { useAppStore } from '../stores/AppStore'

type CalStep = 'idle' | 'throttle' | 'brake' | 'clutch' | 'done'

const CAL_ORDER: Array<'throttle' | 'brake' | 'clutch'> = [
  'throttle',
  'brake',
  'clutch',
]

const CAL_HINT: Record<'throttle' | 'brake' | 'clutch', MessageKey> = {
  throttle: 'dashboard.calPressThrottle',
  brake: 'dashboard.calPressBrake',
  clutch: 'dashboard.calPressClutch',
}

export function DashboardPage() {
  const {
    device,
    gta,
    profiles,
    activeSettings,
    updateAppSettings,
    baseSync,
    serialStatus,
  } = useAppStore()
  const telemetry = useLiveTelemetry()
  const { t } = useI18n()
  const toast = useToast()
  const profileName =
    profiles.profiles.find((p) => p.id === profiles.selectedProfileId)?.name ?? '—'
  const maxAngle = (activeSettings.steering.wheelAngle ?? 900) / 2
  const shownAngle =
    serialStatus.wheelAngleDeg ??
    baseSync?.raw.wheelAngleDeg ??
    activeSettings.steering.wheelAngle

  const [calStep, setCalStep] = useState<CalStep>('idle')
  const [calHint, setCalHint] = useState('')
  const [calError, setCalError] = useState('')
  const [busy, setBusy] = useState(false)
  const [indL, setIndL] = useState(false)
  const [indR, setIndR] = useState(false)
  const [learnedL, setLearnedL] = useState(-1)
  const [learnedR, setLearnedR] = useState(-1)
  const [lastPaddleMsg, setLastPaddleMsg] = useState('')

  useEffect(() => {
    void window.gtamoza?.mozaGetPaddleState?.().then((s) => {
      if (!s) return
      setIndL(s.indL)
      setIndR(s.indR)
      setLearnedL(s.learnedL)
      setLearnedR(s.learnedR)
    })
    const unsub = window.gtamoza?.onMozaPaddle?.((ev) => {
      setIndL(ev.indL)
      setIndR(ev.indR)
      setLearnedL(ev.learnedL)
      setLearnedR(ev.learnedR)
      setLastPaddleMsg(ev.message)
      toast.push({ title: ev.message, tone: 'success' })
    })
    return () => unsub?.()
  }, [toast])

  useEffect(() => {
    if (calStep === 'idle') {
      void window.gtamoza?.mozaEndPedalCalStep()
      return
    }
    if (calStep === 'done') {
      void (async () => {
        const ended = await window.gtamoza?.mozaEndPedalCalStep()
        if (ended?.floors && ended.axisMap) {
          await updateAppSettings({
            pedalFloors: ended.floors,
            pedalAxisMap: ended.axisMap,
          })
        }
      })()
      return
    }
    void window.gtamoza?.mozaBeginPedalCalStep()
  }, [calStep, updateAppSettings])

  const startCal = () => {
    setCalError('')
    setCalStep('throttle')
    setCalHint(t(CAL_HINT.throttle))
  }

  const cancelCal = () => {
    setCalStep('idle')
    setCalHint('')
    setCalError('')
  }

  const rememberFloor = async () => {
    if (calStep === 'idle' || calStep === 'done') return
    if (!window.gtamoza) return
    setBusy(true)
    setCalError('')
    try {
      const role = calStep
      const result = await window.gtamoza.mozaLockPedalFloor(role)
      if (!result.ok) {
        setCalError(
          result.reason === 'not-pressed'
            ? t('dashboard.calNotPressed')
            : t('dashboard.calFailed'),
        )
        await window.gtamoza.mozaBeginPedalCalStep()
        return
      }

      await updateAppSettings({
        pedalAxisMap: result.axisMap,
        pedalFloors: result.floors,
      })

      const nextIndex = CAL_ORDER.indexOf(role) + 1
      if (nextIndex >= CAL_ORDER.length) {
        setCalStep('done')
        setCalHint(t('dashboard.calDone'))
      } else {
        const next = CAL_ORDER[nextIndex]!
        setCalStep(next)
        setCalHint(t(CAL_HINT[next]))
      }
    } finally {
      setBusy(false)
    }
  }

  const skipClutch = async () => {
    if (calStep !== 'clutch') return
    setCalStep('done')
    setCalHint(t('dashboard.calDoneSkipClutch'))
    setCalError('')
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-kicker">{t('dashboard.kicker')}</p>
          <h1 className="page-title">{t('dashboard.title')}</h1>
          <p className="page-desc">{t('dashboard.desc')}</p>
        </div>
      </div>

      <div className="grid-2 link-status-grid">
        <Card title={t('dashboard.linkMoza')} className="status-panel">
          <div className="link-status">
            <StatusIndicator
              status={device.connected ? 'online' : 'offline'}
              label={
                device.connected ? t('dashboard.linkMozaOn') : t('dashboard.linkMozaOff')
              }
            />
            {device.connected ? (
              <p className="link-status-meta">
                {device.model}
                {shownAngle ? ` · ${shownAngle}°` : ''}
              </p>
            ) : (
              <p className="link-status-meta">{t('dashboard.hardwareMissing')}</p>
            )}
          </div>
        </Card>

        <Card title={t('dashboard.linkGta')} className="status-panel">
          <div className="link-status">
            <StatusIndicator
              status={gta.connected ? 'online' : 'offline'}
              label={gta.connected ? t('dashboard.linkGtaOn') : t('dashboard.linkGtaOff')}
            />
            {gta.connected ? (
              <p className="link-status-meta">
                {t('dashboard.storyMode')}
                {gta.vehicle && gta.vehicle !== '—' ? ` · ${gta.vehicle}` : ''}
              </p>
            ) : gta.pluginMissing ? (
              <p className="link-status-meta">{t('dashboard.linkGtaPluginMissing')}</p>
            ) : (
              <p className="link-status-meta">{t('dashboard.waitBadge')}</p>
            )}
          </div>
        </Card>
      </div>

      <Card
        title={t('dashboard.liveInputs')}
        className="live-inputs-card"
        actions={
          <div className="pedal-cal-actions" style={{ marginTop: 0 }}>
            {calStep === 'idle' || calStep === 'done' ? (
              <Button variant="secondary" onClick={startCal}>
                {t('dashboard.calibratePedals')}
              </Button>
            ) : (
              <Button variant="secondary" onClick={cancelCal}>
                {t('common.cancel')}
              </Button>
            )}
          </div>
        }
      >
        {calStep !== 'idle' ? (
          <div className="pedal-cal-banner">
            <p>{calHint}</p>
            {calError ? <p className="pedal-cal-error">{calError}</p> : null}
            {calStep !== 'done' ? (
              <div className="pedal-cal-actions">
                <Button variant="primary" disabled={busy} onClick={() => void rememberFloor()}>
                  {t('dashboard.calRemember')}
                </Button>
                {calStep === 'clutch' ? (
                  <Button variant="secondary" disabled={busy} onClick={() => void skipClutch()}>
                    {t('dashboard.calSkipClutch')}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="live-inputs">
          <WheelGauge
            angle={telemetry.steeringAngle}
            maxAngle={maxAngle}
            torque={telemetry.torque}
            maxTorque={activeSettings.ffb.maximumTorque ?? 5.5}
            connected={device.connected}
          />
          <PedalMeters
            throttle={telemetry.throttle}
            brake={telemetry.brake}
            clutch={telemetry.clutch}
            throttleRaw={telemetry.throttleRaw}
            brakeRaw={telemetry.brakeRaw}
            clutchRaw={telemetry.clutchRaw}
            connected={device.connected}
            labels={{
              throttle: t('dashboard.throttle'),
              brake: t('dashboard.brake'),
              clutch: t('dashboard.clutch'),
            }}
          />
        </div>
        <p className="live-inputs-hint">{t('dashboard.liveInputsHint')}</p>
      </Card>

      <Card
        title={t('dashboard.paddlesTitle')}
        subtitle={t('dashboard.paddlesSubtitle')}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void window.gtamoza?.mozaResetPaddleLearn?.().then((s) => {
                if (!s) return
                setIndL(s.indL)
                setIndR(s.indR)
                setLearnedL(s.learnedL)
                setLearnedR(s.learnedR)
                setLastPaddleMsg(t('dashboard.paddlesReset'))
                toast.push({ title: t('dashboard.paddlesReset'), tone: 'success' })
              })
            }}
          >
            {t('dashboard.paddlesResetBtn')}
          </Button>
        }
      >
        <div className="paddle-debug">
          <div className="paddle-debug-flags">
            <span className="paddle-flag" data-on={indL ? 'true' : 'false'}>
              {t('dashboard.paddleLeft')}: {indL ? t('common.enabled') : t('common.disabled')}
            </span>
            <span className="paddle-flag" data-on={indR ? 'true' : 'false'}>
              {t('dashboard.paddleRight')}: {indR ? t('common.enabled') : t('common.disabled')}
            </span>
          </div>
          <p className="field-hint">
            {t('dashboard.paddlesLearned', {
              left: learnedL < 0 ? '—' : String(learnedL),
              right: learnedR < 0 ? '—' : String(learnedR),
            })}
          </p>
          <p className="paddle-debug-last">{lastPaddleMsg || t('dashboard.paddlesWaiting')}</p>
        </div>
      </Card>

      <Card title={t('dashboard.session')}>
        <div className="metric-grid">
          <div className="metric">
            <div className="metric-label">{t('dashboard.profile')}</div>
            <div className="metric-value" style={{ fontSize: 16 }}>
              {profileName}
            </div>
          </div>
          <div className="metric">
            <div className="metric-label">{t('dashboard.steering')}</div>
            <div className="metric-value">
              {telemetry.steeringAngle.toFixed(1)}
              <span className="metric-unit">°</span>
            </div>
          </div>
          <div className="metric">
            <div className="metric-label">{t('dashboard.ffb')}</div>
            <div className="metric-value" style={{ fontSize: 16 }}>
              {activeSettings.ffb.enabled ? t('common.enabled') : t('common.disabled')}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
