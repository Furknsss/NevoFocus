/**
 * Web Audio API synthesizer for ambient study background sounds and focus session bells.
 * Zero external mp3 dependencies, 100% offline, guaranteed instant playback.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private currentAmbient: string | null = null;
  private ambientGainNode: GainNode | null = null;
  private ambientNodes: { stop?: () => void; interval?: number } = {};
  private masterGain: GainNode | null = null;
  private volume: number = 0.45;
  private isMuted: boolean = false;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getCurrentAmbient(): string | null {
    return this.currentAmbient;
  }

  public stopAmbient() {
    if (this.ambientNodes.stop) {
      try {
        this.ambientNodes.stop();
      } catch {
        // ignore
      }
    }
    if (this.ambientNodes.interval) {
      window.clearInterval(this.ambientNodes.interval);
    }
    this.ambientNodes = {};
    this.currentAmbient = null;
  }

  public playAmbient(type: 'rain' | 'forest' | 'white_noise' | 'airplane' | 'ocean' | 'campfire' | 'off' | string) {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    this.stopAmbient();
    if (type === 'off') return;

    this.currentAmbient = type;
    const ctx = this.ctx;
    const ambientGain = ctx.createGain();
    ambientGain.gain.setValueAtTime(0.7, ctx.currentTime);
    ambientGain.connect(this.masterGain);
    this.ambientGainNode = ambientGain;

    if (type === 'rain') {
      // Pink noise + low pass + bandpass to simulate soothing continuous rain
      const bufferSize = 2 * ctx.sampleRate;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
        b6 = white * 0.115926;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, ctx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(ambientGain);
      whiteNoise.start();

      this.ambientNodes.stop = () => {
        try {
          whiteNoise.stop();
          whiteNoise.disconnect();
        } catch {
          // ignore
        }
      };
    } else if (type === 'forest') {
      // Wind breeze + periodic gentle bird chirps
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, ctx.currentTime);

      const breezeGain = ctx.createGain();
      breezeGain.gain.setValueAtTime(0.04, ctx.currentTime);
      osc.connect(breezeGain);
      breezeGain.connect(ambientGain);
      osc.start();

      const chirpInterval = window.setInterval(() => {
        if (!this.ctx || this.currentAmbient !== 'forest') return;
        const now = this.ctx.currentTime;
        const birdOsc = this.ctx.createOscillator();
        const birdGain = this.ctx.createGain();
        birdOsc.type = 'sine';
        const startFreq = 2200 + Math.random() * 800;
        birdOsc.frequency.setValueAtTime(startFreq, now);
        birdOsc.frequency.exponentialRampToValueAtTime(startFreq * 1.4, now + 0.08);
        birdOsc.frequency.exponentialRampToValueAtTime(startFreq * 0.9, now + 0.16);

        birdGain.gain.setValueAtTime(0, now);
        birdGain.gain.linearRampToValueAtTime(0.08, now + 0.02);
        birdGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

        birdOsc.connect(birdGain);
        birdGain.connect(ambientGain);
        birdOsc.start(now);
        birdOsc.stop(now + 0.25);
      }, 3500);

      this.ambientNodes.stop = () => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // ignore
        }
      };
      this.ambientNodes.interval = chirpInterval;
    } else if (type === 'airplane') {
      // Deep cabin engine drone
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(78, ctx.currentTime);
      osc2.frequency.setValueAtTime(124, ctx.currentTime);

      const cabinFilter = ctx.createBiquadFilter();
      cabinFilter.type = 'lowpass';
      cabinFilter.frequency.setValueAtTime(220, ctx.currentTime);

      const droneGain = ctx.createGain();
      droneGain.gain.setValueAtTime(0.12, ctx.currentTime);

      osc1.connect(cabinFilter);
      osc2.connect(cabinFilter);
      cabinFilter.connect(droneGain);
      droneGain.connect(ambientGain);

      osc1.start();
      osc2.start();

      this.ambientNodes.stop = () => {
        try {
          osc1.stop();
          osc2.stop();
          osc1.disconnect();
          osc2.disconnect();
        } catch {
          // ignore
        }
      };
    } else if (type === 'ocean') {
      // Low rolling ocean waves
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(55, ctx.currentTime);

      const waveFilter = ctx.createBiquadFilter();
      waveFilter.type = 'lowpass';
      waveFilter.frequency.setValueAtTime(280, ctx.currentTime);

      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.15, ctx.currentTime); // slow wave rhythm
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(140, ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(waveFilter.frequency);

      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.18, ctx.currentTime);

      osc.connect(waveFilter);
      waveFilter.connect(subGain);
      subGain.connect(ambientGain);

      osc.start();
      lfo.start();

      this.ambientNodes.stop = () => {
        try {
          osc.stop();
          lfo.stop();
          osc.disconnect();
          lfo.disconnect();
        } catch {
          // ignore
        }
      };
    } else if (type === 'campfire' || type === 'white_noise') {
      // Soft broadband noise
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.05;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(type === 'campfire' ? 650 : 1200, ctx.currentTime);
      filter.Q.setValueAtTime(0.7, ctx.currentTime);

      noise.connect(filter);
      filter.connect(ambientGain);
      noise.start();

      this.ambientNodes.stop = () => {
        try {
          noise.stop();
          noise.disconnect();
        } catch {
          // ignore
        }
      };
    }
  }

  /**
   * Serene Tibetan / Zen crystal bell chime when study session completes
   */
  public playCompletionBell() {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const freqs = [528, 792, 1056, 1584]; // Harmonious 528Hz Solfeggio frequency

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      const peakGain = 0.15 / (idx + 1);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(peakGain, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.00001, now + 3.8);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + 4.0);
    });
  }

  /**
   * Subtle tactile click sound
   */
  public playClick() {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.03);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.035);
  }

  /**
   * Cinematic universe portal swoosh sound
   */
  public playSwoosh() {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.35);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.9);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 1.0);
  }
}

export const soundEngine = new SoundEngine();
