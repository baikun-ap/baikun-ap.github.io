import { animate, scrambleText, splitText, stagger } from 'animejs';
import { createStory, type Story } from './story';
import './style.css';

/**
 * The landing: one fixed 3D story behind a tall, empty scroll track. The
 * scroll drives the story; each short caption shows over its scene, its mono
 * tags decode like a terminal and its title rises letter by letter (Anime.js).
 */

const root = document.documentElement;
const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string) => Array.from(document.querySelectorAll<T>(s));
const motion = root.classList.contains('motion');
const lang = root.lang === 'en' ? 'en' : 'ru';

/* ---------- language ---------- */
if (lang === 'en') {
  $$('[data-en]').forEach((el) => { el.textContent = el.dataset.en ?? el.textContent; });
  $$('[data-en-aria]').forEach((el) => { el.setAttribute('aria-label', el.dataset.enAria ?? ''); });
  document.title = 'bai.kun (baikun) — Chinese that never melts';
  $('meta[name="description"]')?.setAttribute('content', 'bai.kun — Chinese from zero: characters, pinyin, tones, listening, speech recognition, grammar, tests and flashcards. Free, right in your browser.');
}
const langBtn = $<HTMLButtonElement>('#lang');
if (langBtn) {
  langBtn.textContent = lang === 'en' ? 'RU' : 'EN';
  langBtn.setAttribute('aria-label', lang === 'en' ? 'Русский' : 'English');
  langBtn.addEventListener('click', () => {
    try { localStorage.setItem('baikun-lang', lang === 'en' ? 'ru' : 'en'); } catch { /* storage blocked */ }
    location.reload();
  });
}

function safe(fn: () => void) { try { fn(); } catch (e) { console.error('[landing]', e); } }

/** Mono labels decode like a terminal. */
const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+=<>/';
function decode(el: Element, delay = 0) {
  if (!motion) return;
  safe(() => { animate(el, { innerHTML: scrambleText({ chars: GLYPHS }), duration: 800, delay, ease: 'linear' }); });
}

/* ---------- the 3D story ---------- */
// The loading screen counts real work: the models, the baked light, the 学
// glyph and the first frames, a quarter each. The number runs up to what is
// done (on a timer, not on frames: the first frames are the slow ones) and
// the world opens once it has reached 100.
const loader = $('#loader'), loadNum = $('#load-num'), loadBar = $('#load-bar');
let entered = false, loadGoal = 0.04, loadShown = 0, loadTimer = 0;
const paintLoad = () => {
  const n = Math.round(loadShown * 100);
  if (loadNum) loadNum.textContent = String(n).padStart(3, '0');
  if (loadBar) loadBar.style.width = `${n}%`;
  loader?.setAttribute('aria-valuenow', String(n));
};
const open = () => {
  clearInterval(loadTimer);
  loadShown = 1; paintLoad();
  loader?.classList.add('gone');
  root.classList.add('shown');
  $$('.top .tag, .bottom .tag:not(#scene)').forEach((el, i) => decode(el, 200 + i * 120));
};
const enter = () => {
  if (entered) return;
  entered = true;
  loadGoal = 1;
  if (motion) setTimeout(open, 420); else open();
};
if (motion) loadTimer = window.setInterval(() => {
  // A slow creep keeps the counter alive while a big file is on its way.
  if (!entered) loadGoal = Math.min(0.92, loadGoal + 0.002);
  loadShown += (loadGoal - loadShown) * (entered ? 0.4 : 0.14);
  paintLoad();
}, 40);
const host = $('.js-canvas-container');
const story: Story | null = host ? createStory(host, enter, (p) => {
  loadGoal = Math.max(loadGoal, Math.min(1, p));
  if (!motion) { loadShown = loadGoal; paintLoad(); }
}) : null;
if (!story) enter();
setTimeout(enter, 3000);

const go = $('#go');
go?.addEventListener('pointerenter', () => story?.hover(true));
go?.addEventListener('pointerleave', () => story?.hover(false));
go?.addEventListener('focus', () => story?.hover(true));
go?.addEventListener('blur', () => story?.hover(false));
const sound = $<HTMLButtonElement>('#sound');
if (sound && !story) sound.remove();
sound?.addEventListener('click', () => sound.setAttribute('aria-pressed', String(story?.toggleSound() ?? false)));

/* ---------- scroll → story ---------- */
const scrollP = () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
};
const sync = () => story?.setScroll(scrollP());
addEventListener('scroll', sync, { passive: true });
addEventListener('resize', sync);
sync();

/* ---------- captions follow the story ---------- */
const caps = $$('.cap').map((el) => {
  const title = el.querySelector('.title');
  let chars: HTMLElement[] = [];
  if (title && motion) safe(() => { chars = splitText(title as HTMLElement, { words: { class: 'word' }, chars: { class: 'char' } }).chars as HTMLElement[]; });
  return { el, from: Number(el.dataset.from), to: Number(el.dataset.to), chars, on: false };
});
const sceneTag = $('#scene');
let lastScene = -1;
const tick = () => {
  requestAnimationFrame(tick);
  // Without WebGL the captions follow the plain scroll, on the same scale.
  const s = story ? story.progress() : 0.2 + 0.8 * scrollP();
  caps.forEach((c, i) => {
    const span = c.to - c.from, edge = span * 0.18;
    const o = Math.min(1, Math.max(0, (s - c.from) / edge), Math.max(0, (c.to - s) / edge));
    c.el.style.opacity = o.toFixed(3);
    c.el.style.visibility = o > 0.01 ? 'visible' : 'hidden';
    c.el.style.pointerEvents = o > 0.5 ? 'auto' : 'none';
    c.el.style.transform = `translateY(${((1 - o) * (s < c.from + edge ? 18 : -18)).toFixed(1)}px)`;
    const on = o > 0.35;
    if (on && !c.on) {
      c.el.querySelectorAll('.tag').forEach((t, k) => decode(t, k * 100));
      if (c.chars.length) safe(() => { animate(c.chars, { y: ['0.7em', 0], opacity: [0, 1], rotateX: [-70, 0], delay: stagger(22), duration: 900, ease: 'outExpo' }); });
      if (sceneTag && i !== lastScene) { lastScene = i; sceneTag.textContent = `0${i + 1} / 05`; }
    }
    c.on = on;
  });
};
tick();

// A breathing arrow.
if (motion) safe(() => { animate('.go svg', { x: [0, 4, 0], duration: 2400, loop: true, ease: 'inOutSine', delay: 2600 }); });
