/**
 * Pure TypeScript URL Matcher for Vân Du Override
 * Inspired by Violentmonkey pattern matching with zero external dependencies.
 */

export interface MatchCondition {
  host?: string | string[];
  path?: string | string[];
  urlPattern?: string | string[];
  excludeHost?: string | string[];
}

/**
 * Normalizes host by removing leading 'www.'
 */
export function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, '').trim();
}

/**
 * Converts a glob-style URL pattern (e.g., *://*.youtube.com/watch*) to a safe RegExp
 */
export function patternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex special chars except * and ?
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

/**
 * Evaluates whether a given URL matches the specified condition.
 */
export function matchesUrl(condition: MatchCondition, targetUrl: URL | string): boolean {
  try {
    const url = typeof targetUrl === 'string' ? new URL(targetUrl) : targetUrl;
    const currentHost = normalizeHost(url.hostname);

    // 1. Check exclusions first
    if (condition.excludeHost) {
      const exclusions = Array.isArray(condition.excludeHost)
        ? condition.excludeHost
        : [condition.excludeHost];
      const isExcluded = exclusions.some((ex) => {
        const clean = normalizeHost(ex);
        return currentHost === clean || currentHost.endsWith('.' + clean);
      });
      if (isExcluded) return false;
    }

    // 2. Check Host matching
    if (condition.host) {
      const hosts = Array.isArray(condition.host) ? condition.host : [condition.host];
      const hostMatched = hosts.some((h) => {
        if (h === '*' || h === '<all_urls>') return true;
        const clean = normalizeHost(h);
        return currentHost === clean || currentHost.endsWith('.' + clean);
      });
      if (!hostMatched) return false;
    }

    // 3. Check Path matching
    if (condition.path) {
      const paths = Array.isArray(condition.path) ? condition.path : [condition.path];
      const currentPath = url.pathname;
      const pathMatched = paths.some((p) => {
        if (p === '*') return true;
        return currentPath === p || currentPath.startsWith(p);
      });
      if (!pathMatched) return false;
    }

    // 4. Check Pattern matching
    if (condition.urlPattern) {
      const patterns = Array.isArray(condition.urlPattern)
        ? condition.urlPattern
        : [condition.urlPattern];
      const fullHref = url.href;
      const patternMatched = patterns.some((p) => {
        if (p === '*' || p === '<all_urls>') return true;
        const regex = patternToRegex(p);
        return regex.test(fullHref);
      });
      if (!patternMatched) return false;
    }

    return true;
  } catch {
    return false;
  }
}
