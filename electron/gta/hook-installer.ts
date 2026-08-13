/**
 * Download + install Script Hook V and ScriptHookVDotNet Enhanced
 * into a GTA V Enhanced game folder when they are missing.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { app } from 'electron'

const execFileAsync = promisify(execFile)

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
}

/**
 * Script Hook V package (Alexander Blade).
 * Enhanced loads ASI via xinput1_4.dll (ENHANCED ASI LOADER) — dinput8 alone is
 * the legacy loader and will sit loaded without ever scanning *.asi.
 */
const SCRIPT_HOOK_FILES = [
  'dinput8.dll',
  'xinput1_4.dll',
  'ScriptHookV.dll',
  'args.txt',
] as const

/** SHVDN Enhanced runtime files. */
const SHVDN_FILES = [
  'ScriptHookVDotNet.asi',
  'ScriptHookVDotNet2.dll',
  'ScriptHookVDotNet3.dll',
  'ScriptHookVDotNet.ini',
  'MinHook.x64.dll',
] as const

export type HookInstallResult = {
  ok: boolean
  /** Relative filenames written into the game folder. */
  installed: string[]
  error?: string
}

function exists(p: string) {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

function cacheRoot() {
  return path.join(app.getPath('userData'), 'hooks-cache')
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true })
}

async function downloadFile(url: string, dest: string, extraHeaders?: Record<string, string>) {
  ensureDir(path.dirname(dest))
  const res = await fetch(url, {
    headers: { ...BROWSER_HEADERS, ...extraHeaders },
    redirect: 'follow',
  })
  if (!res.ok) {
    throw new Error(`download_failed_${res.status}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 1024) {
    throw new Error('download_too_small')
  }
  fs.writeFileSync(dest, buf)
}

async function extractZip(zipPath: string, destDir: string) {
  ensureDir(destDir)
  // Windows built-in Expand-Archive — no extra npm dependency.
  await execFileAsync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
    ],
    { windowsHide: true },
  )
}

function walkFiles(root: string): string[] {
  const out: string[] = []
  if (!exists(root)) return out
  const stack = [root]
  while (stack.length) {
    const dir = stack.pop()!
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) stack.push(full)
      else out.push(full)
    }
  }
  return out
}

function findNamedFile(root: string, fileName: string): string | null {
  const lower = fileName.toLowerCase()
  for (const full of walkFiles(root)) {
    if (path.basename(full).toLowerCase() === lower) return full
  }
  return null
}

function copyIfMissing(
  src: string,
  dest: string,
  installed: string[],
  relName: string,
): void {
  if (exists(dest)) return
  ensureDir(path.dirname(dest))
  fs.copyFileSync(src, dest)
  installed.push(relName)
}

/** Always refresh Enhanced ASI loader / args from the SHV package. */
function copyReplace(
  src: string,
  dest: string,
  installed: string[],
  relName: string,
): void {
  ensureDir(path.dirname(dest))
  fs.copyFileSync(src, dest)
  if (!installed.includes(relName)) installed.push(relName)
}

async function resolveScriptHookVZipUrl(): Promise<string> {
  const pageUrl = 'https://www.dev-c.com/gtav/scripthookv/'
  const res = await fetch(pageUrl, {
    headers: {
      ...BROWSER_HEADERS,
      Accept: 'text/html,application/xhtml+xml',
      Referer: 'https://www.dev-c.com/',
    },
  })
  if (!res.ok) throw new Error('scripthookv_page_failed')
  const html = await res.text()
  const match = html.match(/\/files\/(ScriptHookV_\d[\w.\-]*\.zip)/i)
  if (!match) throw new Error('scripthookv_link_not_found')
  return `https://www.dev-c.com/files/${match[1]}`
}

async function resolveShvdnZipUrl(): Promise<{ url: string; name: string }> {
  const api =
    'https://api.github.com/repos/Chiheb-Bacha/ScriptHookVDotNetEnhanced/releases/latest'
  const res = await fetch(api, {
    headers: {
      ...BROWSER_HEADERS,
      Accept: 'application/vnd.github+json',
    },
  })
  if (!res.ok) throw new Error('shvdn_release_failed')
  const json = (await res.json()) as {
    assets?: Array<{ name: string; browser_download_url: string }>
  }
  const asset = json.assets?.find((a) => /\.zip$/i.test(a.name))
  if (!asset) throw new Error('shvdn_asset_not_found')
  return { url: asset.browser_download_url, name: asset.name }
}

async function ensureScriptHookV(
  gamePath: string,
  installed: string[],
): Promise<void> {
  // Always ensure Enhanced loader (xinput1_4) — missing it = "no connection".
  const needExtract =
    !exists(path.join(gamePath, 'xinput1_4.dll')) ||
    !exists(path.join(gamePath, 'ScriptHookV.dll')) ||
    !exists(path.join(gamePath, 'dinput8.dll'))

  const zipUrl = await resolveScriptHookVZipUrl()
  const zipName = path.basename(new URL(zipUrl).pathname)
  const zipPath = path.join(cacheRoot(), zipName)
  const extractDir = path.join(cacheRoot(), 'scripthookv-extract')

  if (needExtract || !exists(path.join(extractDir, 'bin', 'xinput1_4.dll'))) {
    if (!exists(zipPath)) {
      await downloadFile(zipUrl, zipPath, {
        Referer: 'https://www.dev-c.com/gtav/scripthookv/',
      })
    }
    if (exists(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true })
    await extractZip(zipPath, extractDir)
  }

  for (const file of SCRIPT_HOOK_FILES) {
    const src = findNamedFile(extractDir, file)
    if (!src) {
      if (file === 'args.txt') continue
      throw new Error(`scripthookv_missing_${file}`)
    }
    // Force-refresh Enhanced ASI loader — a legacy-only dinput8 install looks "complete"
    // but never loads ScriptHookVDotNet.asi.
    if (file === 'xinput1_4.dll' || file === 'args.txt') {
      copyReplace(src, path.join(gamePath, file), installed, file)
    } else {
      copyIfMissing(src, path.join(gamePath, file), installed, file)
    }
  }
}

async function ensureShvdn(gamePath: string, installed: string[]): Promise<void> {
  const missing = SHVDN_FILES.filter((f) => !exists(path.join(gamePath, f)))
  // MinHook is required on modern SHVDN; treat asi + v3 as the must-haves.
  const needCore =
    !exists(path.join(gamePath, 'ScriptHookVDotNet.asi')) ||
    !exists(path.join(gamePath, 'ScriptHookVDotNet3.dll'))
  if (!needCore && missing.length === 0) return

  const { url, name } = await resolveShvdnZipUrl()
  const zipPath = path.join(cacheRoot(), name)
  const extractDir = path.join(cacheRoot(), 'shvdn-extract')

  if (!exists(zipPath)) {
    await downloadFile(url, zipPath)
  }

  if (exists(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true })
  await extractZip(zipPath, extractDir)

  for (const file of SHVDN_FILES) {
    const src = findNamedFile(extractDir, file)
    if (!src) {
      // ini / MinHook may be optional in older builds — skip if absent
      if (file === 'ScriptHookVDotNet.ini' || file === 'MinHook.x64.dll') continue
      throw new Error(`shvdn_missing_${file}`)
    }
    copyIfMissing(src, path.join(gamePath, file), installed, file)
  }
}

/**
 * Ensure Script Hook V + SHVDN Enhanced files exist in the game folder.
 * Downloads latest packages when missing (cached under userData/hooks-cache).
 */
/** Write UTF-8 without BOM — SHVDN ini parsers can choke on EF BB BF. */
function writeUtf8NoBom(filePath: string, text: string) {
  fs.writeFileSync(filePath, text.replace(/^\uFEFF/, ''), { encoding: 'utf8' })
}

/**
 * GTAMOZA uses F11 for SHVDN script reload (F12 often taken by overlays / Steam).
 * Patches ScriptHookVDotNet.ini in the game folder (UTF-8, no BOM).
 */
export function ensureShvdnReloadKeyF11(gamePath: string): void {
  const iniPath = path.join(gamePath, 'ScriptHookVDotNet.ini')
  const desired = 'ReloadKeyBinding=F11'
  try {
    if (exists(iniPath)) {
      let text = fs.readFileSync(iniPath, 'utf8').replace(/^\uFEFF/, '')
      if (/ReloadKeyBinding\s*=/i.test(text)) {
        text = text.replace(/ReloadKeyBinding\s*=\s*\S+/i, desired)
      } else {
        text = `${desired}\n${text}`
      }
      writeUtf8NoBom(iniPath, text)
      return
    }
    writeUtf8NoBom(
      iniPath,
      [
        '; GTAMOZA — ScriptHookVDotNet',
        '; https://learn.microsoft.com/en-us/dotnet/api/system.windows.forms.keys',
        desired,
        'ConsoleKeyBinding=F4',
        'ScriptTimeoutThreshold=5000',
        'ScriptsLocation="scripts"',
        'AutoLoadScripts=true',
        '',
      ].join('\n'),
    )
  } catch (err) {
    console.warn('[gta] could not set ReloadKeyBinding=F11', err)
  }
}

export async function ensureGameHooksInstalled(
  gamePath: string,
): Promise<HookInstallResult> {
  const installed: string[] = []
  try {
    ensureDir(cacheRoot())
    await ensureScriptHookV(gamePath, installed)
    await ensureShvdn(gamePath, installed)
    ensureShvdnReloadKeyF11(gamePath)

    const hasEnhancedLoader = exists(path.join(gamePath, 'xinput1_4.dll'))
    const hasHook = exists(path.join(gamePath, 'ScriptHookV.dll'))
    const hasDotNet = exists(path.join(gamePath, 'ScriptHookVDotNet.asi'))
    if (!hasEnhancedLoader || !hasHook || !hasDotNet) {
      return { ok: false, installed, error: 'hooks_incomplete' }
    }
    return { ok: true, installed }
  } catch (err) {
    return {
      ok: false,
      installed,
      error: err instanceof Error ? err.message : 'hooks_install_failed',
    }
  }
}

export function hooksMissingInGame(gamePath: string): boolean {
  return (
    !exists(path.join(gamePath, 'xinput1_4.dll')) ||
    !exists(path.join(gamePath, 'ScriptHookV.dll')) ||
    !exists(path.join(gamePath, 'ScriptHookVDotNet.asi'))
  )
}
