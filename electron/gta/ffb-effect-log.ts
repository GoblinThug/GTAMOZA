/**
 * JSONL force-feedback effect log for tuning vs other titles.
 * One session file under userData/logs/ffb-effects-*.jsonl
 */
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { EffectsSettings, FfbSettings } from '../../shared/types'

export type FfbEffectParts = {
  suspensionLat: number
  suspensionYaw: number
  understeer: number
  surface: number
  bump: number
  wheelSlip: number
  collision: number
  engine: number
  abs: number
  rawSum: number
  scaled: number
  smoothed: number
  diMag: number
}

let logPath: string | null = null
let stream: fs.WriteStream | null = null
let lastFlushAt = 0
let lastSettingsSig = ''
let enabled = true
const SAMPLE_MS = 50 // 20 Hz — dense enough to tune, light on disk

function logsDir(): string {
  const dir = path.join(app.getPath('userData'), 'logs')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function stamp(): string {
  const d = new Date()
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function writeLine(obj: Record<string, unknown>) {
  if (!enabled || !stream) return
  try {
    stream.write(`${JSON.stringify(obj)}\n`)
  } catch {
    /* ignore */
  }
}

export function getFfbEffectLogPath(): string | null {
  return logPath
}

export function setFfbEffectLogEnabled(on: boolean) {
  enabled = on
}

/** Start / ensure a session file. Safe to call repeatedly. */
export function ensureFfbEffectLogSession(): string | null {
  if (!enabled) return logPath
  if (stream && logPath) return logPath
  try {
    const dir = logsDir()
    logPath = path.join(dir, `ffb-effects-${stamp()}.jsonl`)
    stream = fs.createWriteStream(logPath, { flags: 'a' })
    writeLine({
      kind: 'session',
      ts: Date.now(),
      iso: new Date().toISOString(),
      note:
        'GTAMOZA FFB effect breakdown. parts.* are pre-DI contributions (−1..1-ish); diMag is −10000..10000. Host spring lines use kind=host.',
      path: logPath,
    })
    console.log('[gta-ffb-log] writing', logPath)
    return logPath
  } catch (err) {
    console.warn('[gta-ffb-log] open failed', err)
    logPath = null
    stream = null
    return null
  }
}

export function logFfbSettings(ffb: FfbSettings | null, effects: EffectsSettings | null) {
  ensureFfbEffectLogSession()
  const sig = JSON.stringify({ ffb, effects })
  if (sig === lastSettingsSig) return
  lastSettingsSig = sig
  writeLine({
    kind: 'settings',
    ts: Date.now(),
    iso: new Date().toISOString(),
    ffb,
    effects,
  })
}

export function logFfbSample(row: {
  tel: Record<string, unknown>
  gains: Record<string, unknown>
  parts: FfbEffectParts
  force?: boolean
}) {
  ensureFfbEffectLogSession()
  const now = Date.now()
  if (!row.force && now - lastFlushAt < SAMPLE_MS) return
  lastFlushAt = now
  writeLine({
    kind: 'sample',
    ts: now,
    iso: new Date(now).toISOString(),
    tel: row.tel,
    gains: row.gains,
    parts: row.parts,
  })
}

export function closeFfbEffectLog() {
  try {
    stream?.end()
  } catch {
    /* ignore */
  }
  stream = null
}
