import './style.css';

const ui = document.querySelector<HTMLElement>('#ui');
const loader = document.querySelector<HTMLElement>('#loader');
const sound = document.querySelector<HTMLButtonElement>('#sound');

const revealInterface = (): void => {
  loader?.classList.add('gone');
  window.setTimeout(() => ui?.classList.add('on'), 160);
};

if (document.fonts?.ready) {
  void document.fonts.ready.then(() => window.setTimeout(revealInterface, 420));
} else {
  window.setTimeout(revealInterface, 420);
}

sound?.addEventListener('click', () => {
  const isPlaying = sound.getAttribute('aria-pressed') === 'true';
  sound.setAttribute('aria-pressed', String(!isPlaying));
  sound.setAttribute('aria-label', isPlaying ? 'Turn ambient sound on' : 'Turn ambient sound off');
});
