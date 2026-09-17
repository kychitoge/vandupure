/**
 * Events Browser Primitive: Multi-Layer Event & DOM Unblocker
 * Reference: allow-right-click (lunu-bounir) & enable-permissions (MouadBourbian)
 * Contains ZERO site-specific logic.
 */

export const PRODUCTIVITY_EXCLUDED_HOSTS = [
  'docs.google.com',
  'sheets.google.com',
  'slides.google.com',
  'drive.google.com',
  'mail.google.com',
  'notion.so',
  'vscode.dev',
  'github.dev',
  'figma.com',
  'canva.com',
  'chatgpt.com',
  'openai.com',
  'claude.ai',
  'anthropic.com'
];

export function isProductivityApp(hostname: string): boolean {
  if (!hostname) return false;
  return PRODUCTIVITY_EXCLUDED_HOSTS.some(
    (h) => hostname === h || hostname.endsWith(`.${h}`)
  );
}

/**
 * Transparent Shield Buster (adapted from allow-right-click mouse.js):
 * Detects transparent overlay DIVs / anchor tags placed on top of <img>, <video>, or <canvas>
 * and temporarily clears their pointer-events so the native context menu targets the real media element.
 */
export function createTransparentShieldBuster(): (e: MouseEvent) => void {
  return (e: MouseEvent) => {
    if (typeof document === 'undefined' || !document.elementsFromPoint) return;
    try {
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      if (!elements || elements.length < 2) return;

      const topEl = elements[0] as HTMLElement;
      // If top element is already an image or video, no overlay
      if (['IMG', 'VIDEO', 'CANVAS'].includes(topEl.tagName)) return;

      // Check if top element looks like a shield (empty text, container)
      const hasNoText = !topEl.textContent || topEl.textContent.trim() === '';
      const isContainerTag = ['DIV', 'SPAN', 'A', 'P'].includes(topEl.tagName);

      if (hasNoText && isContainerTag) {
        // Look for underlying media element in the hit stack
        const underlyingMedia = elements.find(
          (el) => ['IMG', 'VIDEO', 'CANVAS'].includes(el.tagName)
        ) as HTMLElement | undefined;

        if (underlyingMedia && underlyingMedia !== topEl) {
          const origPointer = topEl.style.pointerEvents;
          topEl.style.setProperty('pointer-events', 'none', 'important');
          underlyingMedia.style.setProperty('pointer-events', 'all', 'important');

          setTimeout(() => {
            try {
              topEl.style.pointerEvents = origPointer;
            } catch {}
          }, 600);
        }
      }
    } catch {}
  };
}

/**
 * Re-enables native user interactions (contextmenu, copy, cut, paste, text selection)
 * in the capturing phase and enforces CSS user-select styles.
 */
export function unblockEvents(eventNames?: string[]): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  const hostname = window.location?.hostname || '';
  if (isProductivityApp(hostname)) {
    return () => {};
  }

  const targetEvents = eventNames && eventNames.length > 0
    ? eventNames
    : ['contextmenu', 'copy', 'cut', 'paste', 'selectstart', 'dragstart'];

  const handlers: Array<{ name: string; fn: (e: Event) => void }> = [];

  // 1. Capture-phase stopImmediatePropagation to neutralize anti-right-click / anti-copy handlers
  const onUnblockEvent = (e: Event) => {
    e.stopImmediatePropagation();
  };

  targetEvents.forEach((evtName) => {
    window.addEventListener(evtName, onUnblockEvent, { capture: true, passive: true });
    handlers.push({ name: evtName, fn: onUnblockEvent });
  });

  // 2. Keyboard shortcut protection (Ctrl/Cmd + C, V, X, A, P)
  // Stops site scripts from blocking clipboard and text manipulation shortcuts via keydown
  const onKeydownProtection = (e: KeyboardEvent) => {
    const isModifier = e.ctrlKey || e.metaKey;
    const isTargetCode = ['KeyC', 'KeyV', 'KeyX', 'KeyA', 'KeyP'].includes(e.code);
    const isTargetKey = ['c', 'v', 'x', 'a', 'p'].includes(e.key ? e.key.toLowerCase() : '');
    if (isModifier && (isTargetCode || isTargetKey)) {
      e.stopPropagation();
    }
  };
  window.addEventListener('keydown', onKeydownProtection as EventListener, { capture: true, passive: true });

  // 3. Selection Range Protection (stubs Selection.prototype.removeAllRanges to prevent websites from deselecting text on mouseup/copy)
  let originalRemoveAllRanges: (() => void) | undefined;
  try {
    if (typeof Selection !== 'undefined' && Selection.prototype && Selection.prototype.removeAllRanges) {
      const proto = Selection.prototype as any;
      if (!proto.__vandu_orig_removeAllRanges) {
        proto.__vandu_orig_removeAllRanges = Selection.prototype.removeAllRanges;
      }
      originalRemoveAllRanges = proto.__vandu_orig_removeAllRanges;
      Selection.prototype.removeAllRanges = function () {};
    }
  } catch {}

  // 4. Install transparent shield buster for contextmenu
  const shieldBuster = createTransparentShieldBuster();
  window.addEventListener('contextmenu', shieldBuster, { capture: true, passive: true });

  // 5. Clear inline event properties on document and body
  try {
    const docAny = document as any;
    targetEvents.forEach((evt) => {
      const prop = `on${evt}`;
      if (prop in docAny) docAny[prop] = null;
      if (document.body && prop in (document.body as any)) {
        (document.body as any)[prop] = null;
      }
    });
  } catch {}

  // 6. Inject strong CSS rule forcing user-select: auto
  let styleEl: HTMLStyleElement | null = null;
  try {
    const styleId = 'vandu-unblock-selection-override';
    const existing = document.getElementById(styleId);
    if (!existing) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = `
        html, body, p, span, h1, h2, h3, h4, h5, h6, article, main, section, div, blockquote, li, td, th, img, a {
          -webkit-user-select: auto !important;
          -moz-user-select: auto !important;
          -ms-user-select: auto !important;
          user-select: auto !important;
          -webkit-touch-callout: default !important;
        }
      `;
      (document.head || document.documentElement).appendChild(styleEl);
    }
  } catch {}

  return () => {
    handlers.forEach(({ name, fn }) => {
      window.removeEventListener(name, fn, { capture: true });
    });
    window.removeEventListener('keydown', onKeydownProtection as EventListener, { capture: true });
    window.removeEventListener('contextmenu', shieldBuster, { capture: true });
    if (typeof Selection !== 'undefined' && Selection.prototype) {
      try {
        const proto = Selection.prototype as any;
        if (proto.__vandu_orig_removeAllRanges) {
          Selection.prototype.removeAllRanges = proto.__vandu_orig_removeAllRanges;
          delete proto.__vandu_orig_removeAllRanges;
        } else if (originalRemoveAllRanges) {
          Selection.prototype.removeAllRanges = originalRemoveAllRanges;
        }
      } catch {}
    }
    if (styleEl) {
      styleEl.remove();
    }
  };
}
