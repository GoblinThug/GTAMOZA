import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { autoUpdater, type UpdateInfo, type ProgressInfo } from 'electron-updater'
import { GITHUB_RELEASES_URL } from './config'
import type { UpdateErrorCode, UpdateStatus } from '../shared/types'

export type { UpdateErrorCode, UpdateStatus }

function emit(status: UpdateStatus) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('update:status', status)
  }
}

function isPortableBuild(): boolean {
  return Boolean(
    process.env.PORTABLE_EXECUTABLE_DIR || process.env.PORTABLE_EXECUTABLE_FILE,
  )
}

function classifyUpdateError(error: unknown): UpdateErrorCode {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()

  if (
    /enoent|404|cannot find|latest\.yml|no published versions|is not available/i.test(
      lower,
    )
  ) {
    return 'notFound'
  }
  if (/sha512|checksum|hash|blockmap|corrupt|damaged/i.test(lower)) {
    return 'checksum'
  }
  if (/eacces|eperm|ebusy|accessing a file|operation not permitted/i.test(lower)) {
    return 'permission'
  }
  if (
    /enotfound|econnrefused|econnreset|etimedout|enetunreach|offline|network|getaddrinfo|socket|tls|certificate|http.?error|status code|net::/i.test(
      lower,
    )
  ) {
    return 'network'
  }
  return 'generic'
}

function emitUpdateError(error: unknown, opts?: { quiet?: boolean }) {
  const code = classifyUpdateError(error)
  const raw = error instanceof Error ? error.message : String(error ?? '')
  console.error('[updater]', code, raw)

  if (opts?.quiet && (code === 'network' || code === 'notFound')) {
    emit({ state: 'idle' })
    return code
  }

  emit({ state: 'error', code })
  return code
}

export function initAutoUpdater(options?: { autoCheck?: boolean }) {
  let checkSource: 'user' | 'auto' = 'auto'

  ipcMain.handle('update:getVersion', () => app.getVersion())

  ipcMain.handle('update:check', async () => {
    if (!app.isPackaged) {
      const status: UpdateStatus = { state: 'unsupported', reason: 'dev' }
      emit(status)
      return status
    }
    if (isPortableBuild()) {
      const status: UpdateStatus = { state: 'unsupported', reason: 'portable' }
      emit(status)
      return status
    }

    checkSource = 'user'
    emit({ state: 'checking' })
    try {
      await autoUpdater.checkForUpdates()
      return null
    } catch (error) {
      const code = emitUpdateError(error, { quiet: false })
      return { state: 'error', code } satisfies UpdateStatus
    }
  })

  ipcMain.handle('update:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return true
    } catch (error) {
      emitUpdateError(error)
      return false
    }
  })

  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall(false, true)
  })

  ipcMain.handle('update:openReleases', () => shell.openExternal(GITHUB_RELEASES_URL))

  if (!app.isPackaged || isPortableBuild()) {
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.forceDevUpdateConfig = false
  autoUpdater.allowDowngrade = false

  const winUpdater = autoUpdater as typeof autoUpdater & {
    verifyUpdateCodeSignature?: boolean
  }
  if (typeof winUpdater.verifyUpdateCodeSignature === 'boolean') {
    winUpdater.verifyUpdateCodeSignature = false
  }

  autoUpdater.on('checking-for-update', () => {
    emit({ state: 'checking' })
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    emit({
      state: 'available',
      version: info.version,
      releaseNotes:
        typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
    })
  })

  autoUpdater.on('update-not-available', () => {
    emit({ state: 'not-available', version: app.getVersion() })
  })

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    emit({
      state: 'downloading',
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    emit({ state: 'ready', version: info.version })
  })

  autoUpdater.on('error', (error: Error) => {
    emitUpdateError(error, { quiet: checkSource === 'auto' })
    checkSource = 'auto'
  })

  if (options?.autoCheck !== false) {
    setTimeout(() => {
      checkSource = 'auto'
      void autoUpdater.checkForUpdates().catch((error) => {
        emitUpdateError(error, { quiet: true })
        checkSource = 'auto'
      })
    }, 4000)
  }
}
