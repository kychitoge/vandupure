import type { OverrideRule } from '../../core/rules/types.js';

export const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'gbraid',
  'wbraid',
  '_ga',
  '_gl',
  '_gad_source',
  'ttclid',
  'msclkid',
  'twclid',
  'si', // YouTube share tracker
  'ref',
  'ref_src',
  'ref_url',
  'source',
  'igshid',
  'mc_cid',
  'mc_eid',
  'ysclid',
  'yclid',
  'zanpid',
  'sc_clickid',
  'li_fat_id',
  'epik',
  'mkt_tok',
  '_hsenc',
  '_hsmi',
  'icid'
];

export const globalTrackingRule: OverrideRule = {
  id: 'global-tracking-cleaner',
  name: 'Global URL Tracking Cleaner',
  category: 'tracking',
  enabled: true,
  priority: 100,
  lifecycle: 'document_start',
  match: {
    host: '*'
  },
  action: {
    type: 'url.removeQuery',
    params: TRACKING_PARAMS
  }
};
