import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { CheatsSettings } from '../../shared/types'

/** Flat JSON the StoryCheats plugin reads from %TEMP%. */
export function writeCheatsConfig(cheats: CheatsSettings) {
  const file = path.join(os.tmpdir(), 'gtamoza_cheats.json')
  const body = {
    enabled: Boolean(cheats?.enabled),
    godEnabled: Boolean(cheats?.godMode?.enabled),
    copsEnabled: Boolean(cheats?.noPolice?.enabled),
    spawnEnabled: Boolean(cheats?.spawnCar?.enabled),
    godHotkey: String(cheats?.godMode?.hotkey || 'Home'),
    copsHotkey: String(cheats?.noPolice?.hotkey || 'End'),
    spawnHotkey: String(cheats?.spawnCar?.hotkey || 'PageUp'),
  }
  try {
    fs.writeFileSync(file, JSON.stringify(body), 'utf8')
  } catch (err) {
    console.warn('[cheats] write failed', err)
  }
}
