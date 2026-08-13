import type { AppLocale, EffectId, PageId } from '../types'

export type MessageKey = keyof typeof en

const en = {
  'nav.dashboard': 'Dashboard',
  'nav.steering': 'Steering',
  'nav.effects': 'FFB / Effects',
  'nav.profiles': 'Profiles',
  'nav.cheats': 'Cheats',
  'nav.settings': 'Settings',
  'nav.mockBackend': 'Base ↔ GTA',
  'nav.main': 'Menu',

  'window.controls': 'Window controls',
  'window.minimize': 'Minimize',
  'window.maximize': 'Maximize',
  'window.restore': 'Restore',
  'window.close': 'Close',

  'onboarding.title': 'Setup guide',
  'onboarding.step': 'Step {current} of {total}',
  'onboarding.next': 'Next',
  'onboarding.nextAnyway': 'Continue anyway',
  'onboarding.back': 'Back',
  'onboarding.skip': 'Skip',
  'onboarding.finish': 'Start using GTA Moza Drive',
  'onboarding.openPage': 'Do it in the app',
  'onboarding.minimize': 'Hide',
  'onboarding.enableStory': 'Turn on Story Mode',
  'onboarding.replay': 'Replay setup guide',
  'onboarding.replayHint': 'Show the first-run walkthrough again.',
  'onboarding.verdict.ok': 'Looks good — you can continue.',
  'onboarding.verdict.wait': 'Waiting for the checks below to turn green.',
  'onboarding.check.ok': 'Ready',
  'onboarding.check.waiting': 'Waiting…',
  'onboarding.check.pending': 'Not done yet',
  'onboarding.check.checking': 'Checking…',
  'onboarding.check.moza': 'MOZA base',
  'onboarding.check.mozaWait': 'Plug in the R5 over USB',
  'onboarding.check.story': 'Story Mode integration',
  'onboarding.check.gameFolder': 'GTA V Enhanced folder',
  'onboarding.check.gameFolderWait': 'Choose the game folder in Settings',
  'onboarding.check.hooks': 'Script Hook + SHVDN',
  'onboarding.check.hooksWait': 'Install Script Hook V and ScriptHookVDotNet',
  'onboarding.check.plugin': 'GTAMOZA plugin',
  'onboarding.check.pluginWait': 'Enable Story Mode to install the plugin',
  'onboarding.check.pedals': 'Pedal calibration',
  'onboarding.check.pedalsWait': 'Calibrate throttle and brake on the Dashboard',
  'onboarding.check.throttle': 'Throttle 100%',
  'onboarding.check.brake': 'Brake 100%',
  'onboarding.check.clutch': 'Clutch 100%',
  'onboarding.check.calWait': 'Press full travel, then Remember',
  'onboarding.check.clutchOptional': 'Optional — skip if unused',
  'onboarding.check.currentMode': 'Current GTA mode',
  'onboarding.check.onlineAck': 'Online warning understood',
  'onboarding.check.onlineAckWait': 'Tick the box below',
  'onboarding.check.gameLink': 'Live telemetry from game',
  'onboarding.check.gameLinkWait': 'Launch Story Mode and enter a vehicle',
  'onboarding.welcome.title': 'Welcome to GTA Moza Drive',
  'onboarding.welcome.body':
    'Follow the steps on the right. Live checks turn green when each part is done — you can use the app while the guide stays open.',
  'onboarding.moza.title': 'Connect the base',
  'onboarding.moza.body':
    'Plug in the R5 over USB. If you use Pit House, set wheel angle there — GTAMOZA will pick it up. The check below turns green when the base is seen.',
  'onboarding.gta.title': 'Enable Story Mode',
  'onboarding.gta.body':
    'Set the game folder, then turn on Story Mode. GTA Moza Drive downloads Script Hook + SHVDN and installs the plugin automatically.',
  'onboarding.pedals.title': 'Calibrate pedals',
  'onboarding.pedals.body':
    'Open the Dashboard, start Calibrate pedals, press each pedal to full travel and Remember. Throttle and brake are required; clutch is optional.',
  'onboarding.online.title': 'Before GTA Online',
  'onboarding.online.body':
    'Always press “Prepare for Online” in Settings before joining Online. Story Mode mods are not safe for Online.',
  'onboarding.online.ackLabel':
    'I understand — I will Prepare for Online before playing GTA Online.',
  'onboarding.done.title': 'You are ready',
  'onboarding.done.body':
    'Launch Story Mode, hop in a car, and drive. Anything still grey can be finished later from Dashboard or Settings.',

  'cheats.kicker': 'Story Mode',
  'cheats.title': 'Cheats',
  'cheats.desc':
    'Optional helpers for Story Mode only. Off by default — never use with GTA Online.',
  'cheats.master': 'Master switch',
  'cheats.masterLabel': 'Enable cheats',
  'cheats.masterHint': 'When off, all cheat hotkeys are ignored in-game.',
  'cheats.features': 'Features & hotkeys',
  'cheats.god': 'God mode',
  'cheats.godHint': 'Invincibility while toggled on.',
  'cheats.police': 'Disable police',
  'cheats.policeHint': 'Wanted level cleared; cops ignore you.',
  'cheats.spawn': 'Spawn random car',
  'cheats.spawnHint': 'Spawns a random vehicle and puts you in the driver seat.',
  'cheats.pressKey': 'Press a key…',
  'cheats.saved': 'Cheats updated',

  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.delete': 'Delete',
  'common.create': 'Create',
  'common.rename': 'Rename',
  'common.reset': 'Reset',
  'common.active': 'Active',
  'common.connected': 'Connected',
  'common.disconnected': 'Disconnected',
  'common.loading': 'Loading GTA Moza Drive…',
  'common.profileSaved': 'Profile saved',
  'common.strength': 'Strength',
  'common.strengthDesc':
    'How strong this effect is on the rim. 0 = off feel; higher = more obvious. Use the toggle to disable completely.',
  'common.name': 'Name',
  'common.enabled': 'Enabled',
  'common.disabled': 'Disabled',

  'dashboard.title': 'Dashboard',
  'dashboard.kicker': 'Link',
  'dashboard.desc':
    'Live wheel and pedals from the MOZA base. Calibrate pedals here — wheel feel stays in Pit House.',
  'dashboard.linkMoza': 'MOZA base',
  'dashboard.linkMozaOn': 'Connected',
  'dashboard.linkMozaOff': 'Not connected',
  'dashboard.linkGta': 'GTA Story Mode',
  'dashboard.linkGtaOn': 'Connected',
  'dashboard.linkGtaOff': 'Not connected',
  'dashboard.linkGtaPluginMissing':
    'GTA is running, but the plugin did not load. Quit fully and use Settings → Launch Story Mode (no BattlEye). Steam/Epic/Rockstar each need BattlEye off for mods.',
  'dashboard.waitBadge': 'Start Story Mode with GTAMOZA enabled in Settings.',
  'dashboard.hardwareReady':
    'MOZA base detected. Turn the wheel and press pedals to verify live input.',
  'dashboard.hardwareMissing':
    'Plug in the R5 USB. If the base is busy, reopen GTAMOZA after Pit House.',
  'dashboard.mode': 'Mode',
  'dashboard.storyMode': 'Story Mode',
  'dashboard.vehicle': 'Vehicle',
  'dashboard.model': 'Model',
  'dashboard.wheelAngle': 'Wheel angle (from base)',
  'dashboard.serial': 'Pit House',
  'dashboard.serialOpen': 'Linked',
  'dashboard.serialBusy': 'No link',
  'dashboard.serialClosed': 'Idle',
  'dashboard.session': 'Session',
  'dashboard.liveInputs': 'Wheel & pedals',
  'dashboard.liveInputsHint':
    'Bars show live input. Use Calibrate pedals so 100% matches your travel for GTA.',
  'dashboard.calibratePedals': 'Calibrate pedals',
  'dashboard.calPressThrottle':
    'Press THROTTLE to the depth you want as 100%, then Remember 100%.',
  'dashboard.calPressBrake':
    'Press BRAKE to the depth you want as 100%, then Remember 100%.',
  'dashboard.calPressClutch':
    'Press CLUTCH to the depth you want as 100%, then Remember 100%. Skip if unused.',
  'dashboard.calRemember': 'Remember 100%',
  'dashboard.calSkipClutch': 'Skip clutch',
  'dashboard.calDone': 'Pedal ranges saved. Bars use your locked 100%.',
  'dashboard.calDoneSkipClutch': 'Throttle/brake saved. Clutch skipped.',
  'dashboard.calNotPressed': 'Press deeper and hold, then Remember again.',
  'dashboard.calFailed': 'Could not lock this pedal. Try again.',
  'dashboard.throttle': 'Throttle',
  'dashboard.brake': 'Brake',
  'dashboard.clutch': 'Clutch',
  'dashboard.profile': 'Profile',
  'dashboard.steering': 'Steering',
  'dashboard.ffb': 'Game FFB',
  'dashboard.paddlesTitle': 'Turn signals (paddles)',
  'dashboard.paddlesSubtitle':
    'Paddles must be Buttons in Pit House. Press each once — toast shows Button N. First two buttons = left/right.',
  'dashboard.paddlesWaiting': 'Waiting for paddle button press…',
  'dashboard.paddlesReset': 'Paddle mapping reset — press left, then right',
  'dashboard.paddlesResetBtn': 'Reset learn',
  'dashboard.paddleLeft': 'Left',
  'dashboard.paddleRight': 'Right',
  'dashboard.paddlesLearned': 'Learned buttons: L={left} · R={right}',

  'steering.title': 'Steering',
  'steering.kicker': 'GTA map',
  'steering.desc':
    'How the rim drives the car in GTA. Physical wheel angle and soft lock stay in Pit House — change them there.',
  'steering.feelTitle': 'Rim feel (GTAMOZA FFB)',
  'steering.feelSubtitle':
    'Weight and return of the rim from GTAMOZA. In Pit House set Wheel Spring to 0% so springs do not fight.',
  'steering.gtaMapTitle': 'GTA mapping',
  'steering.gtaMapSubtitle':
    'Only how the car turns in game. Does not change base torque or Pit House damper/friction.',
  'steering.sensitivity': 'Sensitivity',
  'steering.sensitivityDesc':
    'How quickly the car reacts to small wheel moves. Higher = sharper turn-in (sports). Lower = calmer on highways and straights.',
  'steering.linearity': 'Linearity',
  'steering.linearityDesc':
    'Feel around center. Lower = softer first degrees (easier to hold a straight). Higher = more 1:1 with the rim.',
  'steering.deadzone': 'Deadzone',
  'steering.deadzoneDesc':
    'Ignores tiny motion near center. Raise a little if the car drifts when you hold the rim still. Keep low for precise steering.',
  'steering.saturation': 'Saturation',
  'steering.saturationDesc':
    'How soon full physical lock reaches full lock in GTA. Lower = you hit in-game lock earlier with less wheel travel.',
  'steering.centerOffset': 'Center offset',
  'steering.centerOffsetDesc':
    'Shifts “straight ahead” if the rim sits a few degrees off center at rest. Use only for calibration, not for feel.',

  'sync.refresh': 'Pull from Pit House',
  'sync.refreshed': 'Angle from Pit House: {angle}°',
  'sync.steeringFromBase':
    'Wheel angle from Pit House: {angle}°. Change it there — GTAMOZA follows (no need to close Pit House).',
  'sync.comBusy':
    'Could not read settings. Keep Pit House open for live sync, or close it once for a COM fallback pull.',
  'sync.waitBase':
    'Waiting for Pit House… Open Pit House with the base connected, then press Pull.',

  'ffb.enabled': 'Game FFB enabled',
  'ffb.enabledDesc':
    'Turns GTAMOZA force feedback on or off. When off, the base still works, but road/kerb/hits from GTA stop.',
  'ffb.overall': 'Overall strength',
  'ffb.overallDesc':
    'Master volume for all game forces (road, kerb, bumps, crashes). Raise if everything feels weak; lower if the rim is too busy.',
  'ffb.centering': 'Self-aligning torque',
  'ffb.centeringDesc':
    'Return-to-center while driving (like tire SAT). Higher = stronger pull to straight. If the rim yanks into a turn, lower this — not Road. Keep Pit House Wheel Spring at 0%.',
  'ffb.damping': 'Damping',
  'ffb.dampingDesc':
    'Stabilizes the rim and reduces shake/oscillation. Higher = heavier, calmer wheel (good under braking). Too high = numb and slow to turn.',
  'ffb.friction': 'Friction',
  'ffb.frictionDesc':
    'Constant drag while you turn — “mechanical” resistance. A little adds weight; too much makes slow steering sticky.',
  'ffb.inertia': 'Inertia',
  'ffb.inertiaDesc':
    'Column mass: resists sudden flicks and direction changes. Higher = heavier, more planted. Too high = the rim feels sluggish.',
  'ffb.smoothing': 'Smoothing',
  'ffb.smoothingDesc':
    'Softens sharp spikes from game effects. Higher = smoother but less detail. Keep moderate so asphalt and kerbs stay readable.',

  'effects.title': 'Effects',
  'effects.kicker': 'GTA feel',
  'effects.desc':
    'What you feel from the road and events in GTA. Base spring/damper live on the Steering tab and in Pit House.',
  'effects.surfacesTitle': 'Surface & event effects',
  'effects.surfacesSubtitle':
    'Each slider is one sensation from GTA telemetry. Toggle off anything you do not want on the rim.',
  'effects.road': 'Road',
  'effects.roadDesc':
    'Fine asphalt grain / micro-vibration on normal roads. If the rim jitters on a straight, turn this down first (often to 10–20).',
  'effects.kerb': 'Kerb',
  'effects.kerbDesc':
    'Hard rumble and hits on kerbs and sidewalks. Raise to feel curbs clearly; leave higher than Road so asphalt stays calm.',
  'effects.grass': 'Grass',
  'effects.grassDesc':
    'Softer, mushy shake off-road (grass, dirt, sand). Useful so leaving the tarmac is obvious without being harsh.',
  'effects.suspension': 'Suspension',
  'effects.suspensionDesc':
    'Potholes, bumps and chassis heave through the rim. Does not pull left/right into a turn — return-to-center is Self-aligning torque.',
  'effects.wheelSlip': 'Wheel slip',
  'effects.wheelSlipDesc':
    'Texture when tires break traction (spin / slide). Raise for drift feel; lower if the rim chatters while grip is fine.',
  'effects.abs': 'ABS',
  'effects.absDesc':
    'Pulsing under hard braking when wheels lock and ABS kicks in. Keep low unless you want a clear pedal/rim cue.',
  'effects.collision': 'Collision',
  'effects.collisionDesc':
    'Sharp hits from crashes and hard contacts. Raise for punchy impacts; if soft scrapes yank sideways, lower this.',
  'effects.engine': 'Engine',
  'effects.engineDesc':
    'Light buzz from RPM / throttle load. Usually keep low — high values make highway cruise feel nervous.',
  'profiles.title': 'Profiles',
  'profiles.kicker': 'Presets',
  'profiles.desc': 'Saved GTA mapping and effect presets for different cars.',
  'profiles.saveChanges': 'Save changes',
  'profiles.create': 'Create',
  'profiles.createTitle': 'Create profile',
  'profiles.renameTitle': 'Rename profile',
  'profiles.deleteTitle': 'Delete profile',
  'profiles.deleteBody': 'Delete “{name}”? This cannot be undone.',
  'profiles.newName': 'New Profile',
  'profiles.created': 'Profile created',
  'profiles.renamed': 'Profile renamed',
  'profiles.deleted': 'Profile deleted',
  'profiles.reset': 'Profile reset',
  'profiles.restoreBackup': 'Restore factory backup',
  'profiles.restoreBackupDesc':
    'Restore all profiles and pedal/cheat settings from the locked ideal backup.',
  'profiles.restoreBackupDone': 'Factory backup restored',
  'profiles.restoreBackupFail': 'Backup file not found',

  'settings.title': 'Settings',
  'settings.kicker': 'App',
  'settings.desc': 'Appearance, behaviour, and updates for GTAMOZA itself.',
  'settings.appearance': 'Appearance',
  'settings.theme': 'Theme',
  'settings.themeHint': 'Dark, light, or match Windows.',
  'settings.theme.dark': 'Dark',
  'settings.theme.light': 'Light',
  'settings.theme.system': 'System',
  'settings.themeUpdated': 'Theme updated',
  'settings.general': 'General',
  'settings.language': 'Language',
  'settings.languageHint': 'Interface language. Applies immediately.',
  'settings.languageUpdated': 'Language updated',
  'settings.startWithWindows': 'Start with Windows',
  'settings.startWithWindowsHint': 'Launch GTAMOZA when you sign in.',
  'settings.minimizeToTray': 'Minimize to tray',
  'settings.minimizeToTrayHint': 'Keep running in the tray instead of closing.',
  'settings.updates': 'Updates',
  'settings.currentVersion': 'Current version',
  'settings.autoUpdates': 'Check for updates automatically',
  'settings.autoUpdatesHint':
    'Quiet check a few seconds after launch. Downloads still need your OK.',
  'settings.updateChannel': 'Update channel',
  'settings.updateChannelHint': 'Stable is recommended. Beta is reserved for future builds.',
  'settings.channel.stable': 'Stable',
  'settings.channel.beta': 'Beta',
  'settings.checkUpdates': 'Check for updates',
  'settings.download': 'Download {version}',
  'settings.restartInstall': 'Restart & install',
  'settings.openReleases': 'Open GitHub Releases',
  'settings.repository': 'Repository: {owner}/{repo}',
  'settings.update.idle': 'Ready to check for updates.',
  'settings.update.checking': 'Checking for updates…',
  'settings.update.available': 'Update {version} is available.',
  'settings.update.notAvailable': 'You are on the latest version ({version}).',
  'settings.update.downloading': 'Downloading… {percent}%',
  'settings.update.ready': 'Update {version} downloaded. Restart to install.',
  'settings.update.unsupportedDev': 'Auto-update is unavailable in development builds.',
  'settings.update.unsupportedPortable': 'Auto-update is unavailable for portable builds.',
  'settings.update.error': 'Update error: {code}',

  'settings.gta': 'GTA V Enhanced',
  'settings.gtaDesc':
    'Install and park Story Mode integration. Disable before Online — your game files stay safe.',
  'settings.gta.path': 'Game folder',
  'settings.gta.pathHint': 'Folder with GTA5_Enhanced.exe',
  'settings.gta.browse': 'Browse…',
  'settings.gta.refresh': 'Refresh status',
  'settings.gta.modeStory': 'Story Mode',
  'settings.gta.modeStoryHint':
    'Turns on wheel support in Story Mode. BattlEye must be off or the ASI loader (dinput8) is blocked.',
  'settings.gta.store': 'Detected store: {store}',
  'settings.gta.store.steam': 'Steam',
  'settings.gta.store.epic': 'Epic Games',
  'settings.gta.store.rockstar': 'Rockstar Launcher',
  'settings.gta.store.unknown': 'Unknown',
  'settings.gta.launchStory': 'Launch Story Mode (no BattlEye)',
  'settings.gta.launchStoryHint':
    'Steam: starts with -nobattleye. Epic: set Launch Options to -nobattleye once, then use this button. Rockstar: uncheck Enable BattlEye in launcher settings, then use this button.',
  'settings.gta.toastLaunched': 'Launching Story Mode…',
  'settings.gta.toastLaunchedSteam': 'Launching via Steam (−nobattleye)…',
  'settings.gta.toastLaunchedEpic':
    'Launching via Epic. If BattlEye still blocks dinput8, add -nobattleye in Epic → Manage → Launch Options.',
  'settings.gta.toastLaunchedRockstar':
    'Launching via Rockstar. Uncheck Enable BattlEye in Rockstar Settings → GTA V if dinput8 is blocked.',
  'settings.gta.toastLaunchRunning': 'GTA is already running — quit it fully first',
  'settings.gta.toastLaunchFailed': 'Could not launch Story Mode: {error}',
  'settings.gta.modeOnline': 'GTA Online',
  'settings.gta.modeOnlineHint':
    'Parks the mod so Online is safe. Always use this before joining Online.',
  'settings.gta.onlineReady': 'Safe',
  'settings.gta.onlineBlocked': 'Mod active',
  'settings.gta.enable': 'Turn on Story Mode',
  'settings.gta.disable': 'Prepare for Online',
  'settings.gta.uninstall': 'Remove from game folder',
  'settings.gta.hotReload': 'Hot-reload plugin',
  'settings.gta.hotReloadHint':
    'Rebuilds GTAMOZA.dll and reloads scripts in a running game (F11). You should see a subtitle in GTA.',
  'settings.gta.hookHelp': 'Open Script Hook download',
  'settings.gta.uninstallHint':
    'Removes GTAMOZA, Script Hook, SHVDN, both ASI loaders (dinput8 + xinput1_4) and logs — game folder left clean.',
  'settings.gta.ffbLogs': 'Open FFB effect logs',
  'settings.gta.ffbLogsOpened': 'FFB logs folder opened',
  'settings.gta.state.enabled': 'Story Mode ON',
  'settings.gta.state.parked': 'Parked — Online safe',
  'settings.gta.state.ready': 'Ready',
  'settings.gta.state.missing-game': 'Game folder not set',
  'settings.gta.hint.enabled':
    'Story Mode integration is active. Disable before joining Online.',
  'settings.gta.hint.parked': 'Hooks are parked. Enable again for Story Mode FFB.',
  'settings.gta.hint.ready': 'Script Hook found. Press Enable to register GTAMOZA.',
  'settings.gta.hint.nohooks':
    'Script Hook is not installed yet. Press “Turn on Story Mode” — GTA Moza Drive will download and install it automatically.',
  'settings.gta.hint.missing': 'Pick the folder with GTA5_Enhanced.exe.',
  'settings.gta.onlineSafe': 'Online-safe: {value}',
  'settings.gta.yes': 'yes',
  'settings.gta.no': 'no',
  'settings.gta.toastEnabled': 'Story Mode integration enabled',
  'settings.gta.toastDisabled': 'Integration parked — safe for Online',
  'settings.gta.toastUninstalled':
    'Game folder cleaned — GTAMOZA, Script Hook, SHVDN and both ASI loaders removed',
  'settings.gta.toastUninstallLocked':
    'Could not delete some files — fully quit GTA / Rockstar Launcher, then uninstall again.',
  'settings.gta.toastHotReloaded':
    'Hot-reload done — check the GTAMOZA subtitle in GTA',
  'settings.gta.toastHotReloadManual':
    'Plugin copied. Focus GTA and press F11 — a subtitle will confirm reload',
  'settings.gta.toastHooksMissing':
    'Could not download Script Hook automatically. Check your internet, then try again or use “Open Script Hook download”.',
  'settings.gta.toastDownloading': 'Downloading Script Hook + SHVDN…',
  'settings.gta.toastPluginMissing':
    'GTAMOZA.dll not built. Run npm run build:gta-mod first.',
  'settings.gta.toastInvalid': 'That folder is not GTA V Enhanced',
  'settings.gta.toastFailed': 'Could not change integration: {error}',
  'settings.gta.warning':
    'Script Hook is Story Mode only. If BattlEye blocked dinput8.dll: launch with -nobattleye (button above) or uncheck BattlEye in Rockstar settings. Re-enable BattlEye / remove -nobattleye before Online. Use “Prepare for Online” in this app too.',
  'dashboard.linkGtaBattlEye':
    'BattlEye blocked dinput8.dll — quit GTA and launch via Steam (−nobattleye) from Settings.',
} as const

const ru: Record<MessageKey, string> = {
  'nav.dashboard': 'Обзор',
  'nav.steering': 'Руль',
  'nav.effects': 'FFB / Эффекты',
  'nav.profiles': 'Профили',
  'nav.cheats': 'Читы',
  'nav.settings': 'Настройки',
  'nav.mockBackend': 'База ↔ GTA',
  'nav.main': 'Меню',

  'window.controls': 'Управление окном',
  'window.minimize': 'Свернуть',
  'window.maximize': 'Развернуть',
  'window.restore': 'Восстановить',
  'window.close': 'Закрыть',

  'onboarding.title': 'Обучение',
  'onboarding.step': 'Шаг {current} из {total}',
  'onboarding.next': 'Далее',
  'onboarding.nextAnyway': 'Продолжить всё равно',
  'onboarding.back': 'Назад',
  'onboarding.skip': 'Пропустить',
  'onboarding.finish': 'Начать пользоваться',
  'onboarding.openPage': 'Сделать в приложении',
  'onboarding.minimize': 'Свернуть',
  'onboarding.enableStory': 'Включить Story Mode',
  'onboarding.replay': 'Пройти обучение снова',
  'onboarding.replayHint': 'Показать мастер первого запуска ещё раз.',
  'onboarding.verdict.ok': 'Отлично — можно идти дальше.',
  'onboarding.verdict.wait': 'Ждём, пока проверки ниже станут зелёными.',
  'onboarding.check.ok': 'Готово',
  'onboarding.check.waiting': 'Ждём…',
  'onboarding.check.pending': 'Ещё не сделано',
  'onboarding.check.checking': 'Проверяем…',
  'onboarding.check.moza': 'База MOZA',
  'onboarding.check.mozaWait': 'Подключи R5 по USB',
  'onboarding.check.story': 'Интеграция Story Mode',
  'onboarding.check.gameFolder': 'Папка GTA V Enhanced',
  'onboarding.check.gameFolderWait': 'Укажи папку игры в Настройках',
  'onboarding.check.hooks': 'Script Hook + SHVDN',
  'onboarding.check.hooksWait': 'Установи Script Hook V и ScriptHookVDotNet',
  'onboarding.check.plugin': 'Плагин GTAMOZA',
  'onboarding.check.pluginWait': 'Включи Story Mode — плагин поставится сам',
  'onboarding.check.pedals': 'Калибровка педалей',
  'onboarding.check.pedalsWait': 'Откалибруй газ и тормоз на Обзоре',
  'onboarding.check.throttle': 'Газ 100%',
  'onboarding.check.brake': 'Тормоз 100%',
  'onboarding.check.clutch': 'Сцепление 100%',
  'onboarding.check.calWait': 'Выжми до конца и нажми Запомнить',
  'onboarding.check.clutchOptional': 'Необязательно — можно пропустить',
  'onboarding.check.currentMode': 'Текущий режим GTA',
  'onboarding.check.onlineAck': 'Предупреждение про Online',
  'onboarding.check.onlineAckWait': 'Отметь галочку ниже',
  'onboarding.check.gameLink': 'Телеметрия из игры',
  'onboarding.check.gameLinkWait': 'Запусти Story Mode и сядь в машину',
  'onboarding.welcome.title': 'Добро пожаловать в GTA Moza Drive',
  'onboarding.welcome.body':
    'Иди по шагам справа. Проверки зеленеют, когда всё сделано — приложением можно пользоваться, гид останется открытым.',
  'onboarding.moza.title': 'Подключи базу',
  'onboarding.moza.body':
    'Вставь R5 по USB. Угол руля при желании выставь в Pit House — GTAMOZA подхватит. Проверка ниже станет зелёной, когда база будет видна.',
  'onboarding.gta.title': 'Включи Story Mode',
  'onboarding.gta.body':
    'Укажи папку игры и включи Story Mode. GTA Moza Drive сам скачает Script Hook + SHVDN и поставит плагин.',
  'onboarding.pedals.title': 'Откалибруй педали',
  'onboarding.pedals.body':
    'Открой Обзор, запусти калибровку, выжми каждую педаль до 100% и нажми Запомнить. Газ и тормоз обязательны, сцепление — по желанию.',
  'onboarding.online.title': 'Перед GTA Online',
  'onboarding.online.body':
    'Всегда жми «Подготовить к Online» в Настройках перед заходом в Online. Моды Story Mode для Online небезопасны.',
  'onboarding.online.ackLabel':
    'Понятно — перед GTA Online я нажму «Подготовить к Online».',
  'onboarding.done.title': 'Готово',
  'onboarding.done.body':
    'Запускай Story Mode, садись в машину и езжай. Серые пункты можно добить позже на Обзоре или в Настройках.',

  'cheats.kicker': 'Сюжет',
  'cheats.title': 'Читы',
  'cheats.desc':
    'Опциональные помощники только для Story Mode. По умолчанию выключены — не для Online.',
  'cheats.master': 'Главный выключатель',
  'cheats.masterLabel': 'Включить читы',
  'cheats.masterHint': 'Пока выключено, горячие клавиши читов в игре не работают.',
  'cheats.features': 'Функции и клавиши',
  'cheats.god': 'Бессмертие',
  'cheats.godHint': 'Неуязвимость, пока режим включён клавишей.',
  'cheats.police': 'Отключить полицию',
  'cheats.policeHint': 'Розыск сбрасывается, копы игнорируют.',
  'cheats.spawn': 'Случайная машина',
  'cheats.spawnHint': 'Спавн случайного авто и посадка за руль.',
  'cheats.pressKey': 'Нажмите клавишу…',
  'cheats.saved': 'Читы обновлены',

  'common.save': 'Сохранить',
  'common.cancel': 'Отмена',
  'common.confirm': 'Подтвердить',
  'common.delete': 'Удалить',
  'common.create': 'Создать',
  'common.rename': 'Переименовать',
  'common.reset': 'Сбросить',
  'common.active': 'Активен',
  'common.connected': 'Подключено',
  'common.disconnected': 'Отключено',
  'common.loading': 'Загрузка GTA Moza Drive…',
  'common.profileSaved': 'Профиль сохранён',
  'common.strength': 'Сила',
  'common.strengthDesc':
    'Насколько сильно эффект отдаётся в руль. 0 ≈ почти не чувствуется; выше — заметнее. Полностью выключить — тумблером справа.',
  'common.name': 'Имя',
  'common.enabled': 'Включено',
  'common.disabled': 'Выключено',

  'dashboard.title': 'Обзор',
  'dashboard.kicker': 'Связка',
  'dashboard.desc':
    'Живой руль и педали с базы MOZA. Педали калибруй здесь — ощущение руля остаётся в Pit House.',
  'dashboard.linkMoza': 'База MOZA',
  'dashboard.linkMozaOn': 'Подключена',
  'dashboard.linkMozaOff': 'Нет связи',
  'dashboard.linkGta': 'GTA Story Mode',
  'dashboard.linkGtaOn': 'Подключена',
  'dashboard.linkGtaOff': 'Нет связи',
  'dashboard.linkGtaPluginMissing':
    'GTA запущена, но плагин не загрузился. Закрой игру и жми в Настройках «Запуск Story Mode (без BattlEye)». На Steam/Epic/Rockstar для модов BattlEye должен быть выключен.',
  'dashboard.waitBadge': 'Запусти Story Mode — перед этим включи GTAMOZA в Настройках.',
  'dashboard.hardwareReady':
    'База MOZA найдена. Крути руль и жми педали — проверь живой ввод.',
  'dashboard.hardwareMissing':
    'Подключи R5 по USB. Если база занята — перезапусти GTAMOZA после Pit House.',
  'dashboard.mode': 'Режим',
  'dashboard.storyMode': 'Story Mode',
  'dashboard.vehicle': 'Машина',
  'dashboard.model': 'Модель',
  'dashboard.wheelAngle': 'Угол руля (с базы)',
  'dashboard.serial': 'Pit House',
  'dashboard.serialOpen': 'Связь есть',
  'dashboard.serialBusy': 'Нет связи',
  'dashboard.serialClosed': 'Ожидание',
  'dashboard.session': 'Сессия',
  'dashboard.liveInputs': 'Руль и педали',
  'dashboard.liveInputsHint':
    'Шкалы показывают живой ввод. Калибруй педали, чтобы 100% совпали с твоим ходом для GTA.',
  'dashboard.calibratePedals': 'Калибровка педалей',
  'dashboard.calPressThrottle':
    'Выжми ГАЗ до нужной глубины (это станет 100%), затем «Запомнить 100%».',
  'dashboard.calPressBrake':
    'Выжми ТОРМОЗ до нужной глубины, затем «Запомнить 100%».',
  'dashboard.calPressClutch':
    'Выжми СЦЕПЛЕНИЕ до нужной глубины, затем «Запомнить 100%». Не нужно — пропусти.',
  'dashboard.calRemember': 'Запомнить 100%',
  'dashboard.calSkipClutch': 'Пропустить сцепление',
  'dashboard.calDone': 'Диапазоны педалей сохранены. Шкалы используют твои 100%.',
  'dashboard.calDoneSkipClutch': 'Газ/тормоз сохранены. Сцепление пропущено.',
  'dashboard.calNotPressed': 'Нажми глубже и удерживай, потом снова «Запомнить».',
  'dashboard.calFailed': 'Не удалось зафиксировать педаль. Попробуй ещё раз.',
  'dashboard.throttle': 'Газ',
  'dashboard.brake': 'Тормоз',
  'dashboard.clutch': 'Сцепление',
  'dashboard.profile': 'Профиль',
  'dashboard.steering': 'Угол руля',
  'dashboard.ffb': 'Игровой FFB',
  'dashboard.paddlesTitle': 'Поворотники (лепестки)',
  'dashboard.paddlesSubtitle':
    'В Pit House лепестки = Buttons. Жми по разу — toast покажет Button N. Первые две кнопки = левый/правый.',
  'dashboard.paddlesWaiting': 'Жду нажатие кнопки лепестка…',
  'dashboard.paddlesReset': 'Обучение сброшено — нажми левый, потом правый',
  'dashboard.paddlesResetBtn': 'Сбросить обучение',
  'dashboard.paddleLeft': 'Левый',
  'dashboard.paddleRight': 'Правый',
  'dashboard.paddlesLearned': 'Заученные кнопки: L={left} · R={right}',

  'steering.title': 'Руль',
  'steering.kicker': 'В GTA',
  'steering.desc':
    'Как руль крутит машину в GTA. Физический угол и soft lock настраиваются в Pit House — меняй их там.',
  'steering.feelTitle': 'Ощущение обода (FFB GTAMOZA)',
  'steering.feelSubtitle':
    'Вес и возврат руля от GTAMOZA. В Pit House поставь Wheel Spring на 0%, чтобы пружины не дрались.',
  'steering.gtaMapTitle': 'Маппинг в GTA',
  'steering.gtaMapSubtitle':
    'Только как машина поворачивает в игре. Не меняет момент базы и damper/friction из Pit House.',
  'steering.sensitivity': 'Чувствительность',
  'steering.sensitivityDesc':
    'Насколько быстро машина отвечает на маленькие движения руля. Выше — острее вход в поворот. Ниже — спокойнее на прямых и трассе.',
  'steering.linearity': 'Линейность',
  'steering.linearityDesc':
    'Ощущение у центра. Ниже — мягче первые градусы (проще держать прямую). Выше — ближе к «один в один» с ободом.',
  'steering.deadzone': 'Мёртвая зона',
  'steering.deadzoneDesc':
    'Игнорирует крошечные движения у нуля. Чуть подними, если машина «плывёт», когда руль стоит. Для точности держи низкой.',
  'steering.saturation': 'Насыщение',
  'steering.saturationDesc':
    'Как рано полный физический угол даёт полный поворот в GTA. Ниже — упираешься в игровой lock раньше, меньшим ходом руля.',
  'steering.centerOffset': 'Смещение центра',
  'steering.centerOffsetDesc':
    'Сдвигает «прямо», если обод в покое стоит на пару градусов мимо центра. Только для калибровки, не для «ощущения».',

  'sync.refresh': 'Подтянуть из Pit House',
  'sync.refreshed': 'Угол из Pit House: {angle}°',
  'sync.steeringFromBase':
    'Угол из Pit House: {angle}°. Меняй там — GTAMOZA подхватывает (Pit House закрывать не нужно).',
  'sync.comBusy':
    'Не удалось прочитать настройки. Держи Pit House открытым для живого синка, либо один раз закрой для COM-fallback.',
  'sync.waitBase':
    'Ждём Pit House… Открой Pit House с подключённой базой и нажми «Подтянуть».',

  'ffb.enabled': 'Игровой FFB включён',
  'ffb.enabledDesc':
    'Включает или выключает отдачу GTAMOZA. База работает и без этого, но дорога / бордюр / удары из GTA пропадут.',
  'ffb.overall': 'Общая сила',
  'ffb.overallDesc':
    'Общая громкость всех игровых сил (дорога, бордюр, ямы, аварии). Подними, если всё слабо; опусти, если руль слишком «шумный».',
  'ffb.centering': 'Самовыравнивание (SAT)',
  'ffb.centeringDesc':
    'Возврат в центр на ходу (как SAT шин). Выше — сильнее тянет к прямой. Если руль рвёт в поворот — крути это вниз, не «Дорогу». Wheel Spring в Pit House = 0%.',
  'ffb.damping': 'Демпфирование',
  'ffb.dampingDesc':
    'Стабилизирует обод и гасит дрожь / осцилляции. Выше — тяжелее и спокойнее (удобно на торможении). Слишком высоко — руль «ватный» и медленный.',
  'ffb.friction': 'Трение',
  'ffb.frictionDesc':
    'Постоянное сопротивление при вращении — «механический» вес. Немного добавляет тяжести; слишком много — липкий медленный поворот.',
  'ffb.inertia': 'Инерция',
  'ffb.inertiaDesc':
    'Масса колонки: сопротивляется резким рывкам и смене направления. Выше — тяжелее и «собраннее». Слишком высоко — обод вялый.',
  'ffb.smoothing': 'Сглаживание',
  'ffb.smoothingDesc':
    'Смягчает резкие пики игровых эффектов. Выше — ровнее, но меньше деталей. Держи умеренно, чтобы асфальт и бордюр читались.',

  'effects.title': 'Эффекты',
  'effects.kicker': 'Ощущение GTA',
  'effects.desc':
    'Что ты чувствуешь от дороги и событий в GTA. Вес базы и пружина — на вкладке «Руль» и в Pit House.',
  'effects.surfacesTitle': 'Поверхности и события',
  'effects.surfacesSubtitle':
    'Каждый ползунок — одно ощущение из телеметрии GTA. Выключи то, что не нужно на руле.',
  'effects.road': 'Дорога',
  'effects.roadDesc':
    'Мелкое зерно асфальта / микродрожь на обычной дороге. Если на прямой руль дёргается — сначала опусти это (часто до 10–20).',
  'effects.kerb': 'Бордюр',
  'effects.kerbDesc':
    'Жёсткий гул и удары на бордюрах и тротуаре. Подними, чтобы бордюр читался; держи выше «Дороги», чтобы асфальт оставался спокойным.',
  'effects.grass': 'Трава',
  'effects.grassDesc':
    'Мягкая «вязкая» тряска вне асфальта (трава, грунт, песок). Чтобы съезд с дороги был заметен, но не жёстким.',
  'effects.suspension': 'Подвеска',
  'effects.suspensionDesc':
    'Ямы, кочки и ход кузова в обод. Не тянет руль влево/вправо в поворот — возврат в центр это «Самовыравнивание (SAT)».',
  'effects.wheelSlip': 'Пробуксовка',
  'effects.wheelSlipDesc':
    'Текстура, когда шины срываются (пробуксовка / занос). Выше — для дрифта; ниже, если руль трещит при нормальном сцеплении.',
  'effects.abs': 'ABS',
  'effects.absDesc':
    'Пульсация при жёстком торможении, когда срабатывает ABS. Держи низко, если не нужна явная подсказка на руле.',
  'effects.collision': 'Столкновение',
  'effects.collisionDesc':
    'Резкие удары от аварий и жёстких контактов. Подними для «ударных» thrash; если лёгкие касания дёргают вбок — опусти.',
  'effects.engine': 'Двигатель',
  'effects.engineDesc':
    'Лёгкий buzz от оборотов / газа. Обычно держи низко — на высоких значениях прямая кажется нервной.',
  'profiles.title': 'Профили',
  'profiles.kicker': 'Пресеты',
  'profiles.desc': 'Сохранённый маппинг и эффекты GTA под разные машины.',
  'profiles.saveChanges': 'Сохранить',
  'profiles.create': 'Создать',
  'profiles.createTitle': 'Создать профиль',
  'profiles.renameTitle': 'Переименовать профиль',
  'profiles.deleteTitle': 'Удалить профиль',
  'profiles.deleteBody': 'Удалить «{name}»? Это нельзя отменить.',
  'profiles.newName': 'Новый профиль',
  'profiles.created': 'Профиль создан',
  'profiles.renamed': 'Профиль переименован',
  'profiles.deleted': 'Профиль удалён',
  'profiles.reset': 'Профиль сброшен',
  'profiles.restoreBackup': 'Восстановить заводской бэкап',
  'profiles.restoreBackupDesc':
    'Вернуть все профили и настройки педалей/читов из зафиксированного идеального бэкапа.',
  'profiles.restoreBackupDone': 'Заводской бэкап восстановлен',
  'profiles.restoreBackupFail': 'Файл бэкапа не найден',

  'settings.title': 'Настройки',
  'settings.kicker': 'Приложение',
  'settings.desc': 'Внешний вид, поведение и обновления самого GTAMOZA.',
  'settings.appearance': 'Внешний вид',
  'settings.theme': 'Тема',
  'settings.themeHint': 'Тёмная, светлая или как в Windows.',
  'settings.theme.dark': 'Тёмная',
  'settings.theme.light': 'Светлая',
  'settings.theme.system': 'Системная',
  'settings.themeUpdated': 'Тема обновлена',
  'settings.general': 'Общие',
  'settings.language': 'Язык',
  'settings.languageHint': 'Язык интерфейса. Применяется сразу.',
  'settings.languageUpdated': 'Язык обновлён',
  'settings.startWithWindows': 'Запуск с Windows',
  'settings.startWithWindowsHint': 'Стартовать GTAMOZA при входе.',
  'settings.minimizeToTray': 'Сворачивать в трей',
  'settings.minimizeToTrayHint': 'Оставлять в трее вместо закрытия.',
  'settings.updates': 'Обновления',
  'settings.currentVersion': 'Текущая версия',
  'settings.autoUpdates': 'Проверять обновления автоматически',
  'settings.autoUpdatesHint':
    'Тихая проверка через несколько секунд после запуска. Скачивание только с вашего согласия.',
  'settings.updateChannel': 'Канал обновлений',
  'settings.updateChannelHint': 'Stable — основной. Beta зарезервирован на будущее.',
  'settings.channel.stable': 'Stable',
  'settings.channel.beta': 'Beta',
  'settings.checkUpdates': 'Проверить обновления',
  'settings.download': 'Скачать {version}',
  'settings.restartInstall': 'Перезапустить и установить',
  'settings.openReleases': 'Открыть GitHub Releases',
  'settings.repository': 'Репозиторий: {owner}/{repo}',
  'settings.update.idle': 'Готово к проверке обновлений.',
  'settings.update.checking': 'Проверка обновлений…',
  'settings.update.available': 'Доступно обновление {version}.',
  'settings.update.notAvailable': 'У вас последняя версия ({version}).',
  'settings.update.downloading': 'Загрузка… {percent}%',
  'settings.update.ready': 'Обновление {version} скачано. Перезапустите для установки.',
  'settings.update.unsupportedDev': 'Автообновление недоступно в dev-сборке.',
  'settings.update.unsupportedPortable': 'Автообновление недоступно в portable-сборке.',
  'settings.update.error': 'Ошибка обновления: {code}',

  'settings.gta': 'GTA V Enhanced',
  'settings.gtaDesc':
    'Включение и парковка интеграции Story Mode. Перед Online отключи — файлы игры не ломаются.',
  'settings.gta.path': 'Папка игры',
  'settings.gta.pathHint': 'Папка с GTA5_Enhanced.exe',
  'settings.gta.browse': 'Обзор…',
  'settings.gta.refresh': 'Обновить статус',
  'settings.gta.modeStory': 'Одиночная игра',
  'settings.gta.modeStoryHint':
    'Включает поддержку руля в Story Mode. BattlEye должен быть выключен, иначе блокируется dinput8 (ASI loader).',
  'settings.gta.store': 'Магазин: {store}',
  'settings.gta.store.steam': 'Steam',
  'settings.gta.store.epic': 'Epic Games',
  'settings.gta.store.rockstar': 'Rockstar Launcher',
  'settings.gta.store.unknown': 'Не определён',
  'settings.gta.launchStory': 'Запуск Story Mode (без BattlEye)',
  'settings.gta.launchStoryHint':
    'Steam: старт с -nobattleye. Epic: один раз пропиши -nobattleye в Launch Options, потом эта кнопка. Rockstar: сними Enable BattlEye в настройках лаунчера, потом эта кнопка.',
  'settings.gta.toastLaunched': 'Запуск Story Mode…',
  'settings.gta.toastLaunchedSteam': 'Запуск через Steam (−nobattleye)…',
  'settings.gta.toastLaunchedEpic':
    'Запуск через Epic. Если BattlEye снова режет dinput8 — добавь -nobattleye в Epic → Manage → Launch Options.',
  'settings.gta.toastLaunchedRockstar':
    'Запуск через Rockstar. Если режет dinput8 — сними Enable BattlEye в Настройки Rockstar → GTA V.',
  'settings.gta.toastLaunchRunning': 'GTA уже запущена — сначала полностью закрой её',
  'settings.gta.toastLaunchFailed': 'Не удалось запустить Story Mode: {error}',
  'settings.gta.modeOnline': 'GTA Online',
  'settings.gta.modeOnlineHint':
    'Отключает мод, чтобы Online был безопасен. Всегда жми перед заходом в Online.',
  'settings.gta.onlineReady': 'Безопасно',
  'settings.gta.onlineBlocked': 'Мод активен',
  'settings.gta.enable': 'Включить Story Mode',
  'settings.gta.disable': 'Подготовить к Online',
  'settings.gta.uninstall': 'Удалить из папки игры',
  'settings.gta.hotReload': 'Обновить плагин (без рестарта)',
  'settings.gta.hotReloadHint':
    'Пересобирает GTAMOZA.dll и перезагружает скрипты в запущенной игре (F11). В GTA появится субтитр.',
  'settings.gta.hookHelp': 'Скачать Script Hook',
  'settings.gta.uninstallHint':
    'Удаляет GTAMOZA, Script Hook, SHVDN, оба ASI-лоадера (dinput8 + xinput1_4) и логи — папка игры остаётся чистой.',
  'settings.gta.ffbLogs': 'Открыть логи FFB-эффектов',
  'settings.gta.ffbLogsOpened': 'Папка логов FFB открыта',
  'settings.gta.state.enabled': 'Story Mode ВКЛ',
  'settings.gta.state.parked': 'Припарковано — Online безопасен',
  'settings.gta.state.ready': 'Готово',
  'settings.gta.state.missing-game': 'Папка игры не задана',
  'settings.gta.hint.enabled':
    'Интеграция Story Mode активна. Перед Online отключи.',
  'settings.gta.hint.parked': 'Хуки припаркованы. Включи снова для FFB в Story Mode.',
  'settings.gta.hint.ready': 'Script Hook найден. Нажми «Включить», чтобы зарегистрировать GTAMOZA.',
  'settings.gta.hint.nohooks':
    'Script Hook ещё не установлен. Нажми «Включить Story Mode» — GTA Moza Drive скачает и поставит всё сам.',
  'settings.gta.hint.missing': 'Укажи папку с GTA5_Enhanced.exe.',
  'settings.gta.onlineSafe': 'Безопасно для Online: {value}',
  'settings.gta.yes': 'да',
  'settings.gta.no': 'нет',
  'settings.gta.toastEnabled': 'Интеграция Story Mode включена',
  'settings.gta.toastDisabled': 'Интеграция припаркована — можно в Online',
  'settings.gta.toastUninstalled':
    'Папка игры очищена — GTAMOZA, Script Hook, SHVDN и оба ASI-лоадера удалены',
  'settings.gta.toastUninstallLocked':
    'Часть файлов занята — полностью закрой GTA и Rockstar Launcher, затем удали снова.',
  'settings.gta.toastHotReloaded':
    'Hot-reload выполнен — в GTA должен появиться субтитр GTAMOZA',
  'settings.gta.toastHotReloadManual':
    'Плагин скопирован. Переключись в GTA и нажми F11 — субтитр подтвердит reload',
  'settings.gta.toastHooksMissing':
    'Не удалось скачать Script Hook автоматически. Проверь интернет и попробуй снова, либо «Скачать Script Hook».',
  'settings.gta.toastDownloading': 'Скачиваем Script Hook + SHVDN…',
  'settings.gta.toastPluginMissing':
    'GTAMOZA.dll не собран. Сначала npm run build:gta-mod.',
  'settings.gta.toastInvalid': 'Это не папка GTA V Enhanced',
  'settings.gta.toastFailed': 'Не удалось изменить интеграцию: {error}',
  'settings.gta.warning':
    'Script Hook — только Story Mode. Если BattlEye заблокировал dinput8.dll: запуск с -nobattleye (кнопка выше) или сними галку BattlEye в Rockstar. Перед Online верни BattlEye / убери -nobattleye и жми «Подготовить к Online» здесь.',
  'dashboard.linkGtaBattlEye':
    'BattlEye заблокировал dinput8.dll — закрой GTA и запускай через Steam (−nobattleye) из Настроек.',
}

const catalogs: Record<AppLocale, Record<MessageKey, string>> = {
  en: en as Record<MessageKey, string>,
  ru,
}

export function translate(
  locale: AppLocale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const template = catalogs[locale]?.[key] ?? catalogs.en[key] ?? key
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`))
}

export const NAV_KEYS: Record<PageId, MessageKey> = {
  dashboard: 'nav.dashboard',
  steering: 'nav.steering',
  effects: 'nav.effects',
  profiles: 'nav.profiles',
  cheats: 'nav.cheats',
  settings: 'nav.settings',
}

export const EFFECT_KEYS: Record<EffectId, MessageKey> = {
  road: 'effects.road',
  kerb: 'effects.kerb',
  grass: 'effects.grass',
  suspension: 'effects.suspension',
  wheelSlip: 'effects.wheelSlip',
  abs: 'effects.abs',
  collision: 'effects.collision',
  engine: 'effects.engine',
}

export const EFFECT_DESC_KEYS: Record<EffectId, MessageKey> = {
  road: 'effects.roadDesc',
  kerb: 'effects.kerbDesc',
  grass: 'effects.grassDesc',
  suspension: 'effects.suspensionDesc',
  wheelSlip: 'effects.wheelSlipDesc',
  abs: 'effects.absDesc',
  collision: 'effects.collisionDesc',
  engine: 'effects.engineDesc',
}
