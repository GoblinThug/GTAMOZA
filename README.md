# GTA Moza Drive (GTAMOZA)

Десктопное приложение для **MOZA R5** force feedback в **GTA V Enhanced Story Mode**.

[Releases](https://github.com/GoblinThug/GTAMOZA/releases/latest) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

## Возможности

- Управление FFB и профилями под GTA Enhanced Story Mode
- Установка / парковка Script Hook + плагина `GTAMOZA.dll` из приложения
- DirectInput FFB host (`gtamoza-ffb`) для базы MOZA
- Автообновления с GitHub Releases

> Хуки только для Story Mode. Перед Online используйте **Prepare for Online** в приложении.

## Стек

- Electron + React + TypeScript + Vite
- .NET 8 — `gtamoza-ffb` (DirectInput)
- .NET Framework 4.8 — плагин SHVDN (`GTAMOZA.dll`)

## Разработка

Нужны **Node.js 22+** и **.NET SDK 8+**.

```bash
npm install
npm run build:native
npm run dev
```

Сборка установщика (Windows):

```bash
npm run dist:win
# → release/GTAMOZA-Setup-*.exe, GTAMOZA-Portable-*.exe
```

Плагин и FFB-host попадают в `extraResources` и при Enable копируются в папку игры — отдельный артефакт мода в релизе не обязателен.

## Релизы (CI)

Пуш в `main` или тег `v*` → GitHub Actions:

1. draft Release `vX.Y.Z` (версия из `package.json` или тега);
2. сборка native + Electron на `windows-latest`;
3. загрузка Setup / Portable / `latest.yml`;
4. публикация релиза.

Вручную: **Actions → Release → Run workflow**.

## Лицензия

[MIT](LICENSE) · [LICENSE.ru](LICENSE.ru)
