// Procedural spooky audio via the Web Audio API: a low ambient drone plus a
// short synthesized tone per category when a place is opened. No audio files,
// so nothing to host or license. The AudioContext is created lazily inside a
// user gesture (the sound toggle), per browser autoplay policy.

type Voice = { freqs: number[]; type: OscillatorType; dur: number; gap: number };

// A distinct little voice per category (pitch set + waveform + timing).
const VOICES: Record<string, Voice> = {
  church: { freqs: [392, 587, 784], type: "sine", dur: 1.9, gap: 0 },
  graveyard: { freqs: [98, 131], type: "sine", dur: 1.7, gap: 0 },
  ruins: { freqs: [110, 147], type: "sine", dur: 1.5, gap: 0 },
  rail: { freqs: [330, 494], type: "sawtooth", dur: 0.45, gap: 0.14 },
  hospital: { freqs: [880, 932], type: "sine", dur: 1.3, gap: 0 },
  house: { freqs: [196, 185], type: "triangle", dur: 0.5, gap: 0.1 },
  hotel: { freqs: [262, 247], type: "triangle", dur: 0.5, gap: 0.1 },
  factory: { freqs: [73, 110], type: "square", dur: 0.45, gap: 0.08 },
  mine: { freqs: [62, 93], type: "square", dur: 0.6, gap: 0.1 },
  military: { freqs: [82, 82], type: "square", dur: 0.4, gap: 0.07 },
  jail: { freqs: [147, 110], type: "square", dur: 0.5, gap: 0.09 },
  castle: { freqs: [165, 247], type: "sawtooth", dur: 0.7, gap: 0 },
  theater: { freqs: [523, 659, 784], type: "triangle", dur: 0.9, gap: 0.1 },
  school: { freqs: [659, 880], type: "square", dur: 0.45, gap: 0.12 },
  lighthouse: { freqs: [110], type: "sine", dur: 1.4, gap: 0 },
  bridge: { freqs: [123, 92], type: "sine", dur: 1.0, gap: 0 },
};

const DEFAULT_VOICE: Voice = { freqs: [220, 277], type: "sine", dur: 0.8, gap: 0 };

class SpookyAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null; // drone level
  private droneStarted = false;
  enabled = false;

  private ensure() {
    if (this.ctx) return;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(this.ctx.destination);
  }

  isEnabled() {
    return this.enabled;
  }

  async toggle(): Promise<boolean> {
    if (this.enabled) {
      this.disable();
      return false;
    }
    await this.enable();
    return true;
  }

  async enable() {
    this.ensure();
    const ctx = this.ctx!;
    const master = this.master!;
    await ctx.resume();
    if (!this.droneStarted) this.startDrone();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 1.5);
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setValueAtTime(this.master.gain.value, ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
  }

  private startDrone() {
    const ctx = this.ctx!;
    const drone = ctx.createGain();
    drone.gain.value = 0.5;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 360;
    drone.connect(filter);
    filter.connect(this.master!);

    [55, 55.6, 82.4].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 2 ? "triangle" : "sine";
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = i === 2 ? 0.3 : 0.5;
      osc.connect(g);
      g.connect(drone);
      osc.start();
    });

    // Slow swell so the drone breathes rather than sitting flat.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.35;
    lfo.connect(lfoGain);
    lfoGain.connect(drone.gain);
    lfo.start();

    this.droneStarted = true;
  }

  playCategory(category: string) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const voice = VOICES[category] ?? DEFAULT_VOICE;
    voice.freqs.forEach((freq, i) => {
      const t0 = ctx.currentTime + i * voice.gap;
      const osc = ctx.createOscillator();
      osc.type = voice.type;
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.28, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + voice.dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + voice.dur + 0.05);
    });
  }
}

export const spookyAudio = new SpookyAudio();
