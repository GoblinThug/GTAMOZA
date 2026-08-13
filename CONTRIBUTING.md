# Contributing to GTA Moza Drive (GTAMOZA)

Русский · [English](#-english)

---

# 🇷🇺 Русский

Спасибо за интерес к проекту. Ниже — как быстро войти в разработку и оформить изменения.

## С чего начать

1. Найдите или создайте [Issue](https://github.com/GoblinThug/GTAMOZA/issues) с описанием бага или идеи.
2. Сделайте fork и ветку от `main` (например `fix/ffb-idle` или `feat/profile-export`).
3. Внесите изменения, проверьте локально, откройте Pull Request.

Небольшие правки (опечатки, README, стили) можно присылать сразу — отдельный issue не обязателен.

## Локальный запуск

Нужны **Node.js 22+**, npm и **.NET SDK 8+** (для `gtamoza-ffb` и `GTAMOZA.dll`).

```bash
git clone https://github.com/GoblinThug/GTAMOZA.git
cd GTAMOZA
npm install
# ScriptHookVDotNet3.dll: из папки GTA Enhanced или:
npm run fetch:shvdn
npm run build:native   # GTAMOZA.dll + gtamoza-ffb.exe
npm run dev
```

Сборка установщиков (Windows):

```bash
npm run dist:win       # → папка release/
```

Плагин `GTAMOZA.dll` кладётся в `extraResources` и при **Enable Story Mode** копируется приложением в `…/GTA V Enhanced/scripts/`. Отдельно заливать мод в релиз не нужно — он уже внутри установщика.

## Структура

| Путь | Назначение |
|---|---|
| `src/` | React UI |
| `electron/` | Main/preload, телеметрия, установка хуков, FFB |
| `gta-mod/` | Плагин SHVDN (`GTAMOZA.dll`) |
| `tools/ffb-host/` | DirectInput FFB host (`gtamoza-ffb.exe`) |
| `shared/` | Общие типы и дефолты профилей |
| `build/` | Иконки и ресурсы сборки |
| `docs/` | Инструкция для пользователей ([USAGE.md](docs/USAGE.md)) |
| `.github/workflows/` | CI / релизы |

## Что желательно соблюдать

- Не коммитьте секреты, `.env`, локальные `profiles.json` / логи FFB.
- Не публикуйте proprietary MOZA SDK (`vendor/moza-sdk/`).
- Держите PR сфокусированным: одна задача — один PR.
- UI-строки добавляйте в `src/i18n/messages.ts` (**en** и **ru**).
- Для багов приложите ОС, версию приложения, версию GTA Enhanced и шаги воспроизведения.
- Для UI — скриншот «до/после», если уместно.
- Помните: хуки только для **Story Mode**; Online — через «Prepare for Online».

## Релизы

Пуш в `main` или тег `v*` запускает GitHub Actions: сборка native + Electron и публикация GitHub Release. Вручную: **Actions → Release → Run workflow**.

## Безопасность

Уязвимости **не** публикуйте в обычных Issues. См. [SECURITY.md](SECURITY.md).

## Лицензия

Внося вклад, вы соглашаетесь, что ваш код распространяется под [MIT](LICENSE) (русский перевод: [LICENSE.ru](LICENSE.ru)).

---

# 🇬🇧 English

Thanks for your interest. Here’s how to get started and submit changes.

## Getting started

1. Find or open an [Issue](https://github.com/GoblinThug/GTAMOZA/issues) describing the bug or idea.
2. Fork and branch from `main` (e.g. `fix/ffb-idle` or `feat/profile-export`).
3. Make your changes, test locally, open a Pull Request.

Tiny fixes (typos, README, styling) can skip a separate issue.

## Local setup

Requires **Node.js 22+**, npm, and **.NET SDK 8+** (for `gtamoza-ffb` and `GTAMOZA.dll`).

```bash
git clone https://github.com/GoblinThug/GTAMOZA.git
cd GTAMOZA
npm install
# ScriptHookVDotNet3.dll from GTA Enhanced folder, or:
npm run fetch:shvdn
npm run build:native   # GTAMOZA.dll + gtamoza-ffb.exe
npm run dev
```

Windows installers:

```bash
npm run dist:win       # → release/
```

`GTAMOZA.dll` is bundled via `extraResources` and copied into `…/GTA V Enhanced/scripts/` when the user enables Story Mode. You do not need a separate mod artifact on the Release.

## Layout

| Path | Purpose |
|---|---|
| `src/` | React UI |
| `electron/` | Main/preload, telemetry, hook installer, FFB |
| `gta-mod/` | SHVDN plugin (`GTAMOZA.dll`) |
| `tools/ffb-host/` | DirectInput FFB host (`gtamoza-ffb.exe`) |
| `shared/` | Shared types and profile defaults |
| `build/` | Icons and packaging resources |
| `docs/` | End-user guide ([USAGE.md](docs/USAGE.md)) |
| `.github/workflows/` | CI / releases |

## Guidelines

- Never commit secrets, `.env`, local `profiles.json`, or FFB logs.
- Do not publish the proprietary MOZA SDK (`vendor/moza-sdk/`).
- Keep PRs focused: one concern per PR.
- Add UI strings in `src/i18n/messages.ts` (**en** and **ru**).
- For bugs: include OS, app version, GTA Enhanced version, and reproduction steps.
- For UI: before/after screenshots when helpful.
- Hooks are **Story Mode only**; Online requires “Prepare for Online”.

## Releases

Push to `main` or a `v*` tag runs GitHub Actions: native + Electron build and a GitHub Release. Manual: **Actions → Release → Run workflow**.

## Security

Do **not** report vulnerabilities in public Issues. See [SECURITY.md](SECURITY.md).

## License

By contributing, you agree your work is licensed under [MIT](LICENSE) (Russian translation: [LICENSE.ru](LICENSE.ru)).
