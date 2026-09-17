/**
 * Navigation Browser Primitive: Link Interceptor
 * Intercepts link clicks at capture phase before in-page SPA routers can handle them.
 * Contains ZERO site-specific logic.
 */

export interface InterceptLinkOptions {
  containerSelector?: string;
  anchorSelector?: string;
  ignoreSelector?: string;
  shouldIntercept: (url: URL) => boolean;
  getCleanUrl: (url: URL) => string;
  onIntercept?: (cleanUrl: string) => void;
}

export function interceptLinkClicks(options: InterceptLinkOptions): () => void {
  if (typeof document === 'undefined') return () => {};

  const handler = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target) return;

    // Ignore clicks on specified ignore selectors (e.g. dropdowns, buttons)
    if (options.ignoreSelector && target.closest(options.ignoreSelector)) {
      return;
    }

    let anchor: HTMLAnchorElement | null = null;

    if (options.containerSelector) {
      const container = target.closest(options.containerSelector);
      if (container) {
        anchor =
          (container.querySelector('a[href]') as HTMLAnchorElement | null) ||
          (target.closest('a[href]') as HTMLAnchorElement | null);
      }
    }

    if (!anchor) {
      const sel = options.anchorSelector || 'a[href]';
      anchor = target.closest(sel) as HTMLAnchorElement | null;
    }

    if (!anchor || !anchor.href) return;

    try {
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
      const parsed = new URL(anchor.href, currentOrigin);

      if (options.shouldIntercept(parsed)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const clean = options.getCleanUrl(parsed);
        if (options.onIntercept) {
          options.onIntercept(clean);
        }
        if (typeof window !== 'undefined' && window.location) {
          window.location.replace(clean);
        }
      }
    } catch {
      // Ignore URL parsing errors
    }
  };

  document.addEventListener('click', handler, { capture: true });
  return () => {
    document.removeEventListener('click', handler, { capture: true });
  };
}
