<p align="center">
  <img src="build/icon.png" alt="GTA Moza Drive" width="120" />
</p>

<h1 align="center">GTA Moza Drive</h1>

<p align="center">
  <strong>Force feedback для баз MOZA в GTA V Enhanced Story Mode</strong><br />
  R3 / R5 / R9 / R12 / R16 · профили · эффекты · плагин
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

**GTA Moza Drive (GTAMOZA)** — десктопное приложение для **баз MOZA** (R3, R5, R9, R12, R16 и др.): синтез force feedback по телеметрии GTA V Enhanced **Story Mode**, профили ощущений и установка плагина одной кнопкой. Основной сценарий — экосистема MOZA; при отсутствии MOZA host может взять другое DirectInput FFB-устройство.

| | Возможность |
|---|---|
| 🎮 | FFB из телеметрии Story Mode (дорога, бордюр, slip, удары, SAT) |
| 🛞 | DirectInput host `gtamoza-ffb` → база **MOZA** (Exclusive; не только R5) |
| 🧩 | Плагин `GTAMOZA.dll` (ScriptHookVDotNet) — ставится из приложения |
| 🛡️ | «Prepare for Online» — парковка хуков перед Online |
| 🎛️ | Профили: Default / Sports / Supercars / Drift / Offroad |
| 🎚️ | Эффекты: дорога, kerb, grass, подвеска, slip, ABS, collision, engine |
| ⌨️ | Чит-хоткеи Story Mode (опционально) |
| 🎨 | Тёмная / светлая / system тема, **ru** + **en** |
| ⬆️ | Автообновления с GitHub Releases (Setup) |

Текущая версия в репозитории: **`1.0.0`** (актуальный номер — всегда в [Releases](https://github.com/GoblinThug/GTAMOZA/releases)).

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

## 📚 Как это устроено

```text
GTA Enhanced  →  GTAMOZA.dll (UDP 29755)
                      ↓
              GTA Moza Drive (синтез эффектов)
                      ↓ UDP 29756
              gtamoza-ffb.exe  →  MOZA base (DirectInput)
```

- Плагин и `gtamoza-ffb` **внутри** установщика (`extraResources`).
- При Enable приложение копирует `GTAMOZA.dll` в `…/Grand Theft Auto V Enhanced/scripts/`.
- Отдельный «мод-архив» в релизе не нужен.

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
| `electron/` | Main / preload, телеметрия, установка хуков, FFB |
| `gta-mod/` | Плагин SHVDN (`GTAMOZA.dll`) |
| `tools/ffb-host/` | DirectInput FFB host |
| `shared/` | Типы и дефолты профилей |
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

**GTA Moza Drive (GTAMOZA)** is a desktop app for **MOZA wheel bases** (R3, R5, R9, R12, R16, and others): force-feedback synthesis from **GTA V Enhanced Story Mode** telemetry, feel profiles, and one-click plugin install. Tuned for the MOZA ecosystem; if no MOZA base is found, the host may fall back to another DirectInput FFB device.

| | Feature |
|---|---|
| 🎮 | FFB from Story Mode telemetry (road, kerb, slip, impacts, SAT) |
| 🛞 | DirectInput host `gtamoza-ffb` → **MOZA** base (Exclusive; not R5-only) |
| 🧩 | `GTAMOZA.dll` plugin (ScriptHookVDotNet) installed from the app |
| 🛡️ | “Prepare for Online” — park hooks before Online |
| 🎛️ | Profiles: Default / Sports / Supercars / Drift / Offroad |
| 🎚️ | Effects: road, kerb, grass, suspension, slip, ABS, collision, engine |
| ⌨️ | Optional Story Mode cheat hotkeys |
| 🎨 | Dark / light / system theme, **en** + **ru** |
| ⬆️ | Auto-updates from GitHub Releases (Setup) |

Repo version: **`1.0.0`** (always check [Releases](https://github.com/GoblinThug/GTAMOZA/releases) for the latest).

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

📖 **Full user guide** (Pit House, pedals, profiles, Online, troubleshooting): **[docs/USAGE.md](docs/USAGE.md)**.

---

## 📚 How it works

```text
GTA Enhanced  →  GTAMOZA.dll (UDP 29755)
                      ↓
              GTA Moza Drive (effect synth)
                      ↓ UDP 29756
              gtamoza-ffb.exe  →  MOZA base (DirectInput)
```

- Plugin and `gtamoza-ffb` ship inside the installer (`extraResources`).
- On Enable, the app copies `GTAMOZA.dll` into `…/Grand Theft Auto V Enhanced/scripts/`.
- No separate “mod zip” is required on the Release.

---

## 🛠️ Development

Requires **Node.js 22+**, npm, and **.NET SDK 8+**.

```bash
git clone https://github.com/GoblinThug/GTAMOZA.git
cd GTAMOZA
npm install
npm run fetch:shvdn    # ScriptHookVDotNet3.dll → libs/ (if no game install)
npm run build:native   # GTAMOZA.dll + gtamoza-ffb.exe
npm run dev
```

Installer:

```bash
npm run dist:win
# → release/GTAMOZA-Setup-*.exe , GTAMOZA-Portable-*.exe
```

### Layout

| Path | Purpose |
|---|---|
| `src/` | React UI |
| `electron/` | Main / preload, telemetry, hook installer, FFB |
| `gta-mod/` | SHVDN plugin (`GTAMOZA.dll`) |
| `tools/ffb-host/` | DirectInput FFB host |
| `shared/` | Shared types & profile defaults |
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
