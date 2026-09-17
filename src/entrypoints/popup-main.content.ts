import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ['<all_urls>'],
  world: 'MAIN',
  runAt: 'document_start',
  allFrames: true,
  main() {
    if (typeof window === 'undefined') return;

    // Prevent double injection in the same execution context
    if ((window as any).__vandu_popup_main_injected) {
      return;
    }
    (window as any).__vandu_popup_main_injected = true;

    // 1. Safe patterns & deceptive indicators
    const SAFE_POPUP_HOST_PATTERNS = [
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

    const DECEPTIVE_AD_PATTERNS = [
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

    function isSafeHost(urlStr?: string): boolean {
      if (!urlStr) return false;
      try {
        const base = window.location?.href || 'http://localhost';
        const parsed = new URL(urlStr, base);
        const host = parsed.hostname.toLowerCase();
        return SAFE_POPUP_HOST_PATTERNS.some((p) => host === p || host.endsWith('.' + p));
      } catch {
        return false;
      }
    }

    function isDeceptive(urlStr?: string, features?: string): boolean {
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
      const url = String(urlStr).toLowerCase();
      if (isSafeHost(url)) return false;
      return DECEPTIVE_AD_PATTERNS.some((p) => url.includes(p));
    }

    // 2. True Click Analysis (AdguardPopupBlocker composedPath & event examination)
    interface TrustedInteractionInfo {
      timestamp: number;
      isTrusted: boolean;
      hasRealInteractiveTarget: boolean;
      targetHref?: string;
      targetTagName?: string;
      isTransparentMask?: boolean;
    }

    let lastInteraction: TrustedInteractionInfo = {
      timestamp: 0,
      isTrusted: false,
      hasRealInteractiveTarget: false
    };

    const getEventPath = (e: Event): EventTarget[] => {
      if (typeof e.composedPath === 'function') {
        return e.composedPath();
      }
      const path: EventTarget[] = [];
      let current = e.target as Node | null;
      while (current) {
        path.push(current);
        current = current.parentNode;
      }
      return path;
    };

    const markInteraction = (e: Event) => {
      if (!e.isTrusted) return;

      const path = getEventPath(e);
      let hasRealInteractiveTarget = false;
      let targetHref: string | undefined;
      let targetTagName: string | undefined;
      let isTransparentMask = false;

      // Examine path for legitimate interactive element
      for (let i = 0; i < path.length; i++) {
        const el = path[i];
        if (!el || !(el instanceof HTMLElement)) continue;

        // Check if top hit element is a transparent clickjacking mask
        if (i === 0) {
          try {
            const style = window.getComputedStyle(el);
            const pos = style.position;
            const op = parseFloat(style.opacity || '1');
            const bg = style.backgroundColor;
            const isTransparent = op <= 0.05 || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)';
            const z = parseInt(style.zIndex || '0', 10);
            if ((pos === 'fixed' || pos === 'absolute') && z >= 80 && isTransparent && el.offsetWidth >= window.innerWidth * 0.4) {
              isTransparentMask = true;
            }
          } catch {}
        }

        const tag = el.tagName.toUpperCase();
        if (
          tag === 'A' ||
          tag === 'BUTTON' ||
          tag === 'INPUT' ||
          tag === 'SELECT' ||
          tag === 'TEXTAREA' ||
          tag === 'AREA' ||
          el.getAttribute('role') === 'button' ||
          el.hasAttribute('onclick')
        ) {
          hasRealInteractiveTarget = true;
          targetTagName = tag;
          if (tag === 'A') {
            targetHref = (el as HTMLAnchorElement).href;
          }
          break;
        }
      }

      lastInteraction = {
        timestamp: Date.now(),
        isTrusted: true,
        hasRealInteractiveTarget,
        targetHref,
        targetTagName,
        isTransparentMask
      };
    };

    window.addEventListener('click', markInteraction, { capture: true, passive: true });
    window.addEventListener('mousedown', markInteraction, { capture: true, passive: true });
    window.addEventListener('pointerdown', markInteraction, { capture: true, passive: true });
    window.addEventListener('keydown', (e) => {
      if (e.isTrusted && ['Enter', ' ', 'Spacebar'].includes(e.key)) {
        lastInteraction = {
          timestamp: Date.now(),
          isTrusted: true,
          hasRealInteractiveTarget: true,
          targetTagName: 'KEYBOARD'
        };
      }
    }, { capture: true, passive: true });

    function isUserInitiated(): boolean {
      const delta = Date.now() - lastInteraction.timestamp;
      if (!lastInteraction.isTrusted || delta > 3000) return false;
      // If the click was caught on an invisible mask, strictly reject!
      if (lastInteraction.isTransparentMask) return false;
      // If user clicked a real interactive button/link/input, allow within 3s (accommodating async login calls)
      if (lastInteraction.hasRealInteractiveTarget) {
        return true;
      }
      // If user clicked somewhere else on the document without a button/link, allow only if very recent (< 600ms)
      return delta < 600;
    }

    // 3. Mock Window Proxy (simulateWindow inspired by schomery/popup-blocker & AdGuard)
    function createMockWindow(targetUrl?: string): any {
      const baseObj: Record<string, any> = {
        closed: false,
        name: '',
        opener: window,
        parent: window,
        top: window,
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

      // Recursive proxy to catch any deeper method/prop access (e.g. win.location.replace, win.customProp)
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
            // Return an empty stub function for unknown function calls
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

    function isPopupBlockerDisabled(): boolean {
      if (document.documentElement.dataset.vanduBlockPopups === 'false') return true;
      try {
        if (localStorage.getItem('vandu-block-popups') === 'false') return true;
      } catch {}
      return false;
    }

    // 4. Dispatch notification to Isolated World
    function notifyBlocked(url: string, type: string) {
      try {
        window.dispatchEvent(
          new CustomEvent('vandu:popup_blocked', {
            detail: {
              url: url || 'blocked_popup',
              type,
              timestamp: Date.now()
            }
          })
        );
      } catch {}
    }

    // 5. Intercept window.open
    const originalOpen = window.open;
    const protectedWindows = new WeakSet<Window>();

    function installPopupInterceptor(w: Window = window) {
      if (protectedWindows.has(w)) return;
      protectedWindows.add(w);

      try {
        w.open = function (url?: string | URL, target?: string, features?: string): any {
          // If extension popup blocker is explicitly disabled via root dataset or localStorage
          if (isPopupBlockerDisabled()) {
            return originalOpen.call(w, url as any, target as any, features as any);
          }

          const urlStr = url ? String(url) : '';

          // 1. If opening a named frame that already exists in window.frames, allow it
          if (target && typeof target === 'string' && (w.frames as any)[target]) {
            return originalOpen.call(w, url as any, target as any, features as any);
          }

          // 2. Safe host check (OAuth / Payment / Known SSO)
          if (isSafeHost(urlStr)) {
            return originalOpen.call(w, url as any, target as any, features as any);
          }

          // 3. Deceptive features check (popunder, hidden window)
          if (isDeceptive(urlStr, features)) {
            notifyBlocked(urlStr, 'deceptive_window_open');
            return createMockWindow(urlStr);
          }

          // 4. If user initiated click AND opening is not deceptive: allow standard user navigation (even cross-origin target="_blank")
          if (isUserInitiated() && !isDeceptive(urlStr, features)) {
            return originalOpen.call(w, url as any, target as any, features as any);
          }

          // 5. Block deceptive popups, popunders, or any unrequested script-initiated popups
          notifyBlocked(urlStr, isUserInitiated() ? 'deceptive_user_click' : 'script_window_open');
          return createMockWindow(urlStr);
        };
      } catch {}

      // 6. Hook HTMLAnchorElement.prototype.click & dispatchEvent
      try {
        const winAny = w as any;
        const originalAnchorClick = winAny.HTMLAnchorElement?.prototype?.click;
        if (originalAnchorClick) {
          winAny.HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
            if (!isPopupBlockerDisabled()) {
              const target = this.getAttribute('target');
              const href = this.getAttribute('href') || this.href;

              if (target === '_blank' && !isSafeHost(href) && (!isUserInitiated() || isDeceptive(href))) {
                notifyBlocked(href || '', 'synthetic_anchor_click');
                return;
              }
            }
            return originalAnchorClick.apply(this);
          };
        }

        const originalAnchorDispatch = winAny.HTMLAnchorElement?.prototype?.dispatchEvent;
        if (originalAnchorDispatch) {
          winAny.HTMLAnchorElement.prototype.dispatchEvent = function (this: HTMLAnchorElement, event: Event) {
            if (!isPopupBlockerDisabled()) {
              if (event && ['click', 'auxclick', 'dblclick'].includes(event.type)) {
                const target = this.getAttribute('target');
                const href = this.getAttribute('href') || this.href;

                if (target === '_blank' && !isSafeHost(href) && (!event.isTrusted || isDeceptive(href))) {
                  notifyBlocked(href || '', 'synthetic_anchor_dispatch');
                  return false;
                }
              }
            }
            return originalAnchorDispatch.call(this, event);
          };
        }
      } catch {}

      // 7. Hook HTMLFormElement.prototype.submit (anti popunder via target="_blank" form)
      try {
        const winAny = w as any;
        const originalFormSubmit = winAny.HTMLFormElement?.prototype?.submit;
        if (originalFormSubmit) {
          winAny.HTMLFormElement.prototype.submit = function (this: HTMLFormElement) {
            if (!isPopupBlockerDisabled()) {
              const target = this.getAttribute('target');
              const action = this.getAttribute('action') || this.action;
              if (target === '_blank' && !isSafeHost(action) && (!isUserInitiated() || isDeceptive(action))) {
                notifyBlocked(action || '', 'form_popup_submit');
                return;
              }
            }
            return originalFormSubmit.apply(this);
          };
        }
      } catch {}

      // 8. Intercept newly created iframes (schomery/popup-blocker pattern)
      try {
        const winAny = w as any;
        const HTMLIFrameElement = winAny.HTMLIFrameElement;
        const HTMLFrameElement = winAny.HTMLFrameElement;
        if (HTMLIFrameElement && HTMLIFrameElement.prototype) {
          const desc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
          if (desc && desc.get) {
            const originalGet = desc.get;
            Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
              configurable: true,
              enumerable: true,
              get() {
                const cw = originalGet.call(this);
                if (cw) {
                  try {
                    installPopupInterceptor(cw);
                  } catch {}
                }
                return cw;
              }
            });
          }
        }

        if (HTMLFrameElement && HTMLFrameElement.prototype) {
          const desc = Object.getOwnPropertyDescriptor(HTMLFrameElement.prototype, 'contentWindow');
          if (desc && desc.get) {
            const originalGet = desc.get;
            Object.defineProperty(HTMLFrameElement.prototype, 'contentWindow', {
              configurable: true,
              enumerable: true,
              get() {
                const cw = originalGet.call(this);
                if (cw) {
                  try {
                    installPopupInterceptor(cw);
                  } catch {}
                }
                return cw;
              }
            });
          }
        }
      } catch {}

      // 9. Stub common pop-under library globals
      try {
        const noop = () => {};
        const dummyPopunderObj = {
          init: noop,
          setup: noop,
          serve: noop,
          addZone: noop,
          cookie: noop
        };
        const popunderGlobals = ['_pop', 'popMagic', 'BetterJsPop', 'popns', 'jsPopunder', 'phantomPopunders'];
        for (const g of popunderGlobals) {
          if ((w as any)[g] === undefined) {
            Object.defineProperty(w, g, {
              configurable: true,
              enumerable: true,
              get: () => dummyPopunderObj,
              set: () => {}
            });
          }
        }
      } catch {}
    }

    // Install on root window immediately
    installPopupInterceptor(window);
  }
});
