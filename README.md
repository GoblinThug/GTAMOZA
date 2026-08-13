<p align="center">
  <img src="build/icon.png" alt="GTA Moza Drive" width="120" />
</p>

<h1 align="center">GTA Moza Drive</h1>

<p align="center">
  <strong>Force feedback для баз MOZA в GTA V Enhanced Story Mode</strong><br />
  R3 / R5 / R9 / R12 / R16 · телеметрия · физика руля · профили
</p>

<p align="center">
  <a href="#-русский">Русский</a> · <a href="#-english">English</a>
</p>

<p align="center">
  <a href="https://github.com/GoblinThug/GTAMOZA/releases/latest"><img src="https://img.shields.io/github/v/release/GoblinThug/GTAMOZA?style=flat-square&label=release" alt="Release" /></a>
  <a href="https://github.com/GoblinThug/GTAMOZA/actions/workflows/release.yml"><img src="https://img.shields.io/github/actions/workflow/status/GoblinThug/GTAMOZA/release.yml?style=flat-square&label=build" alt="Build" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT" /></a>
  <img src="https://img.shields.io/badge/platform-Windows-0078D4?style=flat-square" alt="Windows" />
</p>

<p align="center">
  <a href="https://github.com/GoblinThug/GTAMOZA/releases/latest">⬇️ Скачать</a>
  &nbsp;·&nbsp;
  <a href="docs/USAGE.md">📖 Инструкция / User Guide</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/GoblinThug/GTAMOZA/issues">🐞 Issues</a>
  &nbsp;·&nbsp;
  <a href="CONTRIBUTING.md">🤝 Contributing</a>
</p>

---

# 🇷🇺 Русский

## ✨ Что это

**GTA Moza Drive (GTAMOZA)** — десктопное приложение для **баз MOZA** (R3, R5, R9, R12, R16 и др.): синтез force feedback по телеметрии GTA V Enhanced **Story Mode**, профили ощущений и установка плагина одной кнопкой.

У GTA нет настоящей шинной физики (как в iRacing / ACC). GTAMOZA строит **свой стек**: отслеживание машины в плагине → синтез эффектов в Electron → механическая колонка в DirectInput host.

| | Возможность |
|---|---|
| 📡 | Телеметрия v2: скорость, yaw, slip, поверхность, bump, collision, load |
| 🧲 | Физика руля: SAT-пружина + damp / friction / inertia + игровые эффекты |
| 🛞 | DirectInput host `gtamoza-ffb` → база **MOZA** (Exclusive) |
| 🧩 | Плагин `GTAMOZA.dll` (ScriptHookVDotNet) — ставится из приложения |
| 🚦 | Поворотники на лепестках (авто-обучение кнопок / ось сцепления) |
| 🛡️ | «Prepare for Online» — парковка хуков перед Online |
| 🎛️ | Профили: Default / Sports / Supercars / Drift / Offroad |
| 🎚️ | Эффекты: дорога, kerb, grass, подвеска, slip, ABS, collision, engine |
| ⌨️ | Чит-хоткеи Story Mode (опционально) |
| 🎨 | Тёмная / светлая / system тема, **ru** + **en** |
| ⬆️ | Автообновления с GitHub Releases (Setup) |

Текущая версия в репозитории: **`2.0.0`** (актуальный номер — всегда в [Releases](https://github.com/GoblinThug/GTAMOZA/releases)).

> ⚠️ **Только Story Mode.** Script Hook / ASI loader **нельзя** использовать в Online. Перед Online — кнопка **Prepare for Online** и отключение `-nobattleye` / BattlEye по правилам Rockstar.

---

## ⬇️ Скачать и установить

Готовые сборки: **[GitHub Releases →](https://github.com/GoblinThug/GTAMOZA/releases)**

### 🪟 Windows

| Файл | Когда брать |
|---|---|
| `GTAMOZA-Setup-….exe` | Обычная установка — **рекомендуется**, есть автообновление |
| `GTAMOZA-Portable-….exe` | Без установки; обновлять вручную с Releases |

1. Скачайте Setup или Portable.
2. Запустите файл.
3. Для Setup пройдите мастер и откройте **GTA Moza Drive** из меню «Пуск».

> ⚠️ Windows может показать **SmartScreen**. Если доверяете сборке с GitHub: **Подробнее** → **Выполнить в любом случае**.

macOS / Linux **не** поддерживаются (DirectInput + GTA Enhanced на Windows).

---

## 🚀 Быстрый старт

1. Установите **MOZA Pit House**, база MOZA подключена (R3 / R5 / R9 / …).
2. В Pit House: **Wheel Spring = 0%** (SAT делает приложение), Hands-Off Protection лучше Off.
3. Откройте **GTA Moza Drive** → укажите папку **GTA V Enhanced**.
4. Нажмите **Turn on Story Mode** (скачает/поставит Script Hook + `GTAMOZA.dll` при необходимости).
5. Запускайте игру через **Launch Story Mode** (Steam: `-nobattleye`) или свой ярлык с отключённым BattlEye.
6. Включите FFB в приложении, сядьте в машину — руль должен ожить.

Hot-reload плагина в игре: **F11** (появится субтитр `GTAMOZA Hot-reload OK`).

Перед Online: **Prepare for Online** в приложении.

📖 **Полная инструкция** (Pit House, педали, профили, Online, troubleshooting): **[docs/USAGE.md](docs/USAGE.md)**.

---

## 📡 Системы отслеживания

Плагин `GTAMOZA.dll` каждый тик читает машину игрока и шлёт **телеметрию v2** на `127.0.0.1:29755` (JSON).

### Что отслеживается

| Канал | Откуда | Зачем для FFB / управления |
|---|---|---|
| **Скорость / RPM / передача** | Vehicle | Пороги «едет / стоит», сила эффектов |
| **Steer / throttle / brake / clutch** | UDP 29757 от приложения | Ввод с руля и педалей в игру |
| **accelFwd / accelLat** | Δvelocity в осях кузова | Нагрузка, удары, направление collision |
| **yawRate / pitchRate / rollRate** | LocalRotationVelocity | Поворот, lean, активность руления |
| **wheelSlip** | wheel speed vs body + yaw | Пробуксовка / потеря сцепления |
| **surface / surfL / surfR / matId** | материал под колёсами | Asphalt / kerb / grass / dirt — зерно дороги |
| **bump** | вертикальная Δ позиции | Ямы и неровности |
| **collision / colHard** | health + рывки accel | Удары и жёсткость контакта |
| **airborne / wheelsDown** | колёса в воздухе | Глушение текстуры в полёте |
| **tireHeat** | оценка прогрева | Лёгкая модуляция grip-текстуры |
| **vehicle** | display name | Класс feel (sport / offroad / default) |

### Потоки данных

```text
                    ┌─ UDP 29755 ── telemetry (plugin → app)
GTA Enhanced        │
  GTAMOZA.dll  ─────┼─ UDP 29757 ── controls  (app → plugin)
                    │                 steer / pedals / indL / indR
                    └─ file fallback  %TEMP%\gtamoza_controls.json

GTA Moza Drive ── UDP 29756 ── FFB cmd ──► gtamoza-ffb.exe
                 UDP 29758 ── axis+paddles ◄── (Exclusive DI)
```

| Порт | Направление | Содержимое |
|---|---|---|
| **29755** | plugin → app | Телеметрия v2 |
| **29756** | app → host | `magnitude`, `center`, `damp`, `friction`, `inertia` |
| **29757** | app → plugin | Руль, педали, поворотники |
| **29758** | host → app | Steer + оси/кнопки лепестков (когда HID занят Exclusive) |

### Управление и поворотники

- Руль / педали идут в плагин непрерывно; угол руля согласуется с Pit House.
- **Лепестки → поворотники:** при Exclusive DI ось/кнопки читает `gtamoza-ffb` и отдаёт в приложение.
  - Режим **Button** (часто на MOZA): первое нажатие левого лепестка запоминается как «лево», правого — как «право».
  - Режим **Combined / Independent axis**: отклонение оси сцепления.
- В игре индикаторы включаются через `SET_VEHICLE_INDICATOR_LIGHTS` каждый кадр — мигание как у NPC.

---

## 🧲 Система физики FFB

GTA не отдаёт aligning torque шин. Стек GTAMOZA имитирует ощущение в духе симов: **одна пружина возврата** + **механическая колонка** + **игровые эффекты без DC-тяги в поворот**.

### Слои (снизу вверх)

```text
┌─────────────────────────────────────────────────────────┐
│  Игровые эффекты (Electron)                             │
│  дорога · kerb · grass · bump · slip · ABS · collision  │
│  · engine — AC-текстура / импульсы, без ±steer SAT      │
├─────────────────────────────────────────────────────────┤
│  Команда center / damp / friction / inertia             │
│  (нагрузка от скорости, тормоза, slip — мягко)          │
├─────────────────────────────────────────────────────────┤
│  gtamoza-ffb — механическая колонка (DirectInput CF)    │
│  spring(−norm) + damper + friction + inertia            │
│  ForcePolarity для эффектов · CenterPolarity для пружины│
└─────────────────────────────────────────────────────────┘
```

| Слой | Что делает | Ползунок в приложении |
|---|---|---|
| **SAT / center** | Возврат в центр на скорости (host spring) | Самовыравнивание |
| **Damping** | Стабильность, вес под тормозом (плавно) | Демпфирование |
| **Friction / Inertia** | «Тяжесть» обода, сопротивление рывкам | Трение / Инерция |
| **Road / Kerb / Grass** | Зерно поверхности (на асфальте тихо) | Эффекты → Дорога / … |
| **Suspension** | Ямы / heave (не тяга в поворот) | Подвеска |
| **Wheel slip / ABS** | Потеря сцепления, пульс ABS | Пробуксовка / ABS |
| **Collision** | Удары; мягкие ложные на прямой под тормозом глушатся | Столкновение |
| **Engine** | Лёгкий buzz под нагрузкой | Двигатель |
| **Overall / Smoothing** | Мастер-гейн и сглаживание пиков | Общая сила / Сглаживание |

### Принципы настройки (заводской профиль)

- **Pit House Wheel Spring = 0%** — иначе две пружины дерутся.
- Возврат в центр — **только** Self-aligning torque (host), не игровой ±steer.
- Асфальт спокойный; бордюр и удары читаются поверх.
- Торможение утяжеляет колонку **плавно** (damp/slew), без бокового рывка.
- Заводские дефолты в приложении — **референс**; под себя крутите слайдеры в UI, не обязательно править исходники.

### Полярность

При старте host калибрует **ForcePolarity** (эффекты) и **CenterPolarity** (пружина `−norm`), чтобы возврат шёл к центру, а текстуры не усиливали поворот «в замок».

---

## 📚 Как это устроено (кратко)

```text
GTA Enhanced  →  GTAMOZA.dll (UDP 29755 telemetry)
                      ↓
              GTA Moza Drive (tracking → physics synth)
                      ↓ UDP 29756
              gtamoza-ffb.exe  →  MOZA base (DirectInput Exclusive)
                      ↓ UDP 29758
              axis / paddles  →  app (steer + indicators)
```

- Плагин и `gtamoza-ffb` **внутри** установщика (`extraResources`).
- При Enable приложение копирует `GTAMOZA.dll` в `…/Grand Theft Auto V Enhanced/scripts/`.

---

## 🛠️ Разработка

Нужны **Node.js 22+**, npm и **.NET SDK 8+**.

```bash
git clone https://github.com/GoblinThug/GTAMOZA.git
cd GTAMOZA
npm install
npm run fetch:shvdn    # ScriptHookVDotNet3.dll → libs/ (если нет игры)
npm run build:native   # GTAMOZA.dll + gtamoza-ffb.exe
npm run dev
```

Сборка установщика:

```bash
npm run dist:win
# → release/GTAMOZA-Setup-*.exe , GTAMOZA-Portable-*.exe
```

### Структура

| Путь | Назначение |
|---|---|
| `src/` | React UI |
| `electron/` | Main / preload, телеметрия, синтез FFB, хуки |
| `gta-mod/` | Плагин SHVDN (`GTAMOZA.dll`) — отслеживание + ввод |
| `tools/ffb-host/` | DirectInput FFB host + axis/paddle feed |
| `shared/` | Типы и заводские дефолты профилей |
| `build/` | Иконки |
| `.github/workflows/` | Автосборка и релизы |

### Релизы (CI)

Пуш в `main` или тег `v*` → GitHub Actions собирает native + Electron и публикует Release.  
Вручную: **Actions → Release → Run workflow**.

Подробнее: [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 🔐 Безопасность

Сообщения об уязвимостях — **не** в публичные Issues. См. [SECURITY.md](SECURITY.md).

---

## 📄 Лицензия

[MIT](LICENSE) · русский перевод: [LICENSE.ru](LICENSE.ru)

---
---

# 🇬🇧 English

## ✨ What it is

**GTA Moza Drive (GTAMOZA)** is a desktop app for **MOZA wheel bases** (R3, R5, R9, R12, R16, and others): force-feedback synthesis from **GTA V Enhanced Story Mode** telemetry, feel profiles, and one-click plugin install.

GTA has no real tire model (unlike iRacing / ACC). GTAMOZA builds its **own stack**: vehicle tracking in the plugin → effect synthesis in Electron → mechanical column in the DirectInput host.

| | Feature |
|---|---|
| 📡 | Telemetry v2: speed, yaw, slip, surface, bump, collision, load |
| 🧲 | Wheel physics: SAT spring + damp / friction / inertia + game effects |
| 🛞 | DirectInput host `gtamoza-ffb` → **MOZA** base (Exclusive) |
| 🧩 | `GTAMOZA.dll` plugin (ScriptHookVDotNet) installed from the app |
| 🚦 | Turn signals on paddles (button auto-learn / clutch axis) |
| 🛡️ | “Prepare for Online” — park hooks before Online |
| 🎛️ | Profiles: Default / Sports / Supercars / Drift / Offroad |
| 🎚️ | Effects: road, kerb, grass, suspension, slip, ABS, collision, engine |
| ⌨️ | Optional Story Mode cheat hotkeys |
| 🎨 | Dark / light / system theme, **en** + **ru** |
| ⬆️ | Auto-updates from GitHub Releases (Setup) |

Repo version: **`2.0.0`** (always check [Releases](https://github.com/GoblinThug/GTAMOZA/releases) for the latest).

> ⚠️ **Story Mode only.** Do **not** use Script Hook / ASI loaders in Online. Use **Prepare for Online** and restore BattlEye / remove `-nobattleye` before going Online.

---

## ⬇️ Download & install

Builds: **[GitHub Releases →](https://github.com/GoblinThug/GTAMOZA/releases)**

### 🪟 Windows

| File | When to use |
|---|---|
| `GTAMOZA-Setup-….exe` | Normal install — **recommended**, auto-update |
| `GTAMOZA-Portable-….exe` | No install; update manually from Releases |

1. Download Setup or Portable.
2. Run it.
3. For Setup, finish the wizard and open **GTA Moza Drive** from the Start menu.

> ⚠️ Windows may show **SmartScreen**. If you trust the GitHub build: **More info** → **Run anyway**.

macOS / Linux are **not** supported (DirectInput + GTA Enhanced on Windows).

---

## 🚀 Quick start

1. Install **MOZA Pit House**; MOZA base connected (R3 / R5 / R9 / …).
2. In Pit House: **Wheel Spring = 0%** (the app synthesizes SAT); Hands-Off Protection preferably Off.
3. Open **GTA Moza Drive** → set the **GTA V Enhanced** folder.
4. Click **Turn on Story Mode** (downloads/installs Script Hook + `GTAMOZA.dll` as needed).
5. Launch via **Launch Story Mode** (Steam: `-nobattleye`) or your own BattlEye-off shortcut.
6. Enable FFB in the app, get in a vehicle — the rim should come alive.

In-game plugin hot-reload: **F11** (subtitle `GTAMOZA Hot-reload OK`).

Before Online: **Prepare for Online** in the app.

📖 **Full user guide**: **[docs/USAGE.md](docs/USAGE.md)**.

---

## 📡 Tracking systems

`GTAMOZA.dll` samples the player vehicle every tick and sends **telemetry v2** to `127.0.0.1:29755` (JSON).

### What is tracked

| Channel | Source | Used for |
|---|---|---|
| **Speed / RPM / gear** | Vehicle | Motion gates, effect scaling |
| **Steer / throttle / brake / clutch** | UDP 29757 from the app | Wheel & pedal injection |
| **accelFwd / accelLat** | Body-frame Δvelocity | Load, impacts, collision direction |
| **yawRate / pitchRate / rollRate** | LocalRotationVelocity | Turn activity, lean |
| **wheelSlip** | Wheel vs body speed + yaw | Slip texture |
| **surface / surfL / surfR / matId** | Wheel materials | Asphalt / kerb / grass / dirt grain |
| **bump** | Vertical Δ position | Potholes / heave |
| **collision / colHard** | Health + accel jolts | Impacts and hardness |
| **airborne / wheelsDown** | Contact count | Mute textures in air |
| **tireHeat** | Heat estimate | Light grip-texture modulation |
| **vehicle** | Display name | Sport / offroad / default feel |

### Data paths

```text
                    ┌─ UDP 29755 ── telemetry (plugin → app)
GTA Enhanced        │
  GTAMOZA.dll  ─────┼─ UDP 29757 ── controls  (app → plugin)
                    │                 steer / pedals / indL / indR
                    └─ file fallback  %TEMP%\gtamoza_controls.json

GTA Moza Drive ── UDP 29756 ── FFB cmd ──► gtamoza-ffb.exe
                 UDP 29758 ── axis+paddles ◄── (Exclusive DI)
```

| Port | Direction | Payload |
|---|---|---|
| **29755** | plugin → app | Telemetry v2 |
| **29756** | app → host | `magnitude`, `center`, `damp`, `friction`, `inertia` |
| **29757** | app → plugin | Steering, pedals, indicators |
| **29758** | host → app | Steer + paddle axes/buttons (when HID is Exclusive-blocked) |

### Controls & indicators

- Steering / pedals stream continuously; wheel angle follows Pit House.
- **Paddles → turn signals:** under Exclusive DI, `gtamoza-ffb` reads axes/buttons and feeds the app.
  - **Button** mode (common on MOZA): first left-paddle press learns “left”, first right learns “right”.
  - **Combined / Independent axis**: clutch-paddle travel.
- In-game blinkers use `SET_VEHICLE_INDICATOR_LIGHTS` every frame — NPC-style flash.

---

## 🧲 FFB physics system

GTA does not expose tire aligning torque. GTAMOZA approximates a sim-like feel: **one return spring** + **mechanical column** + **game effects without DC pull into the turn**.

### Layers (bottom → top)

```text
┌─────────────────────────────────────────────────────────┐
│  Game effects (Electron)                                │
│  road · kerb · grass · bump · slip · ABS · collision    │
│  · engine — AC texture / impulses, no ±steer SAT        │
├─────────────────────────────────────────────────────────┤
│  center / damp / friction / inertia command             │
│  (load from speed, brake, slip — smoothed)              │
├─────────────────────────────────────────────────────────┤
│  gtamoza-ffb — mechanical column (DirectInput CF)       │
│  spring(−norm) + damper + friction + inertia            │
│  ForcePolarity for effects · CenterPolarity for spring  │
└─────────────────────────────────────────────────────────┘
```

| Layer | Role | App slider |
|---|---|---|
| **SAT / center** | Speed-aware return-to-center (host spring) | Self-aligning torque |
| **Damping** | Stability; gentle brake weight | Damping |
| **Friction / Inertia** | Rim weight, anti-flick | Friction / Inertia |
| **Road / Kerb / Grass** | Surface grain (quiet on asphalt) | Effects → Road / … |
| **Suspension** | Bumps / heave (not steer pull) | Suspension |
| **Wheel slip / ABS** | Grip loss, ABS pulse | Wheel slip / ABS |
| **Collision** | Impacts; soft false hits under brake muted | Collision |
| **Engine** | Light buzz under load | Engine |
| **Overall / Smoothing** | Master gain & spike softener | Overall / Smoothing |

### Tuning principles (factory profile)

- **Pit House Wheel Spring = 0%** — otherwise two springs fight.
- Return-to-center is **only** Self-aligning torque (host), never game-layer ±steer.
- Calm asphalt; kerb and impacts read above it.
- Braking adds column weight **smoothly** (damp/slew), without a side yank.
- Factory defaults in the app are the **reference**; tweak sliders in the UI as you like.

### Polarity

At startup the host calibrates **ForcePolarity** (effects) and **CenterPolarity** (spring `−norm`) so recentering works and textures do not yank into the lock.

---

## 📚 How it works (short)

```text
GTA Enhanced  →  GTAMOZA.dll (UDP 29755 telemetry)
                      ↓
              GTA Moza Drive (tracking → physics synth)
                      ↓ UDP 29756
              gtamoza-ffb.exe  →  MOZA base (DirectInput Exclusive)
                      ↓ UDP 29758
              axis / paddles  →  app (steer + indicators)
```

- Plugin and `gtamoza-ffb` ship inside the installer (`extraResources`).
- On Enable, the app copies `GTAMOZA.dll` into `…/Grand Theft Auto V Enhanced/scripts/`.

---

## 🛠️ Development

Requires **Node.js 22+**, npm, and **.NET SDK 8+**.

```bash
git clone https://github.com/GoblinThug/GTAMOZA.git
cd GTAMOZA
npm install
npm run fetch:shvdn
npm run build:native
npm run dev
```

Installer:

```bash
npm run dist:win
```

### Layout

| Path | Purpose |
|---|---|
| `src/` | React UI |
| `electron/` | Main / preload, telemetry, FFB synth, hooks |
| `gta-mod/` | SHVDN plugin — tracking + input |
| `tools/ffb-host/` | DirectInput FFB host + axis/paddle feed |
| `shared/` | Types & factory profile defaults |
| `build/` | Icons |
| `.github/workflows/` | CI / releases |

### Releases (CI)

Push to `main` or a `v*` tag → GitHub Actions builds native + Electron and publishes a Release.  
Manual: **Actions → Release → Run workflow**.

More: [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 🔐 Security

Do **not** report vulnerabilities in public Issues. See [SECURITY.md](SECURITY.md).

---

## 📄 License

[MIT](LICENSE) · Russian translation: [LICENSE.ru](LICENSE.ru)
