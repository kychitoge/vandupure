/**
 * Navigation Browser Primitive: SPA Router Event Listener
 * Hooks window and document events to detect SPA page transitions.
 * Contains ZERO site-specific logic.
 */

export function listenSpaTransitions(
  customEvents: string[],
  callback: (currentUrl: URL) => void
): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

  const handleTransition = (e?: Event) => {
    try {
      let urlStr = window.location.href;
      if (e && (e as any).detail && (e as any).detail.url) {
        urlStr = (e as any).detail.url;
        if (urlStr.startsWith('/')) {
            urlStr = window.location.origin + urlStr;
        }
      }
      callback(new URL(urlStr));
    } catch {
      // Ignore URL parsing errors
    }
  };

  const allEvents = ['popstate', ...customEvents];

  allEvents.forEach((evt) => {
    window.addEventListener(evt, handleTransition, { capture: true, passive: true });
    document.addEventListener(evt, handleTransition, { capture: true, passive: true });
  });

  return () => {
    allEvents.forEach((evt) => {
      window.removeEventListener(evt, handleTransition);
      document.removeEventListener(evt, handleTransition);
    });
  };
}
