import { animate, createTimeline, onScroll, splitText, stagger } from 'animejs';
import { createValley, type Valley } from '../valley/scene';
import './style.css';

/**
 * The landing page: the flower valley stays fixed behind a long page, the
 * scroll flies the camera through it, and every block is tied to the scroll
 * with Anime.js (scrubbed forward when you scroll down, backward when you
 * scroll up). With reduced motion everything is simply shown.
 */

const root = document.documentElement;
const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string) => Array.from(document.querySelectorAll<T>(s));
const motion = root.classList.contains('motion');
const lang = root.lang === 'en' ? 'en' : 'ru';

/* ---------- language (Russian in the markup, English in data-en) ---------- */
if (lang === 'en') {
  $$('[data-en]').forEach((el) => { el.textContent = el.dataset.en ?? el.textContent; });
  $$('[data-en-html]').forEach((el) => { el.innerHTML = el.dataset.enHtml ?? el.innerHTML; });
  $$('[data-en-aria]').forEach((el) => { el.setAttribute('aria-label', el.dataset.enAria ?? ''); });
  document.title = 'bai.kun (baikun) — Chinese that grows';
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

/* ---------- the valley ---------- */
const loader = $('#loader');
let entered = false;
const enter = () => {
  if (entered) return;
  entered = true;
  loader?.classList.add('gone');
  heroEntrance();
};
const canvasHost = $('.js-canvas-container');
const valley: Valley | null = canvasHost ? createValley(canvasHost, enter) : null;
if (!valley) enter();
// Never keep the loader up for long, whatever the GPU does.
setTimeout(enter, 2500);

const go = $('#go');
go?.addEventListener('pointerenter', () => valley?.hover(true));
go?.addEventListener('pointerleave', () => valley?.hover(false));
go?.addEventListener('focus', () => valley?.hover(true));
go?.addEventListener('blur', () => valley?.hover(false));

const sound = $<HTMLButtonElement>('#sound');
if (sound && !valley) sound.parentElement?.querySelector('i')?.remove();
if (sound && !valley) sound.remove();
sound?.addEventListener('click', () => {
  const on = valley?.toggleSound() ?? false;
  sound.setAttribute('aria-pressed', String(on));
});

/* ---------- page progress: the camera flight and the thin bar on top ---------- */
const barFill = $('.bar span');
const onPageScroll = () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const p = max > 0 ? window.scrollY / max : 0;
  valley?.setScroll(p);
  if (barFill) barFill.style.transform = `scaleX(${p})`;
};
window.addEventListener('scroll', onPageScroll, { passive: true });
window.addEventListener('resize', onPageScroll);
onPageScroll();

/* ---------- motion ---------- */
function safe(fn: () => void) {
  try { fn(); } catch (e) { console.error('[landing motion]', e); }
}

function heroEntrance() {
  if (!motion) return;
  safe(() => {
    const title = $('#hero-title');
    const { chars } = splitText(title!, { words: { class: 'word' }, chars: { class: 'char' } });
    const tl = createTimeline({ defaults: { ease: 'outExpo' } });
    tl.set('.hero h1', { opacity: 1 })
      .add(chars, { y: ['0.6em', 0], opacity: [0, 1], rotate: [8, 0], duration: 1300, delay: stagger(28) }, 0)
      .add('.hero .eyebrow', { opacity: [0, 1], y: [12, 0], duration: 1000 }, 200)
      .add('.hero .cap', { opacity: [0, 1], y: [18, 0], duration: 1100 }, 450)
      .add('.hero .go', { opacity: [0, 1], scale: [0.4, 1], duration: 1200, ease: 'outElastic(1, .55)' }, 650)
      .call(() => root.classList.add('shown'), 300);
  });
}
if (!motion) root.classList.add('shown');

// A breathing arrow until the visitor hovers it.
if (motion) safe(() => {
  animate('.go svg', { x: [0, 4, 0], duration: 2400, loop: true, ease: 'inOutSine', delay: 2600 });
});

if (motion) {
  /** Scrubbed by the scroll between two thresholds of `target`. */
  const scrub = (target: Element | string, enter: object, leave: object) => onScroll({ target, enter, leave, sync: true } as Parameters<typeof onScroll>[0]);

  // Hero drifts up and fades as it leaves; the valley darkens behind the content.
  safe(() => {
    $$('.hero > *').forEach((el, i) => {
      animate(el, {
        y: [0, -120 - i * 40],
        opacity: [1, 0],
        ease: 'linear',
        autoplay: scrub('#hero', { target: 'top', container: 'top' }, { target: 'bottom', container: 'top' }),
      });
    });
    animate('.scrim', {
      opacity: [0, 1],
      ease: 'linear',
      autoplay: scrub('#hero', { target: 'top', container: 'top' }, { target: 'bottom', container: 'top' }),
    });
    animate('.corner', {
      opacity: [1, 0],
      ease: 'linear',
      autoplay: scrub('#hero', { target: 'center', container: 'top' }, { target: 'bottom', container: 'top' }),
    });
  });

  // Manifesto: each word lights up in turn as the paragraph rises.
  safe(() => {
    const { words } = splitText('#manifesto-text', { words: { class: 'word' } });
    animate(words, {
      opacity: [0.12, 1],
      y: [10, 0],
      delay: stagger(40),
      ease: 'linear',
      autoplay: scrub('#manifesto', { target: 'top', container: 'bottom' }, { target: 'center', container: 'center' }),
    });
  });

  // Section titles: letters rise as the title comes up.
  safe(() => {
    $$('.h2').forEach((h) => {
      const { chars } = splitText(h, { words: { class: 'word' }, chars: { class: 'char' } });
      animate(chars, {
        y: ['0.7em', 0],
        opacity: [0, 1],
        delay: stagger(18),
        ease: 'outQuad',
        autoplay: scrub(h, { target: 'top', container: 'bottom' }, { target: 'top', container: '72%' }),
      });
    });
  });

  // Three gardens: cards rise one after another, their character swings upright.
  safe(() => {
    $$('.world').forEach((card, i) => {
      animate(card, {
        y: [90 + i * 40, 0],
        rotateX: [55, 0],
        rotateY: [(i - 1) * 18, 0],
        opacity: [0, 1],
        ease: 'outQuad',
        autoplay: scrub(card, { target: 'top', container: 'bottom' }, { target: 'top', container: '75%' }),
      });
      animate(card.querySelector('.hz')!, {
        scale: [0.55, 1],
        rotate: [-14, 0],
        ease: 'outBack(1.4)',
        autoplay: scrub(card, { target: 'top', container: 'bottom' }, { target: 'top', container: '68%' }),
      });
    });
  });

  // Eight steps: a 3D deck of cards, like a stack of documents. While the
  // section is pinned, the top card flips up and away and the next one
  // slides forward into its place.
  safe(() => {
    const cards = $$('.step');
    if (cards.length < 2) return;
    const slot = (k: number) => ({ x: 0, y: k * 16, z: -k * 70, scale: 1 - k * 0.045, rotateY: 0, rotateZ: 0, opacity: k < 4 ? 1 : 0 });
    const tl = createTimeline({
      defaults: { ease: 'inOutQuad', duration: 1000 },
      autoplay: onScroll({ target: '#steps', enter: { target: 'top', container: 'top' }, leave: { target: 'bottom', container: 'bottom' }, sync: true }),
    });
    cards.forEach((c, j) => tl.set(c, slot(j), 0));
    for (let k = 0; k < cards.length - 1; k++) {
      const at = k * 1000;
      tl.add(cards[k], { x: (k % 2 ? 1 : -1) * window.innerWidth * 1.1, y: -60, z: 80, rotateY: (k % 2 ? 1 : -1) * 55, rotateZ: (k % 2 ? 1 : -1) * 14, ease: 'inQuad' }, at);
      for (let j = k + 1; j < cards.length; j++) tl.add(cards[j], { ...slot(j - k - 1) }, at + 120);
    }
    tl.add({ duration: 400 }, (cards.length - 1) * 1000);
  });

  // Numbers count up with the scroll.
  safe(() => {
    $$('.num b').forEach((b) => {
      const to = Number(b.dataset.to) || 0;
      const o = { v: 0 };
      animate(o, {
        v: [0, to],
        ease: 'outCubic',
        modifier: Math.round,
        onUpdate: () => { b.textContent = String(Math.round(o.v)); },
        autoplay: scrub(b, { target: 'top', container: 'bottom' }, { target: 'top', container: '62%' }),
      });
    });
  });

  // Exam cards slide in from the sides.
  safe(() => {
    $$('.exam').forEach((card, i) => {
      animate(card, {
        x: [i ? 120 : -120, 0],
        rotateY: [i ? -40 : 40, 0],
        opacity: [0, 1],
        ease: 'outQuad',
        autoplay: scrub(card, { target: 'top', container: 'bottom' }, { target: 'top', container: '72%' }),
      });
    });
  });

  // 开始: the two characters grow out of the ground.
  safe(() => {
    const { chars } = splitText('#kai', { chars: { class: 'char' } });
    chars.forEach((ch, i) => {
      animate(ch, {
        y: ['40%', 0],
        scale: [0.3, 1],
        rotateY: [i ? -70 : 70, 0],
        rotate: [i ? 18 : -18, 0],
        opacity: [0, 1],
        delay: i * 120,
        ease: 'outBack(1.2)',
        autoplay: scrub('#final', { target: 'top', container: 'bottom' }, { target: 'top', container: '30%' }),
      });
    });
    animate(['.final .cap', '.final .big-pill', '.final .foot'], {
      y: [40, 0],
      opacity: [0, 1],
      delay: stagger(80),
      ease: 'outQuad',
      autoplay: scrub('#final', { target: 'top', container: 'bottom' }, { target: 'top', container: '20%' }),
    });
  });
}
