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
- **Test Runner**: Vitest (66/66 unit tests passing across 5 suites).

---

## 🛠️ Essential Commands & Dev Environment Notes

> [!IMPORTANT]
> **PowerShell-First Automation Principle**:
> All build, packaging, release, and verification automation in this repository is strictly **PowerShell (`.ps1`)** based.
> **No `.bat` or `.cmd` files and no `cmd.exe /c` wrappers are allowed.**
> Commands are run natively in PowerShell or via npm scripts wrapping PowerShell scripts:
> - Full verification loop: `npm run verify` (or `powershell -ExecutionPolicy Bypass -File scripts/verify.ps1`)
> - Run tests: `npm test` (all 66 vitest tests)
> - Typecheck: `npm run typecheck` (tsc in strict mode)
> - Build project (dev/local with .env.local): `npm run build`
> - Package clean BYOK release (zero keys, creates .zip in releases/): `npm run package` (or `powershell -ExecutionPolicy Bypass -File scripts/package-release.ps1`)
> - Automatic GitHub Release: `npm run release` (or `powershell -ExecutionPolicy Bypass -File scripts/publish-release.ps1`)
> - Dev server (if needed): `npm run dev`

### Verification Workflow for Any Changes
1. Run full verification loop: `npm run verify` (runs unit tests, typecheck, production build, and clean packaging audit).
2. Check Git status: `git status`.
3. **Automatic Git Commit & Push**: Commit with Conventional Commits and push to `origin/main` (`git push origin main`).
4. **Automatic GitHub Release**: On version updates, publish clean distribution archive to GitHub via `npm run release` (tags commit and uploads `.zip` using `gh release create`).

---

## 🌐 Engineering Protocols & Quality Standards

When working on this codebase, all AI agents must follow the core engineering standards and workflows:

### 1. Defect Resolution
- Identify and isolate root causes prior to making code edits.
- Reproduce the bug with an automated unit test in `tests/`.
- Apply minimal, surgical fixes without collateral damage or code bloat.
- Verify that all related test suites remain green.

### 2. Feature Development
- Design typed contracts and interfaces in `src/engine/types.ts` before writing UI or logic.
- Maintain strict unidirectional data flow: storage layer (`storageService.ts`) $\rightarrow$ services (`chromeTabsService.ts`, `geminiService.ts`) $\rightarrow$ engine logic $\rightarrow$ UI components.
- Avoid state mutation anti-patterns; use idiomatic React hooks (`useCallback`, `useMemo`, `useState`).

### 3. User Interface & Ergonomics
- **Hit targets & padding**: Ensure clickable controls are $\ge 32\text{px}$ in popup windows with clear hover and active feedback.
- **Keyboard navigation**: Support standard shortcuts (`Alt+P` for grouping, `Alt+U` for ungrouping, `Ctrl+Z` for undo, `Esc` to close drawers/swatches and clear search).
- **Input protection**: Never trigger global shortcuts (like `Alt+P`) when user focus is inside an `<input>` or `<textarea>`.
- **DPI scaling**: Preserve exact physical dimensions (`392x440px`, multiples of 8) to prevent fractional subpixel rounding gaps on Windows 125%/150% display scaling.
- **Light/Dark contrast**: Always provide paired Tailwind classes (`text-slate-900 dark:text-slate-100`, etc.) ensuring crisp contrast across all 6 themes.

### 4. Refactoring & Code Quality
- Verify all tests pass before initiating structural changes.
- Preserve public interfaces and behavioral contracts.
- Eliminate dead code, unused parameters, and runtime warnings (e.g. Node 22 experimental globals).

### 5. Verification & Release Loop
- **Full Verification**: `npm run verify` $\rightarrow$ runs unit tests, typecheck, production build, and security audit.
- **Types**: `npm run typecheck` $\rightarrow$ 0 errors.
- **Tests**: `npm test` $\rightarrow$ 100% pass rate.
- **Build**: `npm run build` $\rightarrow$ clean production bundle in `dist/`.
- **Security & Packaging**: `npm run package` $\rightarrow$ PowerShell secret scan passes with 0 leaks & builds clean `.zip`.
- **Git Commit & Push**: Commit with Conventional Commits and push immediately to `origin/main`.
- **GitHub Release Automation**: Run `npm run release` to automatically publish tag and `.zip` asset to GitHub Releases.
- **Diff**: Review `git diff` for unintended whitespace or accidental modifications.

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
│   │   ├── deterministic.ts        # 8-stage Logic Mode engine, NLP similarity & smart merge
│   │   └── semantic.ts             # Meaning Mode: prompt building, privacy sanitizer, schema validator
│   ├── services/
│   │   ├── geminiService.ts        # Multi-provider client (Groq multi-model fallback, Gemini, Custom API)
│   │   └── chromeTabsService.ts    # Chrome tab/group CRUD, window isolation, undo manager, memory discard
│   ├── storage/
│   │   └── storageService.ts       # Typed persistence layer using chrome.storage.local & config import/export
│   └── ui/
│       ├── main.tsx                # SPA entry point & zero-CSP synchronous theme cache loader
│       ├── App.tsx                 # Main popup UI & unified settings sheet
│       ├── themes.ts               # 6 curated modern color themes & applyPrismTheme handler
│       ├── colorPalette.ts         # Native Chrome Tab Group color styles & light/dark contrast classes
│       ├── styles.css              # Tailwind + spectral animation keyframes + slim scrollbars
│       └── components/
│           ├── ThemeSelector.tsx           # Visual theme picker with preview dots
│           ├── PrismRefractionBar.tsx      # Spectral laser prism animation & status
│           ├── GroupPreviewModal.tsx       # Live group list, instant search, drag & drop, swatch picker
│           ├── RulesDrawer.tsx             # Custom logic rules, heuristics editor & config import/export
│           └── SemanticSettingsDrawer.tsx  # Multi-provider API keys & directives configuration
├── tests/
│   ├── deterministic.test.ts       # Logic Mode rules, Jaccard similarity, brand recognition & smart merge
│   ├── semantic.test.ts            # Sanitizer, Groq/Gemini calls & fallback safety
│   ├── cleanup.test.ts             # Disposable tabs (empty New Tab, YouTube homepage)
│   ├── chromeTabsService.test.ts   # Active-window tabs, memory discard & UndoSnapshot restoration
│   └── themes.test.ts              # Theme registry, config export/import & storage persistence tests
├── scripts/
│   ├── generate-icons.mjs          # SVG to high-res PNG icon rasterizer
│   ├── verify.ps1                  # PowerShell full verification loop (tests, types, build, secret scan)
│   ├── package-release.ps1         # PowerShell clean BYOK packager & automated secret audit
│   └── publish-release.ps1         # PowerShell automated GitHub release & asset publisher
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
4. **Full-Height Settings View & Layout Optimization**:
   - When `isSettingsOpen` is true, the Dual-Engine Mode Switcher pill and Tab Action Footer (`Undo` / `Ungroup All`) are completely unmounted.
   - Settings takes 100% of the popup height below the header (`PRISM | Settings`), gaining ~100px of vertical space and eliminating squeezed inner scrolling and cut-off input fields.
   - Header action button transitions to an `X` (Close) button returning to the main view in one click.

---

## ✅ What Has Been Accomplished (v1.1.4)

1. **Tab Search Filter in Popup**:
   - Added instant real-time search input at the top of the group list with a match counter badge.
   - Filters groups and tabs simultaneously; auto-expands matching groups and highlights query matches.
   - Closes / clears instantly with `Esc` or the inline `X` button.
2. **Settings & Rules JSON Import / Export**:
   - Added "Export" and "Import" buttons in settings: users can backup or transfer custom rules, prompt presets, and behavior settings as JSON without leaking API keys.
   - Validates JSON structure, recovers gracefully on corrupted files, and updates the UI live.
3. **HTML5 Drag-and-Drop Tab Reorganization**:
   - Allows users to drag tabs between groups in `GroupPreviewModal.tsx` before or after grouping.
   - Moving tabs automatically syncs with native Chrome Tab Groups via `moveTabToGroup`.
4. **Background Tab Memory Discarding (`chrome.tabs.discard`) & RAM Savings**:
   - Added `discardInactiveTabs` toggle in Quick Settings.
   - Automatically unloads background tabs (except active, pinned, or audible tabs) to reclaim ~55MB RAM per tab.
   - Integrated `estimateMemorySavings` calculating estimated RAM freed (closed tabs + discarded tabs + collapsed groups) and surfaced in toast notifications.
5. **Deterministic Logic Engine & NLP Enhancements**:
   - **Resilient Group Merging**: Fixed edge case where dissolved Chrome Tab Groups would cause failed merges; now gracefully falls back to creating fresh groups.
   - **Preserved Research Group Discovery**: Contextual research linking now checks both preserved and newly created groups.
   - **Compound Emoji & Title Parsing**: `parseExistingGroupTitle` supports compound emojis (`👨‍💻`, `❤️`, `🏳️‍🌈`) and zero-whitespace titles (e.g. `📁Work`).
   - **Russian Topic Inference**: Added Russian keywords (`дизайн`, `разработка`, `купить`, `видео`, `статья`, `игры`...) for intelligent topic emoji selection.
   - **Expanded Domain Profiles**: Added ChatGPT, Claude, X/Twitter, Telegram, Habr, VK, Ozon, Wildberries, AliExpress.
   - **Language-Aware Fallback Grouping**: Uses `🌐 Разное` when tabs are Russian, avoiding foreign titles on local tabs.
6. **Keyboard Ergonomics & Node 22 Clean Test Suite**:
   - Global shortcuts (`Alt+P`, `Alt+U`) are guarded against input/textarea focus.
   - `Esc` key seamlessly closes Settings and dismisses active color swatch pickers.
   - Fixed Node 22 `ExperimentalWarning: localStorage` across `storageService.ts` and `themes.ts`.
   - 66/66 unit tests passing across 5 test suites with 0 warnings.

---

## 📋 What Needs to Be Done Next (Roadmap / Backlog)

Future agents picking up this project should prioritize the following:

### Priority 1: High Value User Features
- [x] **System Theme Auto-Detection (`system` mode)**
- [x] **Settings & Rules JSON Import / Export**
- [x] **Tab Search Filter in Popup**

### Priority 2: Performance & Power Features
- [x] **Memory Savings Counter**
- [x] **Background Tab Memory Discarding (`chrome.tabs.discard`)**
- [x] **Drag-and-Drop Reorganization**
- [ ] **Scheduled / Tab-Count Auto-Grouping**:
  - Optional background alarm (`chrome.alarms`) or threshold trigger (e.g., auto-group when open tabs exceed 25).

### Priority 3: Store Deployment & Ecosystem
- [ ] **Microsoft Edge & Brave Support**:
  - Verify and adapt manifest/packaging for the Microsoft Edge Add-ons store.
- [ ] **Chrome Web Store Submission**:
  - Generate store promo tiles (440x280, 1400x560), privacy policy markdown document, and multi-language store listings (EN, RU).
