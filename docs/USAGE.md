# Инструкция по использованию · User Guide

Русский · [English](#-english)

---

# 🇷🇺 Русский

Полная инструкция по **GTA Moza Drive (GTAMOZA)** — от установки до Online и тюнинга FFB.

## 📋 Что нужно

| Компонент | Зачем |
|---|---|
| **Windows 10/11 x64** | Единственная поддерживаемая ОС |
| **GTA V Enhanced** | Story Mode (`GTA5_Enhanced.exe`) |
| **База MOZA** | R3 / R5 / R9 / R12 / R16 и др. (USB) |
| **MOZA Pit House** | Угол руля, физический soft-lock, прошивка |
| **GTA Moza Drive** | С Setup или Portable с [Releases](https://github.com/GoblinThug/GTAMOZA/releases) |

Педали MOZA (SRP и т.п.) — по желанию; калибруются в приложении.

---

## 1️⃣ Установка приложения

1. Скачайте с [GitHub Releases](https://github.com/GoblinThug/GTAMOZA/releases):
   - **`GTAMOZA-Setup-….exe`** — обычная установка + автообновления (**рекомендуется**);
   - **`GTAMOZA-Portable-….exe`** — без установки.
2. Запустите файл. При SmartScreen: **Подробнее** → **Выполнить в любом случае**.
3. Откройте **GTA Moza Drive**.

---

## 2️⃣ Подготовка базы MOZA (Pit House)

1. Подключите базу USB, откройте **Pit House**.
2. Выставьте **угол вращения** (lock-to-lock) как вам удобно — GTAMOZA подхватывает его.
3. Важно для FFB из игры:
   - **Wheel Spring / Spring = 0%** — возврат в центр (SAT) делает GTAMOZA, не Pit House;
   - **Hands-Off Protection** — лучше **Off**, иначе база может «душить» силу;
   - damper / friction / inertia в Pit House можно оставить умеренными или настроить под себя — это «механический» слой базы.
4. Pit House можно **оставить открытым** — угол синхронизируется без закрытия.

---

## 3️⃣ Первый запуск в приложении

### Настройки → GTA

1. Укажите папку с **`GTA5_Enhanced.exe`** (Browse…).
2. Нажмите **Turn on Story Mode** («Включить Story Mode»).
   - Приложение скачает/поставит Script Hook, SHVDN и скопирует **`GTAMOZA.dll`** в `…/scripts/`.
3. Дождитесь статуса вроде **Story Mode ON**.

### Обзор (Dashboard)

1. Убедитесь, что **MOZA base** зелёный (база видна).
2. Покрутите руль и нажмите педали — полоски должны двигаться.
3. **Calibrate pedals** (калибровка педалей):
   - газ → полный ход → Remember;
   - тормоз → то же;
   - сцепление — по желанию (можно Skip).
4. Показатели педалей — в **%**.

### Руль / FFB / Эффекты

1. Включите **FFB enabled**.
2. Начните с профиля **Default** (или Sports / Supercars / Drift / Offroad).
3. Слайдеры:
   - **Overall** — общая сила игровых эффектов;
   - **Self-aligning torque (SAT)** — возврат шины на ходу (не park-magnet);
   - **Damping / Friction / Inertia** — стабильность и «вес» колонки в стеке GTAMOZA;
   - эффекты: дорога, бордюр, grass, подвеска, slip, ABS, collision, engine.

---

## 4️⃣ Запуск Story Mode (без BattlEye)

Хуки **блокируются BattlEye**. Нужен запуск без него.

В приложении: **Launch Story Mode (no BattlEye)**.

| Магазин | Что делает кнопка / что настроить |
|---|---|
| **Steam** | Запуск с `-nobattleye` |
| **Epic** | Один раз: Manage → Launch Options → `-nobattleye`, затем кнопка |
| **Rockstar** | Settings → GTA V → снять **Enable BattlEye**, затем кнопка |

Игра уже запущена с BattlEye → полностью выйдите и запустите снова через кнопку.

В Story Mode:

1. Держите **GTA Moza Drive** открытым (FFB host должен быть жив).
2. Сядьте в машину.
3. На Dashboard статус GTA/plugin должен стать активным; руль — отдавать дорогу/повороты/удары.

Если «игра есть, плагина нет»:

- выйдите из GTA полностью;
- снова **Turn on Story Mode** при необходимости;
- запуск только через **Launch Story Mode**;
- в игре **F11** → субтитр `GTAMOZA Hot-reload OK`.

---

## 5️⃣ Повседневное использование

### Перед каждой сессией Story Mode

1. Pit House + база подключены.
2. GTAMOZA открыт, FFB включён, Story Mode **enabled**.
3. Launch Story Mode → сесть в авто.

### Hot-reload плагина (F11)

Нужен после обновления `GTAMOZA.dll` без рестарта GTA:

- в приложении: **Hot-reload plugin**, или
- в фокусе GTA: **F11**.

Должны появиться субтитр и тикер **GTAMOZA Hot-reload OK**.

### Профили

| Профиль | Характер |
|---|---|
| **Default** | Базовый баланс |
| **Sports** | Живее, больше дороги/бордюра |
| **Supercars** | Сильнее SAT и стабильность на скорости |
| **Drift** | 1080°, слабый SAT, много slip |
| **Offroad** | Grass / подвеска / удары, тяжелее колонка |

Новый профиль и сброс нестандартного — от фабричного Default.  
Сброс Sports/Drift/… — к шаблону этого пресета.

---

## 6️⃣ Перед GTA Online (обязательно)

1. Полностью выйдите из GTA.
2. В GTAMOZA: **Prepare for Online** — хуки паркуются.
3. Верните BattlEye:
   - уберите `-nobattleye` из Steam/Epic;
   - в Rockstar снова включите Enable BattlEye.
4. Только после этого заходите в Online.

> Не используйте читы / хуки / ASI в Online. Читы в GTAMOZA — **только Story Mode**, по умолчанию выключены.

Чтобы снова играть Story Mode с рулём: **Turn on Story Mode** + запуск без BattlEye.

---

## 7️⃣ Удаление мода из игры

**Settings → Remove from game folder** — убирает GTAMOZA, Script Hook, SHVDN, оба ASI-loader (`dinput8`, `xinput1_4`) и логи.  
Если файлы заняты — полностью закройте GTA и Rockstar Launcher и повторите.

---

## 8️⃣ Типичные проблемы

| Симптом | Что проверить |
|---|---|
| Нет FFB | FFB enabled; host жив; Pit House Spring = 0%; Exclusive не занят другим приложением |
| Руль уводит в сторону | Перезапуск GTAMOZA при руле ближе к центру (калибровка polarity); на стоянке не должно быть сильного game-bias |
| Плагин не грузится | BattlEye выключен; Launch Story Mode; F11; `scripts/GTAMOZA.dll` на месте |
| Педали «не доходят» до 100% | Dashboard → Calibrate pedals |
| SmartScreen | Подробнее → Выполнить в любом случае (unsigned release) |
| Вибрация на месте | Обновите до актуальной версии; engine/collision на idle должны быть глуше |

Логи эффектов: **Settings → Open FFB effect logs** (если доступно).

---

## 9️⃣ Карта разделов приложения

| Раздел | Для чего |
|---|---|
| **Обзор** | Связь с базой/GTA, педали %, калибровка |
| **Руль** | Маппинг в GTA + ощущение обода (SAT/damp/…) |
| **Эффекты** | Сила дороги, kerb, slip, collision и т.д. |
| **Профили** | Сохранение / сброс / пресеты |
| **Читы** | Только Story Mode, опционально |
| **Настройки** | Тема, язык, путь к игре, Enable / Online / uninstall |

---

# 🇬🇧 English

Full guide for **GTA Moza Drive (GTAMOZA)** — install through Online safety and FFB tuning.

## 📋 Requirements

| Component | Why |
|---|---|
| **Windows 10/11 x64** | Only supported OS |
| **GTA V Enhanced** | Story Mode (`GTA5_Enhanced.exe`) |
| **MOZA base** | R3 / R5 / R9 / R12 / R16, etc. (USB) |
| **MOZA Pit House** | Wheel angle, physical soft-lock, firmware |
| **GTA Moza Drive** | Setup or Portable from [Releases](https://github.com/GoblinThug/GTAMOZA/releases) |

MOZA pedals optional; calibrate in the app.

---

## 1️⃣ Install the app

1. Download from [GitHub Releases](https://github.com/GoblinThug/GTAMOZA/releases):
   - **`GTAMOZA-Setup-….exe`** — install + auto-update (**recommended**);
   - **`GTAMOZA-Portable-….exe`** — no install.
2. Run it. SmartScreen: **More info** → **Run anyway**.
3. Open **GTA Moza Drive**.

---

## 2️⃣ Prepare the MOZA base (Pit House)

1. Plug in USB, open **Pit House**.
2. Set **wheel angle** (lock-to-lock) as you like — GTAMOZA follows it.
3. Important for in-game FFB:
   - **Wheel Spring = 0%** — tire SAT is done by GTAMOZA, not Pit House;
   - **Hands-Off Protection** preferably **Off**;
   - Pit House damper / friction / inertia can stay mild — mechanical layer of the base.
4. You can **keep Pit House open** — angle sync works without closing it.

---

## 3️⃣ First run in the app

### Settings → GTA

1. Set the folder with **`GTA5_Enhanced.exe`**.
2. Click **Turn on Story Mode**.
   - Downloads/installs Script Hook + SHVDN and copies **`GTAMOZA.dll`** into `…/scripts/`.
3. Wait for a status like **Story Mode ON**.

### Dashboard

1. Confirm **MOZA base** is green.
2. Turn the wheel and press pedals — bars should move.
3. **Calibrate pedals**: full throttle → Remember; full brake → Remember; clutch optional (Skip).
4. Pedal readouts are in **%**.

### Steering / FFB / Effects

1. Enable **FFB**.
2. Start from profile **Default** (or Sports / Supercars / Drift / Offroad).
3. Key sliders: Overall, SAT, Damping / Friction / Inertia, plus surface/event effects.

---

## 4️⃣ Launch Story Mode (no BattlEye)

Hooks are **blocked by BattlEye**. Launch without it.

In the app: **Launch Story Mode (no BattlEye)**.

| Store | What to do |
|---|---|
| **Steam** | Launches with `-nobattleye` |
| **Epic** | Once: Launch Options → `-nobattleye`, then use the button |
| **Rockstar** | Uncheck **Enable BattlEye**, then use the button |

If the game is already running with BattlEye — quit fully and relaunch via the button.

In Story Mode: keep GTAMOZA open, get in a vehicle, FFB should appear.  
Plugin missing while game runs: quit → Enable again if needed → Launch Story Mode only → press **F11** in-game for `GTAMOZA Hot-reload OK`.

---

## 5️⃣ Day-to-day use

### Before each Story session

1. Pit House + base connected.
2. GTAMOZA open, FFB on, Story Mode **enabled**.
3. Launch Story Mode → enter a car.

### Hot-reload (F11)

After updating `GTAMOZA.dll` without restarting GTA: app button **Hot-reload plugin**, or **F11** in-game.

### Profiles

| Profile | Feel |
|---|---|
| **Default** | Balanced baseline |
| **Sports** | Livelier road/kerb |
| **Supercars** | Stronger SAT / high-speed stability |
| **Drift** | 1080°, weak SAT, lots of slip |
| **Offroad** | Grass / suspension / impacts, heavier column |

New profiles use the factory Default. Reset of preset IDs restores that preset’s template.

---

## 6️⃣ Before GTA Online (required)

1. Quit GTA completely.
2. In GTAMOZA: **Prepare for Online** (parks hooks).
3. Re-enable BattlEye (remove `-nobattleye` / check Enable BattlEye).
4. Only then join Online.

Cheats in GTAMOZA are **Story Mode only**, off by default.

To return to Story Mode with the wheel: **Turn on Story Mode** + launch without BattlEye.

---

## 7️⃣ Remove mod files from the game

**Settings → Remove from game folder** cleans GTAMOZA, Script Hook, SHVDN, both ASI loaders, and logs.  
If files are locked — quit GTA / Rockstar Launcher fully and retry.

---

## 8️⃣ Troubleshooting

| Symptom | Check |
|---|---|
| No FFB | FFB on; host alive; Pit House Spring 0%; Exclusive not taken |
| Rim drifts to one side | Restart app with wheel near center; idle should not have strong game bias |
| Plugin not loading | BattlEye off; Launch Story Mode; F11; `scripts/GTAMOZA.dll` present |
| Pedals never hit 100% | Dashboard → Calibrate pedals |
| SmartScreen | More info → Run anyway |
| Buzz at standstill | Update to latest; idle engine/collision should be muted |

FFB logs: **Settings → Open FFB effect logs** (when available).

---

## 9️⃣ App sections

| Section | Purpose |
|---|---|
| **Dashboard** | Base/GTA link, pedal %, calibration |
| **Steering** | In-game mapping + rim feel (SAT/damp/…) |
| **Effects** | Road, kerb, slip, collision, etc. |
| **Profiles** | Save / reset / presets |
| **Cheats** | Story Mode only, optional |
| **Settings** | Theme, language, game path, Enable / Online / uninstall |
