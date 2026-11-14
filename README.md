<div align="center">

<img src="./public/icons/prism.svg" alt="Prism Tabs logo" width="76" height="76" />

# Prism Tabs

**A fast, privacy-first Chromium Manifest V3 extension that eliminates tab overload through Dual-Engine grouping — instant offline deterministic clustering and optional BYOK AI semantic organization.**

English | [Русский](./README.ru.md)

[![Version](https://img.shields.io/badge/version-v2.0.0--alpha.1%20(pre--release)-818cf8?style=flat-square)](https://github.com/vagram-karapetyan/prism-tabs/releases/tag/v2.0.0-alpha.1)
[![Manifest V3](https://img.shields.io/badge/manifest-MV3-34d399?style=flat-square)](#-privacy-permissions--security)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8%20strict-3178c6?style=flat-square)](#-architecture--safety-guarantees)
[![Preact](https://img.shields.io/badge/UI-Preact%2010%20%2B%20Signals-673ab8?style=flat-square)](#-key-features)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-f59e0b?style=flat-square)](./LICENSE)

</div>

---

> [!NOTE]
> **v2.0.0-alpha.1** is the first public alpha pre-release of the clean-slate **v2** architecture. The previous **v1** stable line remains available in [`v1.1.4`](https://github.com/vagram-karapetyan/prism-tabs/releases/tag/v1.1.4) and the `archive/v1` tag.

## Dual-Engine Grouping

Prism Tabs separates speed and semantic reasoning into two complementary engines sharing the same post-processing pipeline (`Smart Merge`, `maxTabsPerGroup` splitting, and harmonious color allocation):

| Dimension | ⚡ Logic Mode (Default) | 🧠 Meaning Mode (BYOK AI) |
| :--- | :--- | :--- |
| **Execution & Network** | **< 10 ms**, 100% local, **0 network requests** | External LLM call with **automatic fallback to Logic Mode** |
| **Grouping Signals** | Custom rules, platform clusters (Search, Media & Audio, Google Workspace, GitHub/GitLab `owner/repo` + unified service/single-repo buckets), `openerTabId` lineage, bilingual RU/EN NLP, and domains | Cross-domain project intent & semantic topic clustering across clean titles and sanitized paths |
| **Providers** | Built-in deterministic TypeScript engine | **Groq** (auto model rotation), **Google Gemini** (model rotation), or **Custom** OpenAI-compatible endpoint |
| **Privacy Guarantee** | Tabs never leave your browser | Pre-flight **URL sanitizer** strips queries, hashes, internal URLs, and long hex/UUID IDs |
| **Post-Processing** | `Smart Merge`, `maxTabsPerGroup` post-splitter, `ColorAllocator` | `Smart Merge`, `maxTabsPerGroup` post-splitter, `ColorAllocator` |

---

## Key Features

- **Smart Merge (Non-Destructive Grouping):** When enabled, new ungrouped tabs cleanly merge into compatible existing Chrome tab groups instead of tearing down your workspace.
- **Compact `maxTabsPerGroup` Post-Splitter:** Caps oversized domain/platform dumps (e.g. 20+ YouTube tabs) at `6 / 8 / 10 / 12 / Unlimited` (default `8`), splitting by entity/concept subtopics and balanced chunks with distinct Chrome group colors (`ColorAllocator`).
- **Interactive `432×564` Popup Workspace:**
  - Live search across tabs and groups with match highlighting, result counter, and `Esc` reset.
  - Inline group renaming (IME-safe), 9-color Chrome palette picker, one-click group collapse/ungroup, and drag-and-drop tab movement between groups and `Ungrouped Tabs`.
  - Self-hosted offline variable fonts (`Onest Variable` and `JetBrains Mono Variable` with Latin + Cyrillic coverage) — zero external font CDNs.
- **6 Curated Themes + `Auto / System`:** `Prism Deep`, `Midnight Nebula`, `Emerald Forest`, `Sunset Amber`, `Arctic Frost`, `Pure Light`, and `Auto / System` with a pre-paint MV3 CSP-safe `public/theme-boot.js` script to prevent white flash on popup open.
- **Memory & Tab Hygiene:** Optional disposal of empty New Tab / root YouTube homepage tabs and background tab discarding with estimated RAM savings, plus single-click `Undo` (`Ctrl+Z` / `Cmd+Z`) that restores group titles, colors, collapsed state, and tab order.
- **Key-Safe Config Portability & Migration:** Lazy one-time migration from `prism_settings_v1` to `prism_settings_v2` and JSON import/export (`version: 1` & `version: 2`). Provider API keys are **never** exported or overwritten on import.

---

## Architecture & Safety Guarantees

Prism Tabs v2 follows a strict **Ports & Adapters** architecture. ESLint (`eslint.config.mjs`) enforces that core layers (`domain`, `ports`, `engine`, `application`) have zero dependency on `chrome.*`, `window`, `document`, `adapters`, `ui`, or `background`.

```text
src/
├── domain/        # Canonical types, defaults, themes, validators, SemVer source of truth
├── ports/         # Abstract interfaces (BrowserTabsPort, StoragePort, LlmGatewayPort, ClockPort)
├── engine/
│   ├── logic/     # Deterministic clustering: rules, platforms, RU/EN NLP, taxonomy, Smart Merge
│   ├── meaning/   # Pre-flight URL sanitizer, prompt builder, strict JSON response validator
│   └── shared/    # URL classifier, ColorAllocator, emoji parser, maxTabsPerGroup post-splitter
├── application/   # Use cases: SortWindow, UngroupAll, UndoLastSort, LiveGroupOps, Portability
├── adapters/      # Chrome Tabs/Storage adapters, FetchLlmGateway, composition root, test mocks
├── background/    # MV3 service worker handling global commands (Alt+P / Alt+U)
└── ui/            # Preact 10 + Signals 432×564 popup, self-hosted fonts, @layer CSS tokens
```

### Atomic Execution Order

Every sort runs in an atomic sequence:

`Snapshot (for Undo) → Plan (Logic or Meaning + fallback) → Apply Chrome Tab Groups → Close Disposable Tabs → Discard Inactive Tabs`

This ensures disposable tabs never close the active popup mid-sort and at least one tab always remains open in the window.

### BYOK URL Sanitizer (`Meaning Mode`)

Before any metadata reaches an LLM provider, `sanitizeTabMetadata` enforces:
1. Excludes internal browser URLs (`chrome://`, `edge://`, `about:`, `file://`, etc.).
2. Strips all query strings (`?token=...`), hashes (`#...`), and auth parameters.
3. Truncates paths to at most 3 segments and masks `>32`-char hex/UUID segments with `:id`.
4. Trims tab titles to 72 characters.

---

## Installation

### Option 1: Quick Install from GitHub Releases (Recommended)

1. Download **`prism-tabs-v2.0.0-alpha.1.zip`** from the [Releases](https://github.com/vagram-karapetyan/prism-tabs/releases/tag/v2.0.0-alpha.1) page and extract it to a permanent folder.
2. Open `chrome://extensions` (or `edge://extensions` / `brave://extensions`).
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the extracted folder (containing `manifest.json`).

### Option 2: Build from Source (Windows PowerShell)

Requirements: **Node.js 20+**, **npm**, **Windows PowerShell 5.1+**.

```powershell
npm install
powershell -ExecutionPolicy Bypass -File .\scripts\verify.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\package.ps1
```

- `scripts/verify.ps1` runs `tsc --noEmit`, `eslint .`, `vitest run`, `vite build` (into `dist/`), and an MV3 audit (single-source version check, minimal permissions, CSP hygiene, no embedded secrets).
- `scripts/package.ps1` runs `verify.ps1`, builds the audited release archive in `release/prism-tabs-v<version>.zip`, and verifies ZIP contents.
- To load the local build, point **Load unpacked** to the generated `dist/` directory.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Alt+P` (`Command+Shift+P` on macOS) | Group tabs in the active window (works in popup and globally via service worker) |
| `Alt+U` (`Command+Shift+U` on macOS) | Ungroup all tabs in the active window |
| `Ctrl+Z` (`Cmd+Z` on macOS) | Undo the last sort or ungroup action (in popup, outside text inputs) |
| `Esc` | Clear search, cancel inline group rename, or close Settings |

---

## Privacy, Permissions & Security

- **Minimal MV3 Permissions:** Only `tabs`, `tabGroups`, and `storage`.
- **Zero `host_permissions`, Zero Analytics, Zero External Backend:** Offline `Logic Mode` performs no network requests whatsoever; `Meaning Mode` communicates solely with the API provider you configure.
- **Local Key Storage:** BYOK keys are stored locally in `chrome.storage.local` and are excluded from JSON exports.
- **Changelog & License:** See [CHANGELOG.md](./CHANGELOG.md) and [LICENSE](./LICENSE) (**GPL-3.0**).
