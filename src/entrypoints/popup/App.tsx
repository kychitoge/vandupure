import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import {
  getSettings,
  saveSettings,
  isSiteExcluded,
  toggleCurrentSite,
  addExcludedSite,
  removeExcludedSite,
  addCustomBlockDomain,
  removeCustomBlockDomain,
  addCustomCosmeticSelector,
  removeCustomCosmeticSelector,
  resetStats,
  exportConfig,
  importConfig
} from '../../core/storage/index.js';
import type { AppSettings } from '../../core/storage/storageAdapter.js';

export function App() {
  const [activeTab, setActiveTab] = useState<'shield' | 'rules'>('shield');
  const [settings, setSettingsState] = useState<AppSettings | null>(null);
  const [currentDomain, setCurrentDomain] = useState('');
  const [isExcludedOnSite, setIsExcludedOnSite] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Form inputs for Rules Manager
  const [inputBlockDomain, setInputBlockDomain] = useState('');
  const [inputCosmeticSelector, setInputCosmeticSelector] = useState('');
  const [inputWhitelistSite, setInputWhitelistSite] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 2500);
  };

  useEffect(() => {
    async function init() {
      const curSettings = await getSettings();
      setSettingsState(curSettings);

      // Query active tab domain
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
          if (tab?.url) {
            try {
              const url = new URL(tab.url);
              const host = url.hostname.replace(/^www\./, '');
              setCurrentDomain(host);
              const excluded = await isSiteExcluded(host);
              setIsExcludedOnSite(excluded);
            } catch {
              setCurrentDomain('');
            }
          }
        });
      } else {
        setCurrentDomain('youtube.com');
      }
    }

    init();

    // Listen to storage / stats updates in real-time
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
        if (areaName === 'local' && changes['vandu_settings_v2']?.newValue) {
          setSettingsState(changes['vandu_settings_v2'].newValue);
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }
  }, []);

  if (!settings) {
    return <div className="loading-state">Đang tải...</div>;
  }

  // Master Switch Action
  const handleToggleMaster = async () => {
    if (isExcludedOnSite) {
      await toggleCurrentSite(currentDomain);
      setIsExcludedOnSite(false);
      const updated = await getSettings();
      setSettingsState(updated);
    } else {
      const next = !settings.masterEnabled;
      const updated = await saveSettings({ masterEnabled: next });
      setSettingsState(updated);
    }
  };

  // Toggle exclusion on current active tab
  const handleToggleSite = async () => {
    if (!currentDomain) return;
    const nowExcluded = await toggleCurrentSite(currentDomain);
    setIsExcludedOnSite(nowExcluded);
    const updated = await getSettings();
    setSettingsState(updated);
  };

  // Toggle individual feature
  const handleToggleFeature = async (key: keyof AppSettings) => {
    if (isExcludedOnSite) return;
    const nextVal = !Boolean(settings[key]);
    const updated = await saveSettings({ [key]: nextVal });
    setSettingsState(updated);
  };

  // Rules Manager Actions
  const handleAddBlockDomain = async () => {
    if (!inputBlockDomain.trim()) return;
    const updated = await addCustomBlockDomain(inputBlockDomain);
    setSettingsState({ ...settings, customBlocklist: updated });
    setInputBlockDomain('');
  };

  const handleRemoveBlockDomain = async (domain: string) => {
    const updated = await removeCustomBlockDomain(domain);
    setSettingsState({ ...settings, customBlocklist: updated });
  };

  const handleAddCosmeticSelector = async () => {
    if (!inputCosmeticSelector.trim()) return;
    const updated = await addCustomCosmeticSelector(inputCosmeticSelector);
    setSettingsState({ ...settings, customCosmeticSelectors: updated });
    setInputCosmeticSelector('');
  };

  const handleRemoveCosmeticSelector = async (sel: string) => {
    const updated = await removeCustomCosmeticSelector(sel);
    setSettingsState({ ...settings, customCosmeticSelectors: updated });
  };

  const handleAddWhitelistSite = async () => {
    if (!inputWhitelistSite.trim()) return;
    const updated = await addExcludedSite(inputWhitelistSite);
    setSettingsState({ ...settings, excludedSites: updated });
    if (inputWhitelistSite.trim().toLowerCase() === currentDomain.toLowerCase()) {
      setIsExcludedOnSite(true);
    }
    setInputWhitelistSite('');
  };

  const handleRemoveWhitelistSite = async (site: string) => {
    const updated = await removeExcludedSite(site);
    setSettingsState({ ...settings, excludedSites: updated });
    if (site.toLowerCase() === currentDomain.toLowerCase()) {
      setIsExcludedOnSite(false);
    }
  };

  const handleStartElementPicker = async () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'START_ELEMENT_PICKER' }).catch(() => {});
          window.close();
        }
      } catch {}
    }
  };

  const handleResetStats = async () => {
    const updated = await resetStats();
    setSettingsState((prev) => (prev ? { ...prev, stats: updated } : null));
    showToast('Đã đặt lại thống kê');
  };

  // Export / Import Config Handlers
  const handleExportConfig = async () => {
    try {
      const jsonStr = await exportConfig();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vandu-pure-config-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Đã xuất cấu hình');
    } catch {
      showToast('Lỗi khi xuất');
    }
  };

  const handleImportButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFileChange = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const content = String(reader.result || '');
        const res = await importConfig(content, 'merge');
        if (res.success) {
          const updated = await getSettings();
          setSettingsState(updated);
          showToast(res.message);
        } else {
          showToast(res.message);
        }
      } catch {
        showToast('Tệp không hợp lệ');
      }
    };
    reader.readAsText(file);
    target.value = '';
  };

  const isProtectionActive = settings.masterEnabled && !isExcludedOnSite;

  return (
    <div className="app-viewport">
      {/* 1. Header (Shared) */}
      <header className="app-header">
        <div className="brand-title">
          <span className="brand-dot" />
          <span className="brand-text">VÂN DU PURE</span>
          <span className="brand-badge">v1.0.2</span>
        </div>

        <div className="header-actions">
          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-btn ${activeTab === 'shield' ? 'active' : ''}`}
              onClick={() => setActiveTab('shield')}
              title="Lá chắn"
            >
              <svg
                className="segmented-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill={activeTab === 'shield' ? '#4fa89f' : 'none'}
                stroke={activeTab === 'shield' ? '#4fa89f' : '#94a3b8'}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </button>

            <button
              type="button"
              className={`segmented-btn ${activeTab === 'rules' ? 'active' : ''}`}
              onClick={() => setActiveTab('rules')}
              title="Quy tắc"
            >
              <svg
                className="segmented-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={activeTab === 'rules' ? '#4fa89f' : '#94a3b8'}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>

            {/* Nút 3: Thước ngắm (Crosshair Picker) */}
            <button
              type="button"
              className="segmented-btn"
              onClick={handleStartElementPicker}
              title="Thước ngắm phần tử"
            >
              <svg
                className="segmented-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#4fa89f"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="22" y1="12" x2="18" y2="12" />
                <line x1="6" y1="12" x2="2" y2="12" />
                <line x1="12" y1="6" x2="12" y2="2" />
                <line x1="12" y1="22" x2="12" y2="18" />
              </svg>
            </button>

            {/* Nút 4: Mở Dashboard toàn màn hình */}
            <button
              type="button"
              className="segmented-btn"
              onClick={() => {
                if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
                  chrome.runtime.openOptionsPage();
                }
              }}
              title="Mở Bảng điều khiển (Tab mới)"
            >
              <svg
                className="segmented-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#64748b"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Action Toast Alert */}
      {actionNotice && (
        <div className="popup-toast">{actionNotice}</div>
      )}

      {/* Hidden file input for config import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImportFileChange}
      />

      {/* VIEW 1: SHIELD TAB */}
      {activeTab === 'shield' && (
        <div className="main-content shield-view">
          {/* Master Card */}
          <div className="card master-card">
            <div
              className={`big-toggle ${isProtectionActive ? 'active' : ''}`}
              onClick={handleToggleMaster}
              title={isProtectionActive ? 'Tắt bảo vệ' : 'Bật bảo vệ'}
            >
              <div className="big-toggle-knob" />
            </div>

            <div className={`master-status-title ${isProtectionActive ? 'active' : 'paused'}`}>
              {isProtectionActive ? 'ĐANG BẬT' : 'ĐÃ TẮT'}
            </div>

            <div className="master-status-sub">
              {isProtectionActive ? 'Bảo vệ đang hoạt động' : 'Tạm dừng bảo vệ'}
            </div>
          </div>

          {/* Warning Banner khi trang bị miễn trừ */}
          {isExcludedOnSite && (
            <div className="warning-card">
              <span className="warning-text-bold">Đã tạm dừng trên trang này</span>
            </div>
          )}

          {/* Site Toggle Row */}
          {currentDomain && (
            <div className="card site-card">
              <div className="site-info-box">
                <span className="site-action-label">Ngoại lệ trang</span>
                <span className="site-domain-name">{currentDomain}</span>
              </div>

              <div
                className={`switch-toggle ${isExcludedOnSite ? 'active' : ''}`}
                onClick={handleToggleSite}
                title={isExcludedOnSite ? 'Bật bảo vệ lại' : 'Tắt trên trang này'}
              >
                <div className="switch-knob" />
              </div>
            </div>
          )}

          {/* Feature Toggles Card (Clean, tight padding, no nested sub-boxes) */}
          <div className={`card feature-toggles-card ${!isProtectionActive ? 'paused-mode master-off-mode' : ''}`}>
            <div className="feature-row">
              <span className="feature-title">Chặn quảng cáo</span>
              <div
                className={`switch-toggle ${settings.blockAds && isProtectionActive ? 'active' : ''}`}
                onClick={() => handleToggleFeature('blockAds')}
              >
                <div className="switch-knob" />
              </div>
            </div>

            <div className="feature-row">
              <span className="feature-title">Tua YouTube</span>
              <div
                className={`switch-toggle ${settings.skipYoutubeAds && isProtectionActive ? 'active' : ''}`}
                onClick={() => handleToggleFeature('skipYoutubeAds')}
              >
                <div className="switch-knob" />
              </div>
            </div>

            <div className="feature-row">
              <span className="feature-title">Chặn YouTube Mix</span>
              <div
                className={`switch-toggle ${settings.stripYoutubeRadio && isProtectionActive ? 'active' : ''}`}
                onClick={() => handleToggleFeature('stripYoutubeRadio')}
              >
                <div className="switch-knob" />
              </div>
            </div>

            <div className="feature-row">
              <span className="feature-title">Chặn popup</span>
              <div
                className={`switch-toggle ${settings.blockPopups && isProtectionActive ? 'active' : ''}`}
                onClick={() => handleToggleFeature('blockPopups')}
              >
                <div className="switch-knob" />
              </div>
            </div>

            <div className="feature-row">
              <span className="feature-title">Lọc tracking</span>
              <div
                className={`switch-toggle ${settings.stripTracking && isProtectionActive ? 'active' : ''}`}
                onClick={() => handleToggleFeature('stripTracking')}
              >
                <div className="switch-knob" />
              </div>
            </div>

            <div className="feature-row">
              <span className="feature-title">Mở khóa sao chép</span>
              <div
                className={`switch-toggle ${settings.unblockDom && isProtectionActive ? 'active' : ''}`}
                onClick={() => handleToggleFeature('unblockDom')}
              >
                <div className="switch-knob" />
              </div>
            </div>

            <div className="feature-row">
              <span className="feature-title">Thông báo toast</span>
              <div
                className={`switch-toggle ${settings.showToastNotification && isProtectionActive ? 'active' : ''}`}
                onClick={() => handleToggleFeature('showToastNotification')}
              >
                <div className="switch-knob" />
              </div>
            </div>
          </div>

          {/* Stats Card */}
          <div className="card stats-card">
            <div className="stats-header-bar">
              <span className="stats-header-title">THỐNG KÊ</span>
              <button
                type="button"
                onClick={handleResetStats}
                className="btn-stats-reset"
              >
                Đặt lại
              </button>
            </div>
            <div className="stats-columns-grid">
              <div className="stat-col">
                <div className="stat-val">{settings.stats?.trackersBlocked || 0}</div>
                <div className="stat-name">Trackers</div>
              </div>
              <div className="stat-col">
                <div className="stat-val">{settings.stats?.adsBlocked || 0}</div>
                <div className="stat-name">Ads</div>
              </div>
              <div className="stat-col">
                <div className="stat-val">{settings.stats?.popupsNeutralized || 0}</div>
                <div className="stat-name">Popups</div>
              </div>
              <div className="stat-col">
                <div className="stat-val">{settings.stats?.youtubeMixBlocked || 0}</div>
                <div className="stat-name">YouTube</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: RULES & CONFIG TAB */}
      {activeTab === 'rules' && (
        <div className="main-content rules-view">
          {/* Top Quick Actions Bar (Export, Import, Shortcuts) */}
          <div className="card config-actions-card">
            <div className="config-actions-row">
              <button
                type="button"
                className="btn-config-action btn-config-icon"
                onClick={handleExportConfig}
                title="Xuất cấu hình JSON"
                aria-label="Xuất cấu hình"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Xuất</span>
              </button>
              <button
                type="button"
                className="btn-config-action btn-config-icon"
                onClick={handleImportButtonClick}
                title="Nhập cấu hình JSON"
                aria-label="Nhập cấu hình"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Nhập</span>
              </button>
            </div>
            <div className="shortcuts-hint">
              Phím tắt: <strong>Alt+Shift+X</strong> (Thước ngắm) • <strong>Alt+Shift+S</strong> (Lá chắn)
            </div>
          </div>

          {/* Block 1: CHẶN DOMAIN */}
          <div className="card rule-block-card">
            <div className="rule-card-title">CHẶN TÊN MIỀN</div>
            <div className="rule-input-group">
              <input
                type="text"
                className="rule-input-field"
                placeholder="example.com"
                value={inputBlockDomain}
                onInput={(e) => setInputBlockDomain((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddBlockDomain()}
              />
              <button type="button" className="btn-add-rule" onClick={handleAddBlockDomain}>
                Thêm
              </button>
            </div>

            <div className="rule-items-container">
              {!settings.customBlocklist || settings.customBlocklist.length === 0 ? (
                <div className="empty-rule-hint">Trống</div>
              ) : (
                settings.customBlocklist.map((dom) => (
                  <div key={dom} className="rule-list-entry">
                    <span className="rule-entry-text">{dom}</span>
                    <span
                      className="rule-remove-icon"
                      onClick={() => handleRemoveBlockDomain(dom)}
                      title="Xóa"
                    >
                      ×
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Block 2: BỘ LỌC CSS */}
          <div className="card rule-block-card">
            <div className="rule-card-title">BỘ LỌC CSS</div>
            <div className="rule-input-group">
              <input
                type="text"
                className="rule-input-field"
                placeholder=".banner, #ad"
                value={inputCosmeticSelector}
                onInput={(e) => setInputCosmeticSelector((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCosmeticSelector()}
              />
              <button type="button" className="btn-add-rule" onClick={handleAddCosmeticSelector}>
                Thêm
              </button>
            </div>

            <div className="rule-items-container">
              {!settings.customCosmeticSelectors || settings.customCosmeticSelectors.length === 0 ? (
                <div className="empty-rule-hint">Trống</div>
              ) : (
                settings.customCosmeticSelectors.map((sel) => (
                  <div key={sel} className="rule-list-entry">
                    <span className="rule-entry-text">{sel}</span>
                    <span
                      className="rule-remove-icon"
                      onClick={() => handleRemoveCosmeticSelector(sel)}
                      title="Xóa"
                    >
                      ×
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Block 3: NGOẠI LỆ */}
          <div className="card rule-block-card">
            <div className="rule-card-title">TRANG NGOẠI LỆ</div>
            <div className="rule-input-group">
              <input
                type="text"
                className="rule-input-field"
                placeholder="example.com"
                value={inputWhitelistSite}
                onInput={(e) => setInputWhitelistSite((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddWhitelistSite()}
              />
              <button type="button" className="btn-add-rule" onClick={handleAddWhitelistSite}>
                Thêm
              </button>
            </div>

            <div className="rule-items-container">
              {!settings.excludedSites || settings.excludedSites.length === 0 ? (
                <div className="empty-rule-hint">Trống</div>
              ) : (
                settings.excludedSites.map((site) => (
                  <div key={site} className="rule-list-entry">
                    <span className="rule-entry-text">{site}</span>
                    <span
                      className="rule-remove-icon"
                      onClick={() => handleRemoveWhitelistSite(site)}
                      title="Xóa"
                    >
                      ×
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
