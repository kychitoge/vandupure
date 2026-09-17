/**
 * Core Storage Adapter for Vân Du Override
 * Encapsulates chrome.storage.local with in-memory / localStorage fallback and type safety.
 */

export interface ShieldStats {
  trackersBlocked: number;
  popupsNeutralized: number;
  youtubeMixBlocked: number;
  adsBlocked: number;
}

export interface AppSettings {
  masterEnabled: boolean;
  excludedSites: string[];
  blockAds: boolean;
  skipYoutubeAds: boolean;
  blockPopups: boolean;
  stripTracking: boolean;
  unblockDom: boolean;
  stripYoutubeRadio: boolean;
  customBlocklist: string[];
  customCosmeticSelectors: string[];
  showToastNotification: boolean;
  stats: ShieldStats;
}

export interface HeaderItem {
  id: string;
  enabled: boolean;
  name: string;
  value: string;
  operation: 'set' | 'append' | 'remove';
}

export interface HeaderProfile {
  id: string;
  name: string;
  enabled: boolean;
  urlFilter: string;
  requestHeaders: HeaderItem[];
  responseHeaders: HeaderItem[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  masterEnabled: true,
  excludedSites: [],
  blockAds: true,
  skipYoutubeAds: true,
  blockPopups: true,
  stripTracking: true,
  unblockDom: true,
  stripYoutubeRadio: true,
  customBlocklist: [],
  customCosmeticSelectors: [],
  showToastNotification: true,
  stats: {
    trackersBlocked: 0,
    popupsNeutralized: 0,
    youtubeMixBlocked: 0,
    adsBlocked: 0
  }
};

export const DEFAULT_HEADER_PROFILE: HeaderProfile = {
  id: 'profile_default',
  name: 'Default',
  enabled: true,
  urlFilter: '*',
  requestHeaders: [
    {
      id: 'hdr_ua',
      enabled: false,
      name: 'User-Agent',
      value:
        'Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
      operation: 'set'
    },
    {
      id: 'hdr_accept',
      enabled: false,
      name: 'Accept',
      value: 'application/json, text/html, */*',
      operation: 'set'
    }
  ],
  responseHeaders: [
    {
      id: 'hdr_cors',
      enabled: false,
      name: 'Access-Control-Allow-Origin',
      value: '*',
      operation: 'set'
    }
  ]
};

const SETTINGS_KEY = 'vandu_settings_v2';
const PROFILES_KEY = 'vandu_header_profiles_v2';
const ACTIVE_PROFILE_KEY = 'vandu_active_profile_id_v2';

// In-memory store fallback for node/test environment
const memoryStore: Record<string, string> = {};

export function isExtensionValid(): boolean {
  try {
    return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

function rawGet(key: string): string | null {
  if (isExtensionValid() && chrome.storage && chrome.storage.local) {
    return null; // Will use async chrome.storage
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return memoryStore[key] || null;
}

function rawSet(key: string, value: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
  } else {
    memoryStore[key] = value;
  }
}

// Atomic Promise Queue to prevent asynchronous race conditions when recording stats
let statsUpdateQueue: Promise<any> = Promise.resolve();

export const StorageAdapter = {
  async getSettings(): Promise<AppSettings> {
    if (isExtensionValid() && chrome.storage?.local) {
      try {
        const res = await chrome.storage.local.get(SETTINGS_KEY);
        return { ...DEFAULT_SETTINGS, ...(res[SETTINGS_KEY] || {}) };
      } catch {
        // Graceful fallback when context is invalidated
      }
    }
    const val = rawGet(SETTINGS_KEY);
    return val ? { ...DEFAULT_SETTINGS, ...JSON.parse(val) } : DEFAULT_SETTINGS;
  },

  async saveSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const next = { ...current, ...updates };

    if (isExtensionValid() && chrome.storage?.local) {
      try {
        await chrome.storage.local.set({ [SETTINGS_KEY]: next });
        return next;
      } catch {
        // Graceful fallback
      }
    }
    rawSet(SETTINGS_KEY, JSON.stringify(next));
    return next;
  },

  async isSiteExcluded(hostname: string): Promise<boolean> {
    const settings = await this.getSettings();
    const cleanHost = hostname.toLowerCase().replace(/^www\./, '');
    return settings.excludedSites.some((s) => cleanHost === s || cleanHost.endsWith('.' + s));
  },

  async toggleCurrentSite(hostname: string): Promise<boolean> {
    const settings = await this.getSettings();
    const cleanHost = hostname.toLowerCase().replace(/^www\./, '');
    const exists = settings.excludedSites.includes(cleanHost);

    const newExcluded = exists
      ? settings.excludedSites.filter((s) => s !== cleanHost)
      : [...settings.excludedSites, cleanHost];

    await this.saveSettings({ excludedSites: newExcluded });
    return !exists;
  },

  async addExcludedSite(hostname: string): Promise<string[]> {
    const cleanHost = hostname.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
    if (!cleanHost) return (await this.getSettings()).excludedSites;
    const settings = await this.getSettings();
    const current = settings.excludedSites || [];
    if (!current.includes(cleanHost)) {
      const updated = [...current, cleanHost];
      await this.saveSettings({ excludedSites: updated });
      return updated;
    }
    return current;
  },

  async removeExcludedSite(hostname: string): Promise<string[]> {
    const cleanHost = hostname.trim().toLowerCase().replace(/^www\./, '');
    const settings = await this.getSettings();
    const current = settings.excludedSites || [];
    const updated = current.filter((s) => s !== cleanHost);
    await this.saveSettings({ excludedSites: updated });
    return updated;
  },

  recordBlockedItem(
    category: 'trackers' | 'tracking' | 'popups' | 'youtube' | 'ads' | string,
    count = 1
  ): Promise<ShieldStats> {
    const run = async (): Promise<ShieldStats> => {
      const safeCount = Math.max(1, Math.min(Math.floor(Number(count) || 1), 10000));
      const settings = await this.getSettings();
      const stats = { ...settings.stats };

      if (category === 'trackers' || category === 'tracking') {
        stats.trackersBlocked = (stats.trackersBlocked || 0) + safeCount;
      } else if (category === 'popups') {
        stats.popupsNeutralized = (stats.popupsNeutralized || 0) + safeCount;
      } else if (category === 'youtube') {
        stats.youtubeMixBlocked = (stats.youtubeMixBlocked || 0) + safeCount;
      } else if (category === 'ads') {
        stats.adsBlocked = (stats.adsBlocked || 0) + safeCount;
      }

      await this.saveSettings({ stats });
      return stats;
    };

    const nextPromise = statsUpdateQueue.then(run, run);
    statsUpdateQueue = nextPromise.catch(() => {});
    return nextPromise;
  },

  async resetStats(): Promise<ShieldStats> {
    const defaultStats: ShieldStats = {
      trackersBlocked: 0,
      popupsNeutralized: 0,
      youtubeMixBlocked: 0,
      adsBlocked: 0
    };
    await this.saveSettings({ stats: defaultStats });
    return defaultStats;
  },

  async addCustomBlockDomain(domain: string): Promise<string[]> {
    const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^\*\./, '');
    if (!clean) return (await this.getSettings()).customBlocklist;
    const settings = await this.getSettings();
    const current = settings.customBlocklist || [];
    if (!current.includes(clean)) {
      const updated = [...current, clean];
      await this.saveSettings({ customBlocklist: updated });
      return updated;
    }
    return current;
  },

  async removeCustomBlockDomain(domain: string): Promise<string[]> {
    const clean = domain.trim().toLowerCase();
    const settings = await this.getSettings();
    const current = settings.customBlocklist || [];
    const updated = current.filter((d) => d !== clean);
    await this.saveSettings({ customBlocklist: updated });
    return updated;
  },

  async addCustomCosmeticSelector(selector: string): Promise<string[]> {
    const clean = selector.trim();
    if (!clean) return (await this.getSettings()).customCosmeticSelectors;
    const settings = await this.getSettings();
    const current = settings.customCosmeticSelectors || [];
    if (!current.includes(clean)) {
      const updated = [...current, clean];
      await this.saveSettings({ customCosmeticSelectors: updated });
      return updated;
    }
    return current;
  },

  async removeCustomCosmeticSelector(selector: string): Promise<string[]> {
    const clean = selector.trim();
    const settings = await this.getSettings();
    const current = settings.customCosmeticSelectors || [];
    const updated = current.filter((s) => s !== clean);
    await this.saveSettings({ customCosmeticSelectors: updated });
    return updated;
  },

  async getHeaderProfiles(): Promise<HeaderProfile[]> {
    if (isExtensionValid() && chrome.storage?.local) {
      try {
        const res = await chrome.storage.local.get(PROFILES_KEY);
        const profiles = res[PROFILES_KEY] as HeaderProfile[] | undefined;
        if (!profiles || profiles.length === 0) {
          await chrome.storage.local.set({ [PROFILES_KEY]: [DEFAULT_HEADER_PROFILE] });
          return [DEFAULT_HEADER_PROFILE];
        }
        return profiles;
      } catch {
        // Graceful fallback
      }
    }
    const val = rawGet(PROFILES_KEY);
    return val ? JSON.parse(val) : [DEFAULT_HEADER_PROFILE];
  },

  async saveHeaderProfiles(profiles: HeaderProfile[]): Promise<void> {
    if (isExtensionValid() && chrome.storage?.local) {
      try {
        await chrome.storage.local.set({ [PROFILES_KEY]: profiles });
        return;
      } catch {
        // Graceful fallback
      }
    }
    rawSet(PROFILES_KEY, JSON.stringify(profiles));
  },

  async getActiveProfileId(): Promise<string> {
    if (isExtensionValid() && chrome.storage?.local) {
      try {
        const res = await chrome.storage.local.get(ACTIVE_PROFILE_KEY);
        return res[ACTIVE_PROFILE_KEY] || DEFAULT_HEADER_PROFILE.id;
      } catch {
        // Graceful fallback
      }
    }
    return rawGet(ACTIVE_PROFILE_KEY) || DEFAULT_HEADER_PROFILE.id;
  },

  async setActiveProfileId(id: string): Promise<void> {
    if (isExtensionValid() && chrome.storage?.local) {
      try {
        await chrome.storage.local.set({ [ACTIVE_PROFILE_KEY]: id });
        return;
      } catch {
        // Graceful fallback
      }
    }
    rawSet(ACTIVE_PROFILE_KEY, id);
  },

  async addHeaderProfile(name: string): Promise<HeaderProfile> {
    const profiles = await this.getHeaderProfiles();
    const newProfile: HeaderProfile = {
      id: 'prof_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: name.trim() || `Profile ${profiles.length + 1}`,
      enabled: true,
      urlFilter: '*',
      requestHeaders: [],
      responseHeaders: []
    };
    const updated = [...profiles, newProfile];
    await this.saveHeaderProfiles(updated);
    await this.setActiveProfileId(newProfile.id);
    return newProfile;
  },

  async duplicateHeaderProfile(profileId: string): Promise<HeaderProfile | null> {
    const profiles = await this.getHeaderProfiles();
    const target = profiles.find((p) => p.id === profileId);
    if (!target) return null;

    const clone: HeaderProfile = {
      ...JSON.parse(JSON.stringify(target)),
      id: 'prof_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: `${target.name} (Copy)`
    };
    await this.saveHeaderProfiles([...profiles, clone]);
    await this.setActiveProfileId(clone.id);
    return clone;
  },

  async updateHeaderProfile(updatedProfile: HeaderProfile): Promise<void> {
    const profiles = await this.getHeaderProfiles();
    const idx = profiles.findIndex((p) => p.id === updatedProfile.id);
    if (idx !== -1) {
      profiles[idx] = updatedProfile;
      await this.saveHeaderProfiles(profiles);
    }
  },

  async deleteHeaderProfile(profileId: string): Promise<HeaderProfile[]> {
    const profiles = await this.getHeaderProfiles();
    if (profiles.length <= 1) {
      return profiles;
    }
    const updated = profiles.filter((p) => p.id !== profileId);
    await this.saveHeaderProfiles(updated);

    const activeId = await this.getActiveProfileId();
    if (activeId === profileId) {
      await this.setActiveProfileId(updated[0].id);
    }
    return updated;
  }
};
