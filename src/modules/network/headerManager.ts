/**
 * Network Browser Primitive: Header Studio Dynamic Rules Manager
 * Maps HeaderProfile to chrome.declarativeNetRequest MODIFY_HEADERS rules.
 * Contains ZERO site-specific logic.
 */

import type { HeaderProfile } from '../../core/storage/storageAdapter.js';

export const HEADER_RULE_ID_START = 1000;

function mapOperation(op: 'set' | 'append' | 'remove'): chrome.declarativeNetRequest.HeaderOperation {
  if (op === 'append') return 'append' as chrome.declarativeNetRequest.HeaderOperation.APPEND;
  if (op === 'remove') return 'remove' as chrome.declarativeNetRequest.HeaderOperation.REMOVE;
  return 'set' as chrome.declarativeNetRequest.HeaderOperation.SET;
}

export function buildHeaderStudioRule(
  profile: HeaderProfile,
  ruleId = HEADER_RULE_ID_START
): chrome.declarativeNetRequest.Rule | null {
  if (!profile.enabled) return null;

  const enabledReqHeaders: chrome.declarativeNetRequest.ModifyHeaderInfo[] = profile.requestHeaders
    .filter((h) => h.enabled && h.name.trim())
    .map((h) => ({
      header: h.name.trim(),
      operation: mapOperation(h.operation),
      ...(h.operation !== 'remove' ? { value: h.value } : {})
    }));

  const enabledResHeaders: chrome.declarativeNetRequest.ModifyHeaderInfo[] = profile.responseHeaders
    .filter((h) => h.enabled && h.name.trim())
    .map((h) => ({
      header: h.name.trim(),
      operation: mapOperation(h.operation),
      ...(h.operation !== 'remove' ? { value: h.value } : {})
    }));

  if (enabledReqHeaders.length === 0 && enabledResHeaders.length === 0) {
    return null;
  }

  let urlFilter = profile.urlFilter.trim();
  if (!urlFilter || urlFilter === '*' || urlFilter === '<all_urls>') {
    urlFilter = '*';
  } else if (!urlFilter.startsWith('||') && !urlFilter.startsWith('http') && !urlFilter.startsWith('*')) {
    urlFilter = `||${urlFilter}`;
  }

  return {
    id: ruleId,
    priority: 5,
    action: {
      type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      ...(enabledReqHeaders.length > 0 ? { requestHeaders: enabledReqHeaders } : {}),
      ...(enabledResHeaders.length > 0 ? { responseHeaders: enabledResHeaders } : {})
    },
    condition: {
      urlFilter,
      resourceTypes: [
        'main_frame' as chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
        'sub_frame' as chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
        'xmlhttprequest' as chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
        'script' as chrome.declarativeNetRequest.ResourceType.SCRIPT,
        'stylesheet' as chrome.declarativeNetRequest.ResourceType.STYLESHEET,
        'image' as chrome.declarativeNetRequest.ResourceType.IMAGE,
        'media' as chrome.declarativeNetRequest.ResourceType.MEDIA,
        'websocket' as chrome.declarativeNetRequest.ResourceType.WEBSOCKET,
        'other' as chrome.declarativeNetRequest.ResourceType.OTHER
      ]
    }
  };
}
