type WebkitWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

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
    gain.gain.value = 0.34;
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
    this.buffers.set('bgm', makeMelody(this.context));
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
    const ignition = t < 0.34 ? Math.sin(Math.PI * t / 0.34) ** 0.45 : 0;
    const rumble = Math.sin(2 * Math.PI * (62 - t * 11) * t)
      + 0.48 * Math.sin(2 * Math.PI * 94 * t);
    const burnEnvelope = Math.max(0, 1 - t / duration) ** 0.52;
    const crackleGate = Math.max(0, Math.sin(t * 97) * Math.sin(t * 173));
    data[i] = (
      ignition * (noise * 0.48 + rumble * 0.34)
      + burnEnvelope * noise * (0.16 + crackleGate * 0.18)
      + rumble * burnEnvelope * 0.08
    ) * 0.48;
  }
  return buffer;
}

function makeMelody(context: AudioContext): AudioBuffer {
  const duration = 3.2;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const data = buffer.getChannelData(0);
  const notes = [293.7, 392, 440, 392, 329.6, 440, 523.3, 440];
  const noteLength = duration / notes.length;
  for (let i = 0; i < data.length; i += 1) {
    const t = i / context.sampleRate;
    const noteIndex = Math.min(notes.length - 1, Math.floor(t / noteLength));
    const local = (t % noteLength) / noteLength;
    const envelope = Math.sin(Math.PI * local) ** 1.6;
    const wave = Math.sin(2 * Math.PI * notes[noteIndex] * t)
      + 0.3 * Math.sin(2 * Math.PI * notes[noteIndex] * 2 * t);
    data[i] = wave * envelope * 0.11;
  }
  return buffer;
}
