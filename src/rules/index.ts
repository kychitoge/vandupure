import { globalRuleRegistry } from '../core/rules/registry.js';
import { globalTrackingRule } from './global/tracking.rules.js';
import { globalUnblockRules } from './global/unblock.rules.js';
import { globalAdsRules } from './global/ads.rules.js';
import { youtubeRules } from './sites/youtube.rules.js';
import type { OverrideRule } from '../core/rules/types.js';

export * from './global/index.js';
export * from './sites/index.js';

export const allDefaultRules: OverrideRule[] = [
  globalTrackingRule,
  ...globalUnblockRules,
  ...globalAdsRules,
  ...youtubeRules
];

export function registerDefaultRules(): void {
  globalRuleRegistry.register(allDefaultRules);
}
