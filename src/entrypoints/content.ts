import { defineContentScript } from 'wxt/sandbox';
import { StorageAdapter, isExtensionValid, type AppSettings } from '../core/storage/index.js';
import { Logger } from '../core/logger/index.js';
import { globalRuleRegistry } from '../core/rules/registry.js';
import { globalRuleEngine } from '../core/rules/engine.js';
import { registerDefaultRules } from '../rules/index.js';
import { listenSpaTransitions } from '../modules/navigation/spaListener.js';
import { injectCss, removeCss } from '../modules/css/cssInjector.js';
import { installPopunderGuard } from '../modules/script/popunderGuard.js';
import { startElementPicker } from '../modules/dom/elementPicker.js';
import {
  isYouTubeRadioUrl,
  getCleanYouTubeWatchUrl
} from '../rules/sites/youtube.rules.js';
import { cleanupEmptyAdContainers, scanAndRemoveOverlays } from '../modules/dom/overlayRemover.js';
import { runFullGhostCleanup } from '../modules/dom/ghostCleaner.js';
import { killInterstitialOverlays, neutralizeCountdownGlobals } from '../modules/dom/interstitialKiller.js';
import { notifyItemBlocked } from '../core/rules/engine.js';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  async main() {
    try {
      // 1. Register all declarative rules in runtime
      registerDefaultRules();

      let uninstallPopunderGuard: (() => void) | null = null;
      let cachedSettings: AppSettings | null = null;
      const seenCosmeticAds = new WeakSet<Element>();

      const getSettingsFast = async (): Promise<AppSettings> => {
        if (!cachedSettings) {
          cachedSettings = await StorageAdapter.getSettings();
        }
        return cachedSettings;
      };

      const applyRulesForPage = async () => {
        if (!isExtensionValid()) {
          globalRuleEngine.cleanup();
          uninstallPopunderGuard?.();
          return;
        }

        try {
          const settings = await getSettingsFast();
          const excluded = await StorageAdapter.isSiteExcluded(window.location.hostname);
          if (excluded || !settings.masterEnabled || !settings.blockAds) {
            removeCss('vandu-custom-cosmetic-style');
            const defuserStyle = document.getElementById('vandu-ad-defuser-styles');
            if (defuserStyle) defuserStyle.remove();
          }

          if (!settings.masterEnabled || excluded) {
            document.documentElement.dataset.vanduDisabled = 'true';
            try { localStorage.setItem('vandu-disabled', 'true'); } catch {}
          } else {
            delete document.documentElement.dataset.vanduDisabled;
            try { localStorage.removeItem('vandu-disabled'); } catch {}
          }

          if (!settings.blockPopups || !settings.masterEnabled || excluded) {
            document.documentElement.dataset.vanduBlockPopups = 'false';
            try { localStorage.setItem('vandu-block-popups', 'false'); } catch {}
          } else {
            delete document.documentElement.dataset.vanduBlockPopups;
            try { localStorage.removeItem('vandu-block-popups'); } catch {}
          }

          if (!settings.masterEnabled) {
            globalRuleEngine.cleanup();
            uninstallPopunderGuard?.();
            removeCss('vandu-custom-cosmetic-style');
            const defuserStyle = document.getElementById('vandu-ad-defuser-styles');
            if (defuserStyle) defuserStyle.remove();
            return;
          }

          if (excluded) {
            globalRuleEngine.cleanup();
            uninstallPopunderGuard?.();
            removeCss('vandu-custom-cosmetic-style');
            const defuserStyle = document.getElementById('vandu-ad-defuser-styles');
            if (defuserStyle) defuserStyle.remove();
            return;
          }

          // Cleanup any previous execution listeners
          globalRuleEngine.cleanup();
          uninstallPopunderGuard?.();

          // A. Popunder & Click-Hijack Guard
          if (settings.blockPopups) {
            uninstallPopunderGuard = installPopunderGuard((blockedTarget) => {
              notifyItemBlocked('popups', 1);
              Logger.info(`Blocked popup / click-hijack: ${blockedTarget || 'popunder'}`);
            });
          }

          // B. Inject Custom Cosmetic Selectors if enabled
          if (settings.blockAds && settings.customCosmeticSelectors && settings.customCosmeticSelectors.length > 0) {
            const selectors = settings.customCosmeticSelectors.join(',\n');
            injectCss(
              `:is(${selectors}) { display: none !important; visibility: hidden !important; height: 0 !important; opacity: 0 !important; pointer-events: none !important; }`,
              'vandu-custom-cosmetic-style'
            );
          }

          // C. Get matched declarative rules for current page
          const matchedRules = globalRuleRegistry.getMatchedRules(
            window.location.href,
            undefined,
            settings.excludedSites
          );

          // Filter based on user toggle settings
          const activeRules = matchedRules.filter((rule) => {
            if (rule.category === 'tracking' && !settings.stripTracking) return false;
            if (rule.category === 'unblock' && !settings.unblockDom) return false;
            if (rule.category === 'youtube' && !settings.stripYoutubeRadio) return false;
            if (rule.category === 'ads' && !settings.blockAds) return false;
            return true;
          });

          // Execute all active rules
          const currentUrl = new URL(window.location.href);
          globalRuleEngine.executeAll(activeRules, currentUrl);

          // D. Detect and count cosmetic ads on page (deduplicated via WeakSet & double-pass)
          if (settings.blockAds) {
            const scanCosmeticAds = () => {
              try {
                // Clean up ghost ad containers, blocked placeholders, and overlays
                cleanupEmptyAdContainers();
                scanAndRemoveOverlays();
                runFullGhostCleanup();
                killInterstitialOverlays();
                neutralizeCountdownGlobals();

                const ads = document.querySelectorAll(
                  'ins.adsbygoogle, [id^="google_ads_iframe"], [id^="div-gpt-ad"], [id*="-ad-slot"], [class*="-ad-slot"], ' +
                  '.ad-container, .adsbox, .ad-banner, .ad-placement, .ad_wrapper, div[data-ad-unit], div[data-ad-client], ' +
                  'div[id*="popup-banner"], div[class*="popup-banner"], div[id*="float-banner"], div[class*="float-banner"], ' +
                  'div[id*="sticky-banner"], div[class*="sticky-banner"], div[id*="bottom-banner"], div[class*="bottom-banner"], ' +
                  'div[class*="qc-container"], div[id*="qc-container"]'
                );
                let newCount = 0;
                ads.forEach((el) => {
                  if (!seenCosmeticAds.has(el)) {
                    seenCosmeticAds.add(el);
                    newCount++;
                  }
                });
                if (newCount > 0) {
                  notifyItemBlocked('ads', newCount);
                }
              } catch {}
            };

            // Two passes: 1.2s for static ads, 3.0s for lazy-loaded ads
            setTimeout(scanCosmeticAds, 1200);
            setTimeout(scanCosmeticAds, 3000);
          }

          Logger.info(`Applied ${activeRules.length} rules on ${window.location.hostname}`);
        } catch {
          // Context invalidated or navigation abort, gracefully ignore
        }
      };

      await applyRulesForPage();

      // 2. YouTube-specific SPA navigation & High-Performance Ad Skipper
      const isYouTube =
        window.location.hostname === 'youtube.com' ||
        window.location.hostname.endsWith('.youtube.com');

      if (isYouTube) {
        const checkAndCleanSpaUrl = async (navUrl?: URL) => {
          if (!isExtensionValid()) return;

          try {
            const settings = await getSettingsFast();
            if (!settings.masterEnabled || !settings.stripYoutubeRadio) return;

            const url = navUrl || new URL(window.location.href);
            if (isYouTubeRadioUrl(url)) {
              const cleanUrl = getCleanYouTubeWatchUrl(url);
              notifyItemBlocked('youtube', 1);
              Logger.info(`Auto-breakout from Mix playlist to standalone: ${cleanUrl}`);
              if (window.location.href !== cleanUrl) {
                window.history.replaceState(null, '', cleanUrl);
                try {
                  window.dispatchEvent(new CustomEvent('yt-navigate-finish'));
                } catch {}
              }
            }
          } catch {
            // Ignore URL parsing or storage errors
          }
        };

        // P4 System Clean: youtube-main.content.ts (Main World) executes 100% of the player skipping logic.
        // Content script only listens for the edge-triggered event to update statistics and badge!
        window.addEventListener('vandu:youtube_ad_skipped', async () => {
          if (!isExtensionValid()) return;
          try {
            const settings = await getSettingsFast();
            if (settings.masterEnabled && settings.skipYoutubeAds) {
              notifyItemBlocked('youtube', 1);
              Logger.info('Fast-skipped YouTube Video Ad registered from Main World');
            }
          } catch {}
        });

        listenSpaTransitions(
          ['yt-navigate-start', 'yt-navigate-finish', 'yt-page-data-fetched', 'yt-action'],
          (currentUrl) => {
            applyRulesForPage().catch(() => {});
            checkAndCleanSpaUrl(currentUrl);
          }
        );
      }

      // 3. Context Menu target tracking & Element Picker listener
      let lastContextTarget: HTMLElement | null = null;
      if (typeof window !== 'undefined') {
        window.addEventListener('contextmenu', (e: MouseEvent) => {
          lastContextTarget = (e.target as HTMLElement) || null;
        }, { capture: true });
      }

      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
          if (msg && msg.type === 'START_ELEMENT_PICKER') {
            startElementPicker(lastContextTarget || undefined);
            lastContextTarget = null;
            sendResponse?.({ success: true });
          }
        });
      }

      // 3b. In-page direct Keyboard Shortcuts listener (Alt+Shift+X / Alt+Shift+S)
      // Provides 100% reliable execution even if Chrome Commands fail to bind or conflict
      if (typeof window !== 'undefined') {
        window.addEventListener('keydown', async (e: KeyboardEvent) => {
          if (e.altKey && e.shiftKey) {
            const key = e.key.toUpperCase();
            if (key === 'X') {
              e.preventDefault();
              e.stopPropagation();
              startElementPicker();
            } else if (key === 'S') {
              e.preventDefault();
              e.stopPropagation();
              try {
                const host = window.location.hostname.replace(/^www\./, '');
                await StorageAdapter.toggleCurrentSite(host);
              } catch {}
            }
          }
        }, { capture: true });
      }

      // 4. Listen for runtime storage updates without requiring page reload
      if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
          if (!isExtensionValid()) return;
          if (areaName === 'local' && changes['vandu_settings_v2']) {
            const oldVal = changes['vandu_settings_v2'].oldValue as AppSettings | undefined;
            const newVal = changes['vandu_settings_v2'].newValue as AppSettings | undefined;
            cachedSettings = newVal || null;

            // Prevent infinite loop: If ONLY stats changed, DO NOT re-run applyRulesForPage
            if (oldVal && newVal) {
              const togglesChanged =
                oldVal.masterEnabled !== newVal.masterEnabled ||
                oldVal.blockAds !== newVal.blockAds ||
                oldVal.skipYoutubeAds !== newVal.skipYoutubeAds ||
                oldVal.blockPopups !== newVal.blockPopups ||
                oldVal.stripTracking !== newVal.stripTracking ||
                oldVal.unblockDom !== newVal.unblockDom ||
                oldVal.stripYoutubeRadio !== newVal.stripYoutubeRadio ||
                JSON.stringify(oldVal.excludedSites) !== JSON.stringify(newVal.excludedSites) ||
                JSON.stringify(oldVal.customCosmeticSelectors) !== JSON.stringify(newVal.customCosmeticSelectors);

              if (!togglesChanged) {
                return;
              }
            }

            applyRulesForPage().catch(() => {});
          }
        });
      }
    } catch (err) {
      Logger.error('Content script initialization error:', err);
    }
  }
});
