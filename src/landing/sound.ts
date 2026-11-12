/**
 * Sound of the landing story (ICE-PLAN stage 4), synthesized with Web Audio,
 * no recordings:
 *   - wind that rises with the scroll speed, over a soft open chord;
 *   - ice crunch as the bricks of 学 break off: bursts of short, bright noise
 *     grains (cracks) over a low thud;
 *   - a glassy clink as each of the eight ring segments locks in, rising up a
 *     pentatonic scale, a chord for the inner ring;
 *   - the portal's hum, a resonant drone that swells and opens up as the
 *     camera nears it, and a whoosh with a falling boom on its flash.
 * Everything rings out in a small generated reverb, "a cold open space".
 * Nothing plays until the sound button is pressed.
 */

export interface StorySound {
  /** Turn on or off; returns whether it is on. Call from the click itself. */
  toggle(): boolean;
  /** Muffled while the pointer rests on the main button. */
  muffle(on: boolean): void;
  /** Every frame: scroll speed (story progress per second) and portal nearness 0..1. */
  update(speed: number, hum: number): void;
  /** `n` bricks broke off this frame. */
  crunch(n: number): void;
  /** Ring segment `i` (0..7) locked in; 8 is the inner ring. */
  clink(i: number): void;
  /** The portal flash. */
  boom(): void;
}

interface Rig {
  ctx: AudioContext; bus: GainNode; send: GainNode; master: GainNode; muffleGain: GainNode; muffleLp: BiquadFilterNode;
  noise: AudioBuffer; windGain: GainNode; windBand: BiquadFilterNode;
  humGain: GainNode; humLp: BiquadFilterNode; throb: OscillatorNode;
}

/** E pentatonic, up from A5: one note per lesson step. */
const NOTES = [880, 987.8, 1108.7, 1318.5, 1480, 1760, 1975.5, 2217.5];
/** Inharmonic partials of a struck piece of ice (ratios, level, ring time). */
const PARTIALS: [number, number, number][] = [[1, 1, 1.6], [2.756, 0.45, 0.8], [5.404, 0.22, 0.4], [8.933, 0.1, 0.2]];

function build(): Rig {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx(), sr = ctx.sampleRate;
  // bus (dry) and send (reverb) → muffle filter → muffle gain → master → limiter.
  const bus = ctx.createGain(), send = ctx.createGain(), muffleLp = ctx.createBiquadFilter(), muffleGain = ctx.createGain(), master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
  muffleLp.type = 'lowpass'; muffleLp.frequency.value = 18000;
  master.gain.value = 0;
  bus.connect(muffleLp); muffleLp.connect(muffleGain); muffleGain.connect(master); master.connect(comp); comp.connect(ctx.destination);
  // Reverb: decaying stereo noise, darker towards the tail.
  const len = Math.floor(sr * 2.6), ir = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const x = i / len, k = 0.9 - 0.75 * x;
      lp += (Math.random() * 2 - 1 - lp) * k;
      d[i] = lp * Math.pow(1 - x, 3) * (i < sr * 0.01 ? i / (sr * 0.01) : 1);
    }
  }
  const verb = ctx.createConvolver(), wet = ctx.createGain();
  verb.buffer = ir; wet.gain.value = 0.55;
  send.connect(verb); verb.connect(wet); wet.connect(muffleLp);

  const noise = ctx.createBuffer(1, sr * 2, sr), ch = noise.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;

  // Wind: looping noise through a slowly wandering band, and the soft chord.
  const windLp = ctx.createBiquadFilter(); windLp.type = 'lowpass'; windLp.frequency.value = 900; windLp.connect(bus);
  const wind = ctx.createBufferSource(); wind.buffer = noise; wind.loop = true;
  const windBand = ctx.createBiquadFilter(); windBand.type = 'bandpass'; windBand.frequency.value = 480; windBand.Q.value = 0.6;
  const wob = ctx.createOscillator(), wobG = ctx.createGain(); wob.frequency.value = 0.08; wobG.gain.value = 240; wob.connect(wobG); wobG.connect(windBand.frequency);
  const windGain = ctx.createGain(); windGain.gain.value = 0.06;
  wind.connect(windBand); windBand.connect(windGain); windGain.connect(windLp);
  [146.8, 220, 329.6].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; o.detune.value = i * 5 - 5; g.gain.value = 0.01; o.connect(g); g.connect(windLp); o.start(); });
  wind.start(); wob.start();

  // The portal hum: low saws and a sub through a resonant low-pass that opens
  // up, throbbing faster as the camera comes near. Silent until then.
  const humLp = ctx.createBiquadFilter(); humLp.type = 'lowpass'; humLp.frequency.value = 120; humLp.Q.value = 5;
  const trem = ctx.createGain(); trem.gain.value = 0.7;
  const throb = ctx.createOscillator(), throbG = ctx.createGain(); throb.frequency.value = 0.9; throbG.gain.value = 0.3; throb.connect(throbG); throbG.connect(trem.gain);
  const humGain = ctx.createGain(); humGain.gain.value = 0;
  humLp.connect(trem); trem.connect(humGain); humGain.connect(bus);
  [[55, 'sawtooth', -7], [82.4, 'sawtooth', 6], [110.2, 'triangle', 0], [41.2, 'sine', 0]].forEach(([f, type, det]) => {
    const o = ctx.createOscillator(); o.type = type as OscillatorType; o.frequency.value = f as number; o.detune.value = det as number;
    const g = ctx.createGain(); g.gain.value = type === 'sine' ? 0.9 : 0.35;
    o.connect(g); g.connect(type === 'sine' ? trem : humLp); o.start();
  });
  throb.start();
  return { ctx, bus, send, master, muffleGain, muffleLp, noise, windGain, windBand, humGain, humLp, throb };
}

export function createSound(): StorySound {
  let rig: Rig | null = null, on = false, muffled = false, pending = 0, lastCrunch = 0;
  const live = () => (rig && on && rig.ctx.state === 'running' ? rig : null);
  addEventListener('visibilitychange', () => {
    if (!rig) return;
    if (document.hidden) void rig.ctx.suspend().catch(() => {});
    else if (on) void rig.ctx.resume().catch(() => {});
  });

  /** One short burst of filtered noise (a crack, a tick). */
  const grain = (r: Rig, at: number, dur: number, freq: number, q: number, amp: number, wet: number) => {
    const src = r.ctx.createBufferSource(), bp = r.ctx.createBiquadFilter(), g = r.ctx.createGain();
    src.buffer = r.noise; bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(amp, at + 0.0015); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(bp); bp.connect(g); g.connect(r.bus);
    if (wet > 0) { const w = r.ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(r.send); }
    src.start(at, Math.random() * 1.8, dur + 0.02);
  };
  /** One struck ice partial set at `f`. */
  const strike = (r: Rig, at: number, f: number, amp: number, ring: number) => {
    for (const [ratio, lvl, time] of PARTIALS) {
      const o = r.ctx.createOscillator(), g = r.ctx.createGain();
      o.frequency.value = f * ratio;
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(amp * lvl, at + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, at + time * ring);
      o.connect(g); g.connect(r.bus); g.connect(r.send);
      o.start(at); o.stop(at + time * ring + 0.05);
    }
  };
  const playCrunch = (r: Rig, size: number) => {
    const now = r.ctx.currentTime, loud = Math.min(1, 0.45 + 0.1 * size), n = Math.min(18, 5 + size * 2);
    for (let k = 0; k < n; k++) {
      grain(r, now + Math.pow(Math.random(), 1.8) * 0.17, 0.006 + Math.random() * 0.035, 1300 + Math.random() * 4600, 1 + Math.random() * 3, (0.12 + Math.random() * 0.22) * loud, 0.25);
    }
    // The low thud of the brick letting go.
    const src = r.ctx.createBufferSource(), lp = r.ctx.createBiquadFilter(), g = r.ctx.createGain();
    src.buffer = r.noise; lp.type = 'lowpass'; lp.frequency.value = 240;
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.5 * loud, now + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    src.connect(lp); lp.connect(g); g.connect(r.bus);
    src.start(now, Math.random(), 0.25);
  };

  return {
    toggle() {
      try {
        const fresh = !rig, r = rig ?? (rig = build());
        if (fresh && muffled) { r.muffleLp.frequency.value = 320; r.muffleGain.gain.value = 0.45; }
        if (r.ctx.state === 'suspended') void r.ctx.resume();
        on = !on;
        const now = r.ctx.currentTime;
        r.master.gain.cancelScheduledValues(now); r.master.gain.setValueAtTime(r.master.gain.value, now);
        r.master.gain.linearRampToValueAtTime(on ? 0.85 : 0, now + 1);
      } catch { on = false; }
      return on;
    },
    muffle(m) {
      muffled = m;
      if (!rig) return;
      const now = rig.ctx.currentTime;
      rig.muffleLp.frequency.setTargetAtTime(muffled ? 320 : 18000, now, 0.25);
      rig.muffleGain.gain.setTargetAtTime(muffled ? 0.45 : 1, now, 0.25);
    },
    update(speed, hum) {
      const r = live();
      if (!r) return;
      const now = r.ctx.currentTime, w = Math.min(1, Math.abs(speed) / 0.15);
      r.windGain.gain.setTargetAtTime(0.05 + 0.13 * w, now, 0.3);
      r.windBand.frequency.setTargetAtTime(480 + 520 * w, now, 0.3);
      r.humGain.gain.setTargetAtTime(0.2 * Math.pow(hum, 1.6), now, 0.15);
      r.humLp.frequency.setTargetAtTime(120 + 1100 * hum * hum, now, 0.2);
      r.throb.frequency.setTargetAtTime(0.9 + 4.5 * hum, now, 0.3);
      // Cracks come out at most every 60 ms, bigger when many bricks went at once.
      if (pending > 0 && now - lastCrunch >= 0.06) { playCrunch(r, pending); pending = 0; lastCrunch = now; }
    },
    crunch(n) { if (live()) pending += n; },
    clink(i) {
      const r = live();
      if (!r) return;
      const now = r.ctx.currentTime;
      if (i < 8) strike(r, now, NOTES[i], 0.11, 1);
      else { strike(r, now, 659.3, 0.1, 1.6); strike(r, now + 0.012, 987.8, 0.08, 1.6); strike(r, now + 0.02, 1318.5, 0.05, 1.4); }
      grain(r, now, 0.012, 6500, 2, 0.12, 0.3);
    },
    boom() {
      const r = live();
      if (!r) return;
      const now = r.ctx.currentTime;
      // Whoosh: noise through a low-pass falling from bright to dark.
      const src = r.ctx.createBufferSource(), lp = r.ctx.createBiquadFilter(), g = r.ctx.createGain();
      src.buffer = r.noise; src.loop = true; lp.type = 'lowpass';
      lp.frequency.setValueAtTime(5000, now); lp.frequency.exponentialRampToValueAtTime(140, now + 1.5);
      g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.4, now + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, now + 2);
      src.connect(lp); lp.connect(g); g.connect(r.bus); g.connect(r.send);
      src.start(now); src.stop(now + 2.1);
      // Boom: a sine dropping in pitch.
      const o = r.ctx.createOscillator(), og = r.ctx.createGain();
      o.frequency.setValueAtTime(72, now); o.frequency.exponentialRampToValueAtTime(28, now + 1.2);
      og.gain.setValueAtTime(0, now); og.gain.linearRampToValueAtTime(0.55, now + 0.01); og.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
      o.connect(og); og.connect(r.bus);
      o.start(now); o.stop(now + 1.5);
    },
  };
}
