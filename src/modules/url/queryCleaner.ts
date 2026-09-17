/**
 * URL Browser Primitive: Advanced URL Query & Tracking Purifier
 * Reference: url-tracking-stripper (TraderStf) & ClearURLs (Kevin Röbert)
 * Contains ZERO site-specific logic.
 */

export interface CleanUrlResult {
  cleaned: boolean;
  url: string;
  count: number;
}

/**
 * 1. Tracking Prefixes (from url-tracking-stripper & ClearURLs)
 * Parameters starting with these prefixes are identified as marketing telemetry.
 */
export const TRACKING_PREFIXES = [
  'utm_',      // Google Urchin Tracking Module
  '_hs',       // HubSpot (_hsenc, _hsmi)
  'mc_',       // MailChimp (mc_cid, mc_eid)
  'mkt_',      // Marketo (mkt_tok)
  'pk_',       // Piwik / Matomo (pk_source, pk_medium, pk_campaign, pk_kwd, pk_cid)
  'piwik_',    // Piwik
  'matomo_',   // Matomo
  'ns_',       // comScore Digital Analytix
  'ic',        // Adobe Omniture (icid, ICID)
  'vero_',     // Vero
  'wicked',    // Wicked Reports
  'aff_',      // Affiliate parameters
];

/**
 * 2. Comprehensive Standalone Tracking Parameters
 */
export const STANDALONE_TRACKERS = [
  // Google / DoubleClick / Analytics
  'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid', '_ga', '_gl', '_gad_source',
  // Facebook / Meta / Instagram
  'fbclid', 'igshid', 'fref',
  // Microsoft / Bing
  'msclkid',
  // Twitter / X
  'twclid',
  // TikTok
  'ttclid',
  // LinkedIn
  'li_fat_id',
  // Pinterest
  'epik',
  // Yandex
  'yclid', 'ysclid',
  // Affiliate / Analytics Networks
  'zanpid', 'sc_clickid', 's_kwcid', 'rb_clickid', 'irclickid',
  // YouTube Share tracker
  'si',
  // Generic Referrers & Trackers
  'ref', 'ref_src', 'ref_url', 'source',
];

const STANDALONE_SET = new Set(STANDALONE_TRACKERS.map((t) => t.toLowerCase()));

/**
 * Checks if a parameter key is an identified tracker.
 */
export function isTrackingParam(key: string, customSet?: Set<string>): boolean {
  const lower = key.toLowerCase();
  if (customSet && customSet.has(lower)) {
    return true;
  }
  if (STANDALONE_SET.has(lower)) {
    return true;
  }
  for (const prefix of TRACKING_PREFIXES) {
    if (lower.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

/**
 * Unwraps known redirection wrappers (e.g. Google, YouTube, Facebook, Messenger, Reddit, Steam, Slack, generic redirect keys)
 * to retrieve the clean target destination URL. Supports recursive unwrapping.
 */
export function unwrapRedirectUrl(urlStr: string): string {
  function unwrapSingle(urlInput: string): string {
    try {
      const parsed = new URL(urlInput);

      // 1. Google search & Gmail redirection: google.com/url?q=... or ?url=...
      if (parsed.hostname.includes('google.') && parsed.pathname === '/url') {
        const q = parsed.searchParams.get('q') || parsed.searchParams.get('url');
        if (q && (q.startsWith('http://') || q.startsWith('https://'))) {
          return q;
        }
      }

      // 2. YouTube external redirection: youtube.com/redirect?q=...
      if (parsed.hostname.includes('youtube.com') && parsed.pathname === '/redirect') {
        const q = parsed.searchParams.get('q');
        if (q && (q.startsWith('http://') || q.startsWith('https://'))) {
          return q;
        }
      }

      // 3. Facebook & Messenger: l.facebook.com/l.php?u=..., l.messenger.com/l.php?u=...
      if ((parsed.hostname.includes('facebook.com') || parsed.hostname.includes('messenger.com')) && parsed.pathname === '/l.php') {
        const u = parsed.searchParams.get('u');
        if (u && (u.startsWith('http://') || u.startsWith('https://'))) {
          return u;
        }
      }

      // 4. Reddit outgoing: out.reddit.com?url=...
      if (parsed.hostname.includes('reddit.com') && (parsed.pathname === '/' || parsed.pathname === '')) {
        const url = parsed.searchParams.get('url');
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          return url;
        }
      }

      // 5. Steam Community linkfilter: steamcommunity.com/linkfilter/?url=...
      if (parsed.hostname.includes('steamcommunity.com') && parsed.pathname.includes('/linkfilter')) {
        const url = parsed.searchParams.get('url');
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          return url;
        }
      }

      // 6. Slack redirection: slack-redir.net/link?url=...
      if (parsed.hostname.includes('slack-redir.net')) {
        const url = parsed.searchParams.get('url');
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          return url;
        }
      }

      // 7. Generic redirect parameters
      const redirectKeys = ['redirect_to', 'redirect_url', 'destination', 'target', 'dest', 'u', 'url', 'out', 'murl'];
      for (const key of redirectKeys) {
        const val = parsed.searchParams.get(key);
        if (val && (val.startsWith('http://') || val.startsWith('https://'))) {
          return val;
        }
      }
    } catch {}
    return urlInput;
  }

  let current = urlStr;
  for (let i = 0; i < 5; i++) {
    const next = unwrapSingle(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

/**
 * Strips tracking parameters from a URL without mutating window state.
 */
export function stripQueryParams(
  rawUrl: string | URL,
  additionalParamsToStrip?: string[]
): CleanUrlResult {
  try {
    const rawString = typeof rawUrl === 'string' ? rawUrl : rawUrl.href;
    const unwrapped = unwrapRedirectUrl(rawString);
    const baseHref = typeof window !== 'undefined' ? window.location?.href : 'http://localhost';
    const parsed = new URL(unwrapped, baseHref);

    const customSet = additionalParamsToStrip && additionalParamsToStrip.length > 0
      ? new Set(additionalParamsToStrip.map((p) => p.toLowerCase()))
      : undefined;

    let count = 0;
    const keysToDelete: string[] = [];

    for (const key of Array.from(parsed.searchParams.keys())) {
      if (isTrackingParam(key, customSet)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      parsed.searchParams.delete(key);
      count++;
    }

    return {
      cleaned: count > 0 || unwrapped !== rawString,
      url: parsed.href,
      count
    };
  } catch {
    return {
      cleaned: false,
      url: typeof rawUrl === 'string' ? rawUrl : rawUrl.href,
      count: 0
    };
  }
}

/**
 * Strips specified query parameters from current window address bar via replaceState.
 */
export function cleanAddressBar(additionalParamsToStrip?: string[]): CleanUrlResult {
  if (typeof window === 'undefined' || !window.location) {
    return { cleaned: false, url: '', count: 0 };
  }

  const result = stripQueryParams(window.location.href, additionalParamsToStrip);
  if (result.cleaned && window.history?.replaceState) {
    try {
      const targetUrl = new URL(result.url, window.location.href);
      // Only rewrite address bar if target origin matches current origin to prevent DOMException: SecurityError
      if (targetUrl.origin === window.location.origin) {
        window.history.replaceState(null, document.title, targetUrl.href);
      }
    } catch {}
  }
  return result;
}
