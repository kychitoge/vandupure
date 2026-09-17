/**
 * In-Page Notification Toast (Mockup 04 Standard)
 * Clean, lightweight, non-intrusive notification matching Pure Shield layout.
 */

let toastContainer: HTMLElement | null = null;

function getToastContainer(): HTMLElement {
  if (toastContainer && document.body?.contains(toastContainer)) {
    return toastContainer;
  }

  toastContainer = document.createElement('div');
  toastContainer.id = 'vandu-toast-container';
  toastContainer.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  (document.body || document.documentElement).appendChild(toastContainer);
  return toastContainer;
}

import { StorageAdapter } from '../storage/index.js';

export async function showShieldToast(message: string, _icon?: string): Promise<void> {
  try {
    const settings = await StorageAdapter.getSettings();
    if (!settings.showToastNotification) return;

    if (typeof document === 'undefined') return;
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.style.cssText = `
      background-color: #ffffff;
      color: #0f172a;
      border: 1px solid #e2e8f0;
      padding: 10px 18px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      opacity: 0;
      transform: translateY(12px);
      transition: opacity 0.2s ease, transform 0.2s ease;
      pointer-events: auto;
      user-select: none;
    `;

    toast.innerHTML = `
      <span style="width: 20px; height: 20px; border-radius: 50%; background-color: #4fa89f; display: inline-block; flex-shrink: 0;"></span>
      <span class="vandu-toast-message" style="flex: 1; white-space: nowrap; color: #0f172a;"></span>
      <span class="vandu-toast-close" style="color: #94a3b8; font-size: 16px; font-weight: 400; cursor: pointer; padding: 0 4px; line-height: 1;">×</span>
    `;

    const msgSpan = toast.querySelector('.vandu-toast-message') as HTMLElement | null;
    if (msgSpan) {
      msgSpan.textContent = message;
    }

    const closeBtn = toast.querySelector('.vandu-toast-close');
    closeBtn?.addEventListener('click', () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px)';
      setTimeout(() => toast.remove(), 200);
    });

    container.appendChild(toast);

    // Fade in
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    // Auto dismiss after 2.5s
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px)';
      setTimeout(() => {
        if (toast.parentElement) {
          toast.parentElement.removeChild(toast);
        }
      }, 250);
    }, 2500);
  } catch {
    // Ignore sandbox or frame errors
  }
}
