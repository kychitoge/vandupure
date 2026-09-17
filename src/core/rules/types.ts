import type { MatchCondition } from '../matcher/index.js';

export type RuleLifecycle = 'document_start' | 'document_end' | 'document_idle' | 'dynamic';

export type RuleCategory = 'tracking' | 'unblock' | 'youtube' | 'ads' | 'popups' | 'network' | 'custom';

export type RuleAction =
  | { type: 'url.removeQuery'; params: string[] }
  | { type: 'url.redirect'; target: string }
  | { type: 'dom.hide'; selector: string }
  | { type: 'dom.removeOverlay'; minZIndex?: number; minViewportRatio?: number }
  | { type: 'css.inject'; css: string; id?: string }
  | { type: 'events.unblock'; eventNames: string[] }
  | {
      type: 'navigation.interceptClick';
      containerSelector?: string;
      anchorSelector?: string;
      shouldIntercept: (url: URL) => boolean;
      getCleanUrl: (url: URL) => string;
    }
  | { type: 'network.dnr'; dnrRule: chrome.declarativeNetRequest.Rule };

export interface OverrideRule {
  id: string;
  name: string;
  category: RuleCategory;
  enabled: boolean;
  priority: number;
  lifecycle: RuleLifecycle;
  match: MatchCondition;
  action: RuleAction;
}

export interface RuleExecutionContext {
  currentUrl: URL;
  tabId?: number;
  notifyAction?: (category: RuleCategory, count?: number) => void;
}
