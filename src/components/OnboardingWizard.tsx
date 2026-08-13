import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronRight,
  Disc3,
  Gamepad2,
  ShieldAlert,
  Sparkles,
  Usb,
} from 'lucide-react'
import { Button } from './Button'
import { StatusIndicator } from './StatusIndicator'
import { useI18n } from '../i18n/useI18n'
import type { MessageKey } from '../i18n/messages'
import { useAppStore } from '../stores/AppStore'
import type { GtaModStatus, PageId } from '../types'

type CheckTone = 'online' | 'offline' | 'warning'

type CheckRow = {
  id: string
  label: string
  detail?: string
  ok: boolean
  tone: CheckTone
}

type StepId = 'welcome' | 'moza' | 'gta' | 'pedals' | 'online' | 'done'

type Step = {
  id: StepId
  icon: typeof Usb
  titleKey: MessageKey
  bodyKey: MessageKey
  goTo?: PageId
  /** Soft-required: show “continue anyway” until checks pass. */
  requireOk?: boolean
}

const STEPS: Step[] = [
  {
    id: 'welcome',
    icon: Sparkles,
    titleKey: 'onboarding.welcome.title',
    bodyKey: 'onboarding.welcome.body',
  },
  {
    id: 'moza',
    icon: Usb,
    titleKey: 'onboarding.moza.title',
    bodyKey: 'onboarding.moza.body',
    goTo: 'dashboard',
    requireOk: true,
  },
  {
    id: 'gta',
    icon: Gamepad2,
    titleKey: 'onboarding.gta.title',
    bodyKey: 'onboarding.gta.body',
    goTo: 'settings',
    requireOk: true,
  },
  {
    id: 'pedals',
    icon: Disc3,
    titleKey: 'onboarding.pedals.title',
    bodyKey: 'onboarding.pedals.body',
    goTo: 'dashboard',
    requireOk: true,
  },
  {
    id: 'online',
    icon: ShieldAlert,
    titleKey: 'onboarding.online.title',
    bodyKey: 'onboarding.online.body',
    goTo: 'settings',
    requireOk: true,
  },
  {
    id: 'done',
    icon: CheckCircle2,
    titleKey: 'onboarding.done.title',
    bodyKey: 'onboarding.done.body',
  },
]

type Props = {
  open: boolean
  onFinish: () => void
  onNavigate: (page: PageId) => void
}

function CheckList({ rows }: { rows: CheckRow[] }) {
  if (rows.length === 0) return null
  return (
    <ul className="onboard-checks">
      {rows.map((row) => (
        <li key={row.id} className={`onboard-check ${row.ok ? 'is-ok' : 'is-wait'}`}>
          <StatusIndicator status={row.tone} />
          <div className="onboard-check-text">
            <span className="onboard-check-label">{row.label}</span>
            {row.detail ? <span className="onboard-check-detail">{row.detail}</span> : null}
          </div>
        </li>
      ))}
    </ul>
  )
}

export function OnboardingWizard({ open, onFinish, onNavigate }: Props) {
  const { t } = useI18n()
  const { device, settings, gta: gtaLink } = useAppStore()
  const [index, setIndex] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  const [gtaMod, setGtaMod] = useState<GtaModStatus | null>(null)
  const [gtaBusy, setGtaBusy] = useState(false)
  const [onlineAck, setOnlineAck] = useState(false)

  const step = STEPS[index]!
  const Icon = step.icon
  const isLast = index >= STEPS.length - 1
  const progress = useMemo(
    () => ((index + 1) / STEPS.length) * 100,
    [index],
  )

  const refreshGta = useCallback(async () => {
    const status = await window.gtamoza?.gtaGetStatus()
    if (status) setGtaMod(status)
  }, [])

  useEffect(() => {
    if (!open) return
    void refreshGta()
    const timer = window.setInterval(() => void refreshGta(), 1500)
    return () => window.clearInterval(timer)
  }, [open, refreshGta])

  const pedalsOk = Boolean(
    settings.pedalFloors.throttle && settings.pedalFloors.brake,
  )
  const mozaOk = device.connected
  const storyOk = gtaMod?.state === 'enabled'
  const hooksOk = Boolean(gtaMod?.hasScriptHook && gtaMod?.hasDotNet)
  const gameOk = Boolean(gtaMod?.validGame)

  const checks = useMemo((): CheckRow[] => {
    switch (step.id) {
      case 'welcome':
        return [
          {
            id: 'moza',
            label: t('onboarding.check.moza'),
            detail: mozaOk
              ? device.name || t('onboarding.check.ok')
              : t('onboarding.check.mozaWait'),
            ok: mozaOk,
            tone: mozaOk ? 'online' : 'offline',
          },
          {
            id: 'story',
            label: t('onboarding.check.story'),
            detail: storyOk
              ? t('settings.gta.state.enabled')
              : gtaMod
                ? t(`settings.gta.state.${gtaMod.state}` as MessageKey)
                : t('onboarding.check.checking'),
            ok: storyOk,
            tone: storyOk ? 'online' : 'offline',
          },
          {
            id: 'pedals',
            label: t('onboarding.check.pedals'),
            detail: pedalsOk
              ? t('onboarding.check.ok')
              : t('onboarding.check.pedalsWait'),
            ok: pedalsOk,
            tone: pedalsOk ? 'online' : 'warning',
          },
        ]
      case 'moza':
        return [
          {
            id: 'usb',
            label: t('onboarding.check.moza'),
            detail: mozaOk
              ? `${device.name}${device.model ? ` · ${device.model}` : ''}`
              : t('onboarding.check.mozaWait'),
            ok: mozaOk,
            tone: mozaOk ? 'online' : 'offline',
          },
        ]
      case 'gta':
        return [
          {
            id: 'game',
            label: t('onboarding.check.gameFolder'),
            detail: gameOk
              ? gtaMod?.gamePath ?? t('onboarding.check.ok')
              : t('onboarding.check.gameFolderWait'),
            ok: gameOk,
            tone: gameOk ? 'online' : 'offline',
          },
          {
            id: 'hooks',
            label: t('onboarding.check.hooks'),
            detail: hooksOk
              ? t('onboarding.check.ok')
              : t('onboarding.check.hooksWait'),
            ok: hooksOk,
            tone: hooksOk ? 'online' : gameOk ? 'warning' : 'offline',
          },
          {
            id: 'story',
            label: t('onboarding.check.story'),
            detail: storyOk
              ? t('settings.gta.state.enabled')
              : gtaMod
                ? t(`settings.gta.state.${gtaMod.state}` as MessageKey)
                : t('onboarding.check.checking'),
            ok: storyOk,
            tone: storyOk ? 'online' : 'offline',
          },
          {
            id: 'plugin',
            label: t('onboarding.check.plugin'),
            detail: gtaMod?.hasOurPlugin
              ? t('onboarding.check.ok')
              : t('onboarding.check.pluginWait'),
            ok: Boolean(gtaMod?.hasOurPlugin),
            tone: gtaMod?.hasOurPlugin ? 'online' : 'warning',
          },
        ]
      case 'pedals':
        return [
          {
            id: 'throttle',
            label: t('onboarding.check.throttle'),
            detail: settings.pedalFloors.throttle
              ? t('onboarding.check.ok')
              : t('onboarding.check.calWait'),
            ok: Boolean(settings.pedalFloors.throttle),
            tone: settings.pedalFloors.throttle ? 'online' : 'offline',
          },
          {
            id: 'brake',
            label: t('onboarding.check.brake'),
            detail: settings.pedalFloors.brake
              ? t('onboarding.check.ok')
              : t('onboarding.check.calWait'),
            ok: Boolean(settings.pedalFloors.brake),
            tone: settings.pedalFloors.brake ? 'online' : 'offline',
          },
          {
            id: 'clutch',
            label: t('onboarding.check.clutch'),
            detail: settings.pedalFloors.clutch
              ? t('onboarding.check.ok')
              : t('onboarding.check.clutchOptional'),
            ok: Boolean(settings.pedalFloors.clutch),
            tone: settings.pedalFloors.clutch ? 'online' : 'warning',
          },
        ]
      case 'online':
        return [
          {
            id: 'mode',
            label: t('onboarding.check.currentMode'),
            detail: gtaMod
              ? t(`settings.gta.state.${gtaMod.state}` as MessageKey)
              : t('onboarding.check.checking'),
            ok: Boolean(gtaMod),
            tone:
              gtaMod?.state === 'parked'
                ? 'online'
                : gtaMod?.state === 'enabled'
                  ? 'warning'
                  : 'offline',
          },
          {
            id: 'ack',
            label: t('onboarding.check.onlineAck'),
            detail: onlineAck
              ? t('onboarding.check.ok')
              : t('onboarding.check.onlineAckWait'),
            ok: onlineAck,
            tone: onlineAck ? 'online' : 'warning',
          },
        ]
      case 'done':
        return [
          {
            id: 'moza',
            label: t('onboarding.check.moza'),
            ok: mozaOk,
            tone: mozaOk ? 'online' : 'offline',
            detail: mozaOk ? t('onboarding.check.ok') : t('onboarding.check.pending'),
          },
          {
            id: 'story',
            label: t('onboarding.check.story'),
            ok: storyOk,
            tone: storyOk ? 'online' : 'offline',
            detail: storyOk ? t('onboarding.check.ok') : t('onboarding.check.pending'),
          },
          {
            id: 'pedals',
            label: t('onboarding.check.pedals'),
            ok: pedalsOk,
            tone: pedalsOk ? 'online' : 'warning',
            detail: pedalsOk ? t('onboarding.check.ok') : t('onboarding.check.pending'),
          },
          {
            id: 'link',
            label: t('onboarding.check.gameLink'),
            ok: gtaLink.connected,
            tone: gtaLink.connected ? 'online' : 'warning',
            detail: gtaLink.connected
              ? t('dashboard.linkGtaOn')
              : t('onboarding.check.gameLinkWait'),
          },
        ]
      default:
        return []
    }
  }, [
    step.id,
    t,
    mozaOk,
    device.name,
    device.model,
    storyOk,
    gtaMod,
    pedalsOk,
    gameOk,
    hooksOk,
    settings.pedalFloors.throttle,
    settings.pedalFloors.brake,
    settings.pedalFloors.clutch,
    onlineAck,
    gtaLink.connected,
  ])

  const stepOk = useMemo(() => {
    switch (step.id) {
      case 'moza':
        return mozaOk
      case 'gta':
        return storyOk
      case 'pedals':
        return pedalsOk
      case 'online':
        return onlineAck
      default:
        return true
    }
  }, [step.id, mozaOk, storyOk, pedalsOk, onlineAck])

  const enableStory = async () => {
    if (!window.gtamoza) return
    setGtaBusy(true)
    try {
      const result = await window.gtamoza.gtaEnable()
      if (result?.status) setGtaMod(result.status)
    } finally {
      setGtaBusy(false)
    }
  }

  if (!open) return null

  if (collapsed) {
    return (
      <button
        type="button"
        className="onboard-chip"
        onClick={() => setCollapsed(false)}
      >
        <span className={`onboard-chip-dot ${stepOk ? 'is-ok' : 'is-wait'}`} />
        <span className="onboard-chip-text">
          <strong>{t('onboarding.title')}</strong>
          <span>
            {t('onboarding.step', { current: index + 1, total: STEPS.length })}
            {' · '}
            {stepOk ? t('onboarding.check.ok') : t('onboarding.check.waiting')}
          </span>
        </span>
        <ChevronRight size={16} />
      </button>
    )
  }

  return (
    <aside
      className="onboard-dock"
      role="dialog"
      aria-modal="false"
      aria-label={t('onboarding.title')}
    >
      <div className="onboard-dock-head">
        <div>
          <p className="onboard-kicker">
            {t('onboarding.step', { current: index + 1, total: STEPS.length })}
          </p>
          <h2 className="onboard-title">{t(step.titleKey)}</h2>
        </div>
        <Button variant="ghost" onClick={() => setCollapsed(true)}>
          {t('onboarding.minimize')}
        </Button>
      </div>

      <div className="onboard-progress" aria-hidden>
        <div className="onboard-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      <div className="onboard-dock-body">
        <div className="onboard-icon" aria-hidden>
          <Icon size={26} strokeWidth={1.75} />
        </div>
        <p className="onboard-body">{t(step.bodyKey)}</p>

        <CheckList rows={checks} />

        {step.id === 'online' ? (
          <label className="onboard-ack">
            <input
              type="checkbox"
              checked={onlineAck}
              onChange={(e) => setOnlineAck(e.target.checked)}
            />
            <span>{t('onboarding.online.ackLabel')}</span>
          </label>
        ) : null}

        {step.requireOk ? (
          <p className={`onboard-verdict ${stepOk ? 'is-ok' : 'is-wait'}`}>
            {stepOk ? t('onboarding.verdict.ok') : t('onboarding.verdict.wait')}
          </p>
        ) : null}
      </div>

      <div className="onboard-actions">
        {index > 0 ? (
          <Button variant="ghost" onClick={() => setIndex((i) => i - 1)}>
            {t('onboarding.back')}
          </Button>
        ) : (
          <Button variant="ghost" onClick={onFinish}>
            {t('onboarding.skip')}
          </Button>
        )}

        <div className="onboard-actions-right">
          {step.id === 'gta' && gtaMod?.canEnable && !storyOk ? (
            <Button
              variant="secondary"
              disabled={gtaBusy}
              onClick={() => void enableStory()}
            >
              {t('onboarding.enableStory')}
            </Button>
          ) : null}
          {step.goTo && !isLast ? (
            <Button
              variant="secondary"
              onClick={() => {
                onNavigate(step.goTo!)
                setCollapsed(true)
              }}
            >
              {t('onboarding.openPage')}
            </Button>
          ) : null}
          <Button
            variant="primary"
            onClick={() => {
              if (isLast) onFinish()
              else setIndex((i) => i + 1)
            }}
          >
            {isLast
              ? t('onboarding.finish')
              : step.requireOk && !stepOk
                ? t('onboarding.nextAnyway')
                : t('onboarding.next')}
          </Button>
        </div>
      </div>
    </aside>
  )
}
