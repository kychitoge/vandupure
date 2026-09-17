/**
 * Core Rule Execution Engine for Vân Du Override
 * Dispatches declarative actions to module primitives and manages observation/cleanup.
 */

import type { OverrideRule, RuleCategory } from './types.js';
import { cleanAddressBar, stripQueryParams } from '../../modules/url/queryCleaner.js';
import { unblockEvents } from '../../modules/events/eventUnblocker.js';
import { injectCss, removeCss } from '../../modules/css/cssInjector.js';
import { scanAndRemoveOverlays } from '../../modules/dom/overlayRemover.js';
import { hideElements } from '../../modules/dom/elementModifier.js';
import { interceptLinkClicks } from '../../modules/navigation/linkInterceptor.js';
import { showShieldToast } from '../runtime/notification.js';
import { Logger } from '../logger/index.js';

export function notifyItemBlocked(category: RuleCategory, count = 1): void {
  if (count <= 0) return;
  try {
    if (typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id) && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'ITEM_BLOCKED', category, count }).catch(() => {});
    }
  } catch {
    // Context invalidated, safely ignore
  }
}

export class RuleEngine {
  private activeCleanups: Array<() => void> = [];

  /**
   * Executes a single matched rule.
   */
  executeRule(rule: OverrideRule, currentUrl: URL): void {
    if (!rule.enabled) return;

    try {
      const action = rule.action;

      switch (action.type) {
        case 'url.removeQuery': {
          // 1. Clean address bar
          const res = cleanAddressBar(action.params);
          if (res.cleaned) {
            notifyItemBlocked(rule.category, res.count);
            showShieldToast(`Đã gỡ ${res.count} tham số theo dõi`);
          }

          // 2. Intercept outbound link clicks
          if (typeof document !== 'undefined') {
            const clickHandler = (e: MouseEvent) => {
              const anchor = (e.target as HTMLElement)?.closest('a');
              if (!anchor || !anchor.href) return;
              const linkRes = stripQueryParams(anchor.href, action.params);
              if (linkRes.cleaned) {
                anchor.href = linkRes.url;
                notifyItemBlocked(rule.category, linkRes.count);
              }
            };
            document.addEventListener('click', clickHandler, { capture: true });
            this.activeCleanups.push(() => {
              document.removeEventListener('click', clickHandler, { capture: true });
            });
          }
          break;
        }

        case 'events.unblock': {
          const cleanup = unblockEvents(action.eventNames);
          this.activeCleanups.push(cleanup);
          break;
        }

        case 'css.inject': {
          const styleId = action.id || `rule-style-${rule.id}`;
          injectCss(action.css, styleId);
          this.activeCleanups.push(() => {
            removeCss(styleId);
          });
          break;
        }

        case 'dom.removeOverlay': {
          const runScan = () => {
            const removed = scanAndRemoveOverlays({
              minZIndex: action.minZIndex,
              minViewportRatio: action.minViewportRatio
            });
            if (removed > 0) {
              notifyItemBlocked('popups', removed);
              showShieldToast('Đã gỡ bỏ popup che màn hình');
            }
          };

          if (typeof document !== 'undefined') {
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', runScan);
            } else {
              runScan();
            }
            setTimeout(runScan, 1200);
            setTimeout(runScan, 2500);
          }
          break;
        }

        case 'dom.hide': {
          hideElements(action.selector);
          break;
        }

        case 'navigation.interceptClick': {
          const cleanup = interceptLinkClicks({
            containerSelector: action.containerSelector,
            anchorSelector: action.anchorSelector,
            shouldIntercept: action.shouldIntercept,
            getCleanUrl: action.getCleanUrl,
            onIntercept: (cleanUrl) => {
              notifyItemBlocked(rule.category, 1);
              Logger.info(`Intercepted navigation -> ${cleanUrl}`);
            }
          });
          this.activeCleanups.push(cleanup);
          break;
        }

        default:
          break;
      }
    } catch (err) {
      Logger.error(`Failed to execute rule ${rule.id}:`, err);
    }
  }

  /**
   * Executes a collection of matched rules.
   */
  executeAll(rules: OverrideRule[], currentUrl: URL): void {
    for (const rule of rules) {
      this.executeRule(rule, currentUrl);
    }
  }

  /**
   * Cleans up listeners and DOM observers.
   */
  cleanup(): void {
    while (this.activeCleanups.length > 0) {
      const fn = this.activeCleanups.pop();
      try {
        fn?.();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

export const globalRuleEngine = new RuleEngine();
