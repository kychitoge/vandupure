import type { OverrideRule } from '../../core/rules/types.js';

export function isYouTubeRadioUrl(url: URL): boolean {
  if (!url.pathname.includes('/watch')) return false;
  const listParam = url.searchParams.get('list');
  const startRadio = url.searchParams.has('start_radio');
  return (Boolean(listParam) && (listParam!.startsWith('RD') || listParam!.startsWith('UL'))) || startRadio;
}

export function getCleanYouTubeWatchUrl(url: URL): string {
  const videoId = url.searchParams.get('v');
  if (videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }
  return url.href;
}

export const youtubeHideMixBoxesRule: OverrideRule = {
  id: 'youtube-hide-mix-boxes',
  name: 'YouTube Hide Radio Mix Renderers',
  category: 'youtube',
  enabled: true,
  priority: 95,
  lifecycle: 'document_start',
  match: {
    host: ['youtube.com', 'm.youtube.com']
  },
  action: {
    type: 'css.inject',
    id: 'vandu-yt-hide-mix',
    css: `
      ytd-compact-radio-renderer,
      ytd-radio-renderer {
        display: none !important;
      }
    `
  }
};

export const youtubeHideAdsRule: OverrideRule = {
  id: 'youtube-hide-ads',
  name: 'YouTube Hide Banner & Feed Ads',
  category: 'youtube',
  enabled: true,
  priority: 96,
  lifecycle: 'document_start',
  match: {
    host: ['youtube.com', 'm.youtube.com']
  },
  action: {
    type: 'css.inject',
    id: 'vandu-yt-hide-ads',
    css: `
      ytd-companion-slot-renderer,
      ytd-action-companion-ad-renderer,
      ytd-promoted-sparkles-web-renderer,
      ytd-promoted-sparkles-text-search-renderer,
      ytd-ad-slot-renderer,
      ytd-in-feed-ad-layout-renderer,
      ytd-banner-promo-renderer,
      ytd-statement-banner-renderer,
      ytd-player-legacy-desktop-watch-ads-renderer,
      #masthead-ad,
      ytd-rich-item-renderer:has(ytd-ad-slot-renderer),
      ytd-rich-item-renderer:has([id*="ad-slot"]),
      ytd-rich-item-renderer:has(.ytd-ad-slot-renderer),
      ytd-item-section-renderer:has(> #contents > ytd-ad-slot-renderer),
      ytd-item-section-renderer:has(> #contents > ytd-promoted-sparkles-web-renderer),
      #secondary ytd-companion-slot-renderer,
      #secondary ytd-ad-slot-renderer,
      #secondary [id*="ad-slot"],
      #secondary #companion,
      ytd-watch-next-secondary-results-renderer ytd-ad-slot-renderer,
      ytd-watch-next-secondary-results-renderer ytd-companion-slot-renderer,
      ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"],
      ytd-ads-engagement-panel-renderer,
      #panels:has(ytd-ads-engagement-panel-renderer),
      .ytd-merch-shelf-renderer,
      ytd-promoted-video-renderer,
      ytd-display-ad-renderer,
      #player-ads,
      .ytp-ad-overlay-container,
      .ytp-ad-message-container,
      .ytp-ad-action-interstitial,
      .ytp-ad-image-overlay,
      ytd-enforcement-message-view-model,
      tp-yt-paper-dialog:has(ytd-enforcement-message-view-model),
      tp-yt-iron-overlay-backdrop:has(+ tp-yt-paper-dialog ytd-enforcement-message-view-model) {
        display: none !important;
      }

      /* Zero-frame visual blackout: Hide video ONLY when player is actively displaying an ad */
      .html5-video-player.ad-showing video,
      .html5-video-player.ad-interrupting video,
      #movie_player.ad-showing video,
      #movie_player.ad-interrupting video {
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `
  }
};

export const youtubeInterceptMixClicksRule: OverrideRule = {
  id: 'youtube-intercept-mix-clicks',
  name: 'YouTube Intercept Mix Playlist Clicks',
  category: 'youtube',
  enabled: true,
  priority: 100,
  lifecycle: 'document_start',
  match: {
    host: ['youtube.com', 'm.youtube.com']
  },
  action: {
    type: 'navigation.interceptClick',
    containerSelector:
      'yt-lockup-view-model, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, ytd-rich-item-renderer, ytm-video-with-context-renderer, ytd-compact-radio-renderer',
    anchorSelector: 'a[href*="/watch"]',
    shouldIntercept: isYouTubeRadioUrl,
    getCleanUrl: getCleanYouTubeWatchUrl
  }
};

import {
  triggerMediaEnded,
  clickFirstMatching
} from '../../modules/media/mediaController.js';

let wasMutedByAdSkipper = false;
let userPlaybackRate = 1;

/**
 * Automatically skips in-stream YouTube ads using FadBlock rapid-forward strategy (< 50ms).
 * - Detects ad state instantaneously
 * - Mutes audio to avoid harsh noise
 * - Accelerates playback to 16x and jumps to duration end
 * - Triggers skip button clicks
 * - Dismisses anti-adblock enforcement modal if present
 * - Gracefully restores original playback rate (user defined) and audio
 */
export function skipYouTubeVideoAds(): boolean {
  if (typeof document === 'undefined') return false;

  const skipSelectors = [
    '.ytp-ad-skip-button-modern',
    'button.ytp-ad-skip-button-modern',
    '.ytp-skip-ad-button',
    'button.ytp-skip-ad-button',
    '.ytp-ad-skip-button',
    'button.ytp-ad-skip-button',
    '.ytp-ad-skip-button-slot button',
    '.ytp-ad-skip-button-container button',
    'button[id^="skip-button"]',
    '.videoAdUiSkipButton',
    'button[aria-label*="Skip" i]',
    'button[aria-label*="Bỏ qua" i]'
  ];

  // 1. Critical: ALWAYS click any visible skip button immediately if present in DOM
  const earlyClicked = clickFirstMatching(skipSelectors, document.body);

  const player = document.querySelector('#movie_player, .html5-video-player') as HTMLElement | null;
  if (!player) return earlyClicked;

  // 2. Strict check: Is player actively in ad mode?
  const isAdShowing =
    player.classList.contains('ad-showing') ||
    player.classList.contains('ad-interrupting');

  const isAd = earlyClicked || isAdShowing;

  if (!isAd) {
    // Check anti-adblock dialog only if not playing normal video or video is blocked
    const enforcementDialog = document.querySelector(
      'ytd-enforcement-message-view-model, tp-yt-paper-dialog:has(ytd-enforcement-message-view-model)'
    );
    if (enforcementDialog) {
      (enforcementDialog as HTMLElement).style.display = 'none';
      const backdrop = document.querySelector('tp-yt-iron-overlay-backdrop');
      if (backdrop) (backdrop as HTMLElement).style.display = 'none';
      const mainVideo = player.querySelector('video.html5-main-video') as HTMLVideoElement | null;
      if (mainVideo && mainVideo.paused) {
        mainVideo.play().catch(() => {});
      }
      return true;
    }

    // Ad finished: restore main video playback rate and unmute if muted by ad skipper
    const mainVideo = player.querySelector('video.html5-main-video') as HTMLVideoElement | null;
    if (mainVideo) {
      if (mainVideo.playbackRate > 2) {
        mainVideo.playbackRate = userPlaybackRate || 1;
      }
      if (wasMutedByAdSkipper && mainVideo.muted) {
        mainVideo.muted = false;
        wasMutedByAdSkipper = false;
      }
    }
    return false;
  }

  // 3. Under active ad-showing mode ONLY: Mute and advance ad video
  if (isAdShowing) {
    const mainVideo = player.querySelector('video.html5-main-video') as HTMLVideoElement | null;
    if (mainVideo && mainVideo.playbackRate <= 2 && mainVideo.playbackRate > 0) {
      userPlaybackRate = mainVideo.playbackRate;
    }
    const adVideos = player.querySelectorAll('video');
    adVideos.forEach(adVideo => {
      if (adVideo.readyState > 0) {
        if (!adVideo.muted) {
          adVideo.muted = true;
          wasMutedByAdSkipper = true;
        }
        adVideo.playbackRate = 16;
        if (Number.isFinite(adVideo.duration) && adVideo.duration > 0 && adVideo.currentTime < adVideo.duration) {
          adVideo.currentTime = adVideo.duration;
        }
      }
    });
  }

  // 4. Click skip button again after timeline jump
  clickFirstMatching(skipSelectors, document.body);
  return true;
}

export const youtubeRules: OverrideRule[] = [
  youtubeHideMixBoxesRule,
  youtubeHideAdsRule,
  youtubeInterceptMixClicksRule
];
