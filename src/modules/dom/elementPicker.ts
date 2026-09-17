/**
 * DOM Browser Primitive: Interactive Element Picker (Multi-Select, Auto-Adjacent, Flat Design)
 * Allows users to visually select one or multiple elements on any page to hide permanently.
 */

import { StorageAdapter } from '../../core/storage/index.js';
import { injectCss } from '../css/cssInjector.js';
import { showShieldToast } from '../../core/runtime/notification.js';
import { notifyItemBlocked } from '../../core/rules/engine.js';

/**
 * Checks if a container is a floating wrapper (popup box, sticky banner)
 */
export function findFloatingContainer(el: HTMLElement): HTMLElement {
  if (typeof document === 'undefined' || typeof window === 'undefined') return el;
  let curr: HTMLElement | null = el;
  let highestFloating: HTMLElement = el;

  while (curr && curr !== document.body && curr !== document.documentElement) {
    const style = window.getComputedStyle(curr);
    const isFixedOrAbsolute = style.position === 'fixed' || style.position === 'absolute';
    const hasCloseBtn = Boolean(curr.querySelector('.close, [class*="close"], button, img[src*="close"], a[href*="javascript"]'));
    const isSmallOrFloating = curr.offsetWidth < window.innerWidth * 0.95 || curr.offsetHeight < window.innerHeight * 0.95;

    if (isFixedOrAbsolute && isSmallOrFloating && (hasCloseBtn || curr.parentElement === document.body)) {
      highestFloating = curr;
    }
    curr = curr.parentElement;
  }

  return highestFloating;
}

export function computeElementSelector(el: HTMLElement): string {
  if (typeof document === 'undefined') {
    return el.id ? `#${el.id}` : el.tagName?.toLowerCase() || 'div';
  }

  if (el.id && !/^\d/.test(el.id)) {
    const selector = `#${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(el.id) : el.id}`;
    try {
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    } catch {}
  }

  const tag = (el.tagName || 'div').toLowerCase();
  const classList = el.classList ? Array.from(el.classList) : [];
  const validClasses = classList.filter(
    (cls) =>
      !cls.startsWith('vandu-') &&
      !['active', 'open', 'show', 'selected', 'hover'].includes(cls)
  );

  if (validClasses.length > 0) {
    const escapedClasses = validClasses.map((c) =>
      typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(c) : c
    );
    const classSelector = `${tag}.${escapedClasses.join('.')}`;
    try {
      if (document.querySelectorAll(classSelector).length <= 5) {
        return classSelector;
      }
    } catch {}
  }

  // Path-based selector fallback
  const parent = el.parentElement;
  if (parent && parent !== document.body) {
    const parentSel = computeElementSelector(parent);
    const siblings = Array.from(parent.children);
    const idx = siblings.indexOf(el) + 1;
    return `${parentSel} > ${tag}:nth-child(${idx})`;
  }

  return tag;
}

export function startElementPicker(initialTarget?: HTMLElement): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('vandu-element-picker-root')) return;

  const selectedElements = new Set<HTMLElement>();
  let currentHoverTarget: HTMLElement | null = null;

  const root = document.createElement('div');
  root.id = 'vandu-element-picker-root';
  root.innerHTML = `
    <div class="vandu-picker-toolbar">
      <span class="vandu-picker-icon" title="Chế độ chọn phần tử">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4fa89f" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="7"></circle>
          <line x1="12" y1="1" x2="12" y2="4"></line>
          <line x1="12" y1="20" x2="12" y2="23"></line>
          <line x1="1" y1="12" x2="4" y2="12"></line>
          <line x1="20" y1="12" x2="23" y2="12"></line>
        </svg>
      </span>
      <span class="vandu-picker-count" id="vandu-selected-count">0</span>
      <div class="vandu-picker-separator"></div>
      <button type="button" class="vandu-picker-btn" id="vandu-btn-expand" title="Mở rộng vùng chọn lên thẻ cha">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"></polyline>
          <polyline points="9 21 3 21 3 15"></polyline>
          <line x1="21" y1="3" x2="14" y2="10"></line>
          <line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
      </button>
      <button type="button" class="vandu-picker-btn" id="vandu-btn-clear" title="Bỏ chọn tất cả" style="display: none;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
          <polyline points="3 3 3 8 8 8"></polyline>
        </svg>
      </button>
      <button type="button" class="vandu-picker-btn vandu-btn-primary" id="vandu-btn-confirm" title="Ẩn phần tử đã chọn" style="display: none;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      </button>
      <div class="vandu-picker-separator"></div>
      <button type="button" class="vandu-picker-btn" id="vandu-btn-exit" title="Thoát (ESC)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <div class="vandu-picker-tag" style="display: none;"></div>
  `;

  const style = document.createElement('style');
  style.id = 'vandu-element-picker-styles';
  style.textContent = `
    #vandu-element-picker-root {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 0;
      z-index: 2147483647;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .vandu-picker-toolbar {
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: #ffffff;
      color: #1e293b;
      min-height: 38px;
      height: 40px;
      padding: 6px 14px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      pointer-events: auto;
      z-index: 2147483647;
      user-select: none;
      box-sizing: border-box;
      animation: vanduPickerSlideIn 0.2s ease-out;
    }
    @keyframes vanduPickerSlideIn {
      from { opacity: 0; transform: translate(-50%, -10px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }
    .vandu-picker-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #4fa89f;
    }
    .vandu-picker-count {
      background: #86d0cb;
      color: #1e293b;
      padding: 0 6px;
      min-width: 20px;
      height: 20px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    }
    .vandu-picker-separator {
      width: 1px;
      height: 18px;
      background: #e2e8f0;
      margin: 0 2px;
    }
    .vandu-picker-btn {
      background: transparent;
      color: #475569;
      border: none;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: background 0.15s ease, color 0.15s ease;
      box-sizing: border-box;
    }
    .vandu-picker-btn:hover {
      background: #f1f5f9;
      color: #1e293b;
    }
    .vandu-picker-btn.vandu-btn-primary {
      background: #4fa89f !important;
      color: #ffffff !important;
      width: 32px !important;
      height: 28px !important;
      border-radius: 6px !important;
    }
    .vandu-picker-btn.vandu-btn-primary:hover {
      background: #3b938a !important;
    }
    .vandu-picker-tag {
      position: fixed;
      background: #1e293b;
      color: #ffffff;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-family: monospace;
      pointer-events: none;
      z-index: 2147483647;
      border: 1px solid #334155;
      white-space: nowrap;
      max-width: 280px;
      overflow: hidden;
      text-overflow: ellipsis;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    /* Section Hover: Shaded teal overlay with dashed border */
    .vandu-hover-highlight {
      outline: 2px dashed #4fa89f !important;
      outline-offset: -1px !important;
      background-color: rgba(79, 168, 159, 0.35) !important;
      cursor: crosshair !important;
    }
    /* Selected Elements: Shaded red overlay indicating removal */
    .vandu-selected-highlight {
      outline: 2px dashed #ef4444 !important;
      outline-offset: -1px !important;
      background-color: rgba(239, 68, 68, 0.3) !important;
      opacity: 0.7 !important;
      cursor: pointer !important;
    }
  `;

  document.head.appendChild(style);
  const mountPoint = document.body || document.documentElement;
  mountPoint.appendChild(root);

  const countBadge = root.querySelector('#vandu-selected-count') as HTMLElement;
  const btnExpand = root.querySelector('#vandu-btn-expand') as HTMLElement;
  const btnClear = root.querySelector('#vandu-btn-clear') as HTMLElement;
  const btnConfirm = root.querySelector('#vandu-btn-confirm') as HTMLElement;
  const btnExit = root.querySelector('#vandu-btn-exit') as HTMLElement;
  const tagBox = root.querySelector('.vandu-picker-tag') as HTMLElement;

  const updateUI = () => {
    const count = selectedElements.size;
    countBadge.textContent = `${count}`;
    if (count > 0) {
      btnClear.style.display = 'inline-flex';
      btnConfirm.style.display = 'inline-flex';
      btnConfirm.title = `Ẩn phần tử (${count})`;
    } else {
      btnClear.style.display = 'none';
      btnConfirm.style.display = 'none';
    }
  };

  const cleanup = () => {
    if (currentHoverTarget) {
      currentHoverTarget.classList.remove('vandu-hover-highlight');
    }
    selectedElements.forEach((el) => {
      el.classList.remove('vandu-selected-highlight');
    });
    selectedElements.clear();

    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    root.remove();
    style.remove();
  };

  const onMouseMove = (e: MouseEvent) => {
    const rawTarget = e.target as HTMLElement | null;
    if (!rawTarget || root.contains(rawTarget)) {
      tagBox.style.display = 'none';
      return;
    }

    // Auto-detect surrounding floating container if inside a popup/banner
    const target = findFloatingContainer(rawTarget);

    if (currentHoverTarget && currentHoverTarget !== target) {
      currentHoverTarget.classList.remove('vandu-hover-highlight');
    }

    currentHoverTarget = target;
    if (!selectedElements.has(currentHoverTarget)) {
      currentHoverTarget.classList.add('vandu-hover-highlight');
    }

    const sel = computeElementSelector(currentHoverTarget);
    tagBox.textContent = sel;
    tagBox.style.display = 'block';
    tagBox.style.left = `${Math.min(window.innerWidth - 220, e.clientX + 10)}px`;
    tagBox.style.top = `${Math.min(window.innerHeight - 30, e.clientY + 10)}px`;
  };

  const onClick = (e: MouseEvent) => {
    const rawTarget = e.target as HTMLElement | null;
    if (!rawTarget || root.contains(rawTarget)) return;

    e.preventDefault();
    e.stopPropagation();

    // Automatically pick the surrounding floating container or the element itself
    const target = findFloatingContainer(rawTarget);

    if (selectedElements.has(target)) {
      // Toggle off if already selected
      selectedElements.delete(target);
      target.classList.remove('vandu-selected-highlight');
      target.classList.add('vandu-hover-highlight');
    } else {
      // Add to multi-selection
      target.classList.remove('vandu-hover-highlight');
      target.classList.add('vandu-selected-highlight');
      selectedElements.add(target);
    }

    updateUI();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      cleanup();
    }
  };

  // 1. Expand selection to parent containers
  btnExpand.addEventListener('click', () => {
    if (selectedElements.size === 0 && currentHoverTarget && currentHoverTarget.parentElement) {
      currentHoverTarget.classList.remove('vandu-hover-highlight');
      currentHoverTarget = currentHoverTarget.parentElement;
      currentHoverTarget.classList.add('vandu-hover-highlight');
      return;
    }

    const nextBatch: HTMLElement[] = [];
    selectedElements.forEach((el) => {
      el.classList.remove('vandu-selected-highlight');
      const parent = el.parentElement;
      if (parent && parent !== document.body && parent !== document.documentElement) {
        nextBatch.push(parent);
      } else {
        nextBatch.push(el);
      }
    });

    selectedElements.clear();
    nextBatch.forEach((el) => {
      el.classList.add('vandu-selected-highlight');
      selectedElements.add(el);
    });

    updateUI();
  });

  // 2. Clear all selections
  btnClear.addEventListener('click', () => {
    selectedElements.forEach((el) => {
      el.classList.remove('vandu-selected-highlight');
    });
    selectedElements.clear();
    updateUI();
  });

  // 3. Confirm and hide all selected elements
  btnConfirm.addEventListener('click', async () => {
    if (selectedElements.size === 0) return;

    const selectors: string[] = [];
    selectedElements.forEach((el) => {
      const sel = computeElementSelector(el);
      if (sel && !selectors.includes(sel)) {
        selectors.push(sel);
      }
    });

    for (const sel of selectors) {
      await StorageAdapter.addCustomCosmeticSelector(sel);
    }

    if (selectors.length > 0) {
      const combinedCss = selectors.map((s) => `${s} { display: none !important; visibility: hidden !important; height: 0 !important; }`).join('\n');
      injectCss(combinedCss, `vandu-cosmetic-batch-${Date.now()}`);
      notifyItemBlocked('ads', selectedElements.size);
      showShieldToast(`Đã ẩn ${selectedElements.size} phần tử`, '');
    }

    cleanup();
  });

  // 4. Exit
  btnExit.addEventListener('click', cleanup);

  if (initialTarget && initialTarget !== document.body && initialTarget !== document.documentElement) {
    const target = findFloatingContainer(initialTarget);
    selectedElements.add(target);
    target.classList.add('vandu-selected-highlight');
    updateUI();
  }

  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
}
