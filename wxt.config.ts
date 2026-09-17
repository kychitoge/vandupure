import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';

export default defineConfig({
  srcDir: 'src',
  vite: () => ({
    plugins: [preact() as any]
  }),
  manifest: {
    name: 'Vân Du Pure',
    description: 'Trình làm sạch web tinh gọn: Chặn quảng cáo, tua video YouTube,\ntriệt tiêu popup quấy rối và lọc bỏ liên kết theo dõi.',
    version: '1.0.2',
    icons: {
      16: '/icon-16.png',
      32: '/icon-32.png',
      48: '/icon-48.png',
      64: '/icon-64.png',
      128: '/icon-128.png'
    },
    permissions: [
      'storage',
      'activeTab',
      'tabs',
      'contextMenus',
      'declarativeNetRequest',
      'declarativeNetRequestWithHostAccess'
    ],
    host_permissions: [
      '<all_urls>'
    ],
    action: {
      default_title: 'Vân Du Pure',
      default_icon: {
        16: '/icon-16.png',
        32: '/icon-32.png',
        48: '/icon-48.png',
        64: '/icon-64.png'
      }
    },
    commands: {
      'toggle-element-picker': {
        suggested_key: {
          default: 'Alt+Shift+X',
          mac: 'Alt+Shift+X'
        },
        description: 'Bật / Tắt thước ngắm phần tử rác'
      },
      'toggle-shield-master': {
        suggested_key: {
          default: 'Alt+Shift+S',
          mac: 'Alt+Shift+S'
        },
        description: 'Bật / Tắt bảo vệ trên trang'
      }
    },
    declarative_net_request: {
      rule_resources: [
        {
          id: 'ruleset_easylist',
          enabled: true,
          path: '/rulesets/easylist.json'
        },
        {
          id: 'ruleset_china',
          enabled: true,
          path: '/rulesets/chn-0.json'
        },
        {
          id: 'ruleset_vietnam',
          enabled: true,
          path: '/rulesets/vie-1.json'
        },
        {
          id: 'ruleset_peter_lowe',
          enabled: true,
          path: '/rulesets/pgl.json'
        },
        {
          id: 'ruleset_badware',
          enabled: true,
          path: '/rulesets/ublock-badware.json'
        }
      ]
    }
  }
});
