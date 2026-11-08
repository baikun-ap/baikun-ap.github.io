import { animate, onScroll, stagger } from 'animejs';

/**
 * Small, quick motion with Anime.js: pages rise in as a stagger, buttons give
 * a little press, numbers count up, right answers pop. Everything is skipped
 * when the system asks for reduced motion.
 */

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

type ScrollRoot = HTMLElement;

/** Prefer the course scroller when it owns overflow; otherwise use the window. */
function scrollRoot(main: HTMLElement): ScrollRoot {
  const style = getComputedStyle(main);
  const ownsScroll = main.scrollHeight > main.clientHeight && /(auto|scroll|overlay)/.test(style.overflowY);
  // Anime.js uses document.body as its internal sentinel for window scrolling.
  return ownsScroll ? main : document.body;
}

function hasScroll(container: ScrollRoot, main: HTMLElement) {
  return container === main
    ? main.scrollHeight > main.clientHeight
    : document.documentElement.scrollHeight > window.innerHeight;
}

function scrollObserver(target: Element, container: ScrollRoot) {
  return onScroll({
    target,
    // Scrub only through the short reveal band from the viewport edge to 80vh.
    // Once the element's top is above 80% of the viewport, progress is 1.
    enter: { target: 'top', container: 'end' },
    leave: { target: 'top', container: '80%' },
    sync: true,
    container,
  });
}

function scrollReveal(target: Element, container: ScrollRoot, y = 28) {
  return animate(target, {
    opacity: [0, 1],
    translateY: [y, 0],
    duration: 360,
    ease: 'outCubic',
    autoplay: scrollObserver(target, container),
  });
}

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

/**
 * Bind the app's existing cards to a short scroll reveal. Elements already
 * visible on route entry are left at their natural opacity; only content below
 * the viewport is scrubbed, so a non-scrollable page can never show blank cards.
 */
export function installScrollMotion(main: HTMLElement | null): (() => void) | void {
  if (!main || reduced()) return;
  const container = scrollRoot(main);
  const seen = new WeakSet<Element>();
  const animations: { revert: () => unknown }[] = [];

  const bind = (selector: string, y = 28) => {
    const scrollable = hasScroll(container, main);
    main.querySelectorAll(selector).forEach((target) => {
      if (seen.has(target)) return;
      seen.add(target);
      const rect = target.getBoundingClientRect();
      const visibleNow = rect.bottom > 0 && rect.top < window.innerHeight;
      // No scroll, or already visible: never initialize this target at opacity 0.
      if (!scrollable || visibleNow) {
        target.setAttribute('data-scroll-ready', 'true');
        return;
      }
      animations.push(scrollReveal(target, container, y));
    });
  };

  if (main.querySelector('.dash')) {
    bind('.dash .stats .stat', 24);
    bind('.dash .activity > .panel:first-child svg', 18);
    bind('.dash .bk-chart', 32);
    bind('.dash .worlds .world', 32);
    bind('.dash .lessons .lesson-card', 34);
  } else {
    bind('.page > .h1, .page > .serif.h1', 16);
    bind('.page .stats .stat', 24);
    bind('.page .panel, .page .mt-part, .page .lesson-card', 30);
    bind('.page .mt-parts > *, .page .book', 34);
    if (main.querySelector('.mt, .micro')) bind('.page > .h2, .page > .serif.h2', 12);
  }

  // Activity is lazy-loaded on the dashboard, so bind its rings and graph when
  // React inserts them instead of making the first paint wait for chart code.
  const mutationObserver = new MutationObserver(() => {
    if (main.querySelector('.dash')) {
      bind('.dash .activity > .panel:first-child svg', 18);
      bind('.dash .bk-chart', 32);
    }
  });
  mutationObserver.observe(main, { childList: true, subtree: true });

  return () => {
    mutationObserver.disconnect();
    animations.forEach((animation) => animation.revert());
  };
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
