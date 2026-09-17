import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { getSettings, saveSettings, addExcludedSite, removeExcludedSite, addCustomBlockDomain, removeCustomBlockDomain, addCustomCosmeticSelector, removeCustomCosmeticSelector, resetStats, exportConfig, importConfig } from '../../core/storage/index.js';
import type { AppSettings } from '../../core/storage/storageAdapter.js';

export function App() {
  const [activeTab, setActiveTab] = useState<'general' | 'domains' | 'css'>('general');
  const [settings, setSettingsState] = useState<AppSettings | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inputBlockDomain, setInputBlockDomain] = useState('');
  const [inputWhitelistSite, setInputWhitelistSite] = useState('');
  const [inputCss, setInputCss] = useState('');

  useEffect(() => {
    getSettings().then(setSettingsState);
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      const listener = (changes: any, area: string) => {
        if (area === 'local' && changes['vandu_settings_v2']?.newValue) {
          setSettingsState(changes['vandu_settings_v2'].newValue);
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }
  }, []);

  if (!settings) return <div className="loading">Đang tải cấu hình...</div>;

  const handleToggle = async (key: keyof AppSettings) => {
    const nextVal = !Boolean(settings[key]);
    const updated = await saveSettings({ [key]: nextVal });
    setSettingsState(updated);
  };

  const handleAddBlock = async () => {
    if (!inputBlockDomain.trim()) return;
    const up = await addCustomBlockDomain(inputBlockDomain);
    setSettingsState({ ...settings, customBlocklist: up });
    setInputBlockDomain('');
  };

  const handleRemoveBlock = async (d: string) => {
    const up = await removeCustomBlockDomain(d);
    setSettingsState({ ...settings, customBlocklist: up });
  };

  const handleAddWhite = async () => {
    if (!inputWhitelistSite.trim()) return;
    const up = await addExcludedSite(inputWhitelistSite);
    setSettingsState({ ...settings, excludedSites: up });
    setInputWhitelistSite('');
  };

  const handleRemoveWhite = async (s: string) => {
    const up = await removeExcludedSite(s);
    setSettingsState({ ...settings, excludedSites: up });
  };

  const handleAddCss = async () => {
    if (!inputCss.trim()) return;
    const up = await addCustomCosmeticSelector(inputCss);
    setSettingsState({ ...settings, customCosmeticSelectors: up });
    setInputCss('');
  };

  const handleRemoveCss = async (s: string) => {
    const up = await removeCustomCosmeticSelector(s);
    setSettingsState({ ...settings, customCosmeticSelectors: up });
  };

  const showToast = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 2500);
  };

  const handleExport = async () => {
    try {
      const jsonStr = await exportConfig();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vandu-pure-config-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Đã xuất cấu hình JSON');
    } catch {
      showToast('Lỗi khi xuất cấu hình');
    }
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

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-dot"></div>
          <h1>VÂN DU PURE</h1>
          <span className="badge">v1.0.2</span>
        </div>
        <nav className="nav-menu">
          <button className={`nav-item ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>Chung</button>
          <button className={`nav-item ${activeTab === 'domains' ? 'active' : ''}`} onClick={() => setActiveTab('domains')}>Quản lý tên miền</button>
          <button className={`nav-item ${activeTab === 'css' ? 'active' : ''}`} onClick={() => setActiveTab('css')}>Quản lý bộ lọc CSS</button>
        </nav>
      </aside>

      <main className="main-area">
        {actionNotice && <div className="popup-toast">{actionNotice}</div>}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImportFileChange}
        />

        {activeTab === 'general' && (
          <div className="tab-pane">
            <h2 className="tab-title">Tổng quan & Cài đặt chung</h2>
            
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Trackers</h3>
                <div className="stat-val">{settings.stats?.trackersBlocked || 0}</div>
              </div>
              <div className="stat-card">
                <h3>Quảng cáo</h3>
                <div className="stat-val">{settings.stats?.adsBlocked || 0}</div>
              </div>
              <div className="stat-card">
                <h3>Popups</h3>
                <div className="stat-val">{settings.stats?.popupsNeutralized || 0}</div>
              </div>
              <div className="stat-card">
                <h3>YouTube</h3>
                <div className="stat-val">{settings.stats?.youtubeMixBlocked || 0}</div>
              </div>
              <button className="btn-reset" onClick={resetStats}>Đặt lại thống kê</button>
            </div>

            <div className="master-card">
              <div>
                <h4>Bảo vệ toàn diện</h4>
                <p>{settings.masterEnabled ? 'Đang bật bảo vệ toàn diện.' : 'Đã tạm dừng toàn bộ bảo vệ.'}</p>
              </div>
              <div className={`switch-toggle ${settings.masterEnabled ? 'active' : ''}`} onClick={() => handleToggle('masterEnabled')}>
                <div className="switch-knob" />
              </div>
            </div>

            {settings.masterEnabled ? (
              <div className="settings-list">
                <div className="setting-item">
                  <div>
                    <h4>Chặn quảng cáo</h4>
                  </div>
                  <div className={`switch-toggle ${settings.blockAds ? 'active' : ''}`} onClick={() => handleToggle('blockAds')}>
                    <div className="switch-knob" />
                  </div>
                </div>
                <div className="setting-item">
                  <div>
                    <h4>Tua YouTube</h4>
                  </div>
                  <div className={`switch-toggle ${settings.skipYoutubeAds ? 'active' : ''}`} onClick={() => handleToggle('skipYoutubeAds')}>
                    <div className="switch-knob" />
                  </div>
                </div>
                <div className="setting-item">
                  <div>
                    <h4>Chặn YouTube Mix</h4>
                  </div>
                  <div className={`switch-toggle ${settings.stripYoutubeRadio ? 'active' : ''}`} onClick={() => handleToggle('stripYoutubeRadio')}>
                    <div className="switch-knob" />
                  </div>
                </div>
                <div className="setting-item">
                  <div>
                    <h4>Chặn popup</h4>
                  </div>
                  <div className={`switch-toggle ${settings.blockPopups ? 'active' : ''}`} onClick={() => handleToggle('blockPopups')}>
                    <div className="switch-knob" />
                  </div>
                </div>
                <div className="setting-item">
                  <div>
                    <h4>Lọc tracking</h4>
                  </div>
                  <div className={`switch-toggle ${settings.stripTracking ? 'active' : ''}`} onClick={() => handleToggle('stripTracking')}>
                    <div className="switch-knob" />
                  </div>
                </div>
                <div className="setting-item">
                  <div>
                    <h4>Mở khóa sao chép</h4>
                  </div>
                  <div className={`switch-toggle ${settings.unblockDom ? 'active' : ''}`} onClick={() => handleToggle('unblockDom')}>
                    <div className="switch-knob" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="master-off-notice">
                Hệ thống bảo vệ đang tắt. Kích hoạt bảo vệ toàn diện phía trên để tùy chỉnh các tính năng.
              </div>
            )}
            
            <div className="config-actions-row">
              <button className="btn-config-action" onClick={handleExport}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Xuất cấu hình
              </button>
              <button className="btn-config-action" onClick={() => fileInputRef.current?.click()}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Nhập cấu hình
              </button>
            </div>
          </div>
        )}

        {activeTab === 'domains' && (
          <div className="tab-pane">
            <h2 className="tab-title">Quản lý tên miền</h2>
            
            <div className="two-cols">
              <div className="manager-box">
                <h3>Chặn tên miền (Blocklist)</h3>
                <div className="input-group">
                  <input type="text" placeholder="ads.example.com" value={inputBlockDomain} onInput={(e) => setInputBlockDomain((e.target as HTMLInputElement).value)} onKeyDown={(e) => e.key === 'Enter' && handleAddBlock()} />
                  <button onClick={handleAddBlock}>Thêm</button>
                </div>
                <ul className="item-list">
                  {(settings.customBlocklist || []).map(d => (
                    <li key={d}>{d} <button onClick={() => handleRemoveBlock(d)}>Xóa</button></li>
                  ))}
                </ul>
              </div>

              <div className="manager-box">
                <h3>Ngoại lệ (Whitelist)</h3>
                <div className="input-group">
                  <input type="text" placeholder="goodsite.com" value={inputWhitelistSite} onInput={(e) => setInputWhitelistSite((e.target as HTMLInputElement).value)} onKeyDown={(e) => e.key === 'Enter' && handleAddWhite()} />
                  <button onClick={handleAddWhite}>Thêm</button>
                </div>
                <ul className="item-list">
                  {(settings.excludedSites || []).map(s => (
                    <li key={s}>{s} <button onClick={() => handleRemoveWhite(s)}>Xóa</button></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'css' && (
          <div className="tab-pane">
            <h2 className="tab-title">Quản lý bộ lọc CSS (Cosmetic)</h2>
            <div className="manager-box full-width">
              <h3>Các bộ chọn bị ẩn</h3>
              <div className="input-group">
                <input type="text" placeholder=".ad-banner, #sponsor" value={inputCss} onInput={(e) => setInputCss((e.target as HTMLInputElement).value)} onKeyDown={(e) => e.key === 'Enter' && handleAddCss()} />
                <button onClick={handleAddCss}>Thêm</button>
              </div>
              <ul className="item-list">
                {(settings.customCosmeticSelectors || []).map(s => (
                  <li key={s}>{s} <button onClick={() => handleRemoveCss(s)}>Xóa</button></li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
