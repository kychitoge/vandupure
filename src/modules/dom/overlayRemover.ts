/**
 * DOM Browser Primitive: Overlay & Backdrop Remover
 * Identifies and disables full-screen blocking modals / paywalls / anti-adblock screens.
 * Contains ZERO site-specific logic.
 */

export interface OverlayScanOptions {
  minZIndex?: number;
  minViewportRatio?: number;
  ignoreSelector?: string;
  onRemoved?: (removedCount: number) => void;
}

export function unlockScroll(): void {
  if (typeof document === 'undefined') return;

  if (document.body && document.body.style) {
    if (typeof window !== 'undefined' && window.getComputedStyle) {
      const bodyStyle = window.getComputedStyle(document.body);
      if (bodyStyle.overflow === 'hidden' || bodyStyle.position === 'fixed') {
        document.body.style.setProperty('overflow', 'auto', 'important');
        document.body.style.setProperty('position', 'static', 'important');
      }
    } else {
      document.body.style.setProperty('overflow', 'auto', 'important');
      document.body.style.setProperty('position', 'static', 'important');
    }
  }

  if (document.documentElement && document.documentElement.style) {
    if (typeof window !== 'undefined' && window.getComputedStyle) {
      const htmlStyle = window.getComputedStyle(document.documentElement);
      if (htmlStyle.overflow === 'hidden') {
        document.documentElement.style.setProperty('overflow', 'auto', 'important');
      }
    } else {
      document.documentElement.style.setProperty('overflow', 'auto', 'important');
    }
  }
}

const SAFE_HOSTS = [
  'google.com',
  'google.com.vn',
  'bing.com',
  'duckduckgo.com',
  'github.com',
  'gitlab.com',
  'youtube.com',
  'chatgpt.com',
  'openai.com',
  'claude.ai',
  'anthropic.com',
  'notion.so',
  'figma.com',
  'canva.com',
  'stackoverflow.com',
  'reddit.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'facebook.com',
  'instagram.com'
];

export function isSafeSearchOrPortal(hostname?: string): boolean {
  if (!hostname && typeof window !== 'undefined' && window.location) {
    hostname = window.location.hostname;
  }
  if (!hostname) return false;
  const clean = hostname.toLowerCase().replace(/^www\./, '');
  return SAFE_HOSTS.some((h) => clean === h || clean.endsWith('.' + h));
}

export function cleanupEmptyAdContainers(): number {
  if (typeof document === 'undefined') return 0;
  let count = 0;
  const selectors = [
    '[id*="preload-ads"]',
    '[class*="preload-ads"]',
    'div[id^="_preload-ads"]',
    'div[id^="ad-preload"]',
    '.ad-holder',
    '.ads-holder',
    '.ad-container',
    'div:has(> a[href*="hay.win"])',
    'div:has(> a[href*="haywin"])'
  ];

  try {
    const adHolders = document.querySelectorAll(selectors.join(', '));
    adHolders.forEach((el) => {
      if (el instanceof HTMLElement) {
        const text = el.innerText.trim();
        const media = el.querySelectorAll('img, video, iframe');
        const hasVisibleMedia = Array.from(media).some((m) => (m as HTMLElement).offsetWidth > 0 && (m as HTMLElement).style.display !== 'none');

        // If placeholder has no visible media or only shows placeholder text (e.g. #_preload-ads-2)
        if (!hasVisibleMedia || text.startsWith('#_') || text.toLowerCase().includes('preload-ad')) {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('height', '0', 'important');
          el.style.setProperty('min-height', '0', 'important');
          el.style.setProperty('background', 'transparent', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
          count++;
        }
      }
    });
  } catch {}

  return count;
}

export function scanAndRemoveOverlays(options: OverlayScanOptions = {}): number {
  if (typeof document === 'undefined') return 0;
  if (isSafeSearchOrPortal()) return 0;

  cleanupEmptyAdContainers();

  const minZ = options.minZIndex ?? 99;
  const minRatio = options.minViewportRatio ?? 0.75;
  // Overlays are typically injected as direct children of the body. Scanning all divs is a massive CPU bottleneck.
  const candidates = document.querySelectorAll('body > div, body > section, body > aside, body > dialog, #modal-root > div');
  let count = 0;

  candidates.forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.id === 'vandu-toast-container' || el.closest('#vandu-toast-container')) return;
    if (el.id === 'vandu-element-picker-root' || el.closest('#vandu-element-picker-root')) return;
    if (options.ignoreSelector && el.closest(options.ignoreSelector)) return;

    const zIndex = parseInt(window.getComputedStyle(el).zIndex, 10);
    const pos = window.getComputedStyle(el).position;

    if ((pos === 'fixed' || pos === 'absolute') && (isNaN(zIndex) || zIndex >= minZ)) {
      const rect = el.getBoundingClientRect();
      if (rect.width >= window.innerWidth * minRatio && rect.height >= window.innerHeight * minRatio) {
        const cls = (el.className || '').toString().toLowerCase();
        const id = (el.id || '').toLowerCase();

        // Strict criteria for blocking paywall/adblock backdrops & abandoned ghost overlays
        const isKnownBackdropClass =
          cls.includes('backdrop') ||
          cls.includes('modal-overlay') ||
          cls.includes('popup-backdrop') ||
          cls.includes('popup-overlay') ||
          cls.includes('fancybox-overlay') ||
          cls.includes('mfp-bg') ||
          cls.includes('dimmer') ||
          cls.includes('adblock') ||
          cls.includes('newsletter') ||
          cls.includes('paywall') ||
          cls.includes('fc-ab-root') ||
          cls.includes('sp-message') ||
          id.includes('adblock') ||
          id.includes('paywall') ||
          id.includes('popup-overlay') ||
          id.includes('backdrop');

        const bodyLocked =
          window.getComputedStyle(document.body).overflow === 'hidden' ||
          window.getComputedStyle(document.documentElement).overflow === 'hidden';

        // Check if backdrop is an abandoned ghost container (no form, no video, no readable text)
        const hasFormOrVideo = Boolean(el.querySelector('form, video, input, main, article'));
        const bg = window.getComputedStyle(el).backgroundColor;
        const isDarkOrSemiTransparent = bg.includes('rgba') || bg.includes('rgb(0, 0, 0)') || bg.includes('hsla');
        const isGhost = !hasFormOrVideo && el.innerText.trim().length < 30;

        if (
          (isKnownBackdropClass || (isDarkOrSemiTransparent && isGhost) || (bodyLocked && (id.includes('modal') || cls.includes('modal')))) &&
          !hasFormOrVideo &&
          el.style.display !== 'none'
        ) {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
          count++;
        }
      }
    }
  });

  if (count > 0) {
    unlockScroll();
    if (options.onRemoved) {
      options.onRemoved(count);
    }
  }

  return count;
}
