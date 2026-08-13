# GTAMOZA GTA V Enhanced plugin

SHVDN3 script (`GTAMOZA.dll`) sends Story Mode telemetry to GTAMOZA over UDP `127.0.0.1:29755`.

## Build

```bash
npm run build:gta-mod:dev   # Debug — includes Home / PgUp cheats
npm run build:gta-mod       # Release — cheats compiled out (#if DEBUG)
npm run build:ffb-host
```

Requires .NET SDK 8+ and `ScriptHookVDotNet3.dll` in the Enhanced game folder (HintPath in csproj).

### Dev-only keys (Debug DLL only)

| Key | Action |
| --- | --- |
| **Home** | Toggle god mode + no police |
| **Page Up** | Spawn random car and warp in |

Release / `npm run dist` builds strip `DevCheats` entirely — keys do nothing.

## Install

Use **Settings → GTA V Enhanced → Enable for Story Mode** (copies `gta-mod/dist/GTAMOZA.dll` into `scripts/`).

Or copy manually:

`gta-mod/dist/GTAMOZA.dll` → `...\Grand Theft Auto V Enhanced\scripts\GTAMOZA.dll`

## Run

1. Pit House open (base feel)
2. GTAMOZA running (`npm run dev`)
3. Enable integration (not parked)
4. Launch **Story Mode** only
5. Enter a vehicle — Dashboard should show GTA connected; FFB host drives the wheel via DirectInput
