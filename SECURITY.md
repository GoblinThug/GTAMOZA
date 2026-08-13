# Security Policy

Русский · [English](#-english)

---

# 🇷🇺 Русский

GTA Moza Drive (GTAMOZA) — локальное Electron-приложение: профили и настройки хранятся на устройстве пользователя. Телеметрия и управление идут по UDP на localhost; плагин `GTAMOZA.dll` работает только в Story Mode через Script Hook.

## Как сообщить об уязвимости

**Не** создавайте публичный Issue с деталями эксплойта.

Предпочтительный способ — [GitHub Security Advisory](https://github.com/GoblinThug/GTAMOZA/security/advisories/new) (приватный отчёт).

Если advisory недоступен, напишите автору через GitHub ([@GoblinThug](https://github.com/GoblinThug)) **без** публикации PoC в открытом issue.

В отчёте по возможности укажите:

- версию приложения и ОС;
- тип проблемы (локальный privilege escalation, подмена обновлений, небезопасная загрузка хуков и т.п.);
- шаги воспроизведения;
- влияние и, если есть, предложенный фикс.

## Что считается в приоритете

- Подмена автообновлений / поставка вредоносного установщика.
- Небезопасная работа с путями игры при установке/удалении мода.
- Утечка или слабое хранение пользовательских данных приложения.
- Выполнение кода вне ожидаемой границы Electron.

## Что обычно не является уязвимостью

- Отсутствие подписи SmartScreen у сборок с GitHub Releases (известное ограничение unsigned-сборок).
- Использование сторонних Script Hook / ASI loader (пользователь осознанно ставит Story Mode hooks).
- Читы / поведение в Online при неправильной подготовке — см. предупреждения в приложении.
- Проблемы на стороне MOZA Pit House / прошивки базы.

## Сроки ответа

Постараемся ответить в разумный срок (обычно в течение нескольких дней). Пожалуйста, дайте время на проверку и выпуск исправления до публичного раскрытия.

---

# 🇬🇧 English

GTA Moza Drive (GTAMOZA) is a local Electron app: profiles and settings stay on the user’s machine. Telemetry and control use localhost UDP; the `GTAMOZA.dll` plugin runs in Story Mode via Script Hook only.

## How to report

Do **not** open a public Issue with exploit details.

Preferred channel: a private [GitHub Security Advisory](https://github.com/GoblinThug/GTAMOZA/security/advisories/new).

If that isn’t available, contact the maintainer via GitHub ([@GoblinThug](https://github.com/GoblinThug)) **without** posting a PoC in a public issue.

Please include when possible:

- app version and OS;
- issue type (local privilege escalation, update tampering, unsafe game-path handling, etc.);
- reproduction steps;
- impact and, if you have one, a suggested fix.

## High priority

- Auto-update tampering / malicious installer delivery.
- Unsafe path handling when installing or removing the mod.
- Leakage or weak storage of app user data.
- Code execution outside the expected Electron boundary.

## Usually not vulnerabilities

- Missing SmartScreen signing on GitHub Release builds (known unsigned-build limitation).
- Use of third-party Script Hook / ASI loaders (Story Mode hooks are intentional).
- Cheats / Online behaviour when the user skips “Prepare for Online”.
- Issues in MOZA Pit House / base firmware.

## Response

We’ll aim to reply within a reasonable time (typically a few days). Please allow time to investigate and ship a fix before public disclosure.
