import { describe, it, expect } from 'vitest';
import { stripQueryParams } from '../src/modules/url/queryCleaner.js';
import { buildTrackingDnrRule, buildRedirectQueryDnrRule } from '../src/modules/network/dnrBuilder.js';
import { buildHeaderStudioRule } from '../src/modules/network/headerManager.js';
import type { HeaderProfile } from '../src/core/storage/storageAdapter.js';

describe('Module: URL Primitive', () => {
  it('strips matching tracking parameters', () => {
    const raw = 'https://example.com/product?id=99&utm_source=fb&fbclid=abc123xyz&ref=promo';
    const res = stripQueryParams(raw, ['utm_source', 'fbclid', 'ref']);
    expect(res.cleaned).toBe(true);
    expect(res.count).toBe(3);
    expect(res.url).toBe('https://example.com/product?id=99');
  });

  it('strips prefix-grouped telemetry and standalone trackers automatically', () => {
    const raw = 'https://example.com/post?id=42&_hsenc=p223&mc_eid=abc99&pk_campaign=spring&ttclid=tik123&si=yt_tracker';
    const res = stripQueryParams(raw);
    expect(res.cleaned).toBe(true);
    expect(res.count).toBe(5);
    expect(res.url).toBe('https://example.com/post?id=42');
  });

  it('unwraps redirect wrappers (ClearURLs style) and strips trackers from target', () => {
    const googleRedirect = 'https://www.google.com/url?q=https%3A%2F%2Fclean-shop.com%2Fitem%3Fsku%3D123%26utm_source%3Dnewsletter%26fbclid%3Dxyz123';
    const res = stripQueryParams(googleRedirect);
    expect(res.cleaned).toBe(true);
    expect(res.url).toBe('https://clean-shop.com/item?sku=123');
  });

  it('recursively unwraps nested multi-tier redirect wrappers', () => {
    // Nested: reddit -> facebook -> destination
    const nested = 'https://out.reddit.com/?url=' + encodeURIComponent('https://l.facebook.com/l.php?u=' + encodeURIComponent('https://target.org/page?utm_campaign=winter&id=55'));
    const res = stripQueryParams(nested);
    expect(res.cleaned).toBe(true);
    expect(res.url).toBe('https://target.org/page?id=55');
  });

  it('keeps clean URLs intact', () => {
    const raw = 'https://example.com/watch?v=dQw4w9WgXcQ';
    const res = stripQueryParams(raw, ['utm_source', 'fbclid']);
    expect(res.cleaned).toBe(false);
    expect(res.count).toBe(0);
    expect(res.url).toBe(raw);
  });

  it('safely handles cross-origin unwrapped redirect URLs without crashing replaceState', async () => {
    const { cleanAddressBar } = await import('../src/modules/url/queryCleaner.js');
    let replacedUrl: string | null = null;

    const fakeWin: any = {
      location: {
        href: 'https://www.google.com/url?q=' + encodeURIComponent('https://destination-site.org/page?utm_source=ads'),
        origin: 'https://www.google.com'
      },
      history: {
        replaceState: (_state: any, _title: string, url: string) => {
          replacedUrl = url;
        }
      }
    };

    (globalThis as any).window = fakeWin;
    try {
      const res = cleanAddressBar();
      expect(res.cleaned).toBe(true);
      expect(res.url).toBe('https://destination-site.org/page');
      // Cross-origin replaceState should NOT be invoked to prevent SecurityError
      expect(replacedUrl).toBeNull();
    } finally {
      delete (globalThis as any).window;
    }
  });
});

describe('Module: Events Unblocker Primitive', () => {
  it('identifies productivity apps to prevent breaking rich text web apps', async () => {
    const { isProductivityApp } = await import('../src/modules/events/eventUnblocker.js');
    expect(isProductivityApp('docs.google.com')).toBe(true);
    expect(isProductivityApp('notion.so')).toBe(true);
    expect(isProductivityApp('vscode.dev')).toBe(true);
    expect(isProductivityApp('my-news-site.com')).toBe(false);
  });

  it('neutralizes event blockers and injects user-select override style', async () => {
    const { unblockEvents } = await import('../src/modules/events/eventUnblocker.js');
    const addedListeners: Record<string, Function[]> = {};
    let injectedStyle: any = null;

    const fakeWin: any = {
      location: { hostname: 'medium.com' },
      addEventListener: (type: string, fn: Function) => {
        addedListeners[type] = addedListeners[type] || [];
        addedListeners[type].push(fn);
      },
      removeEventListener: (type: string, fn: Function) => {
        if (addedListeners[type]) {
          addedListeners[type] = addedListeners[type].filter((f) => f !== fn);
        }
      }
    };

    const fakeDoc: any = {
      oncontextmenu: () => {},
      oncopy: () => {},
      body: { oncontextmenu: () => {} },
      getElementById: () => null,
      createElement: (tag: string) => {
        const el: any = {
          tagName: tag.toUpperCase(),
          id: '',
          textContent: '',
          remove: () => {
            injectedStyle = null;
          }
        };
        return el;
      },
      head: {
        appendChild: (el: any) => {
          injectedStyle = el;
        }
      }
    };

    (globalThis as any).window = fakeWin;
    (globalThis as any).document = fakeDoc;

    const origSelection = (globalThis as any).Selection;
    let removeAllRangesCalled = false;
    (globalThis as any).Selection = function() {};
    (globalThis as any).Selection.prototype = {
      removeAllRanges: () => {
        removeAllRangesCalled = true;
      }
    };

    try {
      const cleanup = unblockEvents(['contextmenu', 'copy']);
      expect(fakeDoc.oncontextmenu).toBeNull();
      expect(fakeDoc.oncopy).toBeNull();
      expect(fakeDoc.body.oncontextmenu).toBeNull();
      expect(addedListeners['contextmenu']).toBeDefined();
      expect(addedListeners['copy']).toBeDefined();
      expect(addedListeners['keydown']).toBeDefined();
      expect(injectedStyle).toBeDefined();
      expect(injectedStyle.id).toBe('vandu-unblock-selection-override');
      expect(injectedStyle.textContent).toContain('user-select: auto !important');

      // Test keydown protection intercepts Ctrl+C
      let stopped = false;
      const fakeKeyEvent = {
        ctrlKey: true,
        metaKey: false,
        code: 'KeyC',
        key: 'c',
        stopPropagation: () => {
          stopped = true;
        }
      };
      addedListeners['keydown'][0](fakeKeyEvent as any);
      expect(stopped).toBe(true);

      // Test Selection.removeAllRanges is neutralized
      (globalThis as any).Selection.prototype.removeAllRanges();
      expect(removeAllRangesCalled).toBe(false);

      cleanup();
      expect(injectedStyle).toBeNull();

      // Test Selection.removeAllRanges is restored
      (globalThis as any).Selection.prototype.removeAllRanges();
      expect(removeAllRangesCalled).toBe(true);
    } finally {
      delete (globalThis as any).window;
      delete (globalThis as any).document;
      if (origSelection) {
        (globalThis as any).Selection = origSelection;
      } else {
        delete (globalThis as any).Selection;
      }
    }
  });

  it('neutralizes transparent shields covering media via elementsFromPoint', async () => {
    const { createTransparentShieldBuster } = await import('../src/modules/events/eventUnblocker.js');
    const buster = createTransparentShieldBuster();

    const mockShield = {
      tagName: 'DIV',
      textContent: '',
      style: {
        pointerEvents: '',
        setProperty(prop: string, val: string) {
          (this as any)[prop] = val;
        }
      }
    };

    const mockImg = {
      tagName: 'IMG',
      style: {
        pointerEvents: '',
        setProperty(prop: string, val: string) {
          (this as any)[prop] = val;
        }
      }
    };

    const fakeDoc: any = {
      elementsFromPoint: (x: number, y: number) => [mockShield, mockImg]
    };

    (globalThis as any).document = fakeDoc;

    try {
      buster({ clientX: 100, clientY: 100 } as MouseEvent);
      expect((mockShield.style as any)['pointer-events']).toBe('none');
      expect((mockImg.style as any)['pointer-events']).toBe('all');
    } finally {
      delete (globalThis as any).document;
    }
  });
});

describe('Module: Network DNR Builder Primitive', () => {
  it('builds a valid tracking DNR redirect rule', () => {
    const rule = buildTrackingDnrRule({
      id: 1,
      priority: 1,
      trackingParams: ['utm_source', 'fbclid']
    });

    expect(rule.id).toBe(1);
    expect(rule.action.type).toBe('redirect');
    expect(rule.action.redirect?.transform?.queryTransform?.removeParams).toEqual([
      'utm_source',
      'fbclid'
    ]);
  });

  it('builds a valid redirect query DNR rule', () => {
    const rule = buildRedirectQueryDnrRule({
      id: 2,
      priority: 2,
      urlFilter: '||example.com/watch?*list=RD*',
      removeParams: ['list', 'start_radio']
    });

    expect(rule.id).toBe(2);
    expect(rule.condition.urlFilter).toBe('||example.com/watch?*list=RD*');
    expect(rule.action.redirect?.transform?.queryTransform?.removeParams).toEqual([
      'list',
      'start_radio'
    ]);
  });

  it('builds header studio MODIFY_HEADERS rule from profile', () => {
    const profile: HeaderProfile = {
      id: 'prof_1',
      name: 'Custom Profile',
      enabled: true,
      urlFilter: 'api.example.com',
      requestHeaders: [
        { id: '1', enabled: true, name: 'Authorization', value: 'Bearer token', operation: 'set' },
        { id: '2', enabled: false, name: 'X-Disabled', value: 'no', operation: 'set' }
      ],
      responseHeaders: [
        { id: '3', enabled: true, name: 'Access-Control-Allow-Origin', value: '*', operation: 'set' }
      ]
    };

    const rule = buildHeaderStudioRule(profile, 1000);
    expect(rule).not.toBeNull();
    expect(rule?.id).toBe(1000);
    expect(rule?.condition.urlFilter).toBe('||api.example.com');
    expect(rule?.action.requestHeaders?.length).toBe(1);
    expect(rule?.action.requestHeaders?.[0].header).toBe('Authorization');
    expect(rule?.action.responseHeaders?.length).toBe(1);
  });

  it('returns null if profile is disabled', () => {
    const profile: HeaderProfile = {
      id: 'prof_2',
      name: 'Disabled',
      enabled: false,
      urlFilter: '*',
      requestHeaders: [
        { id: '1', enabled: true, name: 'Auth', value: '1', operation: 'set' }
      ],
      responseHeaders: []
    };
    expect(buildHeaderStudioRule(profile)).toBeNull();
  });

  it('builds adblock DNR rules with default and custom domains', async () => {
    const { buildAdBlockDnrRules, POPULAR_AD_DOMAINS, YOUTUBE_AD_ENDPOINTS } = await import(
      '../src/modules/network/dnrBuilder.js'
    );
    const rules = buildAdBlockDnrRules({
      customDomains: ['my-tracker.org']
    });

    expect(rules.length).toBe(POPULAR_AD_DOMAINS.length + YOUTUBE_AD_ENDPOINTS.length + 1);
    const customRule = rules.find((r) => r.condition.urlFilter === '||my-tracker.org^');
    expect(customRule).toBeDefined();
    expect(customRule?.action.type).toBe('block');
  });
});

describe('Module: Media Controller Primitive', () => {
  it('handles empty document gracefully in node environment', async () => {
    const { findMediaElements, fastForwardMedia, clickFirstMatching } = await import(
      '../src/modules/media/mediaController.js'
    );
    expect(findMediaElements()).toEqual([]);
    expect(fastForwardMedia()).toBe(false);
    expect(clickFirstMatching(['.nonexistent'])).toBe(false);
  });
});

describe('Module: Events & Script Primitives', () => {
  it('initializes popunder guard safely', async () => {
    const { installPopunderGuard, isSafePopupUrl, isDeceptivePopup } = await import(
      '../src/modules/script/popunderGuard.js'
    );
    const uninstall = installPopunderGuard();
    expect(typeof uninstall).toBe('function');
    uninstall();

    // Check OAuth safe url detection
    expect(isSafePopupUrl('https://accounts.google.com/o/oauth2/auth')).toBe(true);
    expect(isSafePopupUrl('https://github.com/login/oauth')).toBe(true);
    expect(isSafePopupUrl('https://random-site.com/popup')).toBe(false);

    // Check deceptive popup detection
    expect(isDeceptivePopup('https://popads.net/serve')).toBe(true);
    expect(isDeceptivePopup('https://example.com', 'top=9999,left=9999')).toBe(true);
    expect(isDeceptivePopup('https://example.com', 'width=1,height=1')).toBe(true);
    expect(isDeceptivePopup('https://accounts.google.com/o/oauth2/auth')).toBe(false);
  });

  it('creates a resilient MockWindow proxy that prevents TypeErrors', async () => {
    const { createMockWindow } = await import('../src/modules/script/popunderGuard.js');
    const mockWin = createMockWindow('https://deceptive-site.com');

    expect(mockWin).toBeDefined();
    expect(mockWin.closed).toBe(false);
    expect(() => mockWin.focus()).not.toThrow();
    expect(() => mockWin.blur()).not.toThrow();
    expect(() => mockWin.postMessage('hello', '*')).not.toThrow();
    expect(() => {
      mockWin.location.href = 'https://another-ad.com';
    }).not.toThrow();
    expect(() => mockWin.document.write('<h1>Ad</h1>')).not.toThrow();
    expect(() => mockWin.someArbitraryAdMethod()).not.toThrow();

    mockWin.close();
    expect(mockWin.closed).toBe(true);
  });

  it('correctly identifies full-screen clickjacking overlay elements', async () => {
    const { detectClickjackingOverlay } = await import('../src/modules/script/popunderGuard.js');

    const fakeWindow = {
      innerWidth: 1000,
      innerHeight: 800,
      document: {
        body: {},
        documentElement: {}
      },
      getComputedStyle: (el: any) => el._computedStyle
    } as any;

    const overlayEl = {
      offsetWidth: 1000,
      offsetHeight: 800,
      _computedStyle: {
        position: 'fixed',
        zIndex: '9999',
        opacity: '0.01',
        backgroundColor: 'rgba(0, 0, 0, 0)'
      }
    } as any;

    expect(detectClickjackingOverlay(overlayEl, fakeWindow)).toBe(true);

    // Legitimate UI dialog backdrop should NOT be detected as clickjacking
    const modalBackdropEl = {
      offsetWidth: 1000,
      offsetHeight: 800,
      className: 'headlessui-dialog-backdrop modal-overlay',
      getAttribute: (attr: string) => (attr === 'role' ? 'dialog' : null),
      hasAttribute: (attr: string) => attr === 'aria-modal',
      _computedStyle: {
        position: 'fixed',
        zIndex: '9999',
        opacity: '0.01',
        backgroundColor: 'rgba(0, 0, 0, 0)'
      }
    } as any;
    expect(detectClickjackingOverlay(modalBackdropEl, fakeWindow)).toBe(false);

    const normalEl = {
      offsetWidth: 200,
      offsetHeight: 100,
      _computedStyle: {
        position: 'relative',
        zIndex: '1',
        opacity: '1',
        backgroundColor: '#ffffff'
      }
    } as any;

    expect(detectClickjackingOverlay(normalEl, fakeWindow)).toBe(false);
  });

  it('provides working lifecycle for redirect guard', async () => {
    const { installRedirectGuard } = await import('../src/modules/script/popunderGuard.js');
    const guard = installRedirectGuard(500);
    expect(typeof guard.trigger).toBe('function');
    expect(typeof guard.cleanup).toBe('function');
    guard.trigger();
    guard.cleanup();
  });

  it('renders blocked popup infobar at extension toolbar position', async () => {
    const { showBlockedPopupBar } = await import('../src/modules/script/popunderGuard.js');

    let createdBar: any = null;
    const fakeDoc: any = {
      getElementById: (id: string) => (createdBar && createdBar.id === id ? createdBar : null),
      createElement: (tag: string) => {
        const el: any = {
          tagName: tag.toUpperCase(),
          id: '',
          className: '',
          style: { cssText: '' },
          innerHTML: '',
          querySelector: (sel: string) => ({
            addEventListener: () => {}
          }),
          addEventListener: () => {},
          removeEventListener: () => {},
          remove: () => {
            createdBar = null;
          }
        };
        return el;
      },
      body: {
        appendChild: (el: any) => {
          createdBar = el;
        }
      }
    };

    (globalThis as any).document = fakeDoc;

    try {
      const bar = showBlockedPopupBar('https://malicious-ads.com/popunder');
      expect(bar).toBeDefined();
      expect(bar?.id).toBe('vandu-popup-infobar');
      expect(bar?.className).toBe('vandu-popup-infobar');
      expect(bar?.style.cssText).toContain('top: 8px');
      expect(bar?.style.cssText).toContain('right: 12px');
      expect(bar?.innerHTML).toContain('malicious-ads.com');
      expect(bar?.innerHTML).toContain('vandu-popup-domain');
      expect(bar?.innerHTML).toContain('Mở lại');
    } finally {
      delete (globalThis as any).document;
    }
  });

  it('neutralizes DOM XSS and HTML attribute breakouts in blocked popup URL', async () => {
    const { showBlockedPopupBar } = await import('../src/modules/script/popunderGuard.js');

    let createdBar: any = null;
    const fakeDoc: any = {
      getElementById: () => null,
      createElement: (tag: string) => {
        const el: any = {
          tagName: tag.toUpperCase(),
          id: '',
          className: '',
          style: { cssText: '' },
          innerHTML: '',
          querySelector: () => ({
            addEventListener: () => {}
          }),
          addEventListener: () => {},
          remove: () => {
            createdBar = null;
          }
        };
        return el;
      },
      body: {
        appendChild: (el: any) => {
          createdBar = el;
        }
      }
    };

    (globalThis as any).document = fakeDoc;

    try {
      const maliciousPayload = 'https://evil.com/" onmouseover="alert(1)" <script>alert(2)</script>';
      const bar = showBlockedPopupBar(maliciousPayload);
      expect(bar).toBeDefined();
      // Raw unescaped quotes or raw script tags must NOT appear in generated HTML
      expect(bar?.innerHTML).not.toContain('title="https://evil.com/" onmouseover="alert(1)"');
      expect(bar?.innerHTML).not.toContain('<script>');
      expect(bar?.innerHTML).toContain('&quot;');
    } finally {
      delete (globalThis as any).document;
    }
  });
});

describe('Module: DOM Overlay & Element Picker Primitives', () => {
  it('detects safe search engines to prevent false positive overlay removal', async () => {
    const { isSafeSearchOrPortal } = await import('../src/modules/dom/overlayRemover.js');
    expect(isSafeSearchOrPortal('www.google.com')).toBe(true);
    expect(isSafeSearchOrPortal('google.com.vn')).toBe(true);
    expect(isSafeSearchOrPortal('bing.com')).toBe(true);
    expect(isSafeSearchOrPortal('duckduckgo.com')).toBe(true);
    expect(isSafeSearchOrPortal('random-blog.com')).toBe(false);
  });

  it('computes robust element selector in element picker', async () => {
    const { computeElementSelector } = await import('../src/modules/dom/elementPicker.js');
    const mockEl = {
      id: 'my-unique-ad',
      tagName: 'DIV',
      classList: ['ad-container', 'banner'],
      parentElement: null
    } as unknown as HTMLElement;

    const sel = computeElementSelector(mockEl);
    expect(sel).toBeDefined();
    expect(typeof sel).toBe('string');
  });

  it('identifies floating containers in element picker', async () => {
    const { findFloatingContainer } = await import('../src/modules/dom/elementPicker.js');
    const mockEl = {
      tagName: 'IMG',
      parentElement: null
    } as unknown as HTMLElement;
    expect(findFloatingContainer(mockEl)).toBe(mockEl);
  });

  it('renders element picker control toolbar with light theme spec classes', async () => {
    const { startElementPicker } = await import('../src/modules/dom/elementPicker.js');
    let appendedRoot: any = null;
    let appendedStyle: any = null;

    const fakeDoc: any = {
      getElementById: (id: string) => {
        if (id === 'vandu-element-picker-root') return appendedRoot;
        return null;
      },
      createElement: (tag: string) => {
        const el: any = {
          tagName: tag.toUpperCase(),
          id: '',
          innerHTML: '',
          textContent: '',
          querySelector: (sel: string) => ({
            textContent: '',
            style: {},
            addEventListener: () => {}
          }),
          remove: () => {}
        };
        return el;
      },
      head: {
        appendChild: (el: any) => {
          appendedStyle = el;
        }
      },
      body: {
        appendChild: (el: any) => {
          appendedRoot = el;
        }
      },
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    (globalThis as any).document = fakeDoc;

    try {
      startElementPicker();
      expect(appendedRoot).toBeDefined();
      expect(appendedRoot.id).toBe('vandu-element-picker-root');
      expect(appendedRoot.innerHTML).toContain('vandu-picker-toolbar');
      expect(appendedRoot.innerHTML).toContain('vandu-picker-count');
      expect(appendedRoot.innerHTML).toContain('vandu-picker-btn');
      expect(appendedRoot.innerHTML).toContain('vandu-btn-primary');
      expect(appendedStyle.textContent).toContain('.vandu-picker-toolbar');
      expect(appendedStyle.textContent).toContain('top: 16px');
      expect(appendedStyle.textContent).toContain('#ffffff');
    } finally {
      delete (globalThis as any).document;
    }
  });
});

describe('Module: DOM Ghost Cleaner & Placeholder Cleanup Primitives', () => {
  it('identifies ad media URLs correctly', async () => {
    const { isAdMediaUrl } = await import('../src/modules/dom/ghostCleaner.js');
    expect(isAdMediaUrl('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js')).toBe(true);
    expect(isAdMediaUrl('https://securepubads.g.doubleclick.net/gampad/ads')).toBe(true);
    expect(isAdMediaUrl('https://cdn.taboola.com/libtrc/unip/123/tfa.js')).toBe(true);
    expect(isAdMediaUrl('https://example.com/images/hero.png')).toBe(false);
    expect(isAdMediaUrl('')).toBe(false);
    expect(isAdMediaUrl(null)).toBe(false);
  });

  it('runs safely in SSR/non-browser environment without throwing', async () => {
    const {
      collapseBlockedMediaPlaceholders,
      collapseEmptyParentWrappers,
      cleanupGhostBackdrops,
      cleanupStickyBottomBanners,
      runFullGhostCleanup
    } = await import('../src/modules/dom/ghostCleaner.js');

    expect(collapseBlockedMediaPlaceholders()).toBe(0);
    expect(collapseEmptyParentWrappers()).toBe(0);
    expect(cleanupGhostBackdrops()).toBe(0);
    expect(cleanupStickyBottomBanners()).toBe(0);
    expect(runFullGhostCleanup()).toEqual({
      collapsedMedia: 0,
      collapsedWrappers: 0,
      cleanedBackdrops: 0,
      cleanedSticky: 0
    });
  });

  it('collapses blocked media and ad wrappers with mock DOM environment', async () => {
    const { runFullGhostCleanup } = await import('../src/modules/dom/ghostCleaner.js');

    function createMockElement(tag: string, attrs: Record<string, string> = {}, innerText = '') {
      const styles: Record<string, string> = {};
      const attributes = { ...attrs };
      const children: any[] = [];
      let parent: any = null;

      const el: any = {
        tagName: tag.toUpperCase(),
        id: attributes.id || '',
        className: attributes.class || '',
        innerText,
        style: {
          setProperty(prop: string, val: string) {
            styles[prop] = val;
          },
          getPropertyValue(prop: string) {
            return styles[prop] || '';
          },
          get display() { return styles['display']; }
        },
        getAttribute(name: string) {
          return attributes[name] || null;
        },
        setAttribute(name: string, val: string) {
          attributes[name] = val;
        },
        hasAttribute(name: string) {
          return name in attributes;
        },
        querySelectorAll(selector: string) {
          return children.filter((c: any) => {
            if (selector.includes('video') && c.tagName === 'VIDEO') return true;
            if (selector.includes('img') && c.tagName === 'IMG') return true;
            return false;
          });
        },
        querySelector(selector: string) {
          return children.find((c: any) => {
            if (selector.includes('form') && c.tagName === 'FORM') return true;
            return false;
          }) || null;
        },
        appendChild(child: any) {
          child.parentElement = el;
          children.push(child);
        },
        get parentElement() {
          return parent;
        },
        set parentElement(p: any) {
          parent = p;
        }
      };
      return el;
    }

    const mockIframe = createMockElement('iframe', { src: 'https://securepubads.g.doubleclick.net/ad.html' });
    const mockParent = createMockElement('div', { class: 'ad-wrapper' });
    mockParent.appendChild(mockIframe);

    const mockBackdrop = createMockElement('div', { class: 'modal-backdrop' }, '');
    const mockSticky = createMockElement('div', { id: 'bottom-banner' }, '');

    const fakeDoc = {
      querySelectorAll: (sel: string) => {
        if (sel.includes('iframe')) return [mockIframe];
        if (sel.includes('ins.adsbygoogle') || sel.includes('[data-vandu-collapsed="true"]')) return [mockIframe];
        if (sel.includes('backdrop')) return [mockBackdrop];
        if (sel.includes('bottom-banner')) return [mockSticky];
        return [];
      }
    };

    (globalThis as any).document = fakeDoc;

    try {
      const stats = runFullGhostCleanup();
      expect(stats.collapsedMedia).toBe(1);
      expect(stats.collapsedWrappers).toBe(1);
      expect(stats.cleanedBackdrops).toBe(1);
      expect(stats.cleanedSticky).toBe(1);

      expect(mockIframe.style.display).toBe('none');
      expect(mockParent.style.display).toBe('none');
      expect(mockBackdrop.style.display).toBe('none');
      expect(mockSticky.style.display).toBe('none');
    } finally {
      delete (globalThis as any).document;
    }
  });
});


