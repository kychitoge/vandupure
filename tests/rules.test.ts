import { describe, it, expect, beforeEach } from 'vitest';
import { RuleRegistry } from '../src/core/rules/registry.js';
import { allDefaultRules, registerDefaultRules } from '../src/rules/index.js';
import { isYouTubeRadioUrl, getCleanYouTubeWatchUrl } from '../src/rules/sites/youtube.rules.js';

describe('Stage 7: Rules Migration', () => {
  let registry: RuleRegistry;

  beforeEach(() => {
    registry = new RuleRegistry();
    registry.register(allDefaultRules);
  });

  it('registers all default rules correctly', () => {
    const all = registry.getAll();
    expect(all.length).toBeGreaterThanOrEqual(4);

    const trackingRule = registry.get('global-tracking-cleaner');
    expect(trackingRule).toBeDefined();
    expect(trackingRule?.category).toBe('tracking');

    const unblockEventsRule = registry.get('global-unblock-events');
    expect(unblockEventsRule).toBeDefined();

    const youtubeMixRule = registry.get('youtube-hide-mix-boxes');
    expect(youtubeMixRule).toBeDefined();

    const hideAdsRule = registry.get('global-hide-ads-cosmetic');
    expect(hideAdsRule).toBeDefined();
    expect(hideAdsRule?.category).toBe('ads');
  });

  it('matches global tracking, ads and unblock rules for any site', () => {
    const matched = registry.getMatchedRules('https://some-news-site.com/article');
    const ids = matched.map((r) => r.id);
    expect(ids).toContain('global-tracking-cleaner');
    expect(ids).toContain('global-unblock-events');
    expect(ids).toContain('global-hide-ads-cosmetic');
    expect(ids).not.toContain('youtube-hide-mix-boxes'); // youtube rule should NOT match
  });

  it('matches YouTube rules exclusively on YouTube', () => {
    const matched = registry.getMatchedRules('https://www.youtube.com/watch?v=123');
    const ids = matched.map((r) => r.id);
    expect(ids).toContain('youtube-hide-mix-boxes');
    expect(ids).toContain('youtube-intercept-mix-clicks');
    expect(ids).toContain('global-tracking-cleaner');
  });

  it('correctly detects YouTube Radio/Mix URLs and cleans them', () => {
    const radioUrl = new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ&start_radio=1');
    expect(isYouTubeRadioUrl(radioUrl)).toBe(true);

    const cleanUrl = getCleanYouTubeWatchUrl(radioUrl);
    expect(cleanUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

    const standardUrl = new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(isYouTubeRadioUrl(standardUrl)).toBe(false);
  });

  it('preserves userPlaybackRate when skipping YouTube ads', async () => {
    const { skipYouTubeVideoAds } = await import('../src/rules/sites/youtube.rules.js');

    const mainVideo: any = {
      playbackRate: 1.75,
      muted: false,
      paused: false,
      play: async () => {},
      classList: { contains: () => false },
      tagName: 'VIDEO'
    };
    mainVideo.className = 'html5-main-video';

    const adVideo: any = {
      readyState: 4,
      playbackRate: 1,
      muted: false,
      duration: 15,
      currentTime: 0,
      tagName: 'VIDEO'
    };

    const player: any = {
      classList: {
        contains: (cls: string) => cls === 'ad-showing'
      },
      querySelector: (sel: string) => (sel.includes('main-video') ? mainVideo : null),
      querySelectorAll: (sel: string) => (sel === 'video' ? [adVideo] : [])
    };

    const fakeDoc: any = {
      body: {},
      querySelector: (sel: string) => {
        if (sel.includes('movie_player')) return player;
        return null;
      },
      querySelectorAll: () => []
    };

    (globalThis as any).document = fakeDoc;

    try {
      // 1. In ad mode: skipper sets ad to 16x and records userPlaybackRate = 1.75
      const skipped = skipYouTubeVideoAds();
      expect(skipped).toBe(true);
      expect(adVideo.playbackRate).toBe(16);
      expect(adVideo.muted).toBe(true);
      expect(adVideo.currentTime).toBe(15);

      // 2. Ad finishes: player no longer has ad-showing
      player.classList.contains = () => false;
      mainVideo.playbackRate = 16; // was left at 16x by ad
      const postAd = skipYouTubeVideoAds();
      expect(postAd).toBe(false);
      // userPlaybackRate must be restored to 1.75x, NOT reset to 1.0!
      expect(mainVideo.playbackRate).toBe(1.75);
    } finally {
      delete (globalThis as any).document;
    }
  });
});
