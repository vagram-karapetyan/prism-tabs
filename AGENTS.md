# 🤖 AGENTS.md — AI Agent Guide for Prism Tabs

This document serves as the single source of truth for AI agents (Antigravity, Cursor, Claude, Copilot, etc.) working on the **Prism Tabs** Chrome Extension codebase.

---

## 📌 Project Overview & Stack

**Prism** is a fast, privacy-first Google Chrome extension (Manifest V3) that organizes tabs using a **Dual-Engine Architecture**:
- **⚡ Logic Mode**: Instant `<1ms` offline deterministic clustering (heuristics, platform patterns, opener trees, Jaccard NLP similarity, custom Regex rules).
- **✨ Meaning Mode**: Multi-provider semantic AI clustering (Groq LPU with multi-model rotation, Google Gemini 2.5 Flash, or custom OpenAI-compatible endpoints).

### Tech Stack
- **Framework & UI**: React 18, TypeScript 5.6 (strict mode), Tailwind CSS (`darkMode: 'class'`), Lucide React.
- **Build Tool**: Vite 5 (`vite build`), generating bundle into `dist/`.
- **Target Platform**: Google Chrome / Chromium Manifest V3 (`chrome.tabGroups`, `chrome.tabs`, `chrome.storage.local`).
- **Test Runner**: Vitest (55/55 unit tests passing).

---

## 🛠️ Essential Commands & Dev Environment Notes

> [!IMPORTANT]
> **Windows OS Note**: On this Windows machine, running `npm` directly in PowerShell can hit execution policy restrictions (`PSSecurityException`). Always execute npm commands through `cmd.exe /c`:
> - Run tests: `cmd.exe /c npm test`
> - Build project: `cmd.exe /c npm run build`
> - Dev server (if needed): `cmd.exe /c npm run dev`

### Verification Workflow for Any Changes
1. Run unit test suite: `cmd.exe /c npm test` (all 55 tests must pass).
2. Build extension bundle: `cmd.exe /c npm run build` (always ensure `dist/` is updated and in sync before committing).
3. Check Git status: `git status`.

---

## 🏛️ Codebase & Architecture Map

```text
prism-tabs/
├── public/
│   ├── manifest.json               # Chrome MV3 manifest (minimal permissions: tabs, tabGroups, storage)
│   └── icons/                      # Extension icons (16, 32, 48, 128px + SVG)
├── src/
│   ├── background/
│   │   └── index.ts                # MV3 background service worker (Alt+P, Alt+U shortcut listeners)
│   ├── engine/
│   │   ├── types.ts                # Core types: ProposedTabGroup, GroupingPlan, PrismSettings, Themes
│   │   ├── deterministic.ts        # 7-stage Logic Mode engine & smart merge logic
│   │   └── semantic.ts             # Meaning Mode: prompt building, privacy sanitizer, schema validator
│   ├── services/
│   │   ├── geminiService.ts        # Multi-provider client (Groq multi-model fallback, Gemini, Custom API)
│   │   └── chromeTabsService.ts    # Chrome tab/group CRUD, window isolation, undo manager
│   ├── storage/
│   │   └── storageService.ts       # Typed persistence layer using chrome.storage.local
│   └── ui/
│       ├── App.tsx                 # Main popup UI & unified settings sheet
│       ├── themes.ts               # 6 curated modern color themes & applyPrismTheme handler
│       ├── colorPalette.ts         # Native Chrome Tab Group color styles & light/dark contrast classes
│       ├── styles.css              # Tailwind + spectral animation keyframes + slim scrollbars
│       └── components/
│           ├── ThemeSelector.tsx           # Visual theme picker with preview dots
│           ├── PrismRefractionBar.tsx      # Spectral laser prism animation & status
│           ├── GroupPreviewModal.tsx       # Live group list, color swatch picker & edit controls
│           ├── RulesDrawer.tsx             # Custom logic rules & heuristics editor
│           └── SemanticSettingsDrawer.tsx  # Multi-provider API keys & directives configuration
├── tests/
│   ├── deterministic.test.ts       # Logic Mode rules, Jaccard similarity & smart merge
│   ├── semantic.test.ts            # Sanitizer, Groq/Gemini calls & fallback safety
│   ├── cleanup.test.ts             # Disposable tabs (empty New Tab, YouTube homepage)
│   ├── chromeTabsService.test.ts   # Active-window tabs & UndoSnapshot restoration
│   └── themes.test.ts              # Theme registry & storage persistence tests
├── popup.html                      # Chrome action popup entry point
└── tailwind.config.js              # Tailwind setup with darkMode: 'class'
```

---

## 🎨 UI & Popup Sizing Guardrails

1. **Popup Window Dimensions & DPI Scaling (125%, 150%, 175%, 200%)**:
   - In Chrome extensions, `popup.html` dictates the initial bubble window dimensions.
   - `html` has fixed constraints: `width: 392px !important; height: 440px !important; overflow: hidden;`.
   - **Why 392px and 440px?** Both 392 and 440 are multiples of 8 (`392 = 49*8`, `440 = 55*8`). When Windows Display Scaling is active (e.g. 125%, 150%, 175%), this guarantees exact integer physical pixel dimensions (`392 * 1.25 = 490px`, `440 * 1.25 = 550px`), completely eliminating fractional subpixel rounding gaps and white canvas borders.
   - `body` and `#root` use `width: 100% !important; height: 100% !important;` so they seamlessly cover any OS view boundaries.
   - `App.tsx` root container uses `w-full h-full overflow-hidden`.
2. **Native Chromium Frame (`views::BubbleBorder`) & Color Scheme**:
   - Chrome on Windows wraps extension bubbles in a native OS frame.
   - `popup.html` explicitly defaults to `<meta name="color-scheme" content="dark">` and `color-scheme: dark`. This ensures Chromium initializes dark host view backgrounds and dark bubble borders even when Windows is running in Light Mode.
   - When switching to `pure-light`, `applyPrismTheme` dynamically updates `colorScheme`, `meta.content`, and caches theme attributes in `localStorage` for instant synchronous application on next popup open.
   - All inner elements in `App.tsx` have `rounded-none border-none` on the root container to prevent exposed corners.
3. **Contrast in Light/Dark Themes**:
   - All text, icons, buttons, and inputs must use dual-mode Tailwind classes (`text-slate-900 dark:text-slate-100`, `bg-white dark:bg-slate-900`, etc.).
   - Chrome group badges in `colorPalette.ts` use `text-*-700` in light mode and `text-*-300` in dark mode to prevent "white text on white background".

---

## ✅ What Has Been Accomplished (v1.1.3)

1. **Core Dual-Engine Pipeline**:
   - 7-Stage Logic Mode engine with Jaccard NLP clustering, openerTabId trees, and 60+ domain profiles.
   - Yandex Search vs. Yandex Music differentiation (`music.yandex.ru` -> Media & Audio).
   - Multi-provider AI engine (Groq LPU with multi-model token scaling rotation, Gemini 2.5 Flash, Custom OpenAI endpoints).
   - Privacy Sanitizer (stripping sensitive params, tokens, and browser-internal URLs before LLM prompts).
   - Non-destructive **Smart Merge**: ungrouped tabs are merged into existing groups without duplicating.
   - Automatic empty tab cleanup (`New Tab` / `about:blank`).
   - Optional automatic closing of YouTube homepage tabs (`youtube.com/`) on grouping.
   - Active window isolation: operations operate strictly on `currentWindow: true`.
   - Full 1-click **Undo** (`Ctrl+Z`) and **Ungroup All** (`Alt+U`).
   - Live inline group editing (rename, color swatch picker, individual cluster dissolution).
2. **UI & Theming System**:
   - 6 modern color themes (`prism-deep`, `midnight-nebula`, `emerald-forest`, `sunset-amber`, `arctic-frost`, `pure-light`).
   - Visual theme selector (`ThemeSelector.tsx`) with instant persistence in `chrome.storage.local`.
   - Complete light-mode contrast audit (PRISM gradient, buttons, inputs, badges).
   - Animated spectral refraction progress bar with optical prism animation.
3. **Automated Testing & Code Quality**:
   - 58 unit tests passing across 5 suites (`tests/`).
   - Strict TypeScript (`strict: true`) with zero compilation errors.
   - Clean git history with zero unused artifacts.

---

## 📋 What Needs to Be Done Next (Roadmap / Backlog)

Future agents picking up this project should prioritize the following:

### Priority 1: High Value User Features
- [x] **System Theme Auto-Detection (`system` mode)**:
  - Added an "Auto / Follow System" theme setting that dynamically chooses `pure-light` when `window.matchMedia('(prefers-color-scheme: light)').matches` is true, and `prism-deep` when dark, with live listener on OS theme changes.
- [ ] **Settings & Rules JSON Import / Export**:
  - Add "Export Config" and "Import Config" buttons in settings so users can backup or transfer custom rules and prompt directives.
- [ ] **Tab Search Filter in Popup**:
  - Add an inline search bar at the top of the groups preview list to quickly filter tabs in large windows (50+ tabs).

### Priority 2: Performance & Power Features
- [ ] **Memory Savings Counter**:
  - Track and display estimated RAM saved through tab collapse and cleanup.
- [ ] **Background Tab Memory Discarding (`chrome.tabs.discard`)**:
  - Provide an optional toggle to freeze/suspend inactive grouped tabs to free up RAM on low-spec PCs.
- [ ] **Scheduled / Tab-Count Auto-Grouping**:
  - Optional background alarm (`chrome.alarms`) or threshold trigger (e.g., auto-group when open tabs exceed 25).
- [ ] **Drag-and-Drop Reorganization**:
  - Allow users to drag a tab from one group to another directly inside `GroupPreviewModal.tsx`.

### Priority 3: Store Deployment & Ecosystem
- [ ] **Microsoft Edge & Brave Support**:
  - Verify and adapt manifest/packaging for the Microsoft Edge Add-ons store.
- [ ] **Chrome Web Store Submission**:
  - Generate store promo tiles (440x280, 1400x560), privacy policy markdown document, and multi-language store listings (EN, RU).
