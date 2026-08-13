import { app, BrowserWindow, ipcMain, Menu, shell, nativeTheme } from 'electron'
import path from 'node:path'
import { loadSettings, saveSettings } from './settings-store'
import {
  createProfile,
  deleteProfile,
  loadProfiles,
  renameProfile,
  resetProfile,
  selectProfile,
  updateProfileSettings,
} from './profile-store'
import { initAutoUpdater } from './updater'
import { disposeMozaBridge, initMozaBridge, setMozaPedalAxisMap, setMozaPedalFloors, setMozaProfileSettings } from './moza/bridge'
import {
  disableGtaIntegration,
  enableGtaIntegration,
  getGtaModStatus,
  hotReloadGtaPlugin,
  launchGtaStoryNoBattlEye,
  openGtaHookHelp,
  pickGtaGameFolder,
  resolveGtaPath,
  uninstallGtaIntegration,
} from './gta/mod-manager'
import {
  disposeGtaTelemetryBridge,
  getFfbEffectLogFile,
  getGtaLinkStatus,
  initGtaTelemetryBridge,
  setFfbHostEnabled,
  setGtaFfbContext,
  startFfbHost,
} from './gta/telemetry-bridge'
import { ensureFfbEffectLogSession } from './gta/ffb-effect-log'
import fs from 'node:fs'
import type { AppSettings, ProfileSettings } from './types'
import { APP_DISPLAY_NAME } from '../shared/config'

// Quiet Chromium DComp noise on Win10 (IDCompositionDevice4 unsupported).
app.commandLine.appendSwitch('disable-features', 'CanvasOopRasterization')
app.commandLine.appendSwitch('disable-direct-composition')

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null

function emitWindowState(win: BrowserWindow) {
  if (win.isDestroyed()) return
  win.webContents.send('window:state', {
    maximized: win.isMaximized(),
    fullscreen: win.isFullScreen(),
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 680,
    frame: false,
    transparent: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    // Windows 11 OS rounding + CSS radius leaves a translucent crescent;
    // shape the chrome in CSS instead.
    roundedCorners: process.platform !== 'win32',
    show: false,
    title: APP_DISPLAY_NAME,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  const syncState = () => {
    if (mainWindow && !mainWindow.isDestroyed()) emitWindowState(mainWindow)
  }
  mainWindow.on('maximize', syncState)
  mainWindow.on('unmaximize', syncState)
  mainWindow.on('enter-full-screen', syncState)
  mainWindow.on('leave-full-screen', syncState)

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function syncMozaFromSelectedProfile() {
  const store = loadProfiles()
  const selected =
    store.profiles.find((p) => p.id === store.selectedProfileId) ?? store.profiles[0]
  if (selected) {
    setMozaProfileSettings({
      steering: selected.settings.steering,
      ffb: selected.settings.ffb,
    })
    setGtaFfbContext({
      ffb: selected.settings.ffb,
      effects: selected.settings.effects,
    })
    // Game FFB toggle starts/stops the DI host that pushes forces to the R5
    setFfbHostEnabled(selected.settings.ffb?.enabled !== false)
  }
}

function registerIpc() {
  ipcMain.handle('settings:load', () => loadSettings())
  ipcMain.handle('settings:save', (_event, patch: Partial<AppSettings>) => {
    const next = saveSettings(patch)
    if (patch.theme) {
      applyNativeTheme(next.theme)
    }
    if (patch.pedalAxisMap) {
      setMozaPedalAxisMap(next.pedalAxisMap)
    }
    if (patch.pedalFloors) {
      setMozaPedalFloors(next.pedalFloors)
    }
    // cheats always mirrored to %TEMP% for the game plugin
    return next
  })

  ipcMain.handle('profiles:load', () => loadProfiles())
  ipcMain.handle('profiles:create', (_event, name: string, fromId?: string) =>
    createProfile(name, fromId),
  )
  ipcMain.handle('profiles:delete', (_event, id: string) => deleteProfile(id))
  ipcMain.handle('profiles:rename', (_event, id: string, name: string) =>
    renameProfile(id, name),
  )
  ipcMain.handle('profiles:select', (_event, id: string) => {
    const store = selectProfile(id)
    saveSettings({ selectedProfileId: store.selectedProfileId })
    syncMozaFromSelectedProfile()
    return store
  })
  ipcMain.handle(
    'profiles:updateSettings',
    (_event, id: string, settings: ProfileSettings) => {
      const store = updateProfileSettings(id, settings)
      if (store.selectedProfileId === id) {
        setMozaProfileSettings({
          steering: settings.steering,
          ffb: settings.ffb,
        })
        setGtaFfbContext({
          ffb: settings.ffb,
          effects: settings.effects,
        })
        setFfbHostEnabled(settings.ffb?.enabled !== false)
      }
      return store
    },
  )
  ipcMain.handle('profiles:reset', (_event, id: string) => {
    const store = resetProfile(id)
    syncMozaFromSelectedProfile()
    return store
  })

  ipcMain.handle('shell:openExternal', (_event, url: string) => shell.openExternal(url))

  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize()
  })
  ipcMain.handle('window:maximizeToggle', () => {
    if (!mainWindow) return false
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false)
      emitWindowState(mainWindow)
      return false
    }
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
      emitWindowState(mainWindow)
      return false
    }
    mainWindow.maximize()
    emitWindowState(mainWindow)
    return true
  })
  ipcMain.handle('window:close', () => {
    mainWindow?.close()
  })
  ipcMain.handle('window:isMaximized', () => {
    if (!mainWindow) return false
    return mainWindow.isMaximized() || mainWindow.isFullScreen()
  })

  ipcMain.handle('system:shouldUseDarkColors', () => nativeTheme.shouldUseDarkColors)

  ipcMain.handle('gta:getStatus', () => {
    const settings = loadSettings()
    return getGtaModStatus(resolveGtaPath(settings.gtaGamePath))
  })
  ipcMain.handle('gta:pickFolder', async () => {
    const picked = await pickGtaGameFolder(mainWindow)
    if (picked.ok && picked.status.gamePath) {
      saveSettings({ gtaGamePath: picked.status.gamePath })
    }
    return picked
  })
  ipcMain.handle('gta:enable', async () => {
    const settings = loadSettings()
    const gamePath = resolveGtaPath(settings.gtaGamePath)
    if (!gamePath) {
      return { ok: false, status: getGtaModStatus(null), error: 'invalid_game' }
    }
    if (!settings.gtaGamePath) saveSettings({ gtaGamePath: gamePath })
    return enableGtaIntegration(gamePath)
  })
  ipcMain.handle('gta:disable', () => {
    const settings = loadSettings()
    const gamePath = resolveGtaPath(settings.gtaGamePath)
    if (!gamePath) {
      return { ok: false, status: getGtaModStatus(null), error: 'invalid_game' }
    }
    return disableGtaIntegration(gamePath)
  })
  ipcMain.handle('gta:uninstall', (_e, leaveOnlineSafe?: boolean) => {
    const settings = loadSettings()
    const gamePath = resolveGtaPath(settings.gtaGamePath)
    if (!gamePath) {
      return { ok: false, status: getGtaModStatus(null), error: 'invalid_game' }
    }
    return uninstallGtaIntegration(gamePath, {
      leaveOnlineSafe: leaveOnlineSafe !== false,
    })
  })
  ipcMain.handle('gta:openHookHelp', () => {
    openGtaHookHelp()
  })
  ipcMain.handle('gta:launchStory', () => {
    const settings = loadSettings()
    const gamePath = resolveGtaPath(settings.gtaGamePath)
    if (!gamePath) {
      return { ok: false, error: 'invalid_game' }
    }
    return launchGtaStoryNoBattlEye(gamePath)
  })
  ipcMain.handle('gta:hotReload', async () => {
    const settings = loadSettings()
    const gamePath = resolveGtaPath(settings.gtaGamePath)
    if (!gamePath) {
      return { ok: false, status: getGtaModStatus(null), error: 'invalid_game' }
    }
    return hotReloadGtaPlugin(gamePath)
  })
  ipcMain.handle('gta:getLinkStatus', () => getGtaLinkStatus())
  ipcMain.handle('gta:startFfbHost', () => {
    setFfbHostEnabled(true)
    return startFfbHost()
  })
  ipcMain.handle('gta:openFfbLogs', async () => {
    const file = getFfbEffectLogFile() ?? ensureFfbEffectLogSession()
    const dir = file ? path.dirname(file) : path.join(app.getPath('userData'), 'logs')
    fs.mkdirSync(dir, { recursive: true })
    await shell.openPath(dir)
    return { ok: true, path: file, dir }
  })
}

function applyNativeTheme(theme: AppSettings['theme']) {
  if (theme === 'system') {
    nativeTheme.themeSource = 'system'
  } else {
    nativeTheme.themeSource = theme
  }
}

app.setName(APP_DISPLAY_NAME)

app.whenReady().then(() => {
  // Drop the default File / Edit / View menu bar (CustomSSH-style chrome).
  Menu.setApplicationMenu(null)

  const settings = loadSettings()
  applyNativeTheme(settings.theme)
  registerIpc()
  initMozaBridge()
  initGtaTelemetryBridge()
  setMozaPedalAxisMap(settings.pedalAxisMap)
  setMozaPedalFloors(settings.pedalFloors)
  syncMozaFromSelectedProfile()
  // Remember detected Enhanced path so Settings works offline of Steam defaults
  if (!settings.gtaGamePath) {
    const detected = resolveGtaPath(null)
    if (detected) saveSettings({ gtaGamePath: detected })
  }
  createWindow()
  initAutoUpdater({ autoCheck: settings.autoUpdates })

  nativeTheme.on('updated', () => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('theme:systemChanged', {
          shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
        })
      }
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  disposeGtaTelemetryBridge()
  disposeMozaBridge()
})

app.on('window-all-closed', () => {
  disposeGtaTelemetryBridge()
  disposeMozaBridge()
  if (process.platform !== 'darwin') app.quit()
})
