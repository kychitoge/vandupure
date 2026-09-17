import { describe, it, expect, beforeEach } from 'vitest';
import { matchesUrl, normalizeHost, patternToRegex } from '../src/core/matcher/urlMatcher.js';
import { RuleRegistry } from '../src/core/rules/registry.js';
import type { OverrideRule } from '../src/core/rules/types.js';
import { StorageAdapter } from '../src/core/storage/storageAdapter.js';

describe('Core Matcher: urlMatcher', () => {
  it('normalizes host correctly', () => {
    expect(normalizeHost('www.youtube.com')).toBe('youtube.com');
    expect(normalizeHost('YOUTUBE.COM')).toBe('youtube.com');
    expect(normalizeHost('m.facebook.com')).toBe('m.facebook.com');
  });

  it('matches by host with subdomain support', () => {
    expect(matchesUrl({ host: 'youtube.com' }, 'https://www.youtube.com/watch?v=123')).toBe(true);
    expect(matchesUrl({ host: 'youtube.com' }, 'https://m.youtube.com/')).toBe(true);
    expect(matchesUrl({ host: 'youtube.com' }, 'https://notyoutube.com/')).toBe(false);
  });

  it('matches by path', () => {
    expect(matchesUrl({ path: '/watch' }, 'https://youtube.com/watch?v=123')).toBe(true);
    expect(matchesUrl({ path: '/shorts' }, 'https://youtube.com/watch?v=123')).toBe(false);
  });

  it('matches glob urlPattern', () => {
    expect(
      matchesUrl({ urlPattern: '*://*.youtube.com/watch*' }, 'https://www.youtube.com/watch?v=abc')
    ).toBe(true);
    expect(
      matchesUrl({ urlPattern: '*://*.youtube.com/watch*' }, 'https://www.youtube.com/feed/subscriptions')
    ).toBe(false);
  });

  it('respects excludeHost condition', () => {
    expect(
      matchesUrl(
        { host: '*', excludeHost: 'trusted.com' },
        'https://trusted.com/page'
      )
    ).toBe(false);
    expect(
      matchesUrl(
        { host: '*', excludeHost: 'trusted.com' },
        'https://sub.trusted.com/page'
      )
    ).toBe(false);
    expect(
      matchesUrl(
        { host: '*', excludeHost: 'trusted.com' },
        'https://other.com/page'
      )
    ).toBe(true);
  });
});

describe('Core Rules: RuleRegistry', () => {
  let registry: RuleRegistry;

  const mockRule: OverrideRule = {
    id: 'test-rule-1',
    name: 'Test YouTube Clean',
    category: 'youtube',
    enabled: true,
    priority: 10,
    lifecycle: 'document_start',
    match: {
      host: 'youtube.com',
      path: '/watch'
    },
    action: {
      type: 'url.removeQuery',
      params: ['list', 'start_radio']
    }
  };

  beforeEach(() => {
    registry = new RuleRegistry();
  });

  it('registers and retrieves rules', () => {
    registry.register(mockRule);
    expect(registry.get('test-rule-1')).toBeDefined();
    expect(registry.getAll().length).toBe(1);
  });

  it('finds matched rules sorted by priority', () => {
    const lowPriorityRule: OverrideRule = {
      ...mockRule,
      id: 'low-rule',
      priority: 1
    };
    registry.register([lowPriorityRule, mockRule]);

    const matched = registry.getMatchedRules('https://www.youtube.com/watch?v=xyz');
    expect(matched.length).toBe(2);
    expect(matched[0].id).toBe('test-rule-1'); // higher priority first
    expect(matched[1].id).toBe('low-rule');
  });

  it('filters out disabled rules', () => {
    const disabledRule: OverrideRule = {
      ...mockRule,
      id: 'disabled',
      enabled: false
    };
    registry.register(disabledRule);
    expect(registry.getMatchedRules('https://www.youtube.com/watch?v=xyz').length).toBe(0);
  });
});

describe('Core Storage: StorageAdapter', () => {
  it('returns default settings when storage is empty', async () => {
    const settings = await StorageAdapter.getSettings();
    expect(settings.masterEnabled).toBe(true);
    expect(settings.stripTracking).toBe(true);
  });

  it('saves and reads updated settings', async () => {
    await StorageAdapter.saveSettings({ stripTracking: false });
    const updated = await StorageAdapter.getSettings();
    expect(updated.stripTracking).toBe(false);
  });

  it('records blocked item statistics including ads', async () => {
    const initial = await StorageAdapter.getSettings();
    const trackersBefore = initial.stats.trackersBlocked;
    const adsBefore = initial.stats.adsBlocked || 0;

    await StorageAdapter.recordBlockedItem('trackers', 5);
    await StorageAdapter.recordBlockedItem('tracking', 3);
    await StorageAdapter.recordBlockedItem('ads', 2);

    const updated = await StorageAdapter.getSettings();
    expect(updated.stats.trackersBlocked).toBe(trackersBefore + 8);
    expect(updated.stats.adsBlocked).toBe(adsBefore + 2);
  });

  it('manages custom blocklist domains', async () => {
    const list1 = await StorageAdapter.addCustomBlockDomain('https://ad.example.com/path');
    expect(list1).toContain('ad.example.com');

    const list2 = await StorageAdapter.removeCustomBlockDomain('ad.example.com');
    expect(list2).not.toContain('ad.example.com');
  });

  it('manages custom cosmetic selectors', async () => {
    const list1 = await StorageAdapter.addCustomCosmeticSelector('.sidebar-ad');
    expect(list1).toContain('.sidebar-ad');

    const list2 = await StorageAdapter.removeCustomCosmeticSelector('.sidebar-ad');
    expect(list2).not.toContain('.sidebar-ad');
  });

  it('handles concurrent recordBlockedItem calls atomically without race conditions', async () => {
    await StorageAdapter.resetStats();

    // Fire concurrent increments across categories
    await Promise.all([
      StorageAdapter.recordBlockedItem('ads', 1),
      StorageAdapter.recordBlockedItem('popups', 2),
      StorageAdapter.recordBlockedItem('youtube', 1),
      StorageAdapter.recordBlockedItem('ads', 3),
      StorageAdapter.recordBlockedItem('trackers', 4),
      StorageAdapter.recordBlockedItem('popups', 1),
      StorageAdapter.recordBlockedItem('ads', 2),
      StorageAdapter.recordBlockedItem('youtube', 2)
    ]);

    const settings = await StorageAdapter.getSettings();
    expect(settings.stats.adsBlocked).toBe(6); // 1 + 3 + 2 = 6
    expect(settings.stats.popupsNeutralized).toBe(3); // 2 + 1 = 3
    expect(settings.stats.youtubeMixBlocked).toBe(3); // 1 + 2 = 3
    expect(settings.stats.trackersBlocked).toBe(4); // 4
  });

  it('sanitizes and clamps invalid or malicious count values in recordBlockedItem', async () => {
    await StorageAdapter.resetStats();

    // Passing NaN, negative numbers, non-numbers or huge numbers
    await StorageAdapter.recordBlockedItem('ads', NaN as any);
    await StorageAdapter.recordBlockedItem('ads', -50 as any);
    await StorageAdapter.recordBlockedItem('ads', 'invalid' as any);
    await StorageAdapter.recordBlockedItem('ads', 50000); // Clamped to 10000

    const settings = await StorageAdapter.getSettings();
    // 1 (from NaN fallback) + 1 (from negative clamp) + 1 (from invalid fallback) + 10000 (from clamp) = 10003
    expect(settings.stats.adsBlocked).toBe(10003);
    expect(Number.isNaN(settings.stats.adsBlocked)).toBe(false);
  });
});
