// 효과음 — WebAudio 실시간 합성 (멀수록 작고 좌우로 들린다)
export class Sound {
  constructor() {
    this.ctx = null;
    this.vol = 0.7;
    this.voices = 0;
    this.lx = 0; this.ly = 0; this.lz = 0; this.lyaw = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.vol * 0.7;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  get ready() { return this.ctx && this.ctx.state === 'running'; }

  setVolume(v) {
    this.vol = v;
    if (this.master) this.master.gain.value = v * 0.7;
  }

  listen(x, y, z, yaw) {
    this.lx = x; this.ly = y; this.lz = z; this.lyaw = yaw;
  }

  out(pos, gain) {
    const ctx = this.ctx, g = ctx.createGain();
    if (!pos) {
      g.gain.value = gain;
      g.connect(this.master);
      return g;
    }
    const dx = pos[0] - this.lx, dy = pos[1] - this.ly, dz = pos[2] - this.lz, d = Math.hypot(dx, dy, dz);
    g.gain.value = gain / (1 + Math.pow(d / 8, 1.4));
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.max(700, 16000 * Math.exp(-d / 40));
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      const rx = Math.cos(this.lyaw) * dx - Math.sin(this.lyaw) * dz;
      pan.pan.value = d < 0.5 ? 0 : Math.max(-0.8, Math.min(0.8, rx / Math.max(d, 1)));
      g.connect(lp).connect(pan).connect(this.master);
    } else g.connect(lp).connect(this.master);
    return g;
  }

  noiseHit(o, t, { dur, type = 'bandpass', f = 1000, to = 0, q = 1, peak = 0.5, attack = 0.002 }) {
    const ctx = this.ctx, src = ctx.createBufferSource();
    src.buffer = this.noise;
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(f, t);
    if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
    fl.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl).connect(g).connect(o);
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }

  tone(o, t, { dur, f, to = 0, type = 'sine', peak = 0.3, attack = 0.004 }) {
    const ctx = this.ctx, osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(o);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  play(name, pos = null, gain = 1) {
    if (!this.ready || this.voices > 40) return;
    this.voices++;
    setTimeout(() => this.voices--, 400);
    const t = this.ctx.currentTime, o = this.out(pos, gain);
    const r = () => 0.9 + Math.random() * 0.2;
    switch (name) {
      case 'chop':
        this.noiseHit(o, t, { dur: 0.12, f: 900 * r(), q: 2.5, peak: 0.6 });
        this.tone(o, t, { dur: 0.1, f: 220 * r(), to: 120, type: 'triangle', peak: 0.45 });
        break;
      case 'mine':
        this.tone(o, t, { dur: 0.18, f: 1800 * r(), to: 1500, type: 'square', peak: 0.1 });
        this.noiseHit(o, t, { dur: 0.1, f: 3200, q: 2, peak: 0.45 });
        this.tone(o, t, { dur: 0.3, f: 2600 * r(), peak: 0.06 });
        break;
      case 'clang':
        this.tone(o, t, { dur: 0.25, f: 520, to: 480, type: 'square', peak: 0.1 });
        this.noiseHit(o, t, { dur: 0.08, f: 2000, q: 4, peak: 0.25 });
        break;
      case 'swing':
        this.noiseHit(o, t, { dur: 0.18, f: 600, to: 2200, q: 1.2, peak: 0.18, attack: 0.05 });
        break;
      case 'hit':
        this.noiseHit(o, t, { dur: 0.12, type: 'lowpass', f: 900, peak: 0.6 });
        this.tone(o, t, { dur: 0.12, f: 180 * r(), to: 80, peak: 0.45 });
        break;
      case 'crit':
        this.noiseHit(o, t, { dur: 0.16, type: 'lowpass', f: 1200, peak: 0.7 });
        this.tone(o, t, { dur: 0.2, f: 900, to: 1400, type: 'triangle', peak: 0.2 });
        break;
      case 'edie':
        this.noiseHit(o, t, { dur: 0.35, f: 500, to: 2500, q: 0.8, peak: 0.35, attack: 0.02 });
        this.tone(o, t, { dur: 0.25, f: 400, to: 900, type: 'triangle', peak: 0.12 });
        break;
      case 'grunt':
        this.tone(o, t, { dur: 0.22, f: 160 * r(), to: 110, type: 'sawtooth', peak: 0.1 });
        this.noiseHit(o, t, { dur: 0.18, f: 500, q: 3, peak: 0.1 });
        break;
      case 'howl':
        this.tone(o, t, { dur: 1.2, f: 420, to: 700, type: 'triangle', peak: 0.16, attack: 0.25 });
        break;
      case 'oink':
        this.tone(o, t, { dur: 0.12, f: 300 * r(), to: 220, type: 'sawtooth', peak: 0.1 });
        this.tone(o, t + 0.14, { dur: 0.1, f: 280 * r(), to: 200, type: 'sawtooth', peak: 0.08 });
        break;
      case 'bowshot':
        this.tone(o, t, { dur: 0.15, f: 180, to: 90, type: 'triangle', peak: 0.3 });
        this.noiseHit(o, t, { dur: 0.2, f: 1500, to: 400, q: 1, peak: 0.2 });
        break;
      case 'arrowhit':
        this.noiseHit(o, t, { dur: 0.06, f: 1800, q: 2, peak: 0.3 });
        break;
      case 'pickup':
        this.tone(o, t, { dur: 0.08, f: 660 * r(), to: 990, type: 'triangle', peak: 0.12 });
        break;
      case 'coin':
        this.tone(o, t, { dur: 0.08, f: 1760, peak: 0.1 });
        this.tone(o, t + 0.05, { dur: 0.16, f: 2640, peak: 0.08 });
        break;
      case 'craft':
        [523, 659, 784].forEach((f, i) => this.tone(o, t + i * 0.06, { dur: 0.18, f, type: 'triangle', peak: 0.14 }));
        this.noiseHit(o, t, { dur: 0.08, f: 2500, q: 3, peak: 0.15 });
        break;
      case 'place':
        this.noiseHit(o, t, { dur: 0.18, type: 'lowpass', f: 500, peak: 0.6 });
        this.tone(o, t, { dur: 0.15, f: 140, to: 70, peak: 0.4 });
        break;
      case 'eat':
        for (let i = 0; i < 3; i++) this.noiseHit(o, t + i * 0.09, { dur: 0.06, f: 1200 * r(), q: 1.5, peak: 0.25 });
        break;
      case 'hurt':
        this.tone(o, t, { dur: 0.2, f: 220, to: 110, type: 'square', peak: 0.12 });
        this.noiseHit(o, t, { dur: 0.12, type: 'lowpass', f: 700, peak: 0.4 });
        break;
      case 'pdie':
        this.tone(o, t, { dur: 0.9, f: 440, to: 110, type: 'triangle', peak: 0.25 });
        break;
      case 'jump':
        this.tone(o, t, { dur: 0.12, f: 300, to: 520, type: 'triangle', peak: 0.08 });
        break;
      case 'land':
        this.noiseHit(o, t, { dur: 0.1, type: 'lowpass', f: 400, peak: 0.35 });
        break;
      case 'step':
        this.noiseHit(o, t, { dur: 0.06, type: 'lowpass', f: 600 * r(), peak: 0.12 });
        break;
      case 'chest':
        this.noiseHit(o, t, { dur: 0.25, f: 400, to: 1200, q: 1.5, peak: 0.3 });
        this.tone(o, t, { dur: 0.2, f: 180, to: 260, type: 'sawtooth', peak: 0.08 });
        break;
      case 'common':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(o, t + i * 0.07, { dur: 0.25, f, type: 'triangle', peak: 0.14 }));
        break;
      case 'rare':
        [587, 740, 880, 1175, 1480].forEach((f, i) => this.tone(o, t + i * 0.07, { dur: 0.4, f, type: 'triangle', peak: 0.14 }));
        break;
      case 'legendary':
        [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => this.tone(o, t + i * 0.08, { dur: 0.7, f, type: 'triangle', peak: 0.14 }));
        this.noiseHit(o, t + 0.4, { dur: 1.2, type: 'highpass', f: 6000, peak: 0.08, attack: 0.3 });
        break;
      case 'night':
        this.tone(o, t, { dur: 2.2, f: 110, to: 98, type: 'sawtooth', peak: 0.14, attack: 0.3 });
        this.tone(o, t, { dur: 2.2, f: 165, to: 147, type: 'triangle', peak: 0.1, attack: 0.3 });
        break;
      case 'morning':
        [392, 523, 659, 784].forEach((f, i) => this.tone(o, t + i * 0.12, { dur: 0.8, f, peak: 0.12 }));
        break;
      case 'boss':
        this.tone(o, t, { dur: 1.6, f: 70, to: 45, type: 'sawtooth', peak: 0.3, attack: 0.1 });
        this.noiseHit(o, t, { dur: 1.4, type: 'lowpass', f: 400, to: 150, peak: 0.6, attack: 0.15 });
        break;
      case 'slam':
        this.noiseHit(o, t, { dur: 0.8, type: 'lowpass', f: 300, to: 60, peak: 1, attack: 0.005 });
        this.tone(o, t, { dur: 0.6, f: 80, to: 30, peak: 0.7 });
        break;
      case 'zap':
        this.noiseHit(o, t, { dur: 0.25, type: 'highpass', f: 3000, peak: 0.35 });
        this.tone(o, t, { dur: 0.2, f: 1400, to: 200, type: 'sawtooth', peak: 0.1 });
        break;
      case 'boat':
        this.noiseHit(o, t, { dur: 0.3, type: 'lowpass', f: 600, peak: 0.5 });
        [392, 494, 587].forEach((f, i) => this.tone(o, t + i * 0.08, { dur: 0.3, f, type: 'triangle', peak: 0.12 }));
        break;
      case 'launch':
        for (let i = 0; i < 4; i++) this.tone(o, t + i * 0.5, { dur: 0.45, f: 330, to: 440, type: 'square', peak: 0.1 });
        break;
      case 'victory':
        [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(o, t + i * 0.13, { dur: 0.5, f, type: 'triangle', peak: 0.16 }));
        break;
      case 'defeat':
        [392, 349, 311, 262].forEach((f, i) => this.tone(o, t + i * 0.25, { dur: 0.6, f, type: 'triangle', peak: 0.15 }));
        break;
      case 'err':
        this.tone(o, t, { dur: 0.12, f: 200, type: 'square', peak: 0.08 });
        break;
      case 'click':
        this.tone(o, t, { dur: 0.05, f: 900, type: 'triangle', peak: 0.12 });
        break;
      case 'revive':
        [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(o, t + i * 0.06, { dur: 0.35, f, type: 'triangle', peak: 0.12 }));
        break;
    }
  }
}
