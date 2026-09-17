/**
 * Script Browser Primitive: Popunder & Click-Hijack Guard (v3.2)
 * Inspired by schomery/popup-blocker (Popup Blocker Strict) & AdguardTeam/PopupBlocker.
 * 
 * Features:
 * - Mock Window Proxy (simulateWindow): Eliminates TypeErrors when scripts call w.focus(), w.location.href, etc.
 * - OverlayAnchorObserver: Catches full-screen transparent click-jacking anchors created within 200ms of user mousedown.
 * - Anti-Tabunder Redirect Guard: Blocks forced navigation within 2000ms after a popup is neutralized.
 * - Preserves standard OAuth/SSO login and payment gateways 100%.
 */

export const SAFE_POPUP_HOST_PATTERNS = [
  'accounts.google.com',
  'appleid.apple.com',
  'login.microsoftonline.com',
  'facebook.com',
  'github.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'paypal.com',
  'stripe.com',
  'checkout.stripe.com',
  'vnpay.vn',
  'momo.vn',
  'google.com',
  'bing.com',
  'duckduckgo.com'
];

export const DECEPTIVE_AD_PATTERNS = [
  'popads',
  'adsterra',
  'propeller',
  'exoclick',
  'trafficjunky',
  'juicyads',
  'onclick',
  'track',
  'affiliate',
  'bet',
  'casino',
  '188bet',
  'fun88',
  'w88',
  'fb88',
  'go88',
  'uk88',
  'yo88',
  'sunwin',
  'rikvip'
];

export function isSafePopupUrl(urlStr: string): boolean {
  try {
    const base = typeof window !== 'undefined' && window.location?.href ? window.location.href : 'http://localhost';
    const parsed = new URL(urlStr, base);
    const host = parsed.hostname.toLowerCase();
    return SAFE_POPUP_HOST_PATTERNS.some((pattern) => host === pattern || host.endsWith('.' + pattern));
  } catch {
    return false;
  }
}

export function isDeceptivePopup(urlStr?: string | URL, features?: string): boolean {
  const feat = (features || '').toLowerCase();
  if (
    feat.includes('popunder') ||
    feat.includes('top=9999') ||
    feat.includes('left=9999') ||
    feat.includes('width=1') ||
    feat.includes('height=1') ||
    feat.includes('width=0') ||
    feat.includes('height=0')
  ) {
    return true;
  }

  if (!urlStr) return false;
  const url = urlStr.toString().toLowerCase();

  // If matches known OAuth/Payment, strictly safe
  if (isSafePopupUrl(url)) {
    return false;
  }

  return DECEPTIVE_AD_PATTERNS.some((ad) => url.includes(ad));
}

/**
 * Creates a recursive Mock Window Proxy so external ad scripts
 * calling win.focus(), win.location.href = ..., win.document.write(...)
 * never throw TypeErrors.
 */
export function createMockWindow(targetUrl?: string): any {
  const baseObj: Record<string, any> = {
    closed: false,
    name: '',
    opener: typeof window !== 'undefined' ? window : null,
    parent: typeof window !== 'undefined' ? window : null,
    top: typeof window !== 'undefined' ? window : null,
    self: null,
    window: null,
    frames: [],
    length: 0,
    focus() {},
    blur() {},
    close() {
      baseObj.closed = true;
    },
    postMessage() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
    document: {
      write() {},
      writeln() {},
      open() {},
      close() {},
      title: '',
      createElement() {
        return {};
      },
      getElementById() {
        return null;
      },
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      head: {},
      body: {}
    },
    location: {
      href: targetUrl || '',
      assign() {},
      replace() {},
      reload() {},
      toString() {
        return targetUrl || '';
      }
    }
  };

  baseObj.self = baseObj;
  baseObj.window = baseObj;

  function makeProxy(root: any): any {
    return new Proxy(root, {
      get(target, prop, receiver) {
        if (prop in target) {
          const val = target[prop];
          if (typeof val === 'function') {
            return (...args: any[]) => val.apply(target, args);
          }
          if (typeof val === 'object' && val !== null) {
            return makeProxy(val);
          }
          return val;
        }
        return (..._args: any[]) => makeProxy({});
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      }
    });
  }

  return makeProxy(baseObj);
}

/**
 * Checks if a target DOM element is an abusive full-screen transparent click-jacking overlay.
 */
export function detectClickjackingOverlay(target: HTMLElement, win = typeof window !== 'undefined' ? window : null): boolean {
  if (!target || !win) return false;
  if (target === win.document?.body || target === win.document?.documentElement) return false;

  // SAFEGUARD: Never remove legitimate UI overlays (modals, dialogs, drawers, dropdowns)
  const role = target.getAttribute?.('role') || '';
  if (role === 'dialog' || role === 'menu' || role === 'navigation' || role === 'alertdialog') return false;
  if (target.hasAttribute?.('aria-modal') || target.closest?.('[role="dialog"], [aria-modal="true"]')) return false;

  const className = String(target.className || '').toLowerCase();
  const idName = String(target.id || '').toLowerCase();
  if (
    className.includes('modal') ||
    className.includes('dialog') ||
    className.includes('drawer') ||
    className.includes('dropdown') ||
    className.includes('radix') ||
    className.includes('headlessui') ||
    idName.includes('modal') ||
    idName.includes('dialog')
  ) {
    return false;
  }

  if (target.querySelector?.('form, button, input, textarea, select, [role="button"]')) {
    return false;
  }

  try {
    const style = win.getComputedStyle(target);
    const pos = style.position;
    const opacity = parseFloat(style.opacity || '1');
    const rgba = style.backgroundColor;
    const isTransparent = opacity <= 0.1 || rgba === 'rgba(0, 0, 0, 0)' || rgba === 'transparent';
    const zIndex = parseInt(style.zIndex || '0', 10);

    const winWidth = win.innerWidth || 1024;
    const winHeight = win.innerHeight || 768;
    const width = target.offsetWidth || 0;
    const height = target.offsetHeight || 0;

    return (
      (pos === 'fixed' || pos === 'absolute') &&
      zIndex >= 90 &&
      isTransparent &&
      width >= winWidth * 0.4 &&
      height >= winHeight * 0.4
    );
  } catch {
    return false;
  }
}

/**
 * OverlayAnchorObserver (AdGuard style):
 * Reacts to transparent anchor creation within 200ms after user mousedown.
 */
export function installOverlayAnchorObserver(onBlocked?: (url?: string | URL) => void): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  let isClickActive = false;
  let clickTimer: ReturnType<typeof setTimeout> | null = null;
  const OBSERVE_DURATION_MS = 200;

  const onMouseDown = (e: MouseEvent) => {
    if (e.isTrusted) {
      isClickActive = true;
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        isClickActive = false;
      }, OBSERVE_DURATION_MS);
    }
  };

  const neutralizeTarget = (el: HTMLElement) => {
    try {
      el.style.setProperty('pointer-events', 'none', 'important');
      el.style.setProperty('display', 'none', 'important');
      el.remove();
      if (onBlocked) onBlocked('clickjacking-overlay');
    } catch {}
  };

  const checkCenterOverlay = () => {
    if (!isClickActive) return;
    try {
      const midX = (window.innerWidth || 1000) >> 1;
      const midY = (window.innerHeight || 800) >> 1;
      const hitEl = document.elementFromPoint(midX, midY) as HTMLElement | null;
      if (hitEl && detectClickjackingOverlay(hitEl, window)) {
        neutralizeTarget(hitEl);
      }
    } catch {}
  };

  let observer: MutationObserver | null = null;
  if (typeof MutationObserver !== 'undefined' && document.documentElement) {
    observer = new MutationObserver((mutations) => {
      if (!isClickActive) return;

      for (let i = 0; i < mutations.length; i++) {
        const added = mutations[i].addedNodes;
        for (let j = 0; j < added.length; j++) {
          const node = added[j] as HTMLElement;
          if (node.nodeType === 1) {
            if (detectClickjackingOverlay(node, window)) {
              neutralizeTarget(node);
              return;
            }
            if (node.querySelectorAll) {
              const anchors = node.querySelectorAll('a[target="_blank"]');
              for (let k = 0; k < anchors.length; k++) {
                const a = anchors[k] as HTMLElement;
                if (detectClickjackingOverlay(a, window)) {
                  neutralizeTarget(a);
                  return;
                }
              }
            }
          }
        }
      }

      checkCenterOverlay();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  window.addEventListener('mousedown', onMouseDown, { capture: true, passive: true });

  return () => {
    window.removeEventListener('mousedown', onMouseDown, { capture: true });
    if (clickTimer) clearTimeout(clickTimer);
    if (observer) observer.disconnect();
  };
}

/**
 * Anti-Tabunder Redirect Guard (schomery/popup-blocker style):
 * Temporarily blocks automated redirects when a popup was blocked within 2000ms.
 */
export function installRedirectGuard(periodMs = 2000) {
  if (typeof window === 'undefined') {
    return { trigger: () => {}, cleanup: () => {} };
  }

  let redirectTimer: ReturnType<typeof setTimeout> | null = null;
  let isActive = false;

  const handleNavigate = (e: any) => {
    if (isActive && e && e.userInitiated === false) {
      try {
        const dest = e.destination?.url;
        if (dest) {
          const destUrl = new URL(dest);
          if (destUrl.origin !== window.location.origin && !isSafePopupUrl(dest)) {
            e.preventDefault?.();
          }
        }
      } catch {}
    }
  };

  const trigger = () => {
    isActive = true;
    if ((window as any).navigation) {
      (window as any).navigation.addEventListener('navigate', handleNavigate);
    }

    if (redirectTimer) clearTimeout(redirectTimer);
    redirectTimer = setTimeout(() => {
      isActive = false;
      if ((window as any).navigation) {
        (window as any).navigation.removeEventListener('navigate', handleNavigate);
      }
    }, periodMs);
  };

  const cleanup = () => {
    isActive = false;
    if (redirectTimer) clearTimeout(redirectTimer);
    if ((window as any).navigation) {
      (window as any).navigation.removeEventListener('navigate', handleNavigate);
    }
  };

  return { trigger, cleanup };
}

/**
 * Injects inline scriptlet into Main World as fallback if WXT entrypoint wasn't loaded.
 */
export function injectMainWorldPopupBlocker(): void {
  // popup-main.content.ts is registered as a native WXT content script in world: 'MAIN'.
  // No inline <script> injection needed, avoiding strict CSP violation errors.
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Displays a subtle unblock infobar at the Extension Toolbar position (top-right of viewport).
 * Matches the user preference: "mini-bar ở vị trí thanh extension. không hiện dưới góc"
 */
export function showBlockedPopupBar(blockedUrl: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;

  try {
    const existing = document.getElementById('vandu-popup-infobar');
    if (existing) existing.remove();

    let hostname = 'popup';
    try {
      hostname = new URL(blockedUrl, window.location?.href || 'http://localhost').hostname;
    } catch {
      hostname = String(blockedUrl).substring(0, 25);
    }

    const bar = document.createElement('div');
    bar.id = 'vandu-popup-infobar';
    bar.className = 'vandu-popup-infobar';
    bar.style.cssText = `
      position: fixed !important;
      top: 8px !important;
      right: 12px !important;
      z-index: 2147483647 !important;
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
      background: #ffffff !important;
      color: #1e293b !important;
      border: 1px solid #e2e8f0 !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
      border-radius: 8px !important;
      padding: 6px 12px !important;
      height: 36px !important;
      box-sizing: border-box !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 12px !important;
      line-height: 1.4 !important;
      user-select: none !important;
      animation: vanduSlideIn 0.2s ease-out !important;
    `;

    bar.innerHTML = `
      <style>
        @keyframes vanduSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>
      <span style="color: #4fa89f; display: inline-flex; align-items: center;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4fa89f" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </span>
      <span class="vandu-popup-domain" style="max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #1e293b; font-weight: 600; font-size: 12px;" title="${escapeHtml(blockedUrl)}">${escapeHtml(hostname)}</span>
      <button id="vandu-unblock-btn" class="vandu-btn-primary" title="Mở lại" aria-label="Mở lại" style="
        background: #4fa89f !important;
        color: #ffffff !important;
        border: none !important;
        border-radius: 6px !important;
        width: 28px !important;
        height: 24px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        padding: 0 !important;
        transition: background 0.15s ease !important;
      ">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      </button>
      <button id="vandu-close-btn" class="vandu-picker-btn" title="Đóng" aria-label="Đóng" style="
        background: transparent !important;
        border: none !important;
        color: #94a3b8 !important;
        cursor: pointer !important;
        width: 20px !important;
        height: 20px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 0 !important;
        border-radius: 4px !important;
        transition: color 0.15s ease !important;
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    const domainEl = bar.querySelector('.vandu-popup-domain') as HTMLElement | null;
    if (domainEl) {
      domainEl.textContent = hostname;
      domainEl.title = blockedUrl;
    }

    (document.body || document.documentElement).appendChild(bar);

    let dismissTimer: ReturnType<typeof setTimeout> | null = null;
    const startDismissTimer = () => {
      if (dismissTimer) clearTimeout(dismissTimer);
      dismissTimer = setTimeout(() => {
        bar.remove();
      }, 6000);
    };

    startDismissTimer();

    // Hover / tương tác -> pause timeout
    bar.addEventListener?.('mouseenter', () => {
      if (dismissTimer) clearTimeout(dismissTimer);
    });
    bar.addEventListener?.('mouseleave', () => {
      startDismissTimer();
    });

    const closeBtn = bar.querySelector('#vandu-close-btn');
    closeBtn?.addEventListener('click', () => {
      if (dismissTimer) clearTimeout(dismissTimer);
      bar.remove();
    });

    const unblockBtn = bar.querySelector('#vandu-unblock-btn');
    unblockBtn?.addEventListener('click', () => {
      if (dismissTimer) clearTimeout(dismissTimer);
      bar.remove();
      if (blockedUrl && (blockedUrl.startsWith('http://') || blockedUrl.startsWith('https://'))) {
        window.open(blockedUrl, '_blank');
      }
    });

    return bar;
  } catch {
    return null;
  }
}

/**
 * Installs the complete multi-layer Popup & Popunder Blocker in the page context.
 */
export function installPopunderGuard(onBlocked?: (url?: string | URL) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  // Enable flag on root element for Main World scriptlet
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.dataset.vanduBlockPopups = 'true';
  }

  // 1. Inject fallback into main world for direct window.open interception
  injectMainWorldPopupBlocker();

  // 2. Anti-Tabunder redirect guard
  const redirectGuard = installRedirectGuard(2000);

  // 3. Listen to custom event from main world
  const popupEventListener = (e: Event) => {
    const custom = e as CustomEvent<{ url?: string; type?: string }>;
    const url = custom.detail?.url;
    redirectGuard.trigger();
    if (url && typeof url === 'string' && url !== 'blocked_popup' && url !== 'clickjacking-overlay') {
      showBlockedPopupBar(url);
    }
    if (onBlocked) {
      onBlocked(url);
    }
  };

  window.addEventListener('vandu:popup_blocked', popupEventListener);

  // 4. Isolated world fallback for window.open
  const nativeOpen = window.open;
  window.open = function (url?: string | URL, target?: string, features?: string) {
    if (isDeceptivePopup(url, features)) {
      redirectGuard.trigger();
      if (onBlocked) {
        onBlocked(url);
      }
      return createMockWindow(url ? String(url) : '');
    }
    return nativeOpen.call(window, url, target, features);
  };

  // 5. Intercept link click hijacking on document
  const interceptAnchorClicks = (e: MouseEvent) => {
    const anchor = (e.target as HTMLElement)?.closest('a');
    if (!anchor || !anchor.href) return;

    if (!e.isTrusted && anchor.target === '_blank') {
      e.preventDefault();
      e.stopPropagation();
      redirectGuard.trigger();
      if (onBlocked) onBlocked(anchor.href);
      return;
    }

    if (anchor.target === '_blank' && isDeceptivePopup(anchor.href)) {
      e.preventDefault();
      e.stopPropagation();
      redirectGuard.trigger();
      if (onBlocked) onBlocked(anchor.href);
    }
  };

  // 6. Direct click-jacking overlay detector on click
  const directClickJackingCheck = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    if (detectClickjackingOverlay(target, window)) {
      e.preventDefault();
      e.stopPropagation();
      target.style.setProperty('pointer-events', 'none', 'important');
      target.style.setProperty('display', 'none', 'important');
      target.remove();
      redirectGuard.trigger();
      if (onBlocked) onBlocked('clickjacking-overlay');
    }
  };

  // 7. Install 200ms mousedown OverlayAnchorObserver (AdGuard style)
  const uninstallOverlayObserver = installOverlayAnchorObserver(onBlocked);

  if (typeof document !== 'undefined') {
    document.addEventListener('click', interceptAnchorClicks, { capture: true });
    document.addEventListener('click', directClickJackingCheck, { capture: true });
  }

  return () => {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.dataset.vanduBlockPopups = 'false';
    }
    window.removeEventListener('vandu:popup_blocked', popupEventListener);
    window.open = nativeOpen;
    redirectGuard.cleanup();
    uninstallOverlayObserver();
    if (typeof document !== 'undefined') {
      const existing = document.getElementById('vandu-popup-infobar');
      if (existing) existing.remove();
      document.removeEventListener('click', interceptAnchorClicks, { capture: true });
      document.removeEventListener('click', directClickJackingCheck, { capture: true });
    }
  };
}
