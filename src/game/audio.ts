/* Procedural audio. No external assets, everything is synthesised. */

type ShotKind = 'pistol' | 'smg' | 'ar' | 'dmr' | 'shotgun' | 'lmg' | 'sniper';
type SelectTier = 'common' | 'rare' | 'epic' | 'mythic' | 'divine';

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.32;
    this.master.connect(this.ctx.destination);

    const len = Math.floor(this.ctx.sampleRate * 0.6);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.32;
    return this.muted;
  }

  get isMuted() {
    return this.muted;
  }

  private get t() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private noiseBurst(duration: number, gain: number, freq: number, q = 1) {
    if (!this.ctx || !this.master || !this.noise) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, this.t);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + duration);
    src.connect(filter).connect(g).connect(this.master);
    src.start(this.t);
    src.stop(this.t + duration + 0.02);
  }

  private tone(freq: number, duration: number, gain: number, type: OscillatorType = 'sine', slide = 0) {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), this.t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, this.t);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + duration);
    osc.connect(g).connect(this.master);
    osc.start(this.t);
    osc.stop(this.t + duration + 0.02);
  }

  shot(kind: ShotKind) {
    if (!this.ctx) return;
    switch (kind) {
      case 'pistol':
        this.noiseBurst(0.11, 0.5, 1500, 0.7);
        this.tone(150, 0.09, 0.35, 'triangle', -90);
        break;
      case 'smg':
        this.noiseBurst(0.07, 0.36, 1900, 0.8);
        this.tone(190, 0.06, 0.2, 'square', -100);
        break;
      case 'ar':
        this.noiseBurst(0.12, 0.5, 1300, 0.6);
        this.tone(120, 0.1, 0.3, 'triangle', -70);
        break;
      case 'dmr':
        this.noiseBurst(0.24, 0.52, 900, 0.5);
        this.tone(90, 0.18, 0.4, 'triangle', -50);
        break;
      case 'shotgun':
        this.noiseBurst(0.3, 0.55, 700, 0.45);
        this.tone(70, 0.22, 0.45, 'triangle', -40);
        break;
      case 'lmg':
        this.noiseBurst(0.13, 0.45, 1100, 0.55);
        this.tone(100, 0.1, 0.28, 'square', -60);
        break;
      case 'sniper':
        this.noiseBurst(0.42, 0.62, 720, 0.4);
        this.tone(58, 0.4, 0.5, 'triangle', -26);
        window.setTimeout(() => this.noiseBurst(0.12, 0.2, 2100, 1.2), 24);
        break;
    }
  }

  jump() {
    this.noiseBurst(0.12, 0.1, 560, 0.6);
    this.tone(240, 0.13, 0.06, 'sine', 210);
  }

  doubleJump() {
    this.noiseBurst(0.16, 0.14, 980, 0.8);
    this.tone(430, 0.17, 0.09, 'sine', 330);
  }

  land(force: number) {
    this.noiseBurst(0.11 * force, 0.1 + force * 0.13, 210, 0.5);
    this.tone(70, 0.1, 0.08 + force * 0.08, 'sine', -20);
  }

  chain() {
    this.tone(1500, 0.05, 0.09, 'square', -700);
    window.setTimeout(() => this.tone(2100, 0.04, 0.06, 'square', -900), 35);
  }

  shockwave() {
    this.noiseBurst(0.34, 0.34, 260, 0.5);
    this.tone(52, 0.3, 0.32, 'triangle', -18);
  }

  refund() {
    this.tone(1250, 0.04, 0.06, 'square');
  }

  guardian() {
    this.noiseBurst(0.5, 0.3, 320, 0.4);
    this.tone(196, 0.5, 0.16, 'sine', -40);
    window.setTimeout(() => this.tone(392, 0.6, 0.13, 'sine', 20), 90);
    window.setTimeout(() => this.tone(587, 0.7, 0.1, 'sine', 30), 200);
  }

  shadowstep() {
    this.noiseBurst(0.26, 0.22, 1400, 1.1);
    this.tone(880, 0.18, 0.1, 'sine', -640);
    window.setTimeout(() => this.tone(520, 0.22, 0.08, 'sine', -300), 60);
    window.setTimeout(() => this.noiseBurst(0.2, 0.14, 2400, 1.4), 40);
  }

  slash(combo = 1) {
    this.noiseBurst(0.16, 0.18, 2600 - combo * 180, 1.6);
    this.tone(720 + combo * 60, 0.1, 0.08, 'triangle', -420);
    window.setTimeout(() => this.noiseBurst(0.1, 0.1, 3900, 2), 34);
  }

  swordArt(kind: 'dash' | 'wave' | 'nova') {
    if (kind === 'dash') {
      this.noiseBurst(0.28, 0.24, 3100, 2.2);
      this.tone(980, 0.16, 0.1, 'triangle', -720);
      window.setTimeout(() => this.noiseBurst(0.18, 0.16, 1200, 0.8), 30);
      return;
    }
    if (kind === 'wave') {
      this.noiseBurst(0.4, 0.26, 1900, 1.3);
      this.tone(340, 0.32, 0.14, 'sawtooth', 620);
      window.setTimeout(() => this.tone(880, 0.24, 0.09, 'triangle', -520), 70);
      return;
    }
    this.noiseBurst(0.55, 0.4, 300, 0.5);
    this.tone(64, 0.5, 0.4, 'triangle', -22);
    window.setTimeout(() => this.tone(196, 0.6, 0.14, 'sine', 140), 90);
    window.setTimeout(() => this.noiseBurst(0.35, 0.2, 2400, 1.6), 130);
  }

  cast() {
    this.noiseBurst(0.6, 0.22, 280, 0.6);
    this.tone(130, 0.55, 0.16, 'triangle', 110);
    window.setTimeout(() => this.tone(196, 0.7, 0.12, 'sine', 180), 120);
    window.setTimeout(() => this.tone(392, 0.8, 0.09, 'sine', 240), 260);
  }

  portal() {
    this.noiseBurst(0.5, 0.2, 760, 1.8);
    this.tone(420, 0.7, 0.1, 'sine', -320);
    window.setTimeout(() => this.noiseBurst(0.34, 0.16, 2200, 2.2), 80);
    window.setTimeout(() => this.tone(640, 0.5, 0.09, 'triangle', -400), 120);
  }

  alert() {
    this.tone(120, 0.12, 0.14, 'square', -30);
    window.setTimeout(() => this.tone(160, 0.1, 0.1, 'square', -20), 70);
  }

  select(tier: SelectTier) {
    if (tier === 'divine') {
      this.tone(523, 0.22, 0.1, 'sine');
      window.setTimeout(() => this.tone(784, 0.25, 0.1, 'sine'), 90);
      window.setTimeout(() => this.tone(1046, 0.34, 0.09, 'sine'), 190);
      return;
    }
    if (tier === 'mythic') {
      this.tone(392, 0.18, 0.09, 'sine');
      window.setTimeout(() => this.tone(587, 0.24, 0.08, 'sine'), 80);
      return;
    }
    this.tone(660, 0.07, 0.06, 'square');
  }

  empty() {
    this.tone(2400, 0.03, 0.08, 'square');
  }

  reload() {
    this.tone(700, 0.035, 0.09, 'square');
    window.setTimeout(() => this.tone(500, 0.05, 0.08, 'square'), 120);
  }

  switched() {
    this.tone(900, 0.03, 0.06, 'square');
  }

  hit(headshot: boolean) {
    this.tone(headshot ? 1650 : 1150, 0.045, 0.14, 'sine');
    if (headshot) this.tone(2100, 0.05, 0.1, 'sine');
  }

  kill() {
    this.tone(180, 0.14, 0.16, 'triangle', -80);
  }

  hurt() {
    this.noiseBurst(0.2, 0.35, 320, 0.7);
    this.tone(90, 0.2, 0.2, 'sine', -30);
  }

  /** Secondary technique. Each class family gets its own timbre. */
  technique(kind: string) {
    switch (kind) {
      case 'breach':
        this.noiseBurst(0.34, 0.42, 220, 0.5);
        this.tone(72, 0.3, 0.34, 'triangle', -30);
        window.setTimeout(() => this.noiseBurst(0.16, 0.24, 1400, 1.2), 40);
        break;
      case 'carrion':
        this.noiseBurst(0.42, 0.3, 900, 1.5);
        this.tone(160, 0.36, 0.2, 'sawtooth', 220);
        window.setTimeout(() => this.tone(300, 0.2, 0.12, 'triangle', 320), 90);
        break;
      case 'sanguine':
        this.tone(392, 0.5, 0.12, 'sine', 120);
        window.setTimeout(() => this.tone(523, 0.55, 0.1, 'sine', -60), 110);
        window.setTimeout(() => this.noiseBurst(0.5, 0.18, 620, 1.8), 40);
        break;
      case 'quake':
        this.noiseBurst(0.6, 0.55, 150, 0.4);
        this.tone(44, 0.6, 0.5, 'triangle', -18);
        window.setTimeout(() => this.noiseBurst(0.3, 0.28, 420, 0.5), 80);
        break;
      case 'aegis':
        this.tone(261, 0.7, 0.14, 'sine', 20);
        window.setTimeout(() => this.tone(392, 0.8, 0.12, 'sine', 30), 100);
        window.setTimeout(() => this.tone(523, 0.9, 0.1, 'sine', 40), 220);
        this.noiseBurst(0.5, 0.14, 480, 0.8);
        break;
      case 'inferno':
        this.noiseBurst(0.55, 0.48, 700, 0.6);
        this.tone(96, 0.5, 0.34, 'sawtooth', 130);
        window.setTimeout(() => this.noiseBurst(0.34, 0.3, 1500, 1.1), 120);
        window.setTimeout(() => this.tone(220, 0.3, 0.16, 'triangle', 180), 180);
        break;
      case 'blinkstrike':
        this.noiseBurst(0.2, 0.24, 3200, 2.4);
        this.tone(1500, 0.12, 0.12, 'triangle', -1100);
        window.setTimeout(() => this.tone(760, 0.2, 0.1, 'triangle', 420), 60);
        break;
      case 'banner':
        this.tone(196, 0.6, 0.16, 'sine', 10);
        window.setTimeout(() => this.tone(294, 0.7, 0.13, 'sine', 20), 120);
        window.setTimeout(() => this.tone(392, 0.8, 0.11, 'sine', 30), 250);
        window.setTimeout(() => this.tone(587, 0.9, 0.09, 'sine', 40), 400);
        break;
      default:
        this.cast();
        break;
    }
  }

  instinct() {
    this.noiseBurst(0.22, 0.2, 2600, 2.2);
    this.tone(880, 0.16, 0.1, 'sine', 640);
    window.setTimeout(() => this.tone(1320, 0.22, 0.08, 'sine', -220), 60);
  }

  perfectDodge() {
    this.tone(1760, 0.06, 0.12, 'sine');
    window.setTimeout(() => this.tone(2340, 0.08, 0.1, 'sine'), 45);
    window.setTimeout(() => this.noiseBurst(0.12, 0.1, 3600, 2.6), 25);
  }

  bossRoar() {
    this.noiseBurst(0.9, 0.5, 180, 0.4);
    this.tone(58, 0.9, 0.42, 'sawtooth', 26);
    this.tone(87, 0.8, 0.22, 'triangle', -12);
    window.setTimeout(() => this.tone(116, 0.7, 0.18, 'sawtooth', -20), 200);
  }

  bossSlam() {
    this.noiseBurst(0.7, 0.58, 130, 0.35);
    this.tone(38, 0.7, 0.55, 'triangle', -14);
    window.setTimeout(() => this.noiseBurst(0.4, 0.3, 520, 0.5), 90);
  }

  bossDown() {
    this.noiseBurst(1.1, 0.5, 200, 0.4);
    this.tone(110, 1.0, 0.4, 'triangle', -70);
    window.setTimeout(() => this.tone(74, 1.2, 0.34, 'sine', -40), 260);
    window.setTimeout(() => this.tone(49, 1.4, 0.28, 'sine', -20), 560);
  }

  waveClear() {
    this.tone(520, 0.14, 0.1, 'sine');
    window.setTimeout(() => this.tone(700, 0.18, 0.1, 'sine'), 130);
    window.setTimeout(() => this.tone(940, 0.26, 0.1, 'sine'), 270);
  }

  gameOver() {
    this.tone(220, 0.5, 0.16, 'triangle', -140);
    window.setTimeout(() => this.tone(160, 0.7, 0.14, 'triangle', -90), 220);
  }
}

export const sfx = new Sfx();
