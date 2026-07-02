/** Bottom-center toast, ported verbatim from the prototype's inline toasts. */
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
}
