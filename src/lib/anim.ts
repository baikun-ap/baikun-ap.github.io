import { animate, stagger } from 'animejs';

/**
 * Small, quick motion with Anime.js: pages rise in as a stagger, buttons give
 * a little press, numbers count up, right answers pop. Everything is skipped
 * when the system asks for reduced motion.
 */

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The blocks of a freshly shown page rise and fade in one after another. */
export function enterPage(main: Element | null) {
  if (!main || reduced()) return;
  const blocks = main.querySelectorAll(':scope > .page > *');
  if (!blocks.length) return;
  animate(blocks, {
    opacity: [0, 1],
    translateY: [14, 0],
    delay: stagger(45, { start: 20 }),
    duration: 520,
    ease: 'outCubic',
  });
}

/** A press: a quick dip and a springy return. */
export function press(el: Element) {
  if (reduced()) return;
  animate(el, { scale: [{ to: 0.95, duration: 90, ease: 'outQuad' }, { to: 1, duration: 420, ease: 'outElastic(1, .45)' }] });
}

/** Counts a number up from zero inside an element. */
export function countUp(el: HTMLElement, to: number, duration = 900) {
  if (reduced() || to <= 0) { el.textContent = String(to); return; }
  const o = { v: 0 };
  animate(o, { v: to, duration, ease: 'outExpo', onUpdate: () => { el.textContent = String(Math.round(o.v)); } });
}

/** A right answer: the verdict pops. */
export function celebrate(el: Element) {
  if (reduced()) return;
  animate(el, { scale: [0.6, 1], opacity: [0, 1], duration: 600, ease: 'outBack(2)' });
}

/** Wire the site-wide motion once: button presses and right-answer pops. */
export function installMotion(root: Document = document) {
  root.addEventListener('pointerdown', (e) => {
    const b = (e.target as Element | null)?.closest('.btn, .chip, .opt, .tile, .tone-key, .x-tabs a, .x-tabs button');
    if (b && !(b as HTMLButtonElement).disabled) press(b);
  }, { passive: true });
  // A verdict appearing anywhere gets its pop.
  new MutationObserver((list) => {
    for (const m of list) for (const n of m.addedNodes) {
      if (!(n instanceof Element)) continue;
      const v = n.matches('.verdict.ok') ? n : n.querySelector('.verdict.ok');
      if (v) celebrate(v);
    }
  }).observe(root.body, { childList: true, subtree: true });
}
