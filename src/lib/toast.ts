/** Bottom-center toast, ported verbatim from the prototype's inline toasts.
 *  Every call already marks a real, meaningful event (network connected,
 *  post published, import finished, error…) — so the same calls also feed
 *  a small rolling history, which the notification bell reads. No extra
 *  call sites needed to get a real (not decorative) notification center.
 *  Persisted in localStorage (synced per space like the rest of the app's
 *  state) so the history survives a reload instead of resetting to empty. */

export interface ToastEntry { id: number; icon: string; text: string; at: number; read: boolean; }

const MAX_HISTORY = 30;
const LS = 'eff_notifications_v1';

function loadHistory(): ToastEntry[] {
  try {
    const raw = localStorage.getItem(LS);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

let history: ToastEntry[] = loadHistory();
let nextId = history.reduce((max, h) => Math.max(max, h.id), 0) + 1;
const listeners = new Set<() => void>();

function persist(): void {
  try { localStorage.setItem(LS, JSON.stringify(history)); } catch { /* ignore */ }
}

function notify(): void { listeners.forEach((l) => l()); }

export function showToast(iconSvg: string, html: string): void {
  const toast = document.createElement('div');
  toast.style.cssText =
    'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);z-index:120;display:flex;align-items:center;gap:10px;padding:13px 20px;border-radius:10px;background:var(--canvas-2);border:1px solid var(--acc-soft2);box-shadow:0 18px 40px -16px rgba(20,21,15,.22);color:var(--tx);font-size:14px;font-weight:500;opacity:0;transition:all .35s var(--ease)';
  toast.innerHTML = `<span class="ic" style="width:18px;height:18px;color:var(--acc)">${iconSvg}</span>${html}`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
    setTimeout(() => toast.remove(), 400);
  }, 2600);

  history = [{ id: nextId++, icon: iconSvg, text: html, at: Date.now(), read: false }, ...history].slice(0, MAX_HISTORY);
  persist();
  notify();
}

export function getToastHistory(): ToastEntry[] { return history; }

export function subscribeToasts(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function markToastsRead(): void {
  if (history.every((h) => h.read)) return;
  history = history.map((h) => ({ ...h, read: true }));
  persist();
  notify();
}

export function unreadToastCount(): number {
  return history.filter((h) => !h.read).length;
}
