# Changelog

All notable changes to **Prism Tabs** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0-alpha.1] - 2026-11-13

### Added
- **Clean `Ports & Adapters` v2 architecture** built on TypeScript (strict), Preact, `@preact/signals`, Vite multi-entry (`popup.html` + `background.js`), Vanilla CSS with `@layer` Design Tokens, and Vitest (with strict ESLint layer boundary rules).
- **Compact `maxTabsPerGroup` post-splitter** (`6 / 8 / 10 / 12 / Unlimited`, default `8`) across both engines with balanced thematic chunking and color allocation (`ColorAllocator`) to prevent oversized domain/platform dumps (such as 20+ mixed YouTube tabs).
- **Modular `Logic Mode` (< 10 ms offline):** custom rules matcher, brand/platform clusterer (Search, Media & Audio, Google Workspace, GitHub/GitLab `owner/repo`), RU/EN NLP keyword scoring, `openerTabId` chain + contextual affinity clustering, and `Smart Merge` into existing tab groups.
- **Resilient `Meaning Mode` (BYOK AI):** strict URL sanitizer (strips query, hash, UUIDs, numeric IDs), structured prompt & response validator, and `FetchLlmGateway` with Groq/Gemini model rotation plus seamless fallback to `Logic Mode` with user-visible reason banners.
- **Unified Use-Case Orchestrator (`SortWindowUseCase`, `UngroupAllUseCase`, `UndoLastSortUseCase`, `LiveGroupOpsUseCase`, `ConfigPortabilityUseCase`):** shared by both popup UI and Chrome background service worker (`Alt+P`, `Alt+U`).
- **Interactive `392×440` Popup UI:** pre-paint MV3 CSP-safe `public/theme-boot.js` with 6 themes + `Auto / System`, single scroll container, refraction status bar, instant search with match highlights and `Esc` clear, inline group rename (IME-safe), 9-color Chrome palette picker, drag-and-drop tab movement, RAM saved metrics, and full-height Settings screen.
- **Portability & Settings Migration:** lazy one-time migration from `prism_settings_v1` to `prism_settings_v2` and key-safe JSON import/export supporting `version: 1` and `version: 2`.
- **PowerShell Verification & Packaging:** `scripts/verify.ps1` and `scripts/package.ps1` enforcing SemVer single source of truth, MV3 minimal permissions (`tabs`, `tabGroups`, `storage`), CSP hygiene, and release ZIP secret scans.
- Restored `GPL-3.0` `LICENSE`, extension icons from `archive/v1`, and updated `README.md`.

### Changed
- Enforce atomic execution order `Snapshot → Plan → Apply Groups → Close Disposable Tabs → Discard Inactive Tabs` so disposable New Tab/YouTube tabs never close the Chrome popup mid-sort and at least 1 tab always remains open.
- Replaced monolithic `archive/v1` React + Tailwind implementation with separated domain, application, engine, adapter, and Preact UI modules.
