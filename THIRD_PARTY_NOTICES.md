# THIRD-PARTY OPEN SOURCE NOTICES & ACKNOWLEDGMENTS

> **Project:** Vân Du Pure (`vandupure`)  
> **Author:** kychitoge (<https://github.com/kychitoge/vandupure>)  
> **License:** GNU General Public License v3.0 (GPL-3.0)

Vân Du Pure respectfully acknowledges and credits the pioneering open-source projects, researchers, and engineers whose groundbreaking work, security insights, and algorithms inspired and informed our client-first Manifest V3 implementation.

All referenced algorithmic techniques were studied and reimplemented in clean, modern, strict-mode TypeScript specifically designed for Chrome Manifest V3 without copying binary blobs or legacy webRequest APIs.

---

## 1. Upstream Open Source References & Attributions

| # | Project Name | Upstream Author / Organization | Upstream License | Upstream Repository | Algorithmic Inspirations & Patterns Applied |
|:---:|:---|:---|:---:|:---|:---|
| 1 | **uBlock Origin (uBO)** | Raymond Hill (gorhill) | GPL-3.0 | [github.com/gorhill/uBlock](https://github.com/gorhill/uBlock) | Cosmetic Filtering architecture, WeakSet element deduplication, dynamic stylesheet injection, DOM collapsing logic (`vAPI.domCollapser`). |
| 2 | **uBlock Origin Lite (uBOL)** | Raymond Hill (gorhill) | GPL-3.0 | [github.com/uBlockOrigin/uBOL-home](https://github.com/uBlockOrigin/uBOL-home) | Declarative Net Request (DNR) MV3 rule partition, dynamic DNR rule compiler, ruleset packaging. |
| 3 | **Adguard Scriptlets** | AdguardTeam | LGPL-3.0 | [github.com/AdguardTeam/Scriptlets](https://github.com/AdguardTeam/Scriptlets) | Google AdSense (`window.adsbygoogle`) stubbing, Google Publisher Tag (`googletag`) mock, zero-height anti-adblock defusers. |
| 4 | **Adguard Popup Blocker** | AdguardTeam | LGPL-3.0 | [github.com/AdguardTeam/PopupBlocker](https://github.com/AdguardTeam/PopupBlocker) | `composedPath` event inspection, transparent full-screen clickjacking overlay detection, Mock Window Proxy (`simulateWindow`). |
| 5 | **Popup Blocker Strict** | schomery | MPL-2.0 | [github.com/schomery/popup-blocker](https://github.com/schomery/popup-blocker) | Anti-Tabunder redirect guard, safe host verification, iframe `contentWindow` proxying. |
| 6 | **ClearURLs** | Kevin Röbert | LGPL-3.0 | [gitlab.com/KevinRoebert/ClearURLs](https://gitlab.com/KevinRoebert/ClearURLs) | URL tracking parameter taxonomy, recursive redirect unwrapping (`google.com/url`, `l.facebook.com`, `out.reddit.com`). |
| 7 | **url-tracking-stripper** | TraderStf | MIT | [github.com/TraderStf/url-tracking-stripper](https://github.com/TraderStf/url-tracking-stripper) | Prefix-grouped telemetry parameters (`utm_`, `_hs`, `mc_`, `mkt_`, `pk_`, `aff_`), $O(k)$ URL SearchParams purging. |
| 8 | **allow-right-click** | lunu-bounir | GPL-3.0 | [github.com/lunu-bounir/allow-right-click](https://github.com/lunu-bounir/allow-right-click) | Capture-phase event unblocking (`e.stopImmediatePropagation()`), `user-select: text !important`, transparent shield buster via `elementsFromPoint`. |
| 9 | **enable-permissions** | MouadBourbian | MIT | [github.com/MouadBourbian/enable-permissions](https://github.com/MouadBourbian/enable-permissions) | Keyboard shortcut shield (`Ctrl/Cmd + C, V, X, A`), productivity app bypass strategy. |
| 10 | **Emy** | anto0102 | MIT | [github.com/anto0102/Emy](https://github.com/anto0102/Emy) | YouTube player response mutation, `window.ytcfg` interceptor, ad-keys neutralizer. |
| 11 | **YoutubeAdblock** | SysAdminDoc | MIT | [github.com/SysAdminDoc/YoutubeAdblock](https://github.com/SysAdminDoc/YoutubeAdblock) | Native HTML5 video `timeupdate` fast-forward, zero-lag ad skipper, playback rate preservation. |

---

## 2. License Terms Summary

This software is licensed under the **GNU General Public License v3.0 (GPL-3.0)**, preserving the copyleft freedoms of upstream components (notably `uBlock Origin` and `allow-right-click`).

Under GPL-3.0, you are free to run, study, share, and modify this software provided that any distributed derivative works remain licensed under GPL-3.0 with complete corresponding source code.

For complete license terms, please see the [LICENSE](LICENSE) file.
