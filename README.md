# Vân Du Pure (`vandupure`)

> **The lightweight, local-first web purifier & ad defuser for Chrome Manifest V3.**  
> 100% Client-Side • 0ms Overhead • Zero Telemetry • GPL-3.0 Licensed

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-success.svg)](https://developer.chrome.com/docs/extensions/mv3/)
[![Release](https://img.shields.io/badge/Release-v1.0.2-teal.svg)](https://github.com/kychitoge/vandupure/releases)
[![Tests](https://img.shields.io/badge/Tests-58%2F58%20Passed-brightgreen.svg)](tests/)

---

## Overview

**Vân Du Pure** is an open-source browser extension designed to restore a clean, fast, and tranquil web browsing experience. Unlike bloated extensions that consume excessive memory or rely on remote servers, Vân Du Pure adheres to a strict **$0 Cloud, 100% Local-First** architecture: every heuristic, URL cleaner, and DOM sanitizer executes entirely on your device in real time ($< 1\text{ms}$).

---

## Key Features

### 1. 🛡️ Popunder and Click-Hijack Guard
- **Mock Window Proxy**: Intercepts abusive `window.open` calls from malicious ad scripts and returns a safe recursive mock window object, preventing unhandled `TypeError` exceptions.
- **Overlay Anchor Protection**: Detects and neutralizes full-screen transparent `<a>` links and invisible `<div>` overlays designed to hijack user clicks.
- **Anti-Tabunder Redirect Guard**: Blocks forced tab redirection when background popups are neutralized.

### 2. 🧹 URL Tracking Stripper and Redirect Unwrapper
- **Prefix-Grouped Telemetry Purging**: Strips more than 35 known telemetry parameters (`utm_*`, `fbclid`, `gclid`, `_ga`, `_gl`, `ttclid`, `mc_*`, `_hs*`, `si`).
- **Recursive Redirect Unwrapping**: Unwraps intermediate redirection URLs (including `google.com/url?q=...`, `l.facebook.com/l.php?u=...`, `out.reddit.com?url=...`) to navigate directly to destination sites.
- **Zero-Reload Address Bar Cleaning**: Rewrites the address bar using `history.replaceState` without triggering page refreshes.

### 3. 🎵 YouTube Radio and Mix Playlist Defuser
- **0ms Standalone Breakout**: Intercepts forced radio parameters (`&list=RD...` and `&start_radio=1`), returning videos to standalone playback mode.
- **SPA Integration**: Seamlessly listens to YouTube's native Single Page Application events (`yt-navigate-finish`) to prevent video buffer loss.

### 4. 🔓 DOM Unblocker and Ghost Cleaner
- **Restored Right-Click & Copy**: Disables scripts that block context menus (`contextmenu`) and text selection (`selectstart`, `copy`) at the browser's Capture Phase.
- **Transparent Shield Buster**: Utilizes `elementsFromPoint` inspection to bypass invisible blocking masks layered over images and videos.
- **Ghost Container Cleanup**: Collapses empty ad placeholders, dismisses abandoned paywall backdrops, and restores scrolling (`overflow: auto !important`).

---

## Installation

### Method 1: Pre-built Package (Recommended)

1. Download the latest release asset: [**`vandu-pure-v1.0.2.zip`**](https://github.com/kychitoge/vandupure/releases/latest).
2. Verify the SHA-256 integrity against `vandu-pure-v1.0.2.zip.sha256`.
3. Extract the downloaded zip archive.
4. Open Google Chrome, Brave, or Microsoft Edge, and navigate to:
   ```text
   chrome://extensions/
   ```
5. Enable **Developer mode** in the top-right corner.
6. Click **Load unpacked** and select the extracted folder.
7. Pin **Vân Du Pure** to your browser toolbar.

---

### Method 2: Build from Source

#### Prerequisites
- **Node.js**: `^18.0.0` or `^20.0.0`
- **pnpm**: `>= 9.0.0`

#### Steps
```bash
# 1. Clone the repository
git clone https://github.com/kychitoge/vandupure.git
cd vandupure

# 2. Install dependencies
pnpm install

# 3. Run automated tests
pnpm test

# 4. Build the extension
pnpm build
```

The production-ready extension package is generated in `.output/chrome-mv3/`.

---

## Testing

The extension includes automated test suites covering Core logic, DOM modules, and regression scenarios:

```bash
# Run tests with Vitest
pnpm test

# Run TypeScript type check
pnpm typecheck
```

> [!NOTE]
> All 58 unit and integration tests pass with 0 errors across modern Node.js and Chromium environments.

---

## Automated CI/CD Releases

This repository includes a GitHub Actions release workflow (`.github/workflows/release.yml`).  
Whenever a version tag (`v*`) is pushed to the repository, the pipeline automatically:

1. Runs the test suite and type checking.
2. Compiles and packages the extension into a zip archive.
3. Calculates the SHA-256 checksum.
4. Publishes a GitHub Release with the generated assets.

```bash
# Tag and release example
git tag v1.0.2
git push origin v1.0.2
```

---

## Upstream References & License

This project is licensed under the [GNU General Public License v3.0](LICENSE).

Vân Du Pure gratefully acknowledges the research and engineering foundations established by the open-source community:

- **uBlock Origin & uBlock Origin Lite** — Raymond Hill (gorhill) [GPL-3.0]
- **Adguard Scriptlets & Adguard Popup Blocker** — AdguardTeam [LGPL-3.0]
- **ClearURLs** — Kevin Röbert [LGPL-3.0]
- **allow-right-click** — lunu-bounir [GPL-3.0]
- **url-tracking-stripper** — TraderStf [MIT]
- **enable-permissions** — MouadBourbian [MIT]
- **Popup Blocker Strict** — schomery [MPL-2.0]
- **Emy** — anto0102 [MIT]
- **YoutubeAdblock** — SysAdminDoc [MIT]

For full upstream attributions, repository links, and third-party notices, please see:  
👉 [**`THIRD_PARTY_NOTICES.md`**](THIRD_PARTY_NOTICES.md)

---

**Author:** [kychitoge](https://github.com/kychitoge)  
**Repository:** [https://github.com/kychitoge/vandupure](https://github.com/kychitoge/vandupure)
