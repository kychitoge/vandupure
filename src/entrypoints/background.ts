import { defineBackground } from 'wxt/sandbox';
import { StorageAdapter } from '../core/storage/index.js';
import { Logger } from '../core/logger/index.js';
import { registerDefaultRules } from '../rules/index.js';
import { TRACKING_PARAMS } from '../rules/global/tracking.rules.js';
import {
  buildTrackingDnrRule,
  buildRedirectQueryDnrRule,
  buildAdBlockDnrRules
} from '../modules/network/dnrBuilder.js';
import {
  buildHeaderStudioRule,
  HEADER_RULE_ID_START
} from '../modules/network/headerManager.js';

const tabBlockedCounts: Record<number, number> = {};

function updateTabBadge(tabId: number, count: number): void {
  tabBlockedCounts[tabId] = count;
  const text = count > 0 ? (count > 99 ? '99+' : `${count}`) : '';
  chrome.action.setBadgeText({ text, tabId });
  chrome.action.setBadgeBackgroundColor({ color: '#0d9488', tabId });
  if (chrome.action.setBadgeTextColor) {
    chrome.action.setBadgeTextColor({ color: '#ffffff', tabId });
  }
}

const STATIC_RULESET_IDS = [
  'ruleset_easylist',
  'ruleset_china',
  'ruleset_vietnam',
  'ruleset_peter_lowe',
  'ruleset_badware'
];

async function syncStaticRulesets(enable: boolean): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.declarativeNetRequest?.updateEnabledRulesets) return;
  try {
    if (enable) {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: STATIC_RULESET_IDS
      });
    } else {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        disableRulesetIds: STATIC_RULESET_IDS
      });
    }
  } catch (err) {
    Logger.debug('Failed to update static rulesets:', err);
  }
}

let isSyncing = false;
let pendingSync = false;

async function doSyncDnrRules(): Promise<void> {
  const settings = await StorageAdapter.getSettings();
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existingRules.map((r) => r.id);

  if (!settings.masterEnabled) {
    await syncStaticRulesets(false);
    if (existingIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingIds,
        addRules: []
      });
    }
    Logger.info('DNR protection rules disabled (master switch off).');
    return;
  }

  // Synchronize Static Community Rulesets (Global + VN + China)
  await syncStaticRulesets(Boolean(settings.blockAds));

  const addRules: chrome.declarativeNetRequest.Rule[] = [];

  // 1. Core Tracking Stripper (DNR ID: 1)
  if (settings.stripTracking) {
    addRules.push(
      buildTrackingDnrRule({
        id: 1,
        priority: 1,
        trackingParams: TRACKING_PARAMS
      })
    );
  }

  // 2. YouTube Radio Redirects (DNR IDs: 2, 3, 4)
  if (settings.stripYoutubeRadio) {
    addRules.push(
      buildRedirectQueryDnrRule({
        id: 2,
        priority: 2,
        urlFilter: '||youtube.com/watch?*list=RD*',
        removeParams: ['list', 'start_radio', 'index']
      })
    );
    addRules.push(
      buildRedirectQueryDnrRule({
        id: 3,
        priority: 2,
        urlFilter: '||youtube.com/watch?*start_radio=*',
        removeParams: ['list', 'start_radio', 'index']
      })
    );
    addRules.push(
      buildRedirectQueryDnrRule({
        id: 4,
        priority: 2,
        urlFilter: '||youtube.com/watch?*list=UL*',
        removeParams: ['list', 'start_radio', 'index']
      })
    );
  }

  // 3. Ad Blocker Rules (DNR ID: 10 - 999)
  if (settings.blockAds) {
    const adRules = buildAdBlockDnrRules({
      customDomains: settings.customBlocklist,
      excludedSites: settings.excludedSites
    });
    addRules.push(...adRules);
  } else if (settings.excludedSites && settings.excludedSites.length > 0) {
    // If blockAds is off or site is excluded, make sure allowAllRequests rules are active
    const adRules = buildAdBlockDnrRules({
      defaultDomains: [],
      customDomains: [],
      excludedSites: settings.excludedSites
    });
    addRules.push(...adRules);
  }

  // 4. Header Studio Rules (DNR ID: 1000+)
  const profiles = await StorageAdapter.getHeaderProfiles();
  const activeId = await StorageAdapter.getActiveProfileId();
  const activeProfile = profiles.find((p) => p.id === activeId) || profiles[0];

  if (activeProfile && activeProfile.enabled) {
    const headerRule = buildHeaderStudioRule(activeProfile, HEADER_RULE_ID_START);
    if (headerRule) {
      addRules.push(headerRule);
    }
  }

  // Deduplicate addRules by id
  const seenIds = new Set<number>();
  const uniqueAddRules: chrome.declarativeNetRequest.Rule[] = [];
  for (const rule of addRules) {
    if (!seenIds.has(rule.id)) {
      seenIds.add(rule.id);
      uniqueAddRules.push(rule);
    }
  }

  // Explicitly remove all existing IDs + all IDs about to be added to guarantee uniqueness
  const removeRuleIds = Array.from(new Set([...existingIds, ...seenIds]));

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules: uniqueAddRules
  });

  Logger.info(`DNR Dynamic Rules synced: ${uniqueAddRules.length} active rules.`);
}

async function syncAllDnrRules(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.declarativeNetRequest) return;

  if (isSyncing) {
    pendingSync = true;
    return;
  }

  isSyncing = true;
  try {
    do {
      pendingSync = false;
      await doSyncDnrRules();
    } while (pendingSync);
  } catch (err) {
    Logger.error('Failed to sync DNR rules:', err);
  } finally {
    isSyncing = false;
  }
}

export default defineBackground(() => {
  Logger.info('Vân Du Override v3 Background Service Worker initialized.');

  // 1. Register all declarative rules in memory
  registerDefaultRules();

  // 2. Initialize Toolbar Badge Colors
  chrome.action.setBadgeBackgroundColor({ color: '#0d9488' });
  if (chrome.action.setBadgeTextColor) {
    chrome.action.setBadgeTextColor({ color: '#ffffff' });
  }

  // 3. Initial sync of DNR rules
  syncAllDnrRules();

  // 4. Listen to storage changes
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.onChanged.addListener((changes) => {
      if (
        changes['vandu_settings_v2'] ||
        changes['vandu_header_profiles_v2'] ||
        changes['vandu_active_profile_id_v2']
      ) {
        syncAllDnrRules();
      }
    });
  }

  // 5. Listen to messages from Content Scripts
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender) => {
      try {
        if (msg && msg.type === 'ITEM_BLOCKED') {
          const count = msg.count || 1;
          StorageAdapter.recordBlockedItem(msg.category, count);

          if (sender?.tab?.id) {
            const tabId = sender.tab.id;
            const newTotal = (tabBlockedCounts[tabId] || 0) + count;
            updateTabBadge(tabId, newTotal);
          }
        }
      } catch (e) {
        Logger.debug('Error processing content script message:', e);
      }
    });
  }

  // 6. Tab tracking & cleanup
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.onActivated?.addListener(({ tabId }) => {
      try {
        const current = tabBlockedCounts[tabId] || 0;
        updateTabBadge(tabId, current);
      } catch {}
    });

    chrome.tabs.onUpdated?.addListener((tabId, changeInfo) => {
      try {
        if (changeInfo.status === 'loading') {
          tabBlockedCounts[tabId] = 0;
          updateTabBadge(tabId, 0);
        }
      } catch {}
    });

    chrome.tabs.onRemoved?.addListener((tabId) => {
      delete tabBlockedCounts[tabId];
    });
  }

  // 7. Keyboard Shortcuts coordination
  if (typeof chrome !== 'undefined' && chrome.commands?.onCommand) {
    chrome.commands.onCommand.addListener(async (command) => {
      try {
        if (command === 'toggle-element-picker') {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'START_ELEMENT_PICKER' }).catch(() => {});
          }
        } else if (command === 'toggle-shield-master') {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.url) {
            try {
              const host = new URL(tab.url).hostname.replace(/^www\./, '');
              await StorageAdapter.toggleCurrentSite(host);
            } catch {}
          }
        }
      } catch (err) {
        Logger.debug('Failed to execute command:', err);
      }
    });
  }

  // 8. Context Menu Setup
  if (typeof chrome !== 'undefined' && chrome.contextMenus) {
    const registerContextMenu = () => {
      try {
        chrome.contextMenus.removeAll(() => {
          chrome.contextMenus.create({
            id: 'vandu-picker-context',
            title: 'Vân Du: Xóa phần tử này',
            contexts: ['all']
          }, () => {
            if (chrome.runtime?.lastError) {
              // Ignore duplicate or registration warning
            }
          });
        });
      } catch {}
    };

    registerContextMenu();
    if (chrome.runtime?.onInstalled) {
      chrome.runtime.onInstalled.addListener(registerContextMenu);
    }

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === 'vandu-picker-context' && tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'START_ELEMENT_PICKER' }).catch(() => {});
      }
    });
  }
});
