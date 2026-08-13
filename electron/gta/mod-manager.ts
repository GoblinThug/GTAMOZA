/**
 * GTA V Enhanced integration manager.
 *
 * Goals:
 * - One-click enable for Story Mode (Script Hook stack + GTAMOZA plugin folder)
 * - One-click disable for GTA Online (park ASI loader / hooks, leave game pristine)
 * - Never delete the user's game; only move/copy tracked files with a manifest
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFile, execFileSync, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { app, dialog, BrowserWindow, shell } from 'electron'
import { resolvePluginDll } from './telemetry-bridge'
import {
  ensureGameHooksInstalled,
  ensureShvdnReloadKeyF11,
  hooksMissingInGame,
} from './hook-installer'
import type { GtaModState, GtaModStatus, GtaStoreKind } from '../../shared/types'

const execFileAsync = promisify(execFile)

export type { GtaModState, GtaModStatus, GtaStoreKind } from '../../shared/types'

export type GtaModResult = {
  ok: boolean
  status: GtaModStatus
  error?: string
}

export type GtaHotReloadResult = GtaModResult & {
  /** True if F11 was sent to the GTA window (SHVDN ReloadKeyBinding). */
  keySent?: boolean
}

type Manifest = {
  version: 1
  gamePath: string
  mode: 'enabled' | 'parked'
  /** Relative paths we moved into parked/ (for Online). */
  parkedFiles: string[]
  /** Files/dirs we created (safe to delete on uninstall). */
  createdByUs: string[]
  updatedAt: string
}

/** Files that must leave the game root for Online safety / full uninstall. */
const HOOK_REL_PATHS = [
  /** Legacy ASI loader (old GTA5.exe) — must not linger on Enhanced */
  'dinput8.dll',
  /** Enhanced ASI loader — required for GTA5_Enhanced.exe */
  'xinput1_4.dll',
  'args.txt',
  'ScriptHookV.dll',
  'ScriptHookVDotNet.asi',
  'ScriptHookVDotNet2.dll',
  'ScriptHookVDotNet3.dll',
  'ScriptHookVDotNet.ini',
  'MinHook.x64.dll',
] as const

/**
 * Extra leftovers from Script Hook / old loaders / trainers.
 * Deleted on uninstall; removed (not parked) on disable so the game root stays clean.
 */
const EXTRA_CLEANUP_REL_PATHS = [
  'NativeTrainer.asi',
  'dsound.dll',
  'asiloader.log',
  'ScriptHookV.log',
  'ScriptHookVDotNet.log',
] as const

/** Everything we remove from the game root on uninstall. */
const UNINSTALL_ROOT_REL_PATHS = [
  ...HOOK_REL_PATHS,
  ...EXTRA_CLEANUP_REL_PATHS,
] as const

const OUR_PLUGIN_DIR = path.join('scripts', 'GTAMOZA')
const OUR_PLUGIN_DLL = path.join('scripts', 'GTAMOZA.dll')
const MANAGE_DIR = 'GTAMOZA'
const MANIFEST_NAME = 'manifest.json'
const PARKED_DIR = 'parked'

const DEFAULT_STEAM_ENHANCED =
  'D:\\Steam\\steamapps\\common\\Grand Theft Auto V Enhanced'

function exists(p: string) {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

function isValidGameDir(gamePath: string): boolean {
  if (!gamePath || !exists(gamePath)) return false
  return (
    exists(path.join(gamePath, 'GTA5_Enhanced.exe')) ||
    exists(path.join(gamePath, 'GTA5.exe')) ||
    exists(path.join(gamePath, 'PlayGTAV.exe'))
  )
}

function manageRoot(gamePath: string) {
  return path.join(gamePath, MANAGE_DIR)
}

function manifestPath(gamePath: string) {
  return path.join(manageRoot(gamePath), MANIFEST_NAME)
}

function parkedRoot(gamePath: string) {
  return path.join(manageRoot(gamePath), PARKED_DIR)
}

function readManifest(gamePath: string): Manifest | null {
  const file = manifestPath(gamePath)
  if (!exists(file)) return null
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Manifest
    if (raw?.version !== 1) return null
    return raw
  } catch {
    return null
  }
}

function writeManifest(gamePath: string, manifest: Manifest) {
  const dir = manageRoot(gamePath)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(manifestPath(gamePath), JSON.stringify(manifest, null, 2), 'utf8')
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true })
}

function moveFile(src: string, dest: string) {
  ensureDir(path.dirname(dest))
  if (exists(dest)) fs.rmSync(dest, { force: true, recursive: true })
  fs.renameSync(src, dest)
}

function rmRel(gamePath: string, rel: string) {
  const full = path.join(gamePath, rel)
  if (exists(full)) fs.rmSync(full, { force: true, recursive: true })
}

/** Best-effort delete — returns relative path if it still exists after the attempt. */
function tryRmRel(gamePath: string, rel: string): string | null {
  const full = path.join(gamePath, rel)
  if (!exists(full)) return null
  try {
    fs.rmSync(full, { force: true, recursive: true })
  } catch {
    /* locked by GTA / antivirus */
  }
  return exists(full) ? rel : null
}

function listPresentHooks(gamePath: string): string[] {
  return HOOK_REL_PATHS.filter((rel) => exists(path.join(gamePath, rel)))
}

/** Mod / hook files still present in the game root (including legacy loader + logs). */
export function listLeftoverModFiles(gamePath: string): string[] {
  const left: string[] = []
  for (const rel of UNINSTALL_ROOT_REL_PATHS) {
    if (exists(path.join(gamePath, rel))) left.push(rel)
  }
  if (exists(path.join(gamePath, OUR_PLUGIN_DLL))) left.push(OUR_PLUGIN_DLL)
  if (exists(path.join(gamePath, OUR_PLUGIN_DIR))) left.push(OUR_PLUGIN_DIR)
  if (exists(manageRoot(gamePath))) left.push(MANAGE_DIR)
  return left
}

function listParkedHooks(gamePath: string): string[] {
  const root = parkedRoot(gamePath)
  if (!exists(root)) return []
  return HOOK_REL_PATHS.filter((rel) => exists(path.join(root, rel)))
}

function installOurPlugin(gamePath: string): string[] {
  const created: string[] = []
  ensureDir(path.join(gamePath, 'scripts'))

  const dllSrc = resolvePluginDll()
  if (!dllSrc) {
    throw new Error('plugin_missing')
  }
  const dllDest = path.join(gamePath, OUR_PLUGIN_DLL)
  fs.copyFileSync(dllSrc, dllDest)
  created.push(OUR_PLUGIN_DLL)

  const dir = path.join(gamePath, OUR_PLUGIN_DIR)
  ensureDir(dir)
  created.push(OUR_PLUGIN_DIR)

  const marker = path.join(dir, 'installed.json')
  fs.writeFileSync(
    marker,
    JSON.stringify(
      {
        app: 'GTAMOZA',
        installedAt: new Date().toISOString(),
        dll: OUR_PLUGIN_DLL,
        telemetryUdp: 29755,
      },
      null,
      2,
    ),
    'utf8',
  )
  created.push(path.join(OUR_PLUGIN_DIR, 'installed.json'))

  const readme = path.join(dir, 'README.txt')
  fs.writeFileSync(
    readme,
    [
      'GTAMOZA — GTA V Enhanced Story Mode bridge',
      '',
      'scripts/GTAMOZA.dll is loaded by Script Hook V .NET.',
      'Managed by the GTAMOZA app — use Settings to enable/disable for Online.',
      '',
      'Hot-reload without restarting GTA:',
      '  1) Update the DLL from the GTAMOZA app (Hot-reload plugin), or',
      '  2) Press F11 in-game (ScriptHookVDotNet ReloadKeyBinding).',
      '',
    ].join('\n'),
    'utf8',
  )
  created.push(path.join(OUR_PLUGIN_DIR, 'README.txt'))
  return created
}

function buildStatus(gamePath: string | null): GtaModStatus {
  if (!gamePath || !isValidGameDir(gamePath)) {
    return {
      gamePath,
      validGame: false,
      state: 'missing-game',
      onlineSafe: true,
      hasScriptHook: false,
      hasDotNet: false,
      hasAsiLoader: false,
      hasOurPlugin: false,
      hooksParked: false,
      store: 'unknown',
      message: 'Pick the Grand Theft Auto V Enhanced folder (GTA5_Enhanced.exe).',
      canEnable: false,
      canDisable: false,
      canUninstall: false,
    }
  }

  const manifest = readManifest(gamePath)
  const hooksInRoot = listPresentHooks(gamePath)
  const hooksParked = listParkedHooks(gamePath)
  // Enhanced needs xinput1_4 ASI loader; dinput8 alone is not enough.
  const hasAsiLoader =
    hooksInRoot.includes('xinput1_4.dll') || hooksInRoot.includes('dinput8.dll')
  const hasEnhancedLoader = hooksInRoot.includes('xinput1_4.dll')
  const hasScriptHook = hooksInRoot.includes('ScriptHookV.dll')
  const hasDotNet = hooksInRoot.includes('ScriptHookVDotNet.asi')
  const hasOurPluginLive = exists(path.join(gamePath, OUR_PLUGIN_DLL))
  const hasOurPlugin =
    hasOurPluginLive ||
    exists(path.join(parkedRoot(gamePath), OUR_PLUGIN_DLL)) ||
    exists(path.join(gamePath, OUR_PLUGIN_DIR, 'installed.json'))
  const parkedMode = manifest?.mode === 'parked' || (hooksParked.length > 0 && hooksInRoot.length === 0)
  const enabled =
    hasEnhancedLoader &&
    hasScriptHook &&
    hasOurPluginLive &&
    !parkedMode

  let state: GtaModState = 'ready'
  if (parkedMode) state = 'parked'
  else if (enabled) state = 'enabled'
  else if (hooksInRoot.length > 0 || hasOurPlugin) state = 'ready'

  const onlineSafe =
    !hooksInRoot.includes('xinput1_4.dll') &&
    !hooksInRoot.includes('dinput8.dll') &&
    !exists(path.join(gamePath, 'dsound.dll'))

  let message = 'Hooks detected. Enable GTAMOZA for Story Mode, or park for Online.'
  if (state === 'enabled') {
    message = 'Story Mode integration is ON. Disable before GTA Online.'
  } else if (state === 'parked') {
    message = 'Integration parked — safe for GTA Online. Enable again for Story Mode FFB.'
  } else if (hooksInRoot.length === 0 && hooksParked.length === 0) {
    message =
      'Script Hook not found. Install Script Hook V + SHVDN Enhanced into the game folder, then Enable.'
  } else if (!hasEnhancedLoader && (hasAsiLoader || hasScriptHook)) {
    message =
      'Enhanced ASI loader (xinput1_4.dll) missing — Enable Story Mode again to install it. dinput8 alone will not load mods on Enhanced.'
  } else if (!hasOurPlugin && hooksInRoot.length > 0) {
    message = 'Script Hook is present. Press Enable to register GTAMOZA management.'
  }

  const hasAnyHooks = hooksInRoot.length > 0 || hooksParked.length > 0

  return {
    gamePath,
    validGame: true,
    state,
    onlineSafe,
    hasScriptHook: hasScriptHook || hooksParked.includes('ScriptHookV.dll'),
    hasDotNet: hasDotNet || hooksParked.includes('ScriptHookVDotNet.asi'),
    hasAsiLoader:
      hasEnhancedLoader ||
      hooksParked.includes('xinput1_4.dll') ||
      hooksParked.includes('dinput8.dll'),
    hasOurPlugin: hasOurPlugin || exists(path.join(parkedRoot(gamePath), OUR_PLUGIN_DIR)),
    hooksParked: hooksParked.length > 0,
    store: detectGtaStore(gamePath),
    message,
    // Clickable whenever the game folder is valid; enable() returns hooks_missing if needed.
    canEnable: state !== 'enabled',
    canDisable: state === 'enabled' || (hasAsiLoader && hasOurPlugin),
    canUninstall:
      Boolean(manifest) ||
      hasOurPlugin ||
      hasAnyHooks ||
      listLeftoverModFiles(gamePath).length > 0,
  }
}

function steamLibraryRoots(): string[] {
  const roots = new Set<string>()
  const vdfs = [
    'C:\\Program Files (x86)\\Steam\\steamapps\\libraryfolders.vdf',
    'D:\\Steam\\steamapps\\libraryfolders.vdf',
    'E:\\SteamLibrary\\steamapps\\libraryfolders.vdf',
  ]
  for (const vdf of vdfs) {
    if (!exists(vdf)) continue
    try {
      const text = fs.readFileSync(vdf, 'utf8')
      for (const m of text.matchAll(/"path"\s+"([^"]+)"/g)) {
        const raw = m[1]!.replace(/\\\\/g, '\\')
        if (raw) roots.add(raw)
      }
    } catch {
      /* ignore */
    }
  }
  roots.add('D:\\Steam')
  roots.add('E:\\SteamLibrary')
  roots.add('C:\\Program Files (x86)\\Steam')
  return [...roots]
}

export function detectDefaultGtaPath(): string | null {
  const candidates = [
    DEFAULT_STEAM_ENHANCED,
    'E:\\SteamLibrary\\steamapps\\common\\Grand Theft Auto V Enhanced',
    'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Grand Theft Auto V Enhanced',
    'C:\\Program Files\\Rockstar Games\\Grand Theft Auto V Enhanced',
    ...steamLibraryRoots().map((root) =>
      path.join(root, 'steamapps', 'common', 'Grand Theft Auto V Enhanced'),
    ),
  ]
  for (const c of candidates) {
    if (isValidGameDir(c)) return c
  }
  return null
}

/** True if GTA V Enhanced / legacy process is running (not the same as plugin UDP). */
export function isGtaProcessRunning(): boolean {
  try {
    const out = execFileSync(
      'tasklist',
      ['/FI', 'IMAGENAME eq GTA5_Enhanced.exe', '/NH'],
      { encoding: 'utf8', windowsHide: true },
    )
    if (/GTA5_Enhanced\.exe/i.test(out)) return true
    const legacy = execFileSync(
      'tasklist',
      ['/FI', 'IMAGENAME eq GTA5.exe', '/NH'],
      { encoding: 'utf8', windowsHide: true },
    )
    return /GTA5\.exe/i.test(legacy)
  } catch {
    return false
  }
}

export function getGtaModStatus(gamePath: string | null | undefined): GtaModStatus {
  const resolved =
    (gamePath && gamePath.trim()) || detectDefaultGtaPath() || null
  return buildStatus(resolved)
}

export async function pickGtaGameFolder(
  parent?: BrowserWindow | null,
): Promise<GtaModResult> {
  const win = parent ?? BrowserWindow.getFocusedWindow()
  const opts = {
    title: 'Select Grand Theft Auto V Enhanced',
    properties: ['openDirectory' as const],
  }
  const result = win
    ? await dialog.showOpenDialog(win, opts)
    : await dialog.showOpenDialog(opts)
  if (result.canceled || !result.filePaths[0]) {
    return { ok: false, status: getGtaModStatus(null), error: 'cancelled' }
  }
  const chosen = result.filePaths[0]
  if (!isValidGameDir(chosen)) {
    return {
      ok: false,
      status: buildStatus(chosen),
      error: 'invalid_game',
    }
  }
  return { ok: true, status: buildStatus(chosen) }
}

export async function enableGtaIntegration(gamePath: string): Promise<GtaModResult> {
  if (!isValidGameDir(gamePath)) {
    return { ok: false, status: buildStatus(gamePath), error: 'invalid_game' }
  }

  try {
    // 1) Restore parked hooks first
    const parked = listParkedHooks(gamePath)
    for (const rel of parked) {
      const src = path.join(parkedRoot(gamePath), rel)
      const dest = path.join(gamePath, rel)
      if (exists(src)) moveFile(src, dest)
    }
    // Restore parked plugin dll + folder
    const parkedDll = path.join(parkedRoot(gamePath), OUR_PLUGIN_DLL)
    if (exists(parkedDll)) {
      moveFile(parkedDll, path.join(gamePath, OUR_PLUGIN_DLL))
    }
    const parkedPlugin = path.join(parkedRoot(gamePath), OUR_PLUGIN_DIR)
    if (exists(parkedPlugin)) {
      const dest = path.join(gamePath, OUR_PLUGIN_DIR)
      if (exists(dest)) fs.rmSync(dest, { recursive: true, force: true })
      ensureDir(path.dirname(dest))
      moveFile(parkedPlugin, dest)
    }

    // 2) Auto-download Script Hook V + SHVDN Enhanced if still missing
    let autoInstalledHooks: string[] = []
    if (hooksMissingInGame(gamePath)) {
      const hooks = await ensureGameHooksInstalled(gamePath)
      autoInstalledHooks = hooks.installed
      if (!hooks.ok) {
        return {
          ok: false,
          status: buildStatus(gamePath),
          error: hooks.error ?? 'hooks_missing',
        }
      }
    }

    const present = listPresentHooks(gamePath)
    if (!present.includes('xinput1_4.dll') || !present.includes('ScriptHookV.dll')) {
      return {
        ok: false,
        status: buildStatus(gamePath),
        error: 'hooks_missing',
      }
    }

    ensureShvdnReloadKeyF11(gamePath)

    const created = installOurPlugin(gamePath)
    const prev = readManifest(gamePath)
    writeManifest(gamePath, {
      version: 1,
      gamePath,
      mode: 'enabled',
      parkedFiles: [],
      createdByUs: Array.from(
        new Set([...(prev?.createdByUs ?? []), ...created, ...autoInstalledHooks]),
      ),
      updatedAt: new Date().toISOString(),
    })

    return { ok: true, status: buildStatus(gamePath) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'enable_failed'
    return {
      ok: false,
      status: buildStatus(gamePath),
      error: msg === 'plugin_missing' ? 'plugin_missing' : msg,
    }
  }
}

/** Park ASI loader + hooks so GTA Online is safe. */
export function disableGtaIntegration(gamePath: string): GtaModResult {
  if (!isValidGameDir(gamePath)) {
    return { ok: false, status: buildStatus(gamePath), error: 'invalid_game' }
  }

  try {
    const parkedFiles: string[] = []
    const parkRoot = parkedRoot(gamePath)
    ensureDir(parkRoot)

    // Park both ASI loaders (legacy dinput8 + Enhanced xinput1_4) and the hook stack.
    for (const rel of HOOK_REL_PATHS) {
      const src = path.join(gamePath, rel)
      if (!exists(src)) continue
      moveFile(src, path.join(parkRoot, rel))
      parkedFiles.push(rel)
    }

    // Park our plugin (keep for later enable)
    const dllSrc = path.join(gamePath, OUR_PLUGIN_DLL)
    if (exists(dllSrc)) {
      moveFile(dllSrc, path.join(parkRoot, OUR_PLUGIN_DLL))
      parkedFiles.push(OUR_PLUGIN_DLL)
    }
    const pluginSrc = path.join(gamePath, OUR_PLUGIN_DIR)
    if (exists(pluginSrc)) {
      moveFile(pluginSrc, path.join(parkRoot, OUR_PLUGIN_DIR))
      parkedFiles.push(OUR_PLUGIN_DIR)
    }

    // Trainers / alternate loaders → park; runtime logs → delete (not needed to restore)
    for (const rel of EXTRA_CLEANUP_REL_PATHS) {
      const src = path.join(gamePath, rel)
      if (!exists(src)) continue
      if (rel.endsWith('.log')) {
        fs.rmSync(src, { force: true })
      } else {
        moveFile(src, path.join(parkRoot, rel))
        parkedFiles.push(rel)
      }
    }

    const prev = readManifest(gamePath)
    writeManifest(gamePath, {
      version: 1,
      gamePath,
      mode: 'parked',
      parkedFiles,
      createdByUs: prev?.createdByUs ?? [OUR_PLUGIN_DIR],
      updatedAt: new Date().toISOString(),
    })

    return { ok: true, status: buildStatus(gamePath) }
  } catch (err) {
    return {
      ok: false,
      status: buildStatus(gamePath),
      error: err instanceof Error ? err.message : 'disable_failed',
    }
  }
}

/**
 * Full cleanup: remove GTAMOZA plugin + Script Hook / SHVDN / both ASI loaders
 * (legacy dinput8 + Enhanced xinput1_4) + logs from the game root and from
 * GTAMOZA/parked. Leaves the game folder clean for vanilla Story Mode / Online.
 */
export function uninstallGtaIntegration(
  gamePath: string,
  _opts?: { leaveOnlineSafe?: boolean },
): GtaModResult {
  if (!isValidGameDir(gamePath)) {
    return { ok: false, status: buildStatus(gamePath), error: 'invalid_game' }
  }

  const blocked: string[] = []

  // Plugin (live)
  for (const rel of [OUR_PLUGIN_DLL, OUR_PLUGIN_DIR]) {
    const left = tryRmRel(gamePath, rel)
    if (left) blocked.push(left)
  }

  // Script Hook stack + both ASI loaders + trainers + logs
  for (const rel of UNINSTALL_ROOT_REL_PATHS) {
    const left = tryRmRel(gamePath, rel)
    if (left) blocked.push(left)
  }

  // Wipe entire manage folder (parked hooks incl. old dinput8, manifest, leftovers)
  const mgr = manageRoot(gamePath)
  if (exists(mgr)) {
    try {
      fs.rmSync(mgr, { recursive: true, force: true })
    } catch {
      if (exists(mgr)) blocked.push(MANAGE_DIR)
    }
  }

  // scripts/ — remove if empty or only leftover GTAMOZA crumbs
  const scripts = path.join(gamePath, 'scripts')
  if (exists(scripts)) {
    tryRmRel(gamePath, OUR_PLUGIN_DLL)
    tryRmRel(gamePath, OUR_PLUGIN_DIR)
    try {
      const remaining = fs.readdirSync(scripts)
      if (remaining.length === 0) {
        fs.rmSync(scripts, { recursive: true, force: true })
      }
    } catch {
      /* ignore */
    }
  }

  const leftovers = listLeftoverModFiles(gamePath)
  if (leftovers.length > 0 || blocked.length > 0) {
    const uniq = Array.from(new Set([...blocked, ...leftovers]))
    return {
      ok: false,
      status: buildStatus(gamePath),
      error: `uninstall_locked:${uniq.join(',')}`,
    }
  }

  return { ok: true, status: buildStatus(gamePath) }
}

export function openGtaHookHelp(): void {
  void shell.openExternal('https://www.dev-c.com/gtav/scripthookv/')
}

/** Steam AppID for Grand Theft Auto V Enhanced. */
const GTA_ENHANCED_STEAM_APPID = '3240220'
/** Epic catalog id for GTA V Enhanced (legacy = 9d2d0eb64d5c44529cece33fe2a46482). */
const GTA_ENHANCED_EPIC_APP = '8769e24080ea413b8ebca3f1b8c50951'

export function detectGtaStore(gamePath: string): GtaStoreKind {
  if (!gamePath) return 'unknown'
  const norm = gamePath.replace(/\//g, '\\').toLowerCase()
  if (
    norm.includes('\\steamapps\\') ||
    exists(path.join(gamePath, 'steam_appid.txt'))
  ) {
    return 'steam'
  }
  if (
    exists(path.join(gamePath, '.egstore')) ||
    norm.includes('\\epic games\\') ||
    exists(path.join(gamePath, 'EOSSDK-Win64-Shipping.dll'))
  ) {
    return 'epic'
  }
  if (norm.includes('\\rockstar games\\')) return 'rockstar'
  try {
    const out = execFileSync(
      'reg',
      [
        'query',
        'HKLM\\SOFTWARE\\WOW6432Node\\Rockstar Games\\Grand Theft Auto V Enhanced',
        '/v',
        'InstallFolder',
      ],
      { encoding: 'utf8', windowsHide: true },
    )
    const folder = out.match(/InstallFolder\s+REG_SZ\s+(.+)/i)?.[1]?.trim()
    if (folder && norm.startsWith(path.normalize(folder).toLowerCase())) {
      return 'rockstar'
    }
  } catch {
    /* ignore */
  }
  return 'unknown'
}

function resolveSteamExe(): string | null {
  const candidates = [
    'D:\\Steam\\steam.exe',
    'E:\\Steam\\steam.exe',
    'C:\\Program Files (x86)\\Steam\\steam.exe',
    'C:\\Program Files\\Steam\\steam.exe',
  ]
  for (const c of candidates) {
    if (exists(c)) return c
  }
  for (const root of steamLibraryRoots()) {
    const p = path.join(root, 'steam.exe')
    if (exists(p)) return p
  }
  return null
}

function resolveRockstarLauncherExe(): string | null {
  const candidates = [
    'C:\\Program Files\\Rockstar Games\\Launcher\\Launcher.exe',
    'C:\\Program Files (x86)\\Rockstar Games\\Launcher\\Launcher.exe',
  ]
  for (const c of candidates) {
    if (exists(c)) return c
  }
  try {
    const out = execFileSync(
      'reg',
      [
        'query',
        'HKLM\\SOFTWARE\\WOW6432Node\\Rockstar Games\\Launcher',
        '/v',
        'InstallFolder',
      ],
      { encoding: 'utf8', windowsHide: true },
    )
    const m = out.match(/InstallFolder\s+REG_SZ\s+(.+)/i)
    if (m?.[1]) {
      const p = path.join(m[1].trim(), 'Launcher.exe')
      if (exists(p)) return p
    }
  } catch {
    /* ignore */
  }
  return null
}

function epicAppIdForInstall(gamePath: string): string {
  const installed = 'C:\\ProgramData\\Epic\\UnrealEngineLauncher\\LauncherInstalled.dat'
  if (!exists(installed)) return GTA_ENHANCED_EPIC_APP
  try {
    const data = JSON.parse(fs.readFileSync(installed, 'utf8')) as {
      InstallationList?: Array<{ InstallLocation?: string; AppName?: string }>
    }
    const norm = path.normalize(gamePath).toLowerCase()
    for (const row of data.InstallationList ?? []) {
      const loc = path.normalize(row.InstallLocation ?? '').toLowerCase()
      if (loc && (norm.startsWith(loc) || loc.startsWith(norm)) && row.AppName) {
        return row.AppName
      }
    }
  } catch {
    /* ignore */
  }
  return GTA_ENHANCED_EPIC_APP
}

function spawnDetached(exe: string, args: string[]): void {
  const child = spawn(exe, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  child.unref()
}

export type GtaLaunchResult = {
  ok: boolean
  error?: string
  exe?: string
  store: GtaStoreKind
  /** Extra note for Rockstar/Epic when -nobattleye cannot be forced from here. */
  note?: 'disable_battleye_in_launcher' | 'set_epic_launch_options'
}

/**
 * Launch Enhanced Story Mode across Steam / Epic / Rockstar.
 * BattlEye must be off for Script Hook — Steam gets -nobattleye; Epic/R* need launcher toggle once.
 */
export function launchGtaStoryNoBattlEye(gamePath: string): GtaLaunchResult {
  if (!isValidGameDir(gamePath)) {
    return { ok: false, error: 'invalid_game', store: 'unknown' }
  }
  if (isGtaProcessRunning()) {
    return { ok: false, error: 'already_running', store: detectGtaStore(gamePath) }
  }

  const store = detectGtaStore(gamePath)

  try {
    if (store === 'steam' || (store === 'unknown' && resolveSteamExe())) {
      const steam = resolveSteamExe()
      if (steam) {
        spawnDetached(steam, [
          '-applaunch',
          GTA_ENHANCED_STEAM_APPID,
          '-nobattleye',
        ])
        return {
          ok: true,
          store: 'steam',
          exe: `${steam} -applaunch ${GTA_ENHANCED_STEAM_APPID} -nobattleye`,
        }
      }
      void shell.openExternal(
        `steam://run/${GTA_ENHANCED_STEAM_APPID}//-nobattleye`,
      )
      return {
        ok: true,
        store: 'steam',
        exe: `steam://run/${GTA_ENHANCED_STEAM_APPID}//-nobattleye`,
      }
    }

    if (store === 'epic') {
      const appId = epicAppIdForInstall(gamePath)
      // Epic URI cannot reliably append -nobattleye; user should set Launch Options once.
      // Prefer path-based URI so non-default installs still launch.
      const pathUri = `com.epicgames.launcher://apps/${encodeURIComponent(gamePath)}?action=launch&silent=true`
      void shell.openExternal(pathUri).catch(() => {
        void shell.openExternal(
          `com.epicgames.launcher://apps/${appId}?action=launch&silent=true`,
        )
      })
      return {
        ok: true,
        store: 'epic',
        exe: pathUri,
        note: 'set_epic_launch_options',
      }
    }

    // Rockstar (or unknown without Steam): PlayGTAV.exe boots through R* Launcher
    // (direct GTA5_Enhanced.exe → ERR_NO_LAUNCHER). BattlEye must be off in R* settings.
    const play =
      [
        path.join(gamePath, 'PlayGTAV.exe'),
        path.join(gamePath, 'GTA5_Enhanced.exe'),
      ].find((p) => exists(p)) ?? null
    const rstar = resolveRockstarLauncherExe()
    if (play && path.basename(play).toLowerCase() === 'playgtav.exe') {
      spawnDetached(play, [])
      return {
        ok: true,
        store: store === 'unknown' ? 'rockstar' : store,
        exe: play,
        note: 'disable_battleye_in_launcher',
      }
    }
    if (rstar) {
      spawnDetached(rstar, [])
      return {
        ok: true,
        store: 'rockstar',
        exe: rstar,
        note: 'disable_battleye_in_launcher',
      }
    }
    if (play) {
      // Last resort — may show ERR_NO_LAUNCHER if R* is required.
      spawnDetached(play, [])
      return {
        ok: true,
        store,
        exe: play,
        note: 'disable_battleye_in_launcher',
      }
    }

    return { ok: false, error: 'exe_missing', store }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'launch_failed',
      store,
    }
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/**
 * ScriptHookVDotNet ReloadKeyBinding=F11 — reloads scripts without restarting GTA.
 */
async function trySendShvdnReloadKey(): Promise<boolean> {
  const ps = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class GtamozaReload {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@
$p = Get-Process -Name 'GTA5_Enhanced','GTA5','PlayGTAV' -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } |
  Select-Object -First 1
if (-not $p) { Write-Output 'NOWINDOW'; exit 2 }
[void][GtamozaReload]::ShowWindow($p.MainWindowHandle, 9)
[void][GtamozaReload]::SetForegroundWindow($p.MainWindowHandle)
Start-Sleep -Milliseconds 120
# VK_F11 = 0x7A — matches ScriptHookVDotNet.ini ReloadKeyBinding=F11
[GtamozaReload]::keybd_event(0x7A, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 40
[GtamozaReload]::keybd_event(0x7A, 0, 2, [UIntPtr]::Zero)
Write-Output 'OK'
`.trim()

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', ps],
      { windowsHide: true, timeout: 8000 },
    )
    return String(stdout).includes('OK')
  } catch {
    return false
  }
}

function copyPluginDll(gamePath: string) {
  const dllSrc = resolvePluginDll()
  if (!dllSrc) throw new Error('plugin_missing')
  ensureDir(path.join(gamePath, 'scripts'))
  const dllDest = path.join(gamePath, OUR_PLUGIN_DLL)
  fs.copyFileSync(dllSrc, dllDest)
}

/**
 * Copy the built GTAMOZA.dll into the game and hot-reload SHVDN scripts
 * (F11) so you do not need to restart GTA.
 */
/** Debug = Home/PgUp cheats; Release = stripped (used by npm run build:gta-mod / dist). */
async function rebuildPluginDll(): Promise<void> {
  const csproj = path.join(app.getAppPath(), 'gta-mod', 'GTAMOZA', 'GTAMOZA.csproj')
  const alt = path.join(process.cwd(), 'gta-mod', 'GTAMOZA', 'GTAMOZA.csproj')
  const project = fs.existsSync(csproj) ? csproj : alt
  if (!fs.existsSync(project)) throw new Error('plugin_project_missing')
  const config = app.isPackaged ? 'Release' : 'Debug'
  await execFileAsync(
    'dotnet',
    ['build', project, '-c', config, '--nologo', '-v', 'q'],
    { windowsHide: true, timeout: 120_000 },
  )
}

export async function hotReloadGtaPlugin(gamePath: string): Promise<GtaHotReloadResult> {
  if (!isValidGameDir(gamePath)) {
    return { ok: false, status: buildStatus(gamePath), error: 'invalid_game' }
  }

  const status = buildStatus(gamePath)
  if (status.state === 'parked' || !status.hasAsiLoader) {
    return {
      ok: false,
      status,
      error: 'hooks_missing',
    }
  }

  try {
    ensureShvdnReloadKeyF11(gamePath)

    // Hard reboot: unload → rebuild → copy → reload → second F11
    await trySendShvdnReloadKey()
    await sleep(700)

    try {
      await rebuildPluginDll()
    } catch (err) {
      console.warn('[gta] plugin rebuild skipped/failed', err)
    }

    let copied = false
    for (let attempt = 0; attempt < 3 && !copied; attempt++) {
      try {
        copyPluginDll(gamePath)
        copied = true
      } catch {
        await trySendShvdnReloadKey()
        await sleep(900)
      }
    }

    if (!copied) {
      return { ok: false, status: buildStatus(gamePath), error: 'copy_failed' }
    }

    await sleep(200)
    let keySent = await trySendShvdnReloadKey()
    await sleep(500)
    keySent = (await trySendShvdnReloadKey()) || keySent
    return {
      ok: true,
      status: buildStatus(gamePath),
      keySent,
    }
  } catch (err) {
    return {
      ok: false,
      status: buildStatus(gamePath),
      error: err instanceof Error ? err.message : 'hot_reload_failed',
    }
  }
}

/** Resolve path used by settings; fall back to detection. */
export function resolveGtaPath(saved: string | null | undefined): string | null {
  if (saved && isValidGameDir(saved)) return saved
  return detectDefaultGtaPath()
}

export function getAppUserDataHint() {
  return app.getPath('userData')
}
