import type { OverrideRule, RuleLifecycle } from './types.js';
import { matchesUrl } from '../matcher/index.js';
import { Logger } from '../logger/index.js';

export class RuleRegistry {
  private rules: Map<string, OverrideRule> = new Map();

  /**
   * Registers a single rule or an array of rules.
   */
  register(rules: OverrideRule | OverrideRule[]): void {
    const list = Array.isArray(rules) ? rules : [rules];
    for (const rule of list) {
      this.rules.set(rule.id, rule);
      Logger.debug(`Registered rule: [${rule.id}] ${rule.name}`);
    }
  }

  /**
   * Retrieves a rule by its ID.
   */
  get(id: string): OverrideRule | undefined {
    return this.rules.get(id);
  }

  /**
   * Returns all registered rules.
   */
  getAll(): OverrideRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Finds all active rules that match a given URL, sorted by priority (highest first).
   */
  getMatchedRules(
    url: URL | string,
    lifecycle?: RuleLifecycle,
    excludedHosts: string[] = []
  ): OverrideRule[] {
    const target = typeof url === 'string' ? new URL(url) : url;

    return Array.from(this.rules.values())
      .filter((rule) => {
        if (!rule.enabled) return false;
        if (lifecycle && rule.lifecycle !== lifecycle && rule.lifecycle !== 'dynamic') {
          return false;
        }
        // Check global exclusion
        const conditionWithExclusions = {
          ...rule.match,
          excludeHost: [
            ...(Array.isArray(rule.match.excludeHost)
              ? rule.match.excludeHost
              : rule.match.excludeHost
              ? [rule.match.excludeHost]
              : []),
            ...excludedHosts
          ]
        };
        return matchesUrl(conditionWithExclusions, target);
      })
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Clears the registry (useful in testing).
   */
  clear(): void {
    this.rules.clear();
  }
}

// Global Singleton Registry
export const globalRuleRegistry = new RuleRegistry();
