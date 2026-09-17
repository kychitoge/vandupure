/**
 * Media Browser Primitive: Media Controller
 * Provides primitives for interacting with HTML5 video & audio elements.
 * Contains ZERO site-specific logic.
 */

export function findMediaElements(container?: HTMLElement | null): HTMLMediaElement[] {
  if (typeof document === 'undefined') return [];
  const root = container || document;
  return Array.from(root.querySelectorAll('video, audio')) as HTMLMediaElement[];
}

export function setPlaybackRate(rate: number, container?: HTMLElement | null): void {
  findMediaElements(container).forEach((m) => {
    m.playbackRate = rate;
  });
}

export function muteMediaElements(container?: HTMLElement | null): void {
  findMediaElements(container).forEach((m) => {
    m.muted = true;
  });
}

export function fastForwardMedia(offsetFromEnd = 0.05, container?: HTMLElement | null): boolean {
  let changed = false;
  findMediaElements(container).forEach((m) => {
    if (Number.isFinite(m.duration) && m.duration > 0) {
      m.currentTime = Math.max(0, m.duration - offsetFromEnd);
      changed = true;
    }
  });
  return changed;
}

/**
 * Triggers an 'ended' event on media elements to prompt players to advance
 */
export function triggerMediaEnded(container?: HTMLElement | null): void {
  if (!container) return;
  const elements = container instanceof HTMLMediaElement 
    ? [container] 
    : findMediaElements(container);
    
  elements.forEach((m) => {
    try {
      m.dispatchEvent(new Event('ended'));
    } catch {
      // Ignore error
    }
  });
}

/**
 * Clicks the first matching interactive button using direct activation and MouseEvent
 */
export function clickFirstMatching(selectors: string[], container?: HTMLElement | null): boolean {
  if (typeof document === 'undefined') return false;
  const root = container || document;
  
  for (const selector of selectors) {
    try {
      const elements = root.querySelectorAll(selector);
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i] as HTMLElement;
        const btn = (el.tagName === 'BUTTON' ? el : el.querySelector('button') || el) as HTMLElement;
        if (!btn || btn.hasAttribute('disabled') || btn.getAttribute('aria-disabled') === 'true') {
          continue;
        }

        // Reliable layout visibility check without offsetParent position:fixed bug
        const rects = btn.getClientRects();
        const isVisible = rects.length > 0 && rects[0].width > 0 && rects[0].height > 0;
        if (!isVisible && typeof window !== 'undefined') {
          const style = window.getComputedStyle(btn);
          if (style.display === 'none' || style.visibility === 'hidden') {
            continue;
          }
        }

        try {
          btn.click();
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          return true;
        } catch {
          if (typeof btn.click === 'function') {
            btn.click();
            return true;
          }
        }
      }
    } catch {}
  }

  // Fallback: Scan any button inside player with 'skip' or 'bỏ qua'
  try {
    const candidateButtons = root.querySelectorAll<HTMLElement>(
      '#movie_player button, .video-ads button, .ytp-ad-module button, [class*="ytp-ad"] button'
    );
    for (let i = 0; i < candidateButtons.length; i++) {
      const b = candidateButtons[i];
      if (b.hasAttribute('disabled') || b.getAttribute('aria-disabled') === 'true') continue;
      const text = (b.textContent || '').trim().toLowerCase();
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      if (text.includes('skip') || text.includes('bỏ qua') || aria.includes('skip') || aria.includes('bỏ qua')) {
        b.click();
        b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return true;
      }
    }
  } catch {}

  return false;
}
