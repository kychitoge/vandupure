/**
 * Config Manager: Export & Import Protocol for Vân Du Pure (v1.0.1)
 * Provides secure JSON serialization, schema validation, XSS sanitization,
 * and merge/overwrite options.
 */

import { StorageAdapter, type AppSettings } from './storageAdapter.js';

export interface VanduExportedConfig {
  app: 'vandu-pure';
  version: string;
  exportedAt: string;
  settings: {
    masterEnabled: boolean;
    blockAds: boolean;
    skipYoutubeAds: boolean;
    blockPopups: boolean;
    stripTracking: boolean;
    unblockDom: boolean;
    stripYoutubeRadio: boolean;
    customBlocklist: string[];
    customCosmeticSelectors: string[];
    excludedSites: string[];
  };
}

export interface ImportResult {
  success: boolean;
  message: string;
  importedCount?: {
    domains: number;
    selectors: number;
    sites: number;
  };
}

const DANGEROUS_TAG_REGEX = /<[^>]*>|javascript:|data:/i;

function sanitizeStringList(list: any[]): string[] {
  if (!Array.isArray(list)) return [];
  const cleaned: string[] = [];
  for (const item of list) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed.length > 0 && trimmed.length < 500 && !DANGEROUS_TAG_REGEX.test(trimmed)) {
        cleaned.push(trimmed);
      }
    }
  }
  return Array.from(new Set(cleaned));
}

/**
 * Validates parsed JSON configuration schema
 */
export function validateImportConfig(raw: any): { valid: boolean; error?: string; config?: VanduExportedConfig } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'Dữ liệu cấu hình không phải đối tượng JSON hợp lệ.' };
  }

  const s = raw.settings || raw; // Support both nested format and flat settings
  if (!s || typeof s !== 'object') {
    return { valid: false, error: 'Thiếu trường settings trong tệp cấu hình.' };
  }

  const cleanBlocklist = sanitizeStringList(s.customBlocklist || []);
  const cleanSelectors = sanitizeStringList(s.customCosmeticSelectors || []);
  const cleanExcludedSites = sanitizeStringList(s.excludedSites || []);

  const config: VanduExportedConfig = {
    app: 'vandu-pure',
    version: typeof raw.version === 'string' ? raw.version : '1.0.1',
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
    settings: {
      masterEnabled: s.masterEnabled !== false,
      blockAds: s.blockAds !== false,
      skipYoutubeAds: s.skipYoutubeAds !== false,
      blockPopups: s.blockPopups !== false,
      stripTracking: s.stripTracking !== false,
      unblockDom: s.unblockDom !== false,
      stripYoutubeRadio: s.stripYoutubeRadio !== false,
      customBlocklist: cleanBlocklist,
      customCosmeticSelectors: cleanSelectors,
      excludedSites: cleanExcludedSites
    }
  };

  return { valid: true, config };
}

/**
 * Exports current configuration to formatted JSON string
 */
export async function exportConfig(): Promise<string> {
  const settings = await StorageAdapter.getSettings();
  const exportData: VanduExportedConfig = {
    app: 'vandu-pure',
    version: '1.0.1',
    exportedAt: new Date().toISOString(),
    settings: {
      masterEnabled: settings.masterEnabled,
      blockAds: settings.blockAds,
      skipYoutubeAds: settings.skipYoutubeAds,
      blockPopups: settings.blockPopups,
      stripTracking: settings.stripTracking,
      unblockDom: settings.unblockDom,
      stripYoutubeRadio: settings.stripYoutubeRadio,
      customBlocklist: [...settings.customBlocklist],
      customCosmeticSelectors: [...settings.customCosmeticSelectors],
      excludedSites: [...settings.excludedSites]
    }
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Imports configuration from JSON string
 */
export async function importConfig(jsonString: string, mode: 'merge' | 'overwrite' = 'merge'): Promise<ImportResult> {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return { success: false, message: 'Cú pháp JSON không hợp lệ.' };
  }

  const validation = validateImportConfig(parsed);
  if (!validation.valid || !validation.config) {
    return { success: false, message: validation.error || 'Cấu trúc cấu hình không hợp lệ.' };
  }

  const incoming = validation.config.settings;
  const current = await StorageAdapter.getSettings();

  let finalBlocklist: string[];
  let finalSelectors: string[];
  let finalSites: string[];

  if (mode === 'overwrite') {
    finalBlocklist = incoming.customBlocklist;
    finalSelectors = incoming.customCosmeticSelectors;
    finalSites = incoming.excludedSites;
  } else {
    // Merge & deduplicate
    finalBlocklist = Array.from(new Set([...current.customBlocklist, ...incoming.customBlocklist]));
    finalSelectors = Array.from(new Set([...current.customCosmeticSelectors, ...incoming.customCosmeticSelectors]));
    finalSites = Array.from(new Set([...current.excludedSites, ...incoming.excludedSites]));
  }

  const updatePayload: Partial<AppSettings> = {
    customBlocklist: finalBlocklist,
    customCosmeticSelectors: finalSelectors,
    excludedSites: finalSites
  };

  if (mode === 'overwrite') {
    updatePayload.masterEnabled = incoming.masterEnabled;
    updatePayload.blockAds = incoming.blockAds;
    updatePayload.skipYoutubeAds = incoming.skipYoutubeAds;
    updatePayload.blockPopups = incoming.blockPopups;
    updatePayload.stripTracking = incoming.stripTracking;
    updatePayload.unblockDom = incoming.unblockDom;
    updatePayload.stripYoutubeRadio = incoming.stripYoutubeRadio;
  }

  await StorageAdapter.saveSettings(updatePayload);

  return {
    success: true,
    message: mode === 'overwrite' ? 'Đã ghi đè cấu hình thành công.' : 'Đã hợp nhất cấu hình thành công.',
    importedCount: {
      domains: incoming.customBlocklist.length,
      selectors: incoming.customCosmeticSelectors.length,
      sites: incoming.excludedSites.length
    }
  };
}
