<div align="center">

<img src="./public/icons/prism.svg" alt="Логотип Prism Tabs" width="76" height="76" />

# Prism Tabs

**Быстрое и бережное к приватности расширение для Chromium (Manifest V3), которое устраняет хаос во вкладках за счёт двух движков: мгновенной оффлайн-кластеризации (`Logic Mode`) и опциональной AI-группировки со своим ключом (`Meaning Mode`).**

[English](./README.md) | Русский

[![Version](https://img.shields.io/badge/version-v2.0.0--alpha.1%20(pre--release)-818cf8?style=flat-square)](https://github.com/vagram-karapetyan/prism-tabs/releases/tag/v2.0.0-alpha.1)
[![Manifest V3](https://img.shields.io/badge/manifest-MV3-34d399?style=flat-square)](#-приватность-права-mv3-и-безопасность)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8%20strict-3178c6?style=flat-square)](#-архитектура-и-гарантии-безопасности)
[![Preact](https://img.shields.io/badge/UI-Preact%2010%20%2B%20Signals-673ab8?style=flat-square)](#-ключевые-возможности)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-f59e0b?style=flat-square)](./LICENSE)

</div>

---

> [!NOTE]
> **v2.0.0-alpha.1** — первый публичный альфа-пререлиз новой архитектуры **v2**. Стабильная ветка **v1** по-прежнему доступна в релизе [`v1.1.4`](https://github.com/vagram-karapetyan/prism-tabs/releases/tag/v1.1.4) и теге `archive/v1`.

## Два движка группировки

Prism Tabs объединяет детерминированную скорость и семантический анализ в общем конвейере постобработки (`Smart Merge`, сплиттер `maxTabsPerGroup` и гармоничный подбор цветов `ColorAllocator`):

| Параметр | ⚡ Logic Mode (по умолчанию) | 🧠 Meaning Mode (BYOK AI) |
| :--- | :--- | :--- |
| **Скорость и сеть** | **< 10 мс**, 100% локально, **0 сетевых запросов** | Запрос к выбранному LLM с **автооткатом в Logic Mode** |
| **Сигналы группировки** | Пользовательские правила, платформы (Search, Media & Audio, Google Workspace, GitHub/GitLab `owner/repo` + объединение одиночных репо и общих страниц `GitHub`/`GitLab`), `openerTabId`-цепочки, RU/EN NLP и домены | Кросс-доменный проектный контекст и семантические темы по очищенным заголовкам и путям |
| **Провайдеры** | Встроенный детерминированный TypeScript-движок | **Groq** (авто-ротация моделей), **Google Gemini** (ротация моделей) или **Custom** OpenAI-compatible endpoint |
| **Приватность** | Данные вкладок не покидают браузер | Встроенный **URL-санитайзер** удаляет query, hash, внутренние URL и длинные hex/UUID-идентификаторы |
| **Постобработка** | `Smart Merge`, сплиттер `maxTabsPerGroup`, `ColorAllocator` | `Smart Merge`, сплиттер `maxTabsPerGroup`, `ColorAllocator` |

---

## Ключевые возможности

- **Smart Merge (бережное объединение):** при включённом режиме новые несгруппированные вкладки аккуратно добавляются в подходящие существующие группы Chrome вместо полной перестройки.
- **Контроль размера групп (`maxTabsPerGroup`):** ограничивает размер групп (`6 / 8 / 10 / 12 / Unlimited`, по умолчанию `8`), разбивая крупные домены и платформы (например, 20+ вкладок YouTube) на компактные тематические подгруппы с разными цветами Chrome (`ColorAllocator`).
- **Интерактивный `432×564` Popup-интерфейс:**
  - Мгновенный поиск по вкладкам и группам с подсветкой совпадений, счётчиком и сбросом по `Esc`.
  - Inline-переименование групп (совместимо с IME), палитра из 9 цветов Chrome, сворачивание/разгруппировка и drag-and-drop вкладок между группами и зоной `Ungrouped Tabs`.
  - Встроенные оффлайн-шрифты (`Onest Variable` и `JetBrains Mono Variable` с полной поддержкой кириллицы и латиницы) без обращения к внешним CDN.
- **6 кураторских тем + `Auto / System`:** `Prism Deep`, `Midnight Nebula`, `Emerald Forest`, `Sunset Amber`, `Arctic Frost`, `Pure Light` и `Auto / System` со скриптом предзагрузки `public/theme-boot.js` (MV3 CSP-safe, без вспышки белого экрана).
- **Гигиена вкладок и память:** опциональное закрытие пустых вкладок New Tab / главной YouTube, выгрузка неактивных вкладок с оценкой освобождённой RAM и откат `Undo` (`Ctrl+Z` / `Cmd+Z`) с восстановлением названий, цветов, свёрнутости и порядка.
- **Портативность настроек и миграция:** однократная ленивая миграция `prism_settings_v1 → prism_settings_v2` и импорт/экспорт JSON (`version: 1` и `version: 2`). API-ключи **никогда** не экспортируются и не перезаписываются при импорте.

---

## Архитектура и гарантии безопасности

Prism Tabs v2 построен по строгой архитектуре **Ports & Adapters**. ESLint (`eslint.config.mjs`) запрещает ядру (`domain`, `ports`, `engine`, `application`) любые зависимости от `chrome.*`, `window`, `document`, `adapters`, `ui` и `background`.

```text
src/
├── domain/        # Типы, значения по умолчанию, темы, валидаторы, единый источник SemVer
├── ports/         # Интерфейсы портов (BrowserTabsPort, StoragePort, LlmGatewayPort, ClockPort)
├── engine/
│   ├── logic/     # Детерминированная кластеризация: правила, платформы, RU/EN NLP, Smart Merge
│   ├── meaning/   # URL-санитайзер, построитель промптов, строгий валидатор JSON-ответа
│   └── shared/    # Классификатор URL, ColorAllocator, парсер эмодзи, сплиттер maxTabsPerGroup
├── application/   # Сценарии: SortWindow, UngroupAll, UndoLastSort, LiveGroupOps, Portability
├── adapters/      # Адаптеры Chrome Tabs/Storage, FetchLlmGateway, composition root, моки тестов
├── background/    # MV3 service worker для глобальных горячих клавиш (Alt+P / Alt+U)
└── ui/            # Preact 10 + Signals 432×564 popup, локальные шрифты, @layer CSS-токены
```

### Атомарный порядок выполнения

Каждая сортировка выполняется в строгой последовательности:

`Snapshot (для Undo) → Plan (Logic или Meaning + fallback) → Apply Chrome Tab Groups → Close Disposable Tabs → Discard Inactive Tabs`

Благодаря этому закрытие пустых/одноразовых вкладок не может закрыть popup посреди сортировки, и в окне всегда остаётся минимум 1 открытая вкладка.

### URL-санитайзер в `Meaning Mode`

Перед отправкой метаданных LLM-провайдеру `sanitizeTabMetadata` гарантирует:
1. Исключаются внутренние URL браузера (`chrome://`, `edge://`, `about:`, `file://` и т.д.).
2. Полностью удаляются query-параметры (`?token=...`), hash (`#...`) и параметры авторизации.
3. Путь обрезается максимум до 3 сегментов, а hex/UUID-сегменты длиннее 32 символов маскируются как `:id`.
4. Заголовки ограничиваются 72 символами.

---

## Установка

### Вариант 1: Быстрая установка из GitHub Releases (рекомендуется)

1. Скачайте **`prism-tabs-v2.0.0-alpha.1.zip`** со страницы [Releases](https://github.com/vagram-karapetyan/prism-tabs/releases/tag/v2.0.0-alpha.1) и распакуйте архив в постоянную папку.
2. Откройте `chrome://extensions` (или `edge://extensions` / `brave://extensions`).
3. Включите **Режим разработчика** (*Developer mode*) в правом верхнем углу.
4. Нажмите **Загрузить распакованное расширение** (*Load unpacked*) и выберите распакованную папку (с файлом `manifest.json`).

### Вариант 2: Сборка из исходников (Windows PowerShell)

Требования: **Node.js 20+**, **npm**, **Windows PowerShell 5.1+**.

```powershell
npm install
powershell -ExecutionPolicy Bypass -File .\scripts\verify.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\package.ps1
```

- `scripts/verify.ps1` запускает `tsc --noEmit`, `eslint .`, `vitest run`, `vite build` (в `dist/`) и аудит MV3 (единая версия, минимальные права, CSP без inline-скриптов, отсутствие вшитых ключей).
- `scripts/package.ps1` прогоняет `verify.ps1`, собирает архив `release/prism-tabs-v<version>.zip` и проверяет содержимое ZIP.
- Для загрузки локальной сборки укажите папку `dist/` через **Загрузить распакованное расширение** (*Load unpacked*).

---

## Горячие клавиши

| Сочетание | Действие |
| :--- | :--- |
| `Alt+P` (`Command+Shift+P` на macOS) | Сгруппировать вкладки активного окна (в popup и глобально через service worker) |
| `Alt+U` (`Command+Shift+U` на macOS) | Разгруппировать все вкладки активного окна |
| `Ctrl+Z` (`Cmd+Z` на macOS) | Отменить последнюю сортировку или разгруппировку (в popup, вне полей ввода) |
| `Esc` | Очистить поиск, отменить переименование группы или закрыть Настройки |

---

## Приватность, права MV3 и безопасность

- **Минимальные права MV3:** только `tabs`, `tabGroups` и `storage`.
- **Ноль `host_permissions`, ноль телеметрии, ноль сторонних серверов:** оффлайн `Logic Mode` не делает сетевых запросов, а `Meaning Mode` обращается только к настроенному вами API-провайдеру.
- **Локальное хранение ключей:** BYOK-ключи хранятся локально в `chrome.storage.local` и не включаются в JSON-экспорт.
- **История изменений и лицензия:** см. [CHANGELOG.md](./CHANGELOG.md) и [LICENSE](./LICENSE) (**GPL-3.0**).
