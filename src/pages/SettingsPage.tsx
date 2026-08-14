import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Select, Toggle } from '../components'
import { useToast } from '../components/Toast'
import { APP_CONFIG } from '../config'
import { translate, type MessageKey } from '../i18n/messages'
import { useI18n } from '../i18n/useI18n'
import { useAppStore } from '../stores/AppStore'
import type { AppLocale, AppTheme, GtaModStatus, UpdateChannel, UpdateStatus } from '../types'

function updateMessage(
  status: UpdateStatus,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
) {
  switch (status.state) {
    case 'idle':
      return t('settings.update.idle')
    case 'checking':
      return t('settings.update.checking')
    case 'available':
      return t('settings.update.available', { version: status.version })
    case 'not-available':
      return t('settings.update.notAvailable', { version: status.version })
    case 'downloading':
      return t('settings.update.downloading', { percent: status.percent.toFixed(0) })
    case 'ready':
      return t('settings.update.ready', { version: status.version })
    case 'unsupported':
      return status.reason === 'dev'
        ? t('settings.update.unsupportedDev')
        : t('settings.update.unsupportedPortable')
    case 'error':
      return t('settings.update.error', { code: status.code })
    default:
      return ''
  }
}

export function SettingsPage() {
  const {
    settings,
    updateAppSettings,
    version,
    updateStatus,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  } = useAppStore()
  const toast = useToast()
  const { t } = useI18n()
  const [gta, setGta] = useState<GtaModStatus | null>(null)
  const [gtaBusy, setGtaBusy] = useState(false)

  const refreshGta = useCallback(async () => {
    const status = await window.gtamoza?.gtaGetStatus()
    if (status) setGta(status)
  }, [])

  useEffect(() => {
    void refreshGta()
  }, [refreshGta])

  const runGta = async (
    action: () => Promise<{ ok: boolean; status: GtaModStatus; error?: string } | undefined>,
    okToast: MessageKey,
  ) => {
    if (!window.gtamoza) return
    setGtaBusy(true)
    try {
      const result = await action()
      if (!result) return
      setGta(result.status)
      if (result.status.gamePath && result.status.gamePath !== settings.gtaGamePath) {
        await updateAppSettings({ gtaGamePath: result.status.gamePath })
      }
      if (result.ok) {
        toast.push({ title: t(okToast), tone: 'success' })
      } else if (
        result.error === 'hooks_missing' ||
        result.error === 'hooks_incomplete' ||
        result.error?.startsWith('scripthookv_') ||
        result.error?.startsWith('shvdn_') ||
        result.error?.startsWith('download_')
      ) {
        toast.push({ title: t('settings.gta.toastHooksMissing'), tone: 'warning' })
      } else if (result.error === 'plugin_missing') {
        toast.push({ title: t('settings.gta.toastPluginMissing'), tone: 'error' })
      } else if (result.error === 'invalid_game') {
        toast.push({ title: t('settings.gta.toastInvalid'), tone: 'error' })
      } else if (result.error?.startsWith('uninstall_locked:')) {
        toast.push({ title: t('settings.gta.toastUninstallLocked'), tone: 'error' })
      } else if (result.error === 'cancelled') {
        /* ignore */
      } else {
        toast.push({
          title: t('settings.gta.toastFailed', { error: result.error ?? 'unknown' }),
          tone: 'error',
        })
      }
    } finally {
      setGtaBusy(false)
    }
  }

  const storyOn = gta?.state === 'enabled'
  const onlineSafe = Boolean(gta?.onlineSafe)
  const gtaHintKey = ((): MessageKey => {
    if (!gta?.validGame) return 'settings.gta.hint.missing'
    if (gta.state === 'enabled') return 'settings.gta.hint.enabled'
    if (gta.state === 'parked') return 'settings.gta.hint.parked'
    if (!gta.hasScriptHook && !gta.hasAsiLoader) return 'settings.gta.hint.nohooks'
    return 'settings.gta.hint.ready'
  })()

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-kicker">{t('settings.kicker')}</p>
          <h1 className="page-title">{t('settings.title')}</h1>
          <p className="page-desc">{t('settings.desc')}</p>
        </div>
      </div>

      <Card title={t('settings.gta')}>
        <div className="gta-box">
          <p className="gta-box-lead">{t('settings.gtaDesc')}</p>

          <div className="setting-row">
            <div className="gta-path-block">
              <div className="field-label">{t('settings.gta.path')}</div>
              <div className="field-hint">{t('settings.gta.pathHint')}</div>
              <div className="gta-path-value">
                {gta?.gamePath ?? settings.gtaGamePath ?? '—'}
              </div>
            </div>
            <Button
              variant="secondary"
              disabled={gtaBusy}
              onClick={() => {
                void (async () => {
                  setGtaBusy(true)
                  try {
                    const result = await window.gtamoza?.gtaPickFolder()
                    if (!result) return
                    setGta(result.status)
                    if (result.ok && result.status.gamePath) {
                      await updateAppSettings({ gtaGamePath: result.status.gamePath })
                    } else if (result.error === 'invalid_game') {
                      toast.push({ title: t('settings.gta.toastInvalid'), tone: 'error' })
                    }
                  } finally {
                    setGtaBusy(false)
                  }
                })()
              }}
            >
              {t('settings.gta.browse')}
            </Button>
          </div>

          <p className="gta-status-hint">{t(gtaHintKey)}</p>

          <div className="gta-mode-stack">
            <div className="gta-mode-card gta-mode-card-story" data-active={storyOn ? 'true' : 'false'}>
              <div className="gta-mode-card-head">
                <strong>{t('settings.gta.modeStory')}</strong>
                <span className="gta-mode-pill" data-on={storyOn ? 'true' : 'false'}>
                  {storyOn ? t('common.enabled') : t('common.disabled')}
                </span>
              </div>
              <p className="field-hint">{t('settings.gta.modeStoryHint')}</p>
              {gta?.validGame ? (
                <p className="field-hint" style={{ marginTop: 4 }}>
                  {t('settings.gta.store', {
                    store: t(
                      (
                        {
                          steam: 'settings.gta.store.steam',
                          epic: 'settings.gta.store.epic',
                          rockstar: 'settings.gta.store.rockstar',
                          unknown: 'settings.gta.store.unknown',
                        } as const
                      )[gta.store ?? 'unknown'],
                    ),
                  })}
                </p>
              ) : null}
              <div className="gta-mode-actions">
                <Button
                  variant="primary"
                  disabled={gtaBusy || !gta?.validGame || !gta?.canEnable}
                  onClick={() => {
                    if (!gta?.hasScriptHook || !gta?.hasDotNet) {
                      toast.push({
                        title: t('settings.gta.toastDownloading'),
                        tone: 'default',
                      })
                    }
                    void runGta(
                      () => window.gtamoza!.gtaEnable(),
                      'settings.gta.toastEnabled',
                    )
                  }}
                >
                  {t('settings.gta.enable')}
                </Button>
                <Button
                  variant="secondary"
                  disabled={gtaBusy || !gta?.validGame || !storyOn}
                  onClick={() => {
                    void (async () => {
                      setGtaBusy(true)
                      try {
                        const result = await window.gtamoza?.gtaLaunchStory()
                        if (!result?.ok) {
                          const err = result?.error ?? 'launch_failed'
                          toast.push({
                            title:
                              err === 'already_running'
                                ? t('settings.gta.toastLaunchRunning')
                                : err === 'plugin_missing'
                                  ? t('settings.gta.toastPluginMissing')
                                  : t('settings.gta.toastLaunchFailed', { error: err }),
                            tone: 'error',
                          })
                          return
                        }
                        const titleKey: MessageKey =
                          result.store === 'steam'
                            ? 'settings.gta.toastLaunchedSteam'
                            : result.store === 'epic' ||
                                result.note === 'set_epic_launch_options'
                              ? 'settings.gta.toastLaunchedEpic'
                              : result.store === 'rockstar' ||
                                  result.note === 'disable_battleye_in_launcher'
                                ? 'settings.gta.toastLaunchedRockstar'
                                : 'settings.gta.toastLaunched'
                        toast.push({ title: t(titleKey), tone: 'success' })
                      } finally {
                        setGtaBusy(false)
                      }
                    })()
                  }}
                >
                  {t('settings.gta.launchStory')}
                </Button>
                <Button
                  variant="secondary"
                  disabled={gtaBusy || !gta?.validGame || !storyOn}
                  onClick={() => {
                    void (async () => {
                      if (!window.gtamoza) return
                      setGtaBusy(true)
                      try {
                        const result = await window.gtamoza.gtaHotReload()
                        if (result?.status) setGta(result.status)
                        if (!result?.ok) {
                          toast.push({
                            title: t('settings.gta.toastFailed', {
                              error: result?.error ?? 'hot_reload_failed',
                            }),
                            tone: 'error',
                          })
                          return
                        }
                        toast.push({
                          title: result.keySent
                            ? t('settings.gta.toastHotReloaded')
                            : t('settings.gta.toastHotReloadManual'),
                          tone: 'success',
                        })
                      } finally {
                        setGtaBusy(false)
                      }
                    })()
                  }}
                >
                  {t('settings.gta.hotReload')}
                </Button>
              </div>
              <p className="field-hint">{t('settings.gta.launchStoryHint')}</p>
              <p className="field-hint">{t('settings.gta.hotReloadHint')}</p>
            </div>

            <div
              className="gta-online-bar"
              data-active={onlineSafe ? 'true' : 'false'}
            >
              <div className="gta-online-bar-copy">
                <div className="gta-mode-card-head">
                  <strong>{t('settings.gta.modeOnline')}</strong>
                  <span className="gta-mode-pill" data-on={onlineSafe ? 'true' : 'false'}>
                    {onlineSafe ? t('settings.gta.onlineReady') : t('settings.gta.onlineBlocked')}
                  </span>
                </div>
                <p className="field-hint">{t('settings.gta.modeOnlineHint')}</p>
              </div>
              <Button
                variant="secondary"
                disabled={gtaBusy || !gta?.canDisable}
                onClick={() =>
                  void runGta(() => window.gtamoza!.gtaDisable(), 'settings.gta.toastDisabled')
                }
              >
                {t('settings.gta.disable')}
              </Button>
            </div>
          </div>

          <div className="gta-actions gta-actions-secondary gta-uninstall-row">
            <div>
              <Button
                variant="ghost"
                disabled={gtaBusy || !gta?.canUninstall}
                onClick={() =>
                  void runGta(
                    () => window.gtamoza!.gtaUninstall(false),
                    'settings.gta.toastUninstalled',
                  )
                }
              >
                {t('settings.gta.uninstall')}
              </Button>
              <p className="field-hint" style={{ marginTop: 6 }}>
                {t('settings.gta.uninstallHint')}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card title={t('settings.appearance')}>
        <div className="setting-row">
          <div>
            <div className="field-label">{t('settings.theme')}</div>
            <div className="field-hint">{t('settings.themeHint')}</div>
          </div>
          <div style={{ width: 180 }}>
            <Select
              value={settings.theme}
              options={[
                { value: 'dark', label: t('settings.theme.dark') },
                { value: 'light', label: t('settings.theme.light') },
                { value: 'system', label: t('settings.theme.system') },
              ]}
              onChange={(value) => {
                void updateAppSettings({ theme: value as AppTheme }).then(() =>
                  toast.push({ title: t('settings.themeUpdated'), tone: 'success' }),
                )
              }}
            />
          </div>
        </div>
      </Card>

      <Card title={t('settings.general')}>
        <div className="setting-row">
          <div>
            <div className="field-label">{t('settings.language')}</div>
            <div className="field-hint">{t('settings.languageHint')}</div>
          </div>
          <div style={{ width: 180 }}>
            <Select
              value={settings.locale}
              options={[
                { value: 'en', label: 'English' },
                { value: 'ru', label: 'Русский' },
              ]}
              onChange={(value) => {
                const locale = value as AppLocale
                void updateAppSettings({ locale }).then(() =>
                  toast.push({
                    title: translate(locale, 'settings.languageUpdated'),
                    tone: 'success',
                  }),
                )
              }}
            />
          </div>
        </div>
        <div className="setting-row">
          <div>
            <div className="field-label">{t('settings.startWithWindows')}</div>
            <div className="field-hint">{t('settings.startWithWindowsHint')}</div>
          </div>
          <Toggle
            checked={settings.startWithWindows}
            onChange={(startWithWindows) => {
              void updateAppSettings({ startWithWindows })
            }}
          />
        </div>
        <div className="setting-row">
          <div>
            <div className="field-label">{t('settings.minimizeToTray')}</div>
            <div className="field-hint">{t('settings.minimizeToTrayHint')}</div>
          </div>
          <Toggle
            checked={settings.minimizeToTray}
            onChange={(minimizeToTray) => {
              void updateAppSettings({ minimizeToTray })
            }}
          />
        </div>
        <div className="setting-row">
          <div>
            <div className="field-label">{t('onboarding.replay')}</div>
            <div className="field-hint">{t('onboarding.replayHint')}</div>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              void updateAppSettings({ onboardingCompleted: false })
            }}
          >
            {t('onboarding.replay')}
          </Button>
        </div>
      </Card>

      <Card title={t('settings.updates')}>
        <div className="update-box">
          <div className="field-row">
            <span className="field-label">{t('settings.currentVersion')}</span>
            <strong>{version}</strong>
          </div>
          <div className="setting-row">
            <div>
              <div className="field-label">{t('settings.autoUpdates')}</div>
              <div className="field-hint">{t('settings.autoUpdatesHint')}</div>
            </div>
            <Toggle
              checked={settings.autoUpdates}
              onChange={(autoUpdates) => {
                void updateAppSettings({ autoUpdates })
              }}
            />
          </div>
          <div className="setting-row">
            <div>
              <div className="field-label">{t('settings.updateChannel')}</div>
              <div className="field-hint">{t('settings.updateChannelHint')}</div>
            </div>
            <div style={{ width: 180 }}>
              <Select
                value={settings.updateChannel}
                options={[
                  { value: 'stable', label: t('settings.channel.stable') },
                  { value: 'beta', label: t('settings.channel.beta') },
                ]}
                onChange={(value) => {
                  void updateAppSettings({ updateChannel: value as UpdateChannel })
                }}
              />
            </div>
          </div>

          <p className="field-hint">{updateMessage(updateStatus, t)}</p>

          {updateStatus.state === 'downloading' ? (
            <div className="progress">
              <div className="progress-bar" style={{ width: `${updateStatus.percent}%` }} />
            </div>
          ) : null}

          <div className="ffb-test-panel">
            <Button
              variant="secondary"
              onClick={() => {
                void checkForUpdates()
              }}
            >
              {t('settings.checkUpdates')}
            </Button>
            {updateStatus.state === 'available' ? (
              <Button
                variant="primary"
                onClick={() => {
                  void downloadUpdate()
                }}
              >
                {t('settings.download', { version: updateStatus.version })}
              </Button>
            ) : null}
            {updateStatus.state === 'ready' ? (
              <Button
                variant="primary"
                onClick={() => {
                  void installUpdate()
                }}
              >
                {t('settings.restartInstall')}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              onClick={() => {
                void window.gtamoza?.openReleasesPage()
              }}
            >
              {t('settings.openReleases')}
            </Button>
          </div>
          <div className="field-hint">
            {t('settings.repository', {
              owner: APP_CONFIG.github.owner,
              repo: APP_CONFIG.github.repo,
            })}
          </div>
        </div>
      </Card>
    </div>
  )
}
