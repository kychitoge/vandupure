import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  exportConfig,
  importConfig,
  validateImportConfig
} from '../src/core/storage/configManager.js';
import { StorageAdapter, DEFAULT_SETTINGS } from '../src/core/storage/storageAdapter.js';
import {
  killInterstitialOverlays,
  autoClickInterstitialSkipButtons,
  neutralizeCountdownGlobals
} from '../src/modules/dom/interstitialKiller.js';

describe('v1.0.1 Features Suite: Config Manager & Interstitial Defusers', () => {
  beforeEach(async () => {
    // Reset in-memory storage to defaults
    await StorageAdapter.saveSettings({
      ...DEFAULT_SETTINGS,
      customBlocklist: ['test-ad.com'],
      customCosmeticSelectors: ['.custom-ad'],
      excludedSites: ['trusted.org']
    });
  });

  describe('Config Manager (Export & Import Protocol)', () => {
    it('exports settings to valid formatted JSON with v1.0.1 metadata', async () => {
      const jsonStr = await exportConfig();
      expect(typeof jsonStr).toBe('string');

      const parsed = JSON.parse(jsonStr);
      expect(parsed.app).toBe('vandu-pure');
      expect(parsed.version).toBe('1.0.1');
      expect(parsed.settings.customBlocklist).toContain('test-ad.com');
      expect(parsed.settings.customCosmeticSelectors).toContain('.custom-ad');
      expect(parsed.settings.excludedSites).toContain('trusted.org');
    });

    it('validates and sanitizes imported config against XSS/HTML tags', () => {
      const maliciousPayload = {
        app: 'vandu-pure',
        version: '1.0.1',
        settings: {
          customBlocklist: ['safe-ad.com', '<script>alert(1)</script>', 'javascript:void(0)'],
          customCosmeticSelectors: ['.clean-ad', '<img src=x onerror=alert(1)>', '.banner-box'],
          excludedSites: ['clean-site.com', '   ']
        }
      };

      const result = validateImportConfig(maliciousPayload);
      expect(result.valid).toBe(true);
      expect(result.config?.settings.customBlocklist).toEqual(['safe-ad.com']);
      expect(result.config?.settings.customCosmeticSelectors).toEqual(['.clean-ad', '.banner-box']);
      expect(result.config?.settings.excludedSites).toEqual(['clean-site.com']);
    });

    it('rejects invalid non-object JSON data', () => {
      expect(validateImportConfig(null).valid).toBe(false);
      expect(validateImportConfig('string-not-json').valid).toBe(false);
      expect(validateImportConfig([]).valid).toBe(false);
    });

    it('imports configuration in merge mode (deduplicating items)', async () => {
      const importPayload = JSON.stringify({
        settings: {
          customBlocklist: ['test-ad.com', 'new-ad.com'],
          customCosmeticSelectors: ['.new-ad-selector'],
          excludedSites: ['new-trusted.com']
        }
      });

      const res = await importConfig(importPayload, 'merge');
      expect(res.success).toBe(true);

      const updated = await StorageAdapter.getSettings();
      expect(updated.customBlocklist).toEqual(['test-ad.com', 'new-ad.com']);
      expect(updated.customCosmeticSelectors).toEqual(['.custom-ad', '.new-ad-selector']);
      expect(updated.excludedSites).toEqual(['trusted.org', 'new-trusted.com']);
    });

    it('imports configuration in overwrite mode (replacing items)', async () => {
      const importPayload = JSON.stringify({
        settings: {
          masterEnabled: true,
          blockAds: false,
          customBlocklist: ['overwritten-ad.com'],
          customCosmeticSelectors: ['.overwritten-selector'],
          excludedSites: ['overwritten-site.com']
        }
      });

      const res = await importConfig(importPayload, 'overwrite');
      expect(res.success).toBe(true);

      const updated = await StorageAdapter.getSettings();
      expect(updated.customBlocklist).toEqual(['overwritten-ad.com']);
      expect(updated.customCosmeticSelectors).toEqual(['.overwritten-selector']);
      expect(updated.excludedSites).toEqual(['overwritten-site.com']);
      expect(updated.blockAds).toBe(false);
    });
  });

  describe('Interstitial Ad Killer & Countdown Defuser', () => {
    function createMockElement(tag: string, attributes: Record<string, string> = {}, innerText = '') {
      const styles: Record<string, string> = {};
      const children: any[] = [];
      let parent: any = null;

      const el: any = {
        tagName: tag.toUpperCase(),
        id: attributes.id || '',
        className: attributes.class || '',
        innerText,
        textContent: innerText,
        style: {
          setProperty(prop: string, val: string) { styles[prop] = val; },
          getPropertyValue(prop: string) { return styles[prop] || ''; },
          get display() { return styles['display']; }
        },
        getAttribute(name: string) { return attributes[name] || null; },
        setAttribute(name: string, val: string) { attributes[name] = val; },
        hasAttribute(name: string) { return name in attributes; },
        matches(selector: string) {
          if (selector.includes('main') && tag === 'main') return true;
          if (selector.includes('article') && tag === 'article') return true;
          return false;
        },
        querySelectorAll(selector: string) {
          return children.filter((c: any) => {
            if (selector.includes('button') && c.tagName === 'BUTTON') return true;
            if (selector.includes('input') && c.tagName === 'INPUT') return true;
            return false;
          });
        },
        querySelector(selector: string) {
          return children.find((c: any) => {
            if (selector.includes('form') && c.tagName === 'FORM') return true;
            if (selector.includes('input') && c.tagName === 'INPUT') return true;
            return false;
          }) || null;
        },
        appendChild(child: any) {
          child.parentElement = el;
          children.push(child);
        },
        click() {
          if (el._onClick) el._onClick();
        },
        addEventListener(ev: string, fn: any) {
          if (ev === 'click') el._onClick = fn;
        },
        get parentElement() { return parent; },
        set parentElement(p: any) { parent = p; }
      };
      return el;
    }

    it('detects and collapses interstitial ad containers', () => {
      const interstitialWrapper = createMockElement('div', { class: 'interstitial-ad-wrapper' });
      const skipBtn = createMockElement('button', { class: 'btn-skip' }, 'Skip Ad');
      let clicked = false;
      skipBtn.addEventListener('click', () => { clicked = true; });
      interstitialWrapper.appendChild(skipBtn);

      const fakeDoc = {
        body: {
          querySelectorAll: () => [skipBtn]
        },
        querySelectorAll: (sel: string) => {
          if (sel.includes('interstitial')) return [interstitialWrapper];
          return [];
        }
      };

      (globalThis as any).document = fakeDoc;
      try {
        const result = killInterstitialOverlays();
        expect(result.interstitialsRemoved).toBe(1);
        expect(result.skipButtonsClicked).toBe(1);
        expect(clicked).toBe(true);
        expect(interstitialWrapper.getAttribute('data-vandu-interstitial-killed')).toBe('true');
        expect(interstitialWrapper.style.display).toBe('none');
      } finally {
        delete (globalThis as any).document;
      }
    });

    it('does not collapse genuine login forms or main articles', () => {
      const loginModal = createMockElement('div', { class: 'interstitial-login-modal' });
      const form = createMockElement('form');
      const emailInput = createMockElement('input', { type: 'email' });
      form.appendChild(emailInput);
      loginModal.appendChild(form);

      const fakeDoc = {
        body: { querySelectorAll: () => [] },
        querySelectorAll: (sel: string) => {
          if (sel.includes('interstitial')) return [loginModal];
          return [];
        }
      };

      (globalThis as any).document = fakeDoc;
      try {
        const result = killInterstitialOverlays();
        expect(result.interstitialsRemoved).toBe(0);
        expect(loginModal.getAttribute('data-vandu-interstitial-killed')).toBeNull();
      } finally {
        delete (globalThis as any).document;
      }
    });

    it('auto-clicks skip buttons on demand', () => {
      const skipBtn = createMockElement('button', { class: 'skip-btn' }, 'Bỏ qua');
      let clicked = false;
      skipBtn.addEventListener('click', () => { clicked = true; });

      const fakeRoot: any = {
        querySelectorAll: () => [skipBtn]
      };

      (globalThis as any).document = {};
      try {
        const count = autoClickInterstitialSkipButtons(fakeRoot);
        expect(count).toBe(1);
        expect(clicked).toBe(true);
      } finally {
        delete (globalThis as any).document;
      }
    });

    it('strictly protects against auto-clicking on body or anchor links (OnePageLove / ChatGPT bugfix)', () => {
      const fakeBody: any = { isBody: true };
      const fakeDoc: any = { body: fakeBody, documentElement: {} };
      (globalThis as any).document = fakeDoc;

      try {
        // 1. Must strictly reject when called on document.body
        const bodyCount = autoClickInterstitialSkipButtons(fakeBody);
        expect(bodyCount).toBe(0);

        // 2. Must not click anchor skip links or Tailwind/CSS buttons
        const skipAnchor = createMockElement('a', { class: 'skip-link next flex px-3', href: '#container' }, 'Skip to content');
        const regularBtn = createMockElement('button', { class: 'btn flex items-center px-3 text-sm' }, 'Tạo dự án');
        let anchorClicked = false;
        let btnClicked = false;
        skipAnchor.addEventListener('click', () => { anchorClicked = true; });
        regularBtn.addEventListener('click', () => { btnClicked = true; });

        const fakeContainer: any = {
          querySelectorAll: (sel: string) => {
            // Anchor tags are excluded from selector; button has no skip class/text
            if (sel.includes('button')) return [regularBtn];
            return [];
          }
        };

        const count = autoClickInterstitialSkipButtons(fakeContainer);
        expect(count).toBe(0);
        expect(anchorClicked).toBe(false);
        expect(btnClicked).toBe(false);
      } finally {
        delete (globalThis as any).document;
      }
    });

    it('neutralizes in-page countdown global variables to 0', () => {
      (globalThis as any).window = globalThis;
      (globalThis as any).countdown = 15;
      (globalThis as any).timeleft = 10;
      (globalThis as any).skiptime = 5;

      try {
        neutralizeCountdownGlobals();

        expect((globalThis as any).countdown).toBe(0);
        expect((globalThis as any).timeleft).toBe(0);
        expect((globalThis as any).skiptime).toBe(0);
      } finally {
        delete (globalThis as any).countdown;
        delete (globalThis as any).timeleft;
        delete (globalThis as any).skiptime;
        delete (globalThis as any).window;
      }
    });
  });
});
