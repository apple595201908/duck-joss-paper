type WebkitWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

export const TEMPLE_BGM_DURATION_SECONDS = 12.8;

export interface TempleFestivalBgmData {
  durationSeconds: number;
  sampleRate: number;
  left: Float32Array;
  right: Float32Array;
}

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private bgm: AudioBufferSourceNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private muted = false;

  constructor(muted: boolean) {
    this.muted = muted;
  }

  async unlock(): Promise<void> {
    if (!this.context) {
      const AudioContextCtor = window.AudioContext || (window as WebkitWindow).webkitAudioContext;
      if (!AudioContextCtor) return;
      this.context = new AudioContextCtor();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.22;
      this.master.connect(this.context.destination);
      this.createBuffers();
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.22, this.context.currentTime, 0.02);
    }
  }

  setPaused(paused: boolean) {
    if (!this.context) return;
    if (paused && this.context.state === 'running') void this.context.suspend();
    if (!paused && this.context.state === 'suspended') void this.context.resume();
  }

  startBgm() {
    if (!this.context || !this.master || this.bgm) return;
    const buffer = this.buffers.get('bgm');
    if (!buffer) return;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = this.context.createGain();
    gain.gain.value = 0.42;
    source.connect(gain).connect(this.master);
    source.start();
    this.bgm = source;
  }

  stopBgm() {
    this.bgm?.stop();
    this.bgm = null;
  }

  playReady() { this.play('ready', 0.65); }
  playGo() { this.play('go', 0.72); }
  playPaperToss() { this.play('paperToss', 0.48); }
  playClear() { this.play('clear', 0.82); }
  playFlare() { this.play('flare', 0.92); }
  playFail() { this.play('fail', 0.76); }

  destroy() {
    this.stopBgm();
    void this.context?.close();
    this.context = null;
  }

  private play(name: string, volume: number) {
    if (!this.context || !this.master) return;
    const buffer = this.buffers.get(name);
    if (!buffer) return;
    // A new source is used for every toss, so close taps can overlap cleanly.
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain).connect(this.master);
    source.start();
  }

  private createBuffers() {
    if (!this.context) return;
    this.buffers.set('bgm', makeTempleFestivalBgm(this.context));
    this.buffers.set('ready', makeTone(this.context, [392, 523], 0.34, 'triangle'));
    this.buffers.set('go', makeTone(this.context, [523, 784], 0.27, 'square'));
    this.buffers.set('paperToss', makePaperWhoosh(this.context));
    this.buffers.set('clear', makeTone(this.context, [523, 659, 784, 1046], 0.72, 'triangle'));
    this.buffers.set('flare', makeFurnaceFlare(this.context));
    this.buffers.set('fail', makeTone(this.context, [330, 247, 196], 0.58, 'sawtooth'));
  }
}

function makeTone(context: AudioContext, notes: number[], duration: number, shape: OscillatorType): AudioBuffer {
  const sampleRate = context.sampleRate;
  const buffer = context.createBuffer(1, Math.ceil(sampleRate * duration), sampleRate);
  const data = buffer.getChannelData(0);
  const segment = data.length / notes.length;
  for (let i = 0; i < data.length; i += 1) {
    const note = notes[Math.min(notes.length - 1, Math.floor(i / segment))];
    const phase = (i * note / sampleRate) % 1;
    const wave = shape === 'square' ? (phase < 0.5 ? 1 : -1)
      : shape === 'sawtooth' ? phase * 2 - 1
        : 1 - 4 * Math.abs(Math.round(phase) - phase);
    const envelope = Math.sin(Math.PI * i / data.length) ** 0.7;
    data[i] = wave * envelope * 0.26;
  }
  return buffer;
}

function makePaperWhoosh(context: AudioContext): AudioBuffer {
  const duration = 0.13;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    const t = i / context.sampleRate;
    const seed = Math.sin(i * 12.9898) * 43_758.5453;
    const noise = (seed - Math.floor(seed)) * 2 - 1;
    const flutter = Math.sin(2 * Math.PI * (1_150 - t * 4_100) * t);
    data[i] = (noise * 0.42 + flutter * 0.24) * Math.exp(-t * 31) * 0.46;
  }
  return buffer;
}

function makeFurnaceFlare(context: AudioContext): AudioBuffer {
  const duration = 2.2;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    const t = i / context.sampleRate;
    const seed = Math.sin(i * 17.123 + 0.91) * 91_341.732;
    const noise = (seed - Math.floor(seed)) * 2 - 1;
    const rise = Math.min(1, t / 0.24);
    const fade = t < 1.72 ? 1 : Math.max(0, 1 - (t - 1.72) / 0.48);
    const roar = noise * (0.22 + Math.sin(t * 7.4) * 0.045);
    const lowFlame = Math.sin(2 * Math.PI * 74 * t) * 0.10
      + Math.sin(2 * Math.PI * 111 * t) * 0.055;
    const crackleGate = Math.max(0, Math.sin(t * 97) * Math.sin(t * 173));
    const crackle = noise * crackleGate * 0.13;
    data[i] = (roar + lowFlame + crackle) * rise * fade * 0.52;
  }
  return buffer;
}

function makeTempleFestivalBgm(context: AudioContext): AudioBuffer {
  const rendered = renderTempleFestivalBgm(context.sampleRate);
  const buffer = context.createBuffer(2, rendered.left.length, rendered.sampleRate);
  buffer.getChannelData(0).set(rendered.left);
  buffer.getChannelData(1).set(rendered.right);
  return buffer;
}

/**
 * Renders an original temple-festival loop with no downloaded recordings or samples.
 * Its timbre references the suona, tanggu, gong, cymbals, and bangzi palette used by
 * Taiwanese Beiguan ensembles, while the melody and arrangement are original.
 */
export function renderTempleFestivalBgm(sampleRate: number): TempleFestivalBgmData {
  if (!Number.isFinite(sampleRate) || sampleRate < 8_000) {
    throw new RangeError('Temple BGM sample rate must be at least 8000 Hz');
  }

  const durationSeconds = TEMPLE_BGM_DURATION_SECONDS;
  const length = Math.ceil(sampleRate * durationSeconds);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  const halfBeat = 0.2;
  const tau = Math.PI * 2;

  const mix = (index: number, value: number, pan = 0) => {
    if (index < 0 || index >= length) return;
    const normalizedPan = Math.max(-1, Math.min(1, pan));
    const leftGain = Math.cos((normalizedPan + 1) * Math.PI / 4);
    const rightGain = Math.sin((normalizedPan + 1) * Math.PI / 4);
    left[index] += value * leftGain;
    right[index] += value * rightGain;
  };

  const noiseAt = (index: number, salt: number) => {
    const value = Math.sin((index + 1) * (12.9898 + salt * 0.713)) * 43_758.5453;
    return (value - Math.floor(value)) * 2 - 1;
  };

  const addSuona = (start: number, duration: number, frequency: number, gain: number, pan: number) => {
    const startIndex = Math.floor(start * sampleRate);
    const sampleCount = Math.ceil(duration * sampleRate);
    for (let offset = 0; offset < sampleCount; offset += 1) {
      const t = offset / sampleRate;
      const attack = Math.min(1, t / 0.025);
      const release = Math.min(1, Math.max(0, duration - t) / 0.075);
      const pulse = 0.92 + Math.sin(t * tau * 8) * 0.08;
      const phase = tau * frequency * t + Math.sin(t * tau * 5.3) * 0.13;
      const reed = Math.sin(phase)
        + Math.sin(phase * 2) * 0.38
        + Math.sin(phase * 3) * 0.22
        + Math.sin(phase * 5) * 0.08;
      const breath = noiseAt(startIndex + offset, 2.7) * 0.035;
      mix(startIndex + offset, (reed * 0.54 + breath) * attack * release * pulse * gain, pan);
    }
  };

  const addPluck = (start: number, duration: number, frequency: number, gain: number, pan: number) => {
    const startIndex = Math.floor(start * sampleRate);
    const sampleCount = Math.ceil(duration * sampleRate);
    for (let offset = 0; offset < sampleCount; offset += 1) {
      const t = offset / sampleRate;
      const envelope = Math.exp(-t * 6.8) * Math.min(1, t / 0.004);
      const phase = tau * frequency * t;
      const string = Math.sin(phase) + Math.sin(phase * 2.01) * 0.34 + Math.sin(phase * 3.98) * 0.12;
      mix(startIndex + offset, string * envelope * gain, pan);
    }
  };

  const addTanggu = (start: number, accent: number) => {
    const duration = 0.24;
    const startIndex = Math.floor(start * sampleRate);
    for (let offset = 0; offset < duration * sampleRate; offset += 1) {
      const t = offset / sampleRate;
      const frequency = 122 - t * 185;
      const body = Math.sin(tau * frequency * t) * Math.exp(-t * 15);
      const skin = noiseAt(startIndex + offset, 4.1) * Math.exp(-t * 48);
      mix(startIndex + offset, (body * 0.82 + skin * 0.18) * 0.17 * accent, -0.08);
    }
  };

  const addBangzi = (start: number, pan: number) => {
    const duration = 0.075;
    const startIndex = Math.floor(start * sampleRate);
    for (let offset = 0; offset < duration * sampleRate; offset += 1) {
      const t = offset / sampleRate;
      const knock = Math.sin(tau * 1_490 * t) + Math.sin(tau * 2_370 * t) * 0.44;
      mix(startIndex + offset, knock * Math.exp(-t * 52) * 0.075, pan);
    }
  };

  const addCymbal = (start: number, gain: number, pan: number) => {
    const duration = 0.42;
    const startIndex = Math.floor(start * sampleRate);
    let previousNoise = 0;
    for (let offset = 0; offset < duration * sampleRate; offset += 1) {
      const t = offset / sampleRate;
      const noise = noiseAt(startIndex + offset, 7.9);
      const brightNoise = noise - previousNoise * 0.72;
      previousNoise = noise;
      const shimmer = Math.sin(tau * 3_180 * t) * 0.16 + Math.sin(tau * 4_730 * t) * 0.11;
      mix(startIndex + offset, (brightNoise * 0.34 + shimmer) * Math.exp(-t * 8.5) * gain, pan);
    }
  };

  const addGong = (start: number, gain: number) => {
    const duration = 1.8;
    const startIndex = Math.floor(start * sampleRate);
    for (let offset = 0; offset < duration * sampleRate; offset += 1) {
      const t = offset / sampleRate;
      const bloom = Math.min(1, t / 0.035) * Math.exp(-t * 1.9);
      const metal = Math.sin(tau * 146 * t)
        + Math.sin(tau * 231 * t) * 0.58
        + Math.sin(tau * 364 * t) * 0.33
        + Math.sin(tau * 587 * t) * 0.16;
      mix(startIndex + offset, metal * bloom * gain, 0.12);
    }
  };

  const G4 = 392;
  const A4 = 440;
  const B4 = 493.88;
  const D5 = 587.33;
  const E5 = 659.25;
  const G5 = 783.99;
  const melody: Array<number | null> = [
    G4, null, B4, D5, E5, null, D5, B4, A4, null, G4, A4, B4, D5, null, null,
    B4, null, D5, E5, G5, null, E5, D5, B4, A4, G4, null, A4, B4, null, null,
    G4, A4, B4, null, D5, B4, A4, G4, B4, null, D5, E5, D5, B4, null, A4,
    E5, null, D5, B4, A4, null, G4, A4, B4, D5, B4, A4, G4, null, null, null,
  ];

  melody.forEach((frequency, step) => {
    if (frequency === null) return;
    const holdsNextStep = melody[step + 1] === null;
    const noteDuration = holdsNextStep ? 0.34 : 0.18;
    addSuona(step * halfBeat, noteDuration, frequency, 0.082, step % 4 < 2 ? -0.14 : 0.14);
  });

  const bassRoots = [196, 293.66, 220, 293.66, 196, 246.94, 220, 293.66];
  for (let beat = 0; beat < 32; beat += 1) {
    const time = beat * halfBeat * 2;
    const barBeat = beat % 4;
    const root = bassRoots[Math.floor(beat / 4)];
    addPluck(time, 0.62, root, barBeat === 0 ? 0.085 : 0.058, barBeat % 2 === 0 ? -0.38 : 0.34);
    addTanggu(time, barBeat === 0 ? 1.18 : barBeat === 2 ? 0.94 : 0.68);
    addBangzi(time + halfBeat, barBeat % 2 === 0 ? 0.48 : -0.48);
    if (barBeat === 1 || barBeat === 3) addCymbal(time + halfBeat, 0.052, barBeat === 1 ? -0.3 : 0.3);
  }

  [0, 3.2, 6.4, 9.6].forEach((time, index) => {
    addGong(time, index === 0 ? 0.075 : 0.06);
    addCymbal(time, 0.075, index % 2 === 0 ? -0.22 : 0.22);
  });

  // A short courtyard echo makes the synthesized ensemble feel less dry.
  const echoDelay = Math.floor(sampleRate * 0.115);
  for (let i = echoDelay; i < length; i += 1) {
    left[i] += right[i - echoDelay] * 0.105;
    right[i] += left[i - echoDelay] * 0.105;
  }

  let peak = 0;
  for (let i = 0; i < length; i += 1) {
    const fadeIn = Math.min(1, i / (sampleRate * 0.025));
    const fadeOut = Math.min(1, (length - 1 - i) / (sampleRate * 0.08));
    const edgeEnvelope = Math.max(0, Math.min(fadeIn, fadeOut));
    left[i] *= edgeEnvelope;
    right[i] *= edgeEnvelope;
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }

  if (peak > 0.84) {
    const scale = 0.84 / peak;
    for (let i = 0; i < length; i += 1) {
      left[i] *= scale;
      right[i] *= scale;
    }
  }

  return { durationSeconds, sampleRate, left, right };
}
