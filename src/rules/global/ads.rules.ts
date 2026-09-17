import type { OverrideRule } from '../../core/rules/types.js';

export const globalHideAdsRule: OverrideRule = {
  id: 'global-hide-ads-cosmetic',
  name: 'Global Cosmetic Ad Containers Hide',
  category: 'ads',
  enabled: true,
  priority: 85,
  lifecycle: 'document_start',
  match: {
    host: '*'
  },
  action: {
    type: 'css.inject',
    id: 'vandu-global-hide-ads',
    css: `
      ins.adsbygoogle,
      [id^="google_ads_iframe"],
      [id^="div-gpt-ad"],
      [id*="-ad-slot"],
      [class*="-ad-slot"],
      .ad-container,
      .adsbox,
      .ad-banner,
      .ad-placement,
      .ad_wrapper,
      div[data-ad-unit],
      div[data-ad-client],
      iframe[src*="doubleclick.net"],
      iframe[src*="googlesyndication.com"],
      iframe[src*="adservice.google"],
      iframe[src*="popads.net"],
      iframe[src*="taboola.com"],
      iframe[src*="outbrain.com"],
      /* Floating in-page popups & sticky banners (anime/streaming sites) */
      div[id*="popup-banner"],
      div[class*="popup-banner"],
      div[id*="float-banner"],
      div[class*="float-banner"],
      div[id*="sticky-banner"],
      div[class*="sticky-banner"],
      div[id*="bottom-banner"],
      div[class*="bottom-banner"],
      div[id*="banner-float"],
      div[class*="banner-float"],
      div[class*="floating-ad"],
      div[id*="floating-ad"],
      div[class*="ads-floating"],
      div[id*="ads-floating"],
      div[class*="banner-ads"],
      div[id*="banner-ads"],
      div[class*="ads-bottom"],
      div[id*="ads-bottom"],
      div[class*="ads-center"],
      div[id*="ads-center"],
      div[class*="ads-middle"],
      div[id*="ads-middle"],
      div[class*="qc-container"],
      div[id*="qc-container"],
      div[class*="qc-float"],
      div[id*="qc-float"],
      /* Common betting and casino floating banners */
      div:has(> a[href*="uk88"]),
      div:has(> a[href*="go88"]),
      div:has(> a[href*="yo88"]),
      div:has(> a[href*="sin88"]),
      div:has(> a[href*="debet"]),
      div:has(> a[href*="kubet"]),
      div:has(> a[href*="bk8"]),
      div:has(> a[href*="f8bet"]),
      div:has(> a[href*="shbet"]),
      div:has(> a[href*="789club"]),
      div:has(> a[href*="sunwin"]),
      div:has(> a[href*="188bet"]),
      div:has(> a[href*="w88"]),
      div:has(> a[href*="fb88"]),
      div[style*="fixed"]:has(a[href*="bet"]):has(.close),
      div[style*="fixed"]:has(a[href*="bet"]):has(button),
      div[style*="fixed"]:has(a[href*="bet"]):has([class*="close"]),
      div[style*="fixed"]:has(a[href*="game"]):has(.close),
      div[style*="fixed"]:has(a[href*="casino"]):has(.close) {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        min-height: 0 !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `
  }
};

export const globalAdsRules: OverrideRule[] = [
  globalHideAdsRule
];
