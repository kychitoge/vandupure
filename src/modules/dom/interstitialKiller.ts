/**
 * Interstitial Ad Killer & Countdown Defuser
 * Eliminates full-screen interstitial ads, overlay countdown barriers, and restores scrollability.
 */

import { unlockScroll, isSafeSearchOrPortal } from './overlayRemover.js';

export interface InterstitialKillResult {
  interstitialsRemoved: number;
  skipButtonsClicked: number;
  scrollRestored: boolean;
}

const INTERSTITIAL_SELECTORS = [
  'div[class*="interstitial"]',
  'div[id*="interstitial"]',
  'div[class*="splash-ad"]',
  'div[id*="splash-ad"]',
  'div[class*="fullscreen-ad"]',
  'div[id*="fullscreen-ad"]',
  'div[class*="countdown-ad"]',
  'div[id*="countdown-ad"]',
  'div[class*="overlay-countdown"]',
  'div[id*="overlay-countdown"]',
  'div[class*="ad-modal"]',
  'div[id*="ad-modal"]',
  'div[id*="popup-ad"]',
  'div[class*="popup-ad"]',
  'div[id*="ad-popup"]',
  'div[class*="ad-popup"]',
  'div[id*="popup-banner"]',
  'div[class*="popup-banner"]',
  '.overlay-ad',
  '.ad-overlay',
  '.popup-ad',
  '.qc-popup',
  'div[class*="qc-overlay"]',
  'div[id*="qc-overlay"]',
  '#content.interstitial',
  '#interstitial',
  '.interstitial',
  '.interstitial-wrapper',
  '.ad-interstitial',
  '.interstitial-ad',
  'div[data-ad-type="interstitial"]'
];

const STRICT_SKIP_CLASSES = ['btn-skip', 'skip-btn', 'close-ad', 'ad-close', 'skip-ad', 'ad-skip'];
const STRICT_SKIP_TEXTS = [
  'skip ad',
  'skip ads',
  'bỏ qua quảng cáo',
  'bỏ qua',
  'skip',
  'close ad',
  'đóng quảng cáo',
  '✕',
  '×'
];

/**
 * Searches and automatically clicks skip or close buttons on interstitial ads.
 * CRITICAL: Must ONLY be called on confirmed ad containers, NEVER globally on document.body.
 * NEVER clicks anchor <a> hyperlinks to prevent unwanted page navigation.
 */
export function autoClickInterstitialSkipButtons(root?: Element | null): number {
  if (typeof document === 'undefined' || !root) return 0;
  if (isSafeSearchOrPortal()) return 0;

  // STRICT SAFETY: Disallow executing on root documents or global bodies
  if (root === document.body || root === document.documentElement) {
    return 0;
  }

  let clicked = 0;
  // Exclude <a> tags entirely! Clicking <a> tags forces unwanted URL navigation / loops.
  const buttons = root.querySelectorAll<HTMLElement>(
    'button, div[role="button"], span[role="button"], .btn-skip, .skip-btn, .close-ad, .ad-close, [class*="skip-ad"]'
  );

  buttons.forEach((btn) => {
    try {
      const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      const title = (btn.getAttribute('title') || '').toLowerCase();
      const cls = (typeof btn.className === 'string' ? btn.className : '').toLowerCase();

      const hasSkipClass = STRICT_SKIP_CLASSES.some((c) => cls.includes(c));
      const hasSkipText = STRICT_SKIP_TEXTS.some(
        (p) => text === p || ariaLabel === p || title === p
      );

      if (!hasSkipClass && !hasSkipText) {
        return;
      }

      if (btn.hasAttribute && btn.hasAttribute('data-vandu-skip-clicked')) {
        return;
      }

      if (btn.setAttribute) {
        btn.setAttribute('data-vandu-skip-clicked', 'true');
      }
      btn.click();
      clicked++;
    } catch {}
  });

  return clicked;
}

/**
 * Neutralizes and collapses full-screen interstitial containers
 */
export function killInterstitialOverlays(): InterstitialKillResult {
  if (typeof document === 'undefined') {
    return { interstitialsRemoved: 0, skipButtonsClicked: 0, scrollRestored: false };
  }
  if (isSafeSearchOrPortal()) {
    return { interstitialsRemoved: 0, skipButtonsClicked: 0, scrollRestored: false };
  }

  let interstitialsRemoved = 0;
  let skipButtonsClicked = 0;

  // 1. Query interstitial containers (Ad containers ONLY)
  const candidates = document.querySelectorAll<HTMLElement>(INTERSTITIAL_SELECTORS.join(', '));

  candidates.forEach((el) => {
    try {
      // Must not be genuine forms, logins, dialogs, modals, or rich applications
      const isProtectedUi =
        el.matches('main, article, header, nav, #app, #root, [role="dialog"], [role="alertdialog"], dialog') ||
        el.hasAttribute('aria-modal') ||
        el.querySelector('form, input, textarea, select, [role="dialog"]') !== null;

      if (isProtectedUi) {
        return;
      }

      // Check if it's full viewport overlay or fixed container
      const style = typeof window !== 'undefined' && window.getComputedStyle ? window.getComputedStyle(el) : null;
      const isFixed = style ? style.position === 'fixed' || style.position === 'absolute' : true;
      const zIndex = style && style.zIndex ? parseInt(style.zIndex, 10) : 999;

      const text = (el.innerText || '').toLowerCase();
      const hasWaitOrAdHeader = text.includes('interstitial ad') || text.includes('quảng cáo') || text.includes('vui lòng chờ') || (text.includes('wait ') && text.includes('×')) || (text.includes('wait ') && text.includes('x'));

      if (isFixed && (isNaN(zIndex) || zIndex >= 100)) {
        // Only click skip inside confirmed ad container
        skipButtonsClicked += autoClickInterstitialSkipButtons(el);

        // Collapse container
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('height', '0px', 'important');
        el.style.setProperty('min-height', '0px', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
        el.setAttribute('data-vandu-interstitial-killed', 'true');
        interstitialsRemoved++;
      } else if (hasWaitOrAdHeader) {
        // Standalone or inline interstitial banner block
        skipButtonsClicked += autoClickInterstitialSkipButtons(el);
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('height', '0px', 'important');
        el.style.setProperty('min-height', '0px', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
        el.setAttribute('data-vandu-interstitial-killed', 'true');
        interstitialsRemoved++;
      }
    } catch {}
  });

  let scrollRestored = false;
  if (interstitialsRemoved > 0) {
    unlockScroll();
    scrollRestored = true;
  }

  return {
    interstitialsRemoved,
    skipButtonsClicked,
    scrollRestored
  };
}

/**
 * Neutralizes common in-page countdown variables
 */
export function neutralizeCountdownGlobals(): void {
  if (typeof window === 'undefined') return;
  const countdownKeys = [
    'countdown',
    'timeleft',
    'timeLeft',
    'countDownDate',
    'ik_timer',
    'skiptime',
    'waitTime'
  ];

  for (const key of countdownKeys) {
    try {
      if ((window as any)[key] !== undefined && typeof (window as any)[key] === 'number') {
        (window as any)[key] = 0;
      }
    } catch {}
  }
}
