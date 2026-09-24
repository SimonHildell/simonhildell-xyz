// Procedural ambience (rain + synth pad) and small UI sounds. No audio files needed.
export class Ambience {
  constructor() { this.ctx = null; this.muted = false; this.duck = 1; }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(ctx.destination);
    this.master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 3);
    this.ambBus = ctx.createGain(); this.ambBus.gain.value = 1; this.ambBus.connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.6; this.sfxBus.connect(this.master);

    // rain: filtered noise
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c); let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056;
        d[i] = (b0 + b1 + b2 + w * 0.1) * 0.35 + (Math.random() < 0.0009 ? (Math.random() - 0.5) * 0.9 : 0);
      }
    }
    const rain = ctx.createBufferSource(); rain.buffer = buf; rain.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0.32;
    rain.connect(hp).connect(lp).connect(this.rainGain).connect(this.ambBus);
    rain.start();

    // pad: detuned saws through a slowly breathing low-pass (very CS-80-ish)
    const padOut = ctx.createGain(); padOut.gain.value = 0.045;
    const plp = ctx.createBiquadFilter(); plp.type = 'lowpass'; plp.frequency.value = 700; plp.Q.value = 4;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05;
    const lfoG = ctx.createGain(); lfoG.gain.value = 450; lfo.connect(lfoG).connect(plp.frequency); lfo.start();
    const delay = ctx.createDelay(2); delay.delayTime.value = 0.6;
    const fb = ctx.createGain(); fb.gain.value = 0.45; delay.connect(fb).connect(delay);
    plp.connect(padOut); plp.connect(delay); delay.connect(padOut);
    padOut.connect(this.ambBus);
    this.pad = []; this.padFilter = plp;
    const chord = [55, 82.41, 110, 130.81, 164.81];
    chord.forEach((f, i) => {
      for (const det of [-7, 6]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det + i;
        const g = ctx.createGain(); g.gain.value = i === 0 ? 0.5 : 0.28;
        o.connect(g).connect(plp); o.start(); this.pad.push(o);
      }
    });
    // slow chord changes
    const progs = [[55, 82.41, 110, 130.81, 164.81], [49, 73.42, 98, 123.47, 146.83], [43.65, 65.41, 87.31, 110, 130.81], [51.91, 77.78, 103.83, 123.47, 155.56]];
    let k = 0;
    this._chordTimer = setInterval(() => {
      k = (k + 1) % progs.length;
      this.pad.forEach((o, i) => o.frequency.setTargetAtTime(progs[k][(i / 2) | 0], ctx.currentTime, 2.5));
    }, 12000);
    // distant horn every now and then
    this._hornTimer = setInterval(() => { if (Math.random() < 0.5) this.horn(); }, 23000);
  }

  horn() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 46;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 46.6;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
    const g = ctx.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.09, t + 1.5); g.gain.linearRampToValueAtTime(0, t + 5);
    o.connect(f); o2.connect(f); f.connect(g).connect(this.ambBus);
    o.start(t); o2.start(t); o.stop(t + 5.2); o2.stop(t + 5.2);
  }

  setRain(v) { if (this.rainGain) this.rainGain.gain.setTargetAtTime(0.12 + v * 0.3, this.ctx.currentTime, 0.8); }
  setDuck(on) { if (this.ambBus) this.ambBus.gain.setTargetAtTime(on ? 0.22 : 1, this.ctx.currentTime, 0.6); }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.2); }

  blip(kind = 'find') {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (kind === 'type') {
      const b = ctx.createBuffer(1, 800, ctx.sampleRate); const d = b.getChannelData(0);
      for (let i = 0; i < 800; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 90);
      const s = ctx.createBufferSource(); s.buffer = b; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400 + Math.random() * 1200;
      const g = ctx.createGain(); g.gain.value = 0.5; s.connect(f).connect(g).connect(this.sfxBus); s.start(t);
      return;
    }
    if (kind === 'ui') {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 880;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      o.connect(g).connect(this.sfxBus); o.start(t); o.stop(t + 0.1); return;
    }
    // discovery: glitchy FM sweep + shimmer
    const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.setValueAtTime(220, t); car.frequency.exponentialRampToValueAtTime(1320, t + 0.5);
    const mod = ctx.createOscillator(); mod.frequency.value = 57;
    const mg = ctx.createGain(); mg.gain.value = 400; mod.connect(mg).connect(car.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    car.connect(g).connect(this.sfxBus);
    car.start(t); mod.start(t); car.stop(t + 1.4); mod.stop(t + 1.4);
    [1, 1.5, 2].forEach((m, i) => {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 660 * m;
      const gg = ctx.createGain(); gg.gain.setValueAtTime(0.0001, t + 0.15 + i * 0.09); gg.gain.exponentialRampToValueAtTime(0.08, t + 0.2 + i * 0.09); gg.gain.exponentialRampToValueAtTime(0.0001, t + 1.2 + i * 0.1);
      o.connect(gg).connect(this.sfxBus); o.start(t); o.stop(t + 1.5);
    });
  }
}
