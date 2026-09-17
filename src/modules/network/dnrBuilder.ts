/**
 * Network Browser Primitive: DeclarativeNetRequest Dynamic Rules Builder
 * Compiles high-level network rules to chrome.declarativeNetRequest dynamic rules.
 * Contains ZERO site-specific logic.
 */

export interface TrackingDnrRuleConfig {
  id: number;
  priority?: number;
  trackingParams: string[];
  urlFilter?: string;
}

export function buildTrackingDnrRule(config: TrackingDnrRuleConfig): chrome.declarativeNetRequest.Rule {
  return {
    id: config.id,
    priority: config.priority ?? 1,
    action: {
      type: 'redirect' as chrome.declarativeNetRequest.RuleActionType.REDIRECT,
      redirect: {
        transform: {
          queryTransform: {
            removeParams: config.trackingParams
          }
        }
      }
    },
    condition: {
      urlFilter: config.urlFilter ?? '*',
      resourceTypes: [
        'main_frame' as chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
        'sub_frame' as chrome.declarativeNetRequest.ResourceType.SUB_FRAME
      ]
    }
  };
}

export interface RedirectQueryDnrRuleConfig {
  id: number;
  priority?: number;
  urlFilter: string;
  removeParams: string[];
}

export function buildRedirectQueryDnrRule(
  config: RedirectQueryDnrRuleConfig
): chrome.declarativeNetRequest.Rule {
  return {
    id: config.id,
    priority: config.priority ?? 2,
    action: {
      type: 'redirect' as chrome.declarativeNetRequest.RuleActionType.REDIRECT,
      redirect: {
        transform: {
          queryTransform: {
            removeParams: config.removeParams
          }
        }
      }
    },
    condition: {
      urlFilter: config.urlFilter,
      resourceTypes: ['main_frame' as chrome.declarativeNetRequest.ResourceType.MAIN_FRAME]
    }
  };
}

export const POPULAR_AD_DOMAINS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleads.g.doubleclick.net',
  'adservice.google.com',
  'popads.net',
  'adsterra.com',
  'propellerads.com',
  'taboola.com',
  'outbrain.com',
  'mgid.com',
  'criteo.com',
  'adnxs.com',
  'exoclick.com',
  'juicyads.com',
  'trafficjunky.com',
  'yadro.ru'
];

export const YOUTUBE_AD_ENDPOINTS = [
  'youtube.com/pagead/',
  'youtube.com/api/stats/ads',
  'youtube.com/youtubei/v1/player/ad_break',
  'youtube.com/get_midroll_info',
  'youtube.com/ptracking'
];

export const AD_DEFAULT_RULE_ID_START = 10;
export const AD_YOUTUBE_RULE_ID_START = 40;
export const AD_CUSTOM_RULE_ID_START = 100;

export interface AdBlockDnrOptions {
  defaultDomains?: string[];
  customDomains?: string[];
  excludedSites?: string[];
}

export function buildAdBlockDnrRules(options: AdBlockDnrOptions = {}): chrome.declarativeNetRequest.Rule[] {
  const rules: chrome.declarativeNetRequest.Rule[] = [];
  const defaultDomains = options.defaultDomains ?? POPULAR_AD_DOMAINS;
  const customDomains = options.customDomains ?? [];
  const excludedInitiatorDomains = options.excludedSites && options.excludedSites.length > 0 ? options.excludedSites : undefined;

  const standardResourceTypes = [
    'script' as chrome.declarativeNetRequest.ResourceType.SCRIPT,
    'sub_frame' as chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
    'xmlhttprequest' as chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
    'image' as chrome.declarativeNetRequest.ResourceType.IMAGE,
    'ping' as chrome.declarativeNetRequest.ResourceType.PING,
    'other' as chrome.declarativeNetRequest.ResourceType.OTHER
  ];

  // 1. Default popular ad domains (ID: 10 - 39)
  defaultDomains.forEach((domain, idx) => {
    rules.push({
      id: AD_DEFAULT_RULE_ID_START + idx,
      priority: 3,
      action: {
        type: 'block' as chrome.declarativeNetRequest.RuleActionType.BLOCK
      },
      condition: {
        urlFilter: `||${domain}^`,
        resourceTypes: standardResourceTypes,
        excludedInitiatorDomains
      }
    });
  });

  // 2. YouTube-specific ad endpoints (ID: 40 - 59)
  YOUTUBE_AD_ENDPOINTS.forEach((endpoint, idx) => {
    rules.push({
      id: AD_YOUTUBE_RULE_ID_START + idx,
      priority: 5,
      action: {
        type: 'block' as chrome.declarativeNetRequest.RuleActionType.BLOCK
      },
      condition: {
        urlFilter: `||${endpoint}`,
        resourceTypes: standardResourceTypes,
        excludedInitiatorDomains
      }
    });
  });

  // 3. High-priority Whitelist Allow Rules for Excluded Sites (ID: 60 - 99)
  // When user whitelists a site or turns off shield on domain, allowAllRequests overrides static EasyList/Vie/Chn rulesets!
  if (options.excludedSites && options.excludedSites.length > 0) {
    options.excludedSites.forEach((site, idx) => {
      const cleanSite = site.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (!cleanSite) return;
      rules.push({
        id: 60 + idx,
        priority: 99999,
        action: {
          type: 'allowAllRequests' as chrome.declarativeNetRequest.RuleActionType.ALLOW_ALL_REQUESTS
        },
        condition: {
          initiatorDomains: [cleanSite],
          resourceTypes: [
            'main_frame' as chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
            'sub_frame' as chrome.declarativeNetRequest.ResourceType.SUB_FRAME
          ]
        }
      });
    });
  }

  // 4. Custom blocklist domains (ID: 100 - 999)
  customDomains.forEach((domain, idx) => {
    let clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    clean = clean.replace(/^\|\|/, '').replace(/\^$/, '');
    if (!clean) return;
    rules.push({
      id: AD_CUSTOM_RULE_ID_START + idx,
      priority: 4,
      action: {
        type: 'block' as chrome.declarativeNetRequest.RuleActionType.BLOCK
      },
      condition: {
        urlFilter: `||${clean}^`,
        resourceTypes: standardResourceTypes,
        excludedInitiatorDomains
      }
    });
  });

  return rules;
}
