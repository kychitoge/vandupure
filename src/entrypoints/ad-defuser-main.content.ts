import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ['<all_urls>'],
  world: 'MAIN',
  runAt: 'document_start',
  allFrames: true,
  main() {
    if (typeof window === 'undefined') return;

    // Prevent duplicate injection in the same frame/window
    if ((window as any).__vandu_ad_defuser_injected) {
      return;
    }
    (window as any).__vandu_ad_defuser_injected = true;

    const isDisabled = () => {
      if (document.documentElement.dataset.vanduDisabled === 'true') return true;
      try {
        if (localStorage.getItem('vandu-disabled') === 'true') return true;
      } catch {}
      return false;
    };

    // 1. Fast CSS defuser injection directly in DOM
    if (!isDisabled()) {
      try {
        const style = document.createElement('style');
        style.id = 'vandu-ad-defuser-styles';
        style.textContent = `
          .adsbygoogle,
          ins.adsbygoogle,
          [id^="google_ads_iframe"],
          [id^="div-gpt-ad"],
          div[data-ad-unit],
          div[data-ad-client] {
            display: none !important;
            visibility: hidden !important;
            height: 0px !important;
            min-height: 0px !important;
            width: 0px !important;
            min-width: 0px !important;
            margin: 0px !important;
            padding: 0px !important;
            border: none !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }
        `;
        (document.head || document.documentElement).appendChild(style);
      } catch {
        // Document might not have head yet in rare edge-cases
      }
    }

    // 1b. Anti-Adblock Detector Stubs & Bait Neutralizer (uBO / AdGuard style)
    try {
      // Common Adblock detection globals
      const safeGlobals: Record<string, any> = {
        canRunAds: true,
        can_run_ads: true,
        isAdBlockActive: false,
        adBlockDetected: false,
        adsAreBlocked: false,
        hasAdblock: false,
        hasAdBlock: false,
        adblock: false,
        adBlock: false,
        noAdBlock: true,
        noAdBlockers: true,
        isAdblockDisabled: true
      };

      for (const [key, val] of Object.entries(safeGlobals)) {
        try {
          if ((window as any)[key] === undefined) {
            Object.defineProperty(window, key, {
              configurable: true,
              enumerable: true,
              get: () => val,
              set: () => {}
            });
          }
        } catch {}
      }

      // FuckAdBlock / BlockAdBlock Defuser
      function FabDefuser(this: any) {}
      FabDefuser.prototype.check = function () { return false; };
      FabDefuser.prototype.on = function (detected: boolean, fn: any) {
        if (!detected && typeof fn === 'function') {
          try { fn(); } catch {}
        }
        return this;
      };
      FabDefuser.prototype.onDetected = function () { return this; };
      FabDefuser.prototype.onNotDetected = function (fn: any) {
        if (typeof fn === 'function') {
          try { fn(); } catch {}
        }
        return this;
      };
      FabDefuser.prototype.setOption = function () { return this; };

      const fabInstance = new (FabDefuser as any)();
      const fabProps = ['FuckAdBlock', 'fuckAdBlock', 'BlockAdBlock', 'blockAdBlock'];
      for (const prop of fabProps) {
        try {
          Object.defineProperty(window, prop, {
            configurable: true,
            enumerable: true,
            get: () => (prop.startsWith('F') || prop.startsWith('B') ? FabDefuser : fabInstance),
            set: () => {}
          });
        } catch {}
      }

      // Bait Element Neutralizer: Trap offsetHeight/clientHeight/offsetWidth for bait classes
      const BAIT_REGEX = /(?:ads?box|ad-banner|banner-ad|ad-detector|pub_300x250|ad-zone|ad_unit|afs_ads|sponsor-ad|carbon-ads)/i;
      const isBaitElement = (el: HTMLElement): boolean => {
        if (!el) return false;
        const cls = typeof el.className === 'string' ? el.className : '';
        const id = el.id || '';
        return BAIT_REGEX.test(cls) || BAIT_REGEX.test(id);
      };

      const origOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
      if (origOffsetHeight?.get) {
        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
          configurable: true,
          enumerable: true,
          get() {
            if (isBaitElement(this)) return 100;
            return origOffsetHeight.get!.call(this);
          }
        });
      }

      const origClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
      if (origClientHeight?.get) {
        Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
          configurable: true,
          enumerable: true,
          get() {
            if (isBaitElement(this)) return 100;
            return origClientHeight.get!.call(this);
          }
        });
      }

      const origOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
      if (origOffsetWidth?.get) {
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
          configurable: true,
          enumerable: true,
          get() {
            if (isBaitElement(this)) return 300;
            return origOffsetWidth.get!.call(this);
          }
        });
      }
    } catch {}

    // 2. Google AdSense Defuser (AdGuard / uBO inspired)
    try {
      const dummyAdsByGoogle: any = [];
      dummyAdsByGoogle.loaded = true;
      dummyAdsByGoogle.push = function (...args: any[]) {
        for (const item of args) {
          if (typeof item === 'function') {
            try {
              item();
            } catch {}
          } else if (item && typeof item === 'object' && typeof item.params === 'object') {
            if (typeof item.params.onload === 'function') {
              try {
                item.params.onload();
              } catch {}
            }
          }
        }
        return dummyAdsByGoogle.length;
      };

      // Process any calls already queued in window.adsbygoogle
      const existingAds = (window as any).adsbygoogle;
      if (Array.isArray(existingAds)) {
        for (const item of existingAds) {
          dummyAdsByGoogle.push(item);
        }
      }

      Object.defineProperty(window, 'adsbygoogle', {
        configurable: true,
        enumerable: true,
        get: () => dummyAdsByGoogle,
        set: (val) => {
          if (Array.isArray(val)) {
            for (const item of val) {
              dummyAdsByGoogle.push(item);
            }
          }
        }
      });
    } catch {}

    // 3. Google Publisher Tag (GPT) Defuser
    try {
      const noop = () => {};
      const chainableNoop: any = () => proxyObj;
      const proxyObj: any = new Proxy(noop, {
        get: (_target, prop) => {
          if (prop === 'then') return undefined;
          return chainableNoop;
        },
        apply: () => proxyObj
      });

      const dummyGpt: any = {
        apiReady: true,
        cmd: [],
        pubads: () => proxyObj,
        companionAds: () => proxyObj,
        sizeMapping: () => proxyObj,
        defineSlot: () => proxyObj,
        defineOutOfPageSlot: () => proxyObj,
        defineUnit: () => proxyObj,
        destroySlots: noop,
        display: noop,
        enableServices: noop,
        setTargeting: noop,
        getVersion: () => '1.0.0'
      };

      const processCmdQueue = (queue: any[]) => {
        if (!Array.isArray(queue)) return;
        while (queue.length > 0) {
          const fn = queue.shift();
          if (typeof fn === 'function') {
            try {
              fn();
            } catch {}
          }
        }
      };

      dummyGpt.cmd.push = function (...fns: any[]) {
        for (const fn of fns) {
          if (typeof fn === 'function') {
            try {
              fn();
            } catch {}
          }
        }
        return dummyGpt.cmd.length;
      };

      const existingGpt = (window as any).googletag;
      if (existingGpt && Array.isArray(existingGpt.cmd)) {
        processCmdQueue(existingGpt.cmd);
      }

      Object.defineProperty(window, 'googletag', {
        configurable: true,
        enumerable: true,
        get: () => dummyGpt,
        set: (val) => {
          if (val && Array.isArray(val.cmd)) {
            processCmdQueue(val.cmd);
          }
        }
      });
    } catch {}
  }
});
