import { fr } from './format';

interface CountOpts {
  dur?: number;
  fmt?: (v: number) => string;
}

/** rAF count-up that writes into a DOM node, with a guaranteed final value
 *  if rAF is throttled. Ported from the prototype's countUp(). */
export function countUp(node: HTMLElement | null, target: number, opts: CountOpts = {}): void {
  if (!node) return;
  const dur = opts.dur || 900;
  const fmt = opts.fmt || ((v: number) => fr(Math.round(v)));
  const start = parseFloat(node.dataset.v || '0') || 0;
  const t0 = performance.now();
  let done = false;
  function finish() {
    if (done) return;
    done = true;
    node!.textContent = fmt(target);
    node!.dataset.v = String(target);
  }
  function step(t: number) {
    const k = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    node!.textContent = fmt(start + (target - start) * e);
    if (k < 1) requestAnimationFrame(step);
    else finish();
  }
  requestAnimationFrame(step);
  setTimeout(finish, dur + 90);
}
