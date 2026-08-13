/**
 * SoundEngine: the plugin's one audio owner. Lazily creates the AudioContext
 * (browser autoplay policy requires a user gesture), mirrors the durable
 * settings scope into an immutable config snapshot, exposes play/preview
 * entry points used by the stream listener, the key listener, the header mute
 * button, and the settings page, and routes every durable write through the
 * settings scope (optimistic local apply first, so a rejected write — e.g.
 * while the namespace is unexposed — still updates the live session).
 */
import {
  DEFAULT_TYPEWRITER_SETTINGS, type StreamProfile, type TypewriterSettings,
} from '../typewriter-settings.ts'
import { Synth } from './synth.ts'
import type { TypewriterSettingsClient } from './settings-client.ts'

/** Minimum gap between keystroke ticks (key auto-repeat flood guard). */
const KEY_TICK_MIN_INTERVAL_MS = 25

export class SoundEngine {
  private ctx: AudioContext | null = null
  private synth: Synth | null = null
  private config: TypewriterSettings = { ...DEFAULT_TYPEWRITER_SETTINGS }
  private readonly listeners = new Set<() => void>()
  private lastKeyTick = 0
  private readonly stopScope: () => void

  constructor(private readonly scope: TypewriterSettingsClient) {
    this.stopScope = this.scope.subscribe(() => { this.adopt() })
    this.adopt()
  }

  /**
   * Release the scope subscription and close the audio context. Called by the
   * plugin fiber on unload so no listener outlives the plugin.
   */
  dispose(): void {
    this.stopScope()
    this.listeners.clear()
    if (this.ctx !== null) void this.ctx.close().catch(() => {})
    this.ctx = null
    this.synth = null
  }

  /** Adopt the scope's accepted durable section without writing it back. */
  private adopt(): void {
    const value = this.scope.getSnapshot().value
    this.config = { ...DEFAULT_TYPEWRITER_SETTINGS, ...value }
    this.publish()
  }

  /** External store seam (useSyncExternalStore pair). */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Current immutable config snapshot (stable reference until the next change). */
  readonly getConfig = (): TypewriterSettings => this.config

  private publish(): void {
    for (const listener of [...this.listeners]) listener()
  }

  /** Lazy AudioContext creation + resume; idempotent, cheap on repeat gestures. */
  unlock(): void {
    if (this.ctx === null) {
      const AudioContextCtor = window.AudioContext
      if (AudioContextCtor === undefined) return
      this.ctx = new AudioContextCtor()
      this.synth = new Synth(this.ctx)
    }
    if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => {})
  }

  /** The live synth, or null until the context exists and is running. */
  private liveSynth(): Synth | null {
    if (this.synth === null || this.ctx === null || this.ctx.state !== 'running') return null
    return this.synth
  }

  /** Clamp a per-voice volume against the master volume. */
  private voice(volume: number): number {
    return Math.max(0, Math.min(1, volume * this.config.masterVolume))
  }

  /** One stream cadence click (current profile); respects master + stream switches. */
  playClick(profile?: StreamProfile): void {
    const synth = this.liveSynth()
    if (synth === null || !this.config.enabled || !this.config.streamEnabled) return
    synth.click(profile ?? this.config.streamProfile, this.config.masterVolume)
  }

  /** Input-field keystroke tick, throttled against key auto-repeat. */
  playKeyTick(): void {
    const synth = this.liveSynth()
    if (synth === null || !this.config.enabled || !this.config.typingEnabled) return
    const now = performance.now()
    if (now - this.lastKeyTick < KEY_TICK_MIN_INTERVAL_MS) return
    this.lastKeyTick = now
    synth.keyTick(0.6 * this.config.masterVolume)
  }

  /**
   * Short tick burst for an IME commit (composition process stays silent;
   * the landed text sounds). Ticks space ~30ms apart so the per-tick
   * throttle does not swallow them.
   * @param count - number of ticks (1-3).
   */
  playKeyBurst(count: number): void {
    this.playKeyTick()
    for (let i = 1; i < count; i += 1) {
      window.setTimeout(() => { this.playKeyTick() }, i * 30)
    }
  }

  /** Send rebound clack. */
  playSend(): void {
    const synth = this.liveSynth()
    if (synth === null || !this.config.enabled || !this.config.sendEnabled) return
    synth.sendClack(this.voice(this.config.sendVolume))
  }

  /** Turn-complete ding. */
  playDing(): void {
    const synth = this.liveSynth()
    if (synth === null || !this.config.enabled || !this.config.dingEnabled) return
    synth.ding(this.config.dingPitch, this.voice(0.8))
  }

  /** Error/interrupt buzz. */
  playBuzz(): void {
    const synth = this.liveSynth()
    if (synth === null || !this.config.enabled || !this.config.errorEnabled) return
    synth.buzz(this.voice(0.8))
  }

  /**
   * Settings-page stream preview: a click cadence at the configured interval
   * for ~3 seconds. Runs inside a click gesture, so it unlocks the context.
   */
  previewStream(profile: StreamProfile, durationMs = 3000): void {
    this.unlock()
    const synth = this.synth
    if (synth === null) return
    const interval = Math.max(60, this.config.streamIntervalMs)
    const end = performance.now() + durationMs
    const step = (): void => {
      if (performance.now() >= end) return
      synth.click(profile, this.config.masterVolume)
      window.setTimeout(step, interval)
    }
    step()
  }

  /** Preview helpers for the settings page (each is a user gesture). */
  previewSend(): void {
    this.unlock()
    if (this.synth !== null) this.synth.sendClack(this.voice(this.config.sendVolume))
  }

  previewDing(): void {
    this.unlock()
    if (this.synth !== null) this.synth.ding(this.config.dingPitch, this.voice(0.8))
  }

  previewBuzz(): void {
    this.unlock()
    if (this.synth !== null) this.synth.buzz(this.voice(0.8))
  }

  /** Optimistic local apply (instant feedback before the durable write settles). */
  applyLocal(patch: Partial<TypewriterSettings>): void {
    this.config = { ...this.config, ...patch }
    this.publish()
  }

  /** Durable write: local first, then the settings scope (rejection keeps the local value). */
  setSetting<K extends keyof TypewriterSettings>(field: K, value: TypewriterSettings[K]): void {
    this.applyLocal({ [field]: value } as Partial<TypewriterSettings>)
    void this.scope.set(field, value).catch(() => {})
  }

  /** Header mute button: flip the master switch (persisted through the scope). */
  toggleMuted(): void {
    this.setSetting('enabled', !this.config.enabled)
  }
}
