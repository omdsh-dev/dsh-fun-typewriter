/**
 * WebAudio synthesis recipes for the typewriter ambience — zero audio assets.
 * Every voice is a scheduled graph of noise-buffer sources, biquad filters,
 * and oscillators over one shared master gain. All times are absolute
 * `AudioContext.currentTime` values so overlapping voices mix cleanly.
 *
 * Voice map:
 * - click(profile): the stream cadence sound, three timbres (see below).
 * - keyTick:        crisp input-field keystroke tick.
 * - sendClack:      low "thock" rebound when a prompt is sent.
 * - ding(pitch):    bell with 1.5×/2× overtones (turn complete).
 * - buzz:           square-wave error/interrupt buzz.
 */

export type ClickProfile = 'light' | 'classic' | 'mechanical'

/** 1s of white noise, shared by every noise voice of one AudioContext. */
export function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1
  return buffer
}

interface NoiseBurstOptions {
  /** Absolute start time. */
  when: number
  /** Total envelope length in seconds. */
  duration: number
  /** Peak gain (0-1), pre-master. */
  peak: number
  /** Filter center frequency in Hz. */
  center: number
  /** Filter quality. */
  q?: number
  /** Biquad filter type (bandpass default). */
  type?: BiquadFilterType
  /** Attack ramp in seconds. */
  attack?: number
}

interface ToneOptions {
  /** Absolute start time. */
  when: number
  /** Oscillator frequency in Hz. */
  freq: number
  /** Optional glide target in Hz (exponential ramp over the envelope). */
  freqEnd?: number
  /** Total envelope length in seconds. */
  duration: number
  /** Peak gain (0-1), pre-master. */
  peak: number
  /** Oscillator waveform (sine default). */
  type?: OscillatorType
  /** Attack ramp in seconds. */
  attack?: number
}

/**
 * Synthesizer over one AudioContext. Instantiated by the SoundEngine when the
 * browser first grants audio through a user gesture.
 */
export class Synth {
  readonly ctx: AudioContext

  /** Single master bus between every voice and the destination. */
  readonly master: GainNode

  private readonly noise: AudioBuffer

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 1
    this.master.connect(ctx.destination)
    this.noise = createNoiseBuffer(ctx)
  }

  /** Filtered noise pulse with an exponential attack/decay envelope. */
  private noiseBurst(options: NoiseBurstOptions): void {
    const { when, duration, peak, center, q = 1, type = 'bandpass', attack = 0.001 } = options
    const source = this.ctx.createBufferSource()
    source.buffer = this.noise
    const filter = this.ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = center
    filter.Q.value = q
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), when + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    source.start(when)
    source.stop(when + duration + 0.02)
  }

  /** Oscillator tone with an exponential attack/decay envelope. */
  private tone(options: ToneOptions): void {
    const { when, freq, freqEnd, duration, peak, type = 'sine', attack = 0.001 } = options
    const osc = this.ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq, when)
    if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(freqEnd, when + duration)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), when + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(when)
    osc.stop(when + duration + 0.02)
  }

  /**
   * One stream cadence click.
   * - light:       crisp high-frequency click, short decay.
   * - classic:     mid-frequency noise "clack" plus a second low short pulse
   *                30ms later (the "咔-回" double strike).
   * - mechanical:  low-frequency knock with a slight 0.2s low-pass tail.
   * @param profile - timbre selection.
   * @param level - master volume (0-1).
   */
  click(profile: ClickProfile, level: number): void {
    const t = this.ctx.currentTime + 0.001
    switch (profile) {
      case 'light':
        this.noiseBurst({ when: t, duration: 0.03, peak: 0.9 * level, center: 4000, q: 1.2 })
        this.tone({ when: t, freq: 3200, duration: 0.03, peak: 0.25 * level })
        break
      case 'classic':
        this.noiseBurst({ when: t, duration: 0.035, peak: 0.8 * level, center: 2200, q: 0.9 })
        this.tone({ when: t, freq: 260, duration: 0.05, peak: 0.35 * level })
        this.noiseBurst({ when: t + 0.03, duration: 0.025, peak: 0.45 * level, center: 900, q: 0.8 })
        break
      case 'mechanical':
        this.tone({ when: t, freq: 150, duration: 0.04, peak: 0.5 * level })
        this.noiseBurst({ when: t, duration: 0.03, peak: 0.7 * level, center: 1200, q: 0.7, type: 'lowpass' })
        this.noiseBurst({ when: t, duration: 0.2, peak: 0.18 * level, center: 600, q: 0.5, type: 'lowpass' })
        break
    }
  }

  /** Crisp input-field keystroke tick (typing sound). */
  keyTick(level: number): void {
    const t = this.ctx.currentTime + 0.001
    this.tone({ when: t, freq: 3000, duration: 0.012, peak: 0.18 * level })
    this.noiseBurst({ when: t, duration: 0.012, peak: 0.3 * level, center: 6000, q: 0.7, type: 'highpass' })
  }

  /** Low rebound "thock" when a prompt is sent. */
  sendClack(level: number): void {
    const t = this.ctx.currentTime + 0.001
    this.tone({ when: t, freq: 190, freqEnd: 140, duration: 0.07, peak: 0.4 * level })
    this.noiseBurst({ when: t, duration: 0.03, peak: 0.5 * level, center: 1500, q: 0.8 })
  }

  /** Bell-style turn-complete ding: base pitch plus 1.5×/2× overtones, 1s decay. */
  ding(pitch: number, level: number): void {
    const t = this.ctx.currentTime + 0.001
    this.tone({ when: t, freq: pitch, duration: 1, peak: 0.35 * level, attack: 0.004 })
    this.tone({ when: t, freq: pitch * 1.5, duration: 0.8, peak: 0.22 * level, attack: 0.004 })
    this.tone({ when: t, freq: pitch * 2, duration: 0.6, peak: 0.1 * level, attack: 0.004 })
  }

  /** Error/interrupt buzz: 180Hz square wave with a slight downward glide. */
  buzz(level: number): void {
    const t = this.ctx.currentTime + 0.001
    this.tone({ when: t, freq: 180, freqEnd: 150, duration: 0.4, peak: 0.3 * level, type: 'square', attack: 0.01 })
  }
}
