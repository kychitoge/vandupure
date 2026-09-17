/**
 * CSS Browser Primitive: Scoped CSS Injector
 * Injects or removes scoped <style> tags safely into the DOM.
 * Contains ZERO site-specific logic.
 */

export function injectCss(cssContent: string, styleId: string): HTMLStyleElement | null {
  if (typeof document === 'undefined') return null;

  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = cssContent;
    const parent = document.head || document.documentElement;
    if (parent) {
      parent.appendChild(styleEl);
    }
  } else {
    styleEl.textContent = cssContent;
  }
  return styleEl;
}

export function removeCss(styleId: string): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.getElementById(styleId);
  if (el) {
    el.remove();
    return true;
  }
  return false;
}
