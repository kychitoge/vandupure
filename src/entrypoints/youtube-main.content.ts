import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    if (typeof window === 'undefined') return;

    if ((window as any).__vandu_yt_injected) {
      return;
    }
    (window as any).__vandu_yt_injected = true;

    const isDisabled = () => {
      if (document.documentElement.dataset.vanduDisabled === 'true') return true;
      try {
        if (localStorage.getItem('vandu-disabled') === 'true') return true;
      } catch {}
      return false;
    };

    // 0. YouTube Immune: Neutralize network_machine pipeline (uBO quick-fixes standard)
    function neutraliseExperimentFlags(target: any) {
      if (!target || typeof target !== 'object') return;
      const flags = target.EXPERIMENT_FLAGS || target.data_?.EXPERIMENT_FLAGS;
      if (flags && typeof flags === 'object') {
        flags.all_web_enable_network_machine = false;
        flags.all_web_network_machine_raw_request = false;
      }
    }

    let _ambientYtcfg = (window as any).ytcfg;
    if (_ambientYtcfg) {
      neutraliseExperimentFlags(_ambientYtcfg);
      if (typeof _ambientYtcfg.set === 'function') {
        const origSet = _ambientYtcfg.set;
        _ambientYtcfg.set = function (first: any, ...rest: any[]) {
          if (first && typeof first === 'object') {
            neutraliseExperimentFlags(first);
          }
          return origSet.apply(this, [first, ...rest]);
        };
      }
    }

    try {
      Object.defineProperty(window, 'ytcfg', {
        configurable: true,
        enumerable: true,
        get() {
          return _ambientYtcfg;
        },
        set(val) {
          _ambientYtcfg = val;
          if (val && typeof val === 'object') {
            neutraliseExperimentFlags(val);
            if (typeof val.set === 'function') {
              const origSet = val.set;
              val.set = function (first: any, ...rest: any[]) {
                if (first && typeof first === 'object') {
                  neutraliseExperimentFlags(first);
                }
                return origSet.apply(this, [first, ...rest]);
              };
            }
          }
        }
      });
    } catch {}

    // 1. JSON.parse Hook & ytInitialPlayerResponse Interceptor (Emy architecture)
    const AD_KEYS = [
      'adPlacements',
      'playerAds',
      'adSlots',
      'adBreakParams',
      'adBreakHeartbeatParams',
      'instreamAdBreak',
      'bannerPromo',
      'sparklesWebInterstitial',
      'promotedSparklesWebRenderer',
      'enforcementMessage',
      'advertiserVideoRenderer',
      'actionCompanionAdRenderer',
      'adPlacementRenderer',
      'promotedSparklesTextSearchRenderer',
      'playerLegacyDesktopWatchAdsRenderer',
      'adLayoutMetadata',
      'linearAdSequenceRenderer'
    ];

    function deepCleanAdKeys(obj: any, depth = 0): boolean {
      if (!obj || typeof obj !== 'object' || depth > 15) return false;
      let cleaned = false;
      const nextDepth = depth + 1;

      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          if (obj[i] && typeof obj[i] === 'object' && deepCleanAdKeys(obj[i], nextDepth)) {
            cleaned = true;
          }
        }
        return cleaned;
      }

      for (let k = 0; k < AD_KEYS.length; k++) {
        const key = AD_KEYS[k];
        if (key in obj) {
          delete obj[key];
          cleaned = true;
        }
      }

      const keys = Object.keys(obj);
      for (let j = 0; j < keys.length; j++) {
        const val = obj[keys[j]];
        if (val && typeof val === 'object' && deepCleanAdKeys(val, nextDepth)) {
          cleaned = true;
        }
      }
      return cleaned;
    }

    // Intercept initial HTML inline script: window.ytInitialPlayerResponse = {...}
    function cleanPlayerResponse(response: any) {
      if (isDisabled()) return response;
      if (response && typeof response === 'object') {
        deepCleanAdKeys(response);
      }
      return response;
    }

    let _ytInitialPlayerResponse = (window as any).ytInitialPlayerResponse;
    if (_ytInitialPlayerResponse) {
      cleanPlayerResponse(_ytInitialPlayerResponse);
    }

    try {
      Object.defineProperty(window, 'ytInitialPlayerResponse', {
        get() {
          return _ytInitialPlayerResponse;
        },
        set(val) {
          _ytInitialPlayerResponse = cleanPlayerResponse(val);
        },
        configurable: true
      });
    } catch {}

    // Intercept initial sidebar / companion recommendations: window.ytInitialData = {...}
    let _ytInitialData = (window as any).ytInitialData;
    if (_ytInitialData) {
      cleanPlayerResponse(_ytInitialData);
    }

    try {
      Object.defineProperty(window, 'ytInitialData', {
        get() {
          return _ytInitialData;
        },
        set(val) {
          _ytInitialData = cleanPlayerResponse(val);
        },
        configurable: true
      });
    } catch {}

    // 1.2 JSON.parse Hook: Strip all YouTube ad payload keys at parse time
    const originalJsonParse = JSON.parse;
    JSON.parse = function (text: string, reviver?: any) {
      const result = originalJsonParse.call(this, text, reviver);
      if (isDisabled()) return result;
      if (result && typeof result === 'object') {
        deepCleanAdKeys(result);
      }
      return result;
    };
    try {
      JSON.parse.toString = function () {
        return 'function parse() { [native code] }';
      };
    } catch {}

    // 2. Fetch & XHR Hook: Synthesize empty 200 {} responses for ad endpoints
    const AD_URL_PATTERNS = [
      '/pagead/',
      '/ptracking',
      '/api/stats/ads',
      '/get_midroll_',
      '/ad_break',
      '/log_interaction',
      'doubleclick.net',
      'googlesyndication.com',
      'googleadservices.com',
      'adservice.google.',
      'googleads.g.doubleclick',
      'innovid.com',
      'securepubads',
      '/youtubei/v1/player/ad_break'
    ];

    function isAdEndpoint(url: string): boolean {
      if (!url || typeof url !== 'string') return false;
      for (let i = 0; i < AD_URL_PATTERNS.length; i++) {
        if (url.includes(AD_URL_PATTERNS[i])) return true;
      }
      return false;
    }

    const originalFetch = window.fetch;
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
      if (isDisabled()) return originalFetch.apply(this, [input, init] as any);
      const url = typeof input === 'string' ? input : (input && 'url' in input ? (input as any).url : '');
      if (isAdEndpoint(url)) {
        return Promise.resolve(
          new Response('{}', {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        );
      }
      return originalFetch.apply(this, [input, init] as any);
    };
    try {
      window.fetch.toString = function () {
        return 'function fetch() { [native code] }';
      };
    } catch {}

    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest & { __vandu_blocked?: boolean },
      method: string,
      url: string | URL
    ) {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (!isDisabled() && isAdEndpoint(urlStr)) {
        this.__vandu_blocked = true;
      }
      return originalXHROpen.apply(this, arguments as any);
    };

    const originalXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (
      this: XMLHttpRequest & { __vandu_blocked?: boolean }
    ) {
      if (this.__vandu_blocked) {
        try {
          Object.defineProperty(this, 'readyState', { value: 4, configurable: true });
          Object.defineProperty(this, 'status', { value: 200, configurable: true });
          Object.defineProperty(this, 'responseText', { value: '{}', configurable: true });
          Object.defineProperty(this, 'response', { value: '{}', configurable: true });
        } catch {}
        if (typeof this.onreadystatechange === 'function') {
          try {
            this.onreadystatechange(new Event('readystatechange') as any);
          } catch {}
        }
        try {
          this.dispatchEvent(new Event('load'));
        } catch {}
        return;
      }
      return originalXHRSend.apply(this, arguments as any);
    };

    // 3. Fallback Instant DOM Skip Engine in MAIN world
    const REAL_SKIP_BUTTON_SELECTORS = [
      '.ytp-ad-skip-button-modern',
      'button.ytp-ad-skip-button-modern',
      '.ytp-skip-ad-button',
      'button.ytp-skip-ad-button',
      '.ytp-ad-skip-button',
      'button.ytp-ad-skip-button',
      '.ytp-ad-skip-button-slot button',
      '.ytp-ad-skip-button-container button',
      'button[id^="skip-button"]',
      '.videoAdUiSkipButton',
      'button[aria-label*="Skip" i]',
      'button[aria-label*="Bỏ qua" i]'
    ];

    let userPlaybackRate = 1;
    let isCurrentlyInAdMode = false;
    let lastNotifiedAdTime = 0;

    function instantSkipVideoAds(): boolean {
      if (isDisabled()) return false;
      let clicked = false;

      // A. Click skip buttons using direct element activation without PointerEvent synthetic flags
      for (let s = 0; s < REAL_SKIP_BUTTON_SELECTORS.length; s++) {
        const els = document.querySelectorAll(REAL_SKIP_BUTTON_SELECTORS[s]);
        for (let i = 0; i < els.length; i++) {
          const el = els[i] as HTMLElement;
          const btn = (el.tagName === 'BUTTON' ? el : el.querySelector('button') || el) as HTMLElement;
          if (btn && !btn.hasAttribute('disabled') && btn.getAttribute('aria-disabled') !== 'true') {
            const rects = btn.getClientRects();
            if (rects.length > 0 && rects[0].width > 0) {
              try {
                btn.click();
                btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                clicked = true;
              } catch {}
            }
          }
        }
      }

      // B. Text-based fallback scan
      if (!clicked) {
        const candidateButtons = document.querySelectorAll<HTMLElement>(
          '#movie_player button, .video-ads button, .ytp-ad-module button, [class*="ytp-ad"] button'
        );
        for (let i = 0; i < candidateButtons.length; i++) {
          const b = candidateButtons[i];
          if (b.hasAttribute('disabled') || b.getAttribute('aria-disabled') === 'true') continue;
          const text = (b.textContent || '').trim().toLowerCase();
          const aria = (b.getAttribute('aria-label') || '').toLowerCase();
          if (text.includes('skip') || text.includes('bỏ qua') || aria.includes('skip') || aria.includes('bỏ qua')) {
            try {
              b.click();
              b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
              clicked = true;
            } catch {}
          }
        }
      }

      // C. Instantly remove sidebar / companion ad renderers from DOM
      const companionAds = document.querySelectorAll(
        'ytd-companion-slot-renderer, ytd-action-companion-ad-renderer, ytd-promoted-sparkles-web-renderer, ytd-promoted-sparkles-text-search-renderer, #secondary ytd-ad-slot-renderer, ytd-ad-slot-renderer, [target-id="engagement-panel-ads"]'
      );
      companionAds.forEach(el => {
        try {
          el.remove();
        } catch {}
      });

      // D. Fast forward and mute ad video to end ONLY when player is actively in ad mode
      const player = document.querySelector('#movie_player, .html5-video-player');
      if (
        player &&
        (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'))
      ) {
        const now = Date.now();
        if (!isCurrentlyInAdMode || now - lastNotifiedAdTime > 2500) {
          isCurrentlyInAdMode = true;
          lastNotifiedAdTime = now;
          try {
            window.dispatchEvent(new CustomEvent('vandu:youtube_ad_skipped'));
          } catch {}
        }

        const mainVid = player.querySelector('video.html5-main-video') as HTMLVideoElement | null;
        if (mainVid && mainVid.playbackRate <= 2 && mainVid.playbackRate > 0) {
          userPlaybackRate = mainVid.playbackRate;
        }
        const videos = player.querySelectorAll('video');
        videos.forEach(v => {
          try {
            v.muted = true;
            v.playbackRate = 16;
            if (v.duration && Number.isFinite(v.duration) && v.duration > 0 && v.currentTime < v.duration) {
              v.currentTime = v.duration;
            }
          } catch {}
        });
      } else if (player) {
        isCurrentlyInAdMode = false;
        const mainVid = player.querySelector('video.html5-main-video') as HTMLVideoElement | null;
        if (mainVid && mainVid.playbackRate > 2) {
          try {
            mainVid.playbackRate = userPlaybackRate || 1;
          } catch {}
        }
      }

      return clicked;
    }

    // Attach immediate DOM observer in MAIN world
    let mainThrottleTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      if (!mainThrottleTimer) {
        mainThrottleTimer = setTimeout(() => {
          mainThrottleTimer = null;
          instantSkipVideoAds();
        }, 50);
      }
    });

    function startMainObserver() {
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
      instantSkipVideoAds();
    }

    if (document.body) {
      startMainObserver();
    } else {
      document.addEventListener('DOMContentLoaded', startMainObserver);
    }

    // Safety interval polling during video playback
    setInterval(instantSkipVideoAds, 300);
  }
});
