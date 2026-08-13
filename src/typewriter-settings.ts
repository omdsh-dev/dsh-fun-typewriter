/**
 * Durable settings model shared by the Host schema registration and the
 * browser settings scope: the `dsh-typewriter` namespace carries the master
 * switch, volumes, the three click profiles, the stream cadence knobs, and
 * the per-sound toggles. All sound is WebAudio-synthesized at runtime — no
 * asset lives behind any of these fields.
 */
import z from '@deepseek-ai/schemastery'

/** Settings namespace owned by this plugin (exposed via the api-proxy allowlist). */
export const TYPEWRITER_SETTINGS_NAMESPACE = 'dsh-typewriter'

/** Stream click timbres: crisp light switch / classic typewriter / mechanical keyboard. */
export const STREAM_PROFILES = ['light', 'classic', 'mechanical'] as const
export type StreamProfile = typeof STREAM_PROFILES[number]

/** Durable section shared by the Host schema and the browser scope. */
export interface TypewriterSettings {
  /** Master switch; the header mute button flips exactly this field. */
  enabled: boolean
  /** Master volume 0-1 multiplying every voice. */
  masterVolume: number
  /** Whether the assistant streaming cadence sounds at all. */
  streamEnabled: boolean
  /** Stream click timbre. */
  streamProfile: StreamProfile
  /** Minimum ms between stream clicks (the throttle floor). */
  streamIntervalMs: number
  /** Randomization 0-1: clicks jitter by ±(value × interval). */
  streamJitter: number
  /** Whether the send rebound clack sounds on turn start. */
  sendEnabled: boolean
  /** Send rebound volume 0-1 (scaled by master). */
  sendVolume: number
  /** Whether the turn-complete ding sounds. */
  dingEnabled: boolean
  /** Ding base pitch in Hz (the 1.5×/2× overtones follow). */
  dingPitch: number
  /** Whether the error/interrupt buzz sounds. */
  errorEnabled: boolean
  /** Whether input-field keystrokes tick. */
  typingEnabled: boolean
}

/** Default section used when the user-settings document has no override. */
export const DEFAULT_TYPEWRITER_SETTINGS: TypewriterSettings = {
  enabled: true,
  masterVolume: 0.6,
  streamEnabled: true,
  streamProfile: 'classic',
  streamIntervalMs: 150,
  streamJitter: 0.3,
  sendEnabled: true,
  sendVolume: 0.7,
  dingEnabled: true,
  dingPitch: 1200,
  errorEnabled: true,
  typingEnabled: true,
}

/** Durable section schema; also the wire envelope the browser scope validates against. */
export const TypewriterSettingsSchema: z<TypewriterSettings> = z.object({
  enabled: z.boolean().default(DEFAULT_TYPEWRITER_SETTINGS.enabled),
  masterVolume: z.percent().default(DEFAULT_TYPEWRITER_SETTINGS.masterVolume),
  streamEnabled: z.boolean().default(DEFAULT_TYPEWRITER_SETTINGS.streamEnabled),
  streamProfile: z.union([z.const('light'), z.const('classic'), z.const('mechanical')])
    .default(DEFAULT_TYPEWRITER_SETTINGS.streamProfile),
  streamIntervalMs: z.natural().min(30).max(1000).default(DEFAULT_TYPEWRITER_SETTINGS.streamIntervalMs),
  streamJitter: z.percent().default(DEFAULT_TYPEWRITER_SETTINGS.streamJitter),
  sendEnabled: z.boolean().default(DEFAULT_TYPEWRITER_SETTINGS.sendEnabled),
  sendVolume: z.percent().default(DEFAULT_TYPEWRITER_SETTINGS.sendVolume),
  dingEnabled: z.boolean().default(DEFAULT_TYPEWRITER_SETTINGS.dingEnabled),
  dingPitch: z.natural().min(600).max(1600).default(DEFAULT_TYPEWRITER_SETTINGS.dingPitch),
  errorEnabled: z.boolean().default(DEFAULT_TYPEWRITER_SETTINGS.errorEnabled),
  typingEnabled: z.boolean().default(DEFAULT_TYPEWRITER_SETTINGS.typingEnabled),
})

/** Human labels for the three stream profiles (settings-page select copy). */
export const STREAM_PROFILE_LABELS: Readonly<Record<StreamProfile, string>> = {
  light: '轻轴',
  classic: '老式打字机',
  mechanical: '机械键盘',
}
