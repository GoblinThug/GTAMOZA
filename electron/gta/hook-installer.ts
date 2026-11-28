/**
 * Download + install Script Hook V and ScriptHookVDotNet Enhanced
 * into a GTA V Enhanced game folder when they are missing.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import { app, net } from 'electron'

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

/** Escape for single-quoted PowerShell literals. */
function psQuote(s: string) {
  return s.replace(/'/g, "''")
}

function mergeHeaders(extra?: Record<string, string>) {
  return { ...BROWSER_HEADERS, ...extra }
}

/**
 * WinHTTP/Schannel can reach hosts (e.g. dev-c.com) where Node OpenSSL TLS fails.
 * Prefer Chromium net.fetch in Electron, then node fetch, then PowerShell.
 */
async function fetchHttpResponse(
  url: string,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const headers = mergeHeaders(extraHeaders)
  const init = { headers, redirect: 'follow' as const }

  try {
    return await net.fetch(url, init)
  } catch (err) {
    console.warn('[hooks] net.fetch failed', url, err)
  }

  try {
    return await fetch(url, init)
  } catch (err) {
    console.warn('[hooks] node fetch failed', url, err)
    const text = await fetchTextPowerShell(url, headers)
    // Minimal Response shim for callers that only need .ok / .text() / .json()
    return {
      ok: true,
      status: 200,
      text: async () => text,
      json: async () => JSON.parse(text) as unknown,
      arrayBuffer: async () => Buffer.from(text, 'utf8').buffer,
    } as Response
  }
}

async function fetchTextPowerShell(
  url: string,
  headers: Record<string, string>,
): Promise<string> {
  const assigns = Object.entries(headers)
    .map(([k, v]) => `$h['${psQuote(k)}']='${psQuote(v)}'`)
    .join('; ')
  const cmd = `$h=@{};${assigns}; (Invoke-WebRequest -Uri '${psQuote(url)}' -UseBasicParsing -Headers $h).Content`
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', cmd],
    { windowsHide: true, maxBuffer: 32 * 1024 * 1024 },
  )
  const text = stdout.toString()
  if (!text.trim()) throw new Error('download_network_failed')
  return text
}

async function downloadFilePowerShell(
  url: string,
  dest: string,
  headers: Record<string, string>,
): Promise<void> {
  ensureDir(path.dirname(dest))
  const assigns = Object.entries(headers)
    .map(([k, v]) => `$h['${psQuote(k)}']='${psQuote(v)}'`)
    .join('; ')
  const cmd = `$h=@{};${assigns}; Invoke-WebRequest -Uri '${psQuote(url)}' -OutFile '${psQuote(dest)}' -UseBasicParsing -Headers $h`
  await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', cmd],
    { windowsHide: true },
  )
  if (!exists(dest) || fs.statSync(dest).size < 1024) {
    throw new Error('download_too_small')
  }
}

async function downloadFile(url: string, dest: string, extraHeaders?: Record<string, string>) {
  ensureDir(path.dirname(dest))
  const headers = mergeHeaders(extraHeaders)

  try {
    let res: Response
    try {
      res = await net.fetch(url, { headers, redirect: 'follow' })
    } catch (err) {
      console.warn('[hooks] net.fetch download failed', url, err)
      try {
        res = await fetch(url, { headers, redirect: 'follow' })
      } catch {
        await downloadFilePowerShell(url, dest, headers)
        return
      }
    }
    if (!res.ok) throw new Error(`download_failed_${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 1024) throw new Error('download_too_small')
    fs.writeFileSync(dest, buf)
    return
  } catch (err) {
    if (exists(dest)) fs.rmSync(dest, { force: true })
    if (err instanceof Error && err.message.startsWith('download_')) throw err
    await downloadFilePowerShell(url, dest, headers)
  }
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

function errnoCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    return String((err as NodeJS.ErrnoException).code)
  }
  return ''
}

function clearWindowsReadonly(filePath: string): void {
  if (!exists(filePath)) return
  try {
    fs.chmodSync(filePath, 0o666)
  } catch {
    /* ignore */
  }
  try {
    execFileSync('attrib', ['-R', filePath], { windowsHide: true })
  } catch {
    /* ignore */
  }
}

/** Temp file → rename avoids some AV locks; PowerShell fallback on EPERM. */
async function copyIntoGameDir(src: string, dest: string): Promise<void> {
  ensureDir(path.dirname(dest))
  clearWindowsReadonly(dest)

  const tmp = `${dest}.gtamoza.tmp`
  const tryNode = (): void => {
    if (exists(tmp)) fs.rmSync(tmp, { force: true })
    fs.copyFileSync(src, tmp)
    if (exists(dest)) {
      clearWindowsReadonly(dest)
      fs.rmSync(dest, { force: true })
    }
    fs.renameSync(tmp, dest)
  }

  try {
    tryNode()
    return
  } catch (err) {
    try {
      fs.rmSync(tmp, { force: true })
    } catch {
      /* ignore */
    }
    const code = errnoCode(err)
    if (code !== 'EPERM' && code !== 'EACCES') throw err
  }

  const cmd = `Copy-Item -LiteralPath '${psQuote(src)}' -Destination '${psQuote(dest)}' -Force`
  try {
    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', cmd],
      { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
    )
    return
  } catch {
    await copySingleFileElevated(src, dest)
  }
}

async function runElevatedPowerShellScript(scriptPath: string): Promise<number> {
  const launcher = `
$p = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File','${psQuote(scriptPath)}') -Verb RunAs -Wait -PassThru
if ($null -eq $p) { exit 1223 }
exit $p.ExitCode
`
  try {
    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', launcher],
      { windowsHide: true },
    )
    return 0
  } catch (err) {
    const code = errnoCode(err)
    if (/^\d+$/.test(code)) return Number(code)
    if (err && typeof err === 'object' && 'code' in err) {
      const n = Number((err as { code?: string | number }).code)
      if (!Number.isNaN(n)) return n
    }
    return 1
  }
}

async function copySingleFileElevated(src: string, dest: string): Promise<void> {
  ensureDir(cacheRoot())
  const scriptPath = path.join(cacheRoot(), 'elevated-copy-one.ps1')
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `$src = '${psQuote(src)}'`,
    `$dest = '${psQuote(dest)}'`,
    `$dir = Split-Path -LiteralPath $dest -Parent`,
    `if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }`,
    `if (Test-Path -LiteralPath $dest) { cmd /c attrib -R "$dest" 2>$null; Remove-Item -LiteralPath $dest -Force }`,
    `Copy-Item -LiteralPath $src -Destination $dest -Force`,
  ].join('\n')
  fs.writeFileSync(scriptPath, script, 'utf8')
  const code = await runElevatedPowerShellScript(scriptPath)
  if (code === 1223) throw new Error('elevation_declined')
  if (code !== 0) throw new Error('game_folder_not_writable')
  if (!exists(dest)) throw new Error('game_folder_not_writable')
}

async function copyIfMissing(
  src: string,
  dest: string,
  installed: string[],
  relName: string,
): Promise<void> {
  if (exists(dest)) return
  await copyIntoGameDir(src, dest)
  installed.push(relName)
}

/** Always refresh Enhanced ASI loader / args from the SHV package. */
async function copyReplace(
  src: string,
  dest: string,
  installed: string[],
  relName: string,
): Promise<void> {
  await copyIntoGameDir(src, dest)
  if (!installed.includes(relName)) installed.push(relName)
}

function isGameOrLauncherRunning(): boolean {
  try {
    const ps =
      "$n=@('GTA5_Enhanced','GTA5','PlayGTAV','Launcher','SocialClubHelper','RockstarService');" +
      '(Get-Process -Name $n -ErrorAction SilentlyContinue | Measure-Object).Count'
    const out = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', ps],
      { encoding: 'utf8', windowsHide: true },
    )
    return parseInt(out.trim(), 10) > 0
  } catch {
    return false
  }
}

function isGameFolderWritable(gamePath: string): boolean {
  const probe = path.join(gamePath, '.gtamoza_write_probe')
  try {
    fs.writeFileSync(probe, 'ok', { encoding: 'utf8' })
    fs.rmSync(probe, { force: true })
    return true
  } catch {
    return false
  }
}

/** Rockstar / Steam installs often leave the game folder RX-only for Users — grant Modify once. */
function tryRepairGameFolderWriteAccess(gamePath: string): boolean {
  try {
    execFileSync('attrib', ['-R', gamePath], { windowsHide: true })
  } catch {
    /* ignore */
  }
  return isGameFolderWritable(gamePath)
}

async function requestElevatedGameFolderAccess(
  gamePath: string,
): Promise<{ ok: boolean; error?: string }> {
  ensureDir(cacheRoot())
  const scriptPath = path.join(cacheRoot(), 'elevated-grant-write.ps1')
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `$p = '${psQuote(gamePath)}'`,
    `if (-not (Test-Path -LiteralPath $p)) { exit 2 }`,
    `cmd /c attrib -R "$p"`,
    `cmd /c icacls "$p" /grant "$env:USERNAME:(OI)(CI)M"`,
    `$probe = Join-Path $p '.gtamoza_write_probe'`,
    `[IO.File]::WriteAllText($probe, 'ok')`,
    `Remove-Item -LiteralPath $probe -Force`,
  ].join('\r\n')
  fs.writeFileSync(scriptPath, script, 'utf8')
  const code = await runElevatedPowerShellScript(scriptPath)
  if (code === 1223) return { ok: false, error: 'elevation_declined' }
  if (code !== 0) return { ok: false, error: 'game_folder_not_writable' }
  if (!isGameFolderWritable(gamePath)) {
    return { ok: false, error: 'game_folder_not_writable' }
  }
  return { ok: true }
}

/**
 * GTA install dirs are often read-only for standard users (RX ACE on BUILTIN\\Users).
 * One UAC prompt grants Modify so hooks + plugin can copy without running the whole app as admin.
 */
export async function ensureGameFolderWritableAccess(
  gamePath: string,
): Promise<{ ok: boolean; error?: string }> {
  if (isGameFolderWritable(gamePath)) return { ok: true }
  if (tryRepairGameFolderWriteAccess(gamePath)) return { ok: true }
  return requestElevatedGameFolderAccess(gamePath)
}

async function resolveScriptHookVZipUrl(): Promise<string> {
  const pageUrl = 'https://www.dev-c.com/gtav/scripthookv/'
  const res = await fetchHttpResponse(pageUrl, {
    Accept: 'text/html,application/xhtml+xml',
    Referer: 'https://www.dev-c.com/',
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
  const res = await fetchHttpResponse(api, {
    Accept: 'application/vnd.github+json',
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
    const dest = path.join(gamePath, file)
    // Force-refresh Enhanced ASI loader — a legacy-only dinput8 install looks "complete"
    // but never loads ScriptHookVDotNet.asi.
    if (file === 'xinput1_4.dll' || file === 'args.txt') {
      await copyReplace(src, dest, installed, file)
    } else if (file === 'dinput8.dll') {
      try {
        await copyIfMissing(src, dest, installed, file)
      } catch (err) {
        // Enhanced uses xinput1_4; legacy dinput8 can be blocked by ACL/BattlEye placeholders.
        const code = errnoCode(err)
        if (code === 'EPERM' || code === 'EACCES') {
          console.warn('[hooks] dinput8.dll not written (optional on Enhanced)', err)
          continue
        }
        throw err
      }
    } else {
      await copyIfMissing(src, dest, installed, file)
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
    await copyIfMissing(src, path.join(gamePath, file), installed, file)
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
    if (isGameOrLauncherRunning()) {
      return { ok: false, installed, error: 'close_game_first' }
    }
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
    !exists(path.join(gamePath, 'ScriptHookVDotNet.asi')) ||
    !exists(path.join(gamePath, 'ScriptHookVDotNet3.dll'))
  )
}
