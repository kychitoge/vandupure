/**
 * Ghost Cleaner & Placeholder Cleanup Engine
 * Reference: uBO vAPI.domCollapser & AdGuard Defusers
 * 
 * Collapses blocked media placeholders (iframes, images), empty parent wrappers with fixed heights,
 * ghost backdrops and abandoned sticky banners to restore clean page layout.
 */

import { unlockScroll, isSafeSearchOrPortal } from './overlayRemover.js';

export interface GhostCleanupStats {
  collapsedMedia: number;
  collapsedWrappers: number;
  cleanedBackdrops: number;
  cleanedSticky: number;
}

const KNOWN_AD_DOMAINS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleads',
  'adservice.google',
  'popads.net',
  'adsterra.com',
  'propellerads.com',
  'exoclick.com',
  'trafficjunky.com',
  'taboola.com',
  'outbrain.com',
  'juicyads.com',
  'adnxs.com',
  'criteo.com',
  'rubiconproject.com',
  'smartadserver.com',
  'openx.net',
  'pubmatic.com',
  'media.net',
  'mgid.com',
  'revcontent.com',
  'ad-delivery.net',
  'hay.win',
  'haywin'
];

/**
 * Checks if a URL matches any known ad/tracking network patterns
 */
export function isAdMediaUrl(urlStr?: string | null): boolean {
  if (!urlStr) return false;
  const lower = urlStr.toLowerCase();
  return KNOWN_AD_DOMAINS.some((domain) => lower.includes(domain));
}

/**
 * 1. Collapse blocked media placeholders (iframes, broken images, embeds)
 */
export function collapseBlockedMediaPlaceholders(): number {
  if (typeof document === 'undefined') return 0;
  if (isSafeSearchOrPortal()) return 0;

  let count = 0;
  const mediaElements = document.querySelectorAll<HTMLElement>('iframe, img, embed, object');

  mediaElements.forEach((el) => {
    try {
      let isAdMedia = false;
      const src = el.getAttribute('src') || '';
      const dataSrc = el.getAttribute('data-src') || '';

      if (isAdMediaUrl(src) || isAdMediaUrl(dataSrc)) {
        isAdMedia = true;
      } else if (el.tagName.toLowerCase() === 'iframe') {
        const id = el.id || '';
        const name = el.getAttribute('name') || '';
        const cls = el.className || '';
        if (
          id.startsWith('google_ads_iframe') ||
          id.includes('aswift_') ||
          name.startsWith('google_ads_iframe') ||
          cls.includes('adsbygoogle')
        ) {
          isAdMedia = true;
        }
      }

      if (isAdMedia) {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('height', '0px', 'important');
        el.style.setProperty('min-height', '0px', 'important');
        el.style.setProperty('width', '0px', 'important');
        el.style.setProperty('min-width', '0px', 'important');
        el.style.setProperty('margin', '0px', 'important');
        el.style.setProperty('padding', '0px', 'important');
        el.style.setProperty('border', 'none', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
        el.setAttribute('data-vandu-collapsed', 'true');
        count++;
      }
    } catch {}
  });

  return count;
}

const PROTECTED_TAGS = new Set([
  'html',
  'body',
  'main',
  'article',
  'header',
  'nav',
  'footer',
  'form',
  'table',
  'thead',
  'tbody'
]);

/**
 * 2. Collapse empty parent wrappers that previously contained ad slots
 * Traverses up parent hierarchy (up to maxDepth) and collapses container if it has no meaningful text/content.
 */
export function collapseEmptyParentWrappers(maxDepth = 3): number {
  if (typeof document === 'undefined') return 0;
  if (isSafeSearchOrPortal()) return 0;

  let count = 0;
  const adCandidates = document.querySelectorAll<HTMLElement>(
    '[data-vandu-collapsed="true"], ' +
    'ins.adsbygoogle, ' +
    '[id^="div-gpt-ad"], ' +
    '[id^="google_ads_iframe"], ' +
    '.ad-holder, .ads-holder, .ad-container, .ad-wrapper, .ad_wrapper, .adsbox, .ad-banner, .banner-ad, ' +
    'div[data-ad-unit], div[data-ad-client]'
  );

  const collapsedParents = new WeakSet<HTMLElement>();

  adCandidates.forEach((startEl) => {
    let current: HTMLElement | null = startEl.parentElement;
    let depth = 0;

    while (current && depth < maxDepth) {
      if (collapsedParents.has(current)) {
        break;
      }

      const tagName = current.tagName.toLowerCase();
      if (PROTECTED_TAGS.has(tagName)) {
        break;
      }

      // Check for protected ids/classes (unless it's an interstitial container)
      const id = (current.id || '').toLowerCase();
      const cls = (typeof current.className === 'string' ? current.className : '').toLowerCase();
      const isExplicitInterstitial = id.includes('interstitial') || cls.includes('interstitial');
      if (
        !isExplicitInterstitial &&
        (id === 'root' ||
        id === 'app' ||
        id === 'main' ||
        id === 'content' ||
        cls.includes('main-content') ||
        cls.includes('article-content') ||
        cls.includes('container-fluid'))
      ) {
        break;
      }

      // Check if this parent has real textual content
      const text = current.innerText ? current.innerText.trim() : '';
      if (text.length >= 25) {
        // Has genuine article or page content, do not collapse
        break;
      }

      // Check if it has interactive forms or media
      const interactiveEls = current.querySelectorAll('video, audio, canvas, input, textarea, select, form');
      if (interactiveEls.length > 0) {
        break;
      }

      // If wrapper is an ad placeholder wrapper or has almost no content
      const isAdWrapper =
        id.includes('ad') ||
        cls.includes('ad') ||
        cls.includes('banner') ||
        current.hasAttribute('data-vandu-collapsed') ||
        text.length === 0;

      if (isAdWrapper) {
        current.style.setProperty('display', 'none', 'important');
        current.style.setProperty('height', '0px', 'important');
        current.style.setProperty('min-height', '0px', 'important');
        current.style.setProperty('max-height', '0px', 'important');
        current.style.setProperty('margin', '0px', 'important');
        current.style.setProperty('padding', '0px', 'important');
        current.style.setProperty('border', 'none', 'important');
        current.style.setProperty('pointer-events', 'none', 'important');
        current.setAttribute('data-vandu-wrapper-collapsed', 'true');
        collapsedParents.add(current);
        count++;
      }

      current = current.parentElement;
      depth++;
    }
  });

  return count;
}

/**
 * 3. Ghost Backdrop Buster
 * Removes orphaned darken/blur backdrops left behind after popups/ads were defused.
 */
export function cleanupGhostBackdrops(): number {
  if (typeof document === 'undefined') return 0;
  if (isSafeSearchOrPortal()) return 0;

  let count = 0;
  const backdrops = document.querySelectorAll<HTMLElement>(
    '.modal-backdrop, .popup-backdrop, div[class*="backdrop"], div[id*="backdrop"], ' +
    'div[class*="overlay-backdrop"], div[id*="overlay-backdrop"]'
  );

  backdrops.forEach((el) => {
    try {
      const text = el.innerText ? el.innerText.trim() : '';
      const hasForm = el.querySelector('form, input, video') !== null;
      if (!hasForm && text.length < 15) {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
        el.setAttribute('data-vandu-backdrop-cleaned', 'true');
        count++;
      }
    } catch {}
  });

  if (count > 0) {
    unlockScroll();
  }

  return count;
}

/**
 * 4. Sticky Bottom & Top Banner Buster
 * Neutralizes residual fixed banners attached to viewport edges.
 */
export function cleanupStickyBottomBanners(): number {
  if (typeof document === 'undefined') return 0;
  if (isSafeSearchOrPortal()) return 0;

  let count = 0;
  const stickyCandidates = document.querySelectorAll<HTMLElement>(
    'div[id*="bottom-banner"], div[class*="bottom-banner"], ' +
    'div[id*="sticky-banner"], div[class*="sticky-banner"], ' +
    'div[id*="float-banner"], div[class*="float-banner"], ' +
    'div[id*="sticky-bottom"], div[class*="sticky-bottom"], ' +
    'div[class*="qc-container"], div[id*="qc-container"]'
  );

  stickyCandidates.forEach((el) => {
    try {
      const text = el.innerText ? el.innerText.trim() : '';
      const hasForm = el.querySelector('form, input, video') !== null;
      if (!hasForm && text.length < 30) {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('height', '0px', 'important');
        el.style.setProperty('min-height', '0px', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
        el.setAttribute('data-vandu-sticky-cleaned', 'true');
        count++;
      }
    } catch {}
  });

  return count;
}

/**
 * Runs full ghost cleaner pipeline safely
 */
export function runFullGhostCleanup(): GhostCleanupStats {
  const collapsedMedia = collapseBlockedMediaPlaceholders();
  const collapsedWrappers = collapseEmptyParentWrappers();
  const cleanedBackdrops = cleanupGhostBackdrops();
  const cleanedSticky = cleanupStickyBottomBanners();

  return {
    collapsedMedia,
    collapsedWrappers,
    cleanedBackdrops,
    cleanedSticky
  };
}
