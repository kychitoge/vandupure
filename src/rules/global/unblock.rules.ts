import type { OverrideRule } from '../../core/rules/types.js';

export const globalUnblockEventsRule: OverrideRule = {
  id: 'global-unblock-events',
  name: 'Global Right-Click & Copy Unblocker',
  category: 'unblock',
  enabled: true,
  priority: 90,
  lifecycle: 'document_start',
  match: {
    host: '*'
  },
  action: {
    type: 'events.unblock',
    eventNames: ['contextmenu', 'copy', 'cut', 'selectstart', 'dragstart']
  }
};

export const globalUnblockCssRule: OverrideRule = {
  id: 'global-unblock-selection-css',
  name: 'Global Force Text Selection Style',
  category: 'unblock',
  enabled: true,
  priority: 90,
  lifecycle: 'document_start',
  match: {
    host: '*'
  },
  action: {
    type: 'css.inject',
    id: 'vandu-unblock-styles',
    css: `
      p, span, h1, h2, h3, h4, h5, h6, article, main, blockquote, li, td, th {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      }
    `
  }
};

export const globalRemoveOverlayRule: OverrideRule = {
  id: 'global-remove-overlay',
  name: 'Global Modal & Overlay Remover',
  category: 'unblock',
  enabled: true,
  priority: 80,
  lifecycle: 'document_end',
  match: {
    host: '*'
  },
  action: {
    type: 'dom.removeOverlay',
    minZIndex: 1000,
    minViewportRatio: 0.8
  }
};

export const globalUnblockRules: OverrideRule[] = [
  globalUnblockEventsRule,
  globalUnblockCssRule,
  globalRemoveOverlayRule
];
