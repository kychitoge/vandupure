/**
 * DOM Browser Primitive: Element Modifier
 * Modifies, hides, or removes DOM elements by CSS selector.
 * Contains ZERO site-specific logic.
 */

export function hideElements(selector: string): number {
  if (typeof document === 'undefined') return 0;
  const elements = document.querySelectorAll(selector);
  let count = 0;
  elements.forEach((el) => {
    if (el instanceof HTMLElement && el.style.display !== 'none') {
      el.style.setProperty('display', 'none', 'important');
      count++;
    }
  });
  return count;
}

export function removeElements(selector: string): number {
  if (typeof document === 'undefined') return 0;
  const elements = document.querySelectorAll(selector);
  let count = 0;
  elements.forEach((el) => {
    el.remove();
    count++;
  });
  return count;
}
