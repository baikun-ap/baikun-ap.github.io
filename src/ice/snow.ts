/**
 * Snowflakes for a right answer: a small burst of six-armed flakes flies up
 * from the «Верно!» verdict and melts. Plain DOM and the Web Animations API,
 * no canvas; nothing happens under prefers-reduced-motion.
 */

const FLAKE = '<svg viewBox="-12 -12 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">'
  + [0, 60, 120].map((a) => `<g transform="rotate(${a})"><path d="M0-10V10M0-6l-3-3M0-6l3-3M0 6l-3 3M0 6l3 3"/></g>`).join('')
  + '</g></svg>';

export function snowBurst(from: Element) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = from.getBoundingClientRect();
  if (!r.width && !r.height) return;
  const layer = document.createElement('div');
  layer.className = 'snow-burst';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  const n = 14;
  let left = n;
  for (let i = 0; i < n; i++) {
    const f = document.createElement('span');
    f.innerHTML = FLAKE;
    const size = 10 + Math.random() * 16;
    const x0 = r.left + r.width * Math.random(), y0 = r.top + r.height / 2;
    // Up and out in a fan, then a slow fall with a sideways drift.
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 60 + Math.random() * 110;
    const dx = Math.cos(a) * v, dy = Math.sin(a) * v, drift = (Math.random() - 0.5) * 50, turn = (Math.random() - 0.5) * 540;
    f.style.cssText = `left:${x0 - size / 2}px;top:${y0 - size / 2}px;width:${size}px;height:${size}px`;
    layer.appendChild(f);
    const anim = f.animate([
      { transform: 'translate(0,0) rotate(0deg) scale(.3)', opacity: 0 },
      { transform: `translate(${dx * 0.7}px,${dy * 0.8}px) rotate(${turn * 0.5}deg) scale(1)`, opacity: 1, offset: 0.3 },
      { transform: `translate(${dx + drift}px,${dy * 0.6 + 70}px) rotate(${turn}deg) scale(.7)`, opacity: 0 },
    ], { duration: 1100 + Math.random() * 700, delay: Math.random() * 120, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' });
    const done = () => { if (--left <= 0) layer.remove(); };
    anim.finished.then(done, done);
  }
}

/**
 * Every exercise marks a right answer with `.verdict.ok`, so one watcher on
 * the page covers lessons, the midterm, microeconomics, writing and listening.
 */
export function watchRightAnswers(root: Element = document.body) {
  const seen = new WeakSet<Element>();
  const hit = (el: Element) => { if (!seen.has(el)) { seen.add(el); try { snowBurst(el); } catch (e) { console.error('[snow]', e); } } };
  const scan = (n: Node) => {
    if (!(n instanceof Element)) return;
    if (n.matches('.verdict.ok')) hit(n);
    n.querySelectorAll('.verdict.ok').forEach(hit);
  };
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'attributes') { if ((m.target as Element).matches('.verdict.ok')) hit(m.target as Element); else seen.delete(m.target as Element); }
      else m.addedNodes.forEach(scan);
    }
  });
  mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  return () => mo.disconnect();
}
