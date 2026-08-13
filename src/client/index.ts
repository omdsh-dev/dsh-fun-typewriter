/**
 * Typewriter plugin, browser half: WebAudio-synthesized typewriter /
 * mechanical-keyboard ambience. Zero audio files, zero network requests.
 *
 * Surfaces:
 * - StreamListener (invisible, input dock): session-snapshot diff drives the
 *   throttled click cadence, the send rebound, the completion ding, and the
 *   error/interrupt buzz.
 * - KeyListener (document capture): input-field keystroke ticks + first
 *   gesture unlock for the lazy AudioContext.
 * - HeaderMute (session-header action): the daily mute toggle.
 * - SettingsSection: master controls + per-sound knobs, all persisted through
 *   the `dsh-typewriter` settings namespace.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only merges: the settings and conversation SlotMap contracts.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { HeaderMute } from './HeaderMute.tsx'
import { installKeyListener } from './KeyListener.ts'
import { SettingsSection } from './SettingsSection.tsx'
import { SoundEngine } from './SoundEngine.ts'
import { StreamListener } from './StreamListener.tsx'
import { HttpTypewriterSettingsClient } from './settings-client.ts'

export type { HeaderMuteInjected, HeaderMuteProps } from './HeaderMute.tsx'
export type { SettingsSectionInjected, SettingsSectionProps } from './SettingsSection.tsx'
export type { StreamListenerInjected, StreamListenerProps } from './StreamListener.tsx'
export type { ClickProfile } from './synth.ts'
export { SoundEngine } from './SoundEngine.ts'

/** Required services (cordis fiber inject). */
export const inject = ['slots']

/**
 * Client plugin body: one shared engine over the settings scope, the document
 * key listener, and the three slot contributions.
 * @param ctx - client cordis context.
 */
export function apply(ctx: ClientContext): void {
  const settings = new HttpTypewriterSettingsClient()
  const engine = new SoundEngine(settings)
  const refresh = (): void => { void settings.refresh().catch(() => {}) }
  ctx.effect(() => {
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, 'typewriter: settings refresh')

  // Input typing ticks + first-gesture unlock (capture-phase document listeners).
  ctx.effect(() => installKeyListener(engine), 'typewriter: key listener')

  // Engine lifetime rides the plugin fiber: unload releases the scope
  // subscription and closes the audio context.
  ctx.effect(() => () => {
    engine.dispose()
    settings.dispose()
  }, 'typewriter: engine')

  // Invisible session-scope listener: mounts once per session, renders null.
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'typewriter-stream',
    order: 90,
    inject: () => ({ engine }),
  }, StreamListener))

  // Header mute quick access.
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions',
    id: 'typewriter-mute',
    order: 30,
    inject: () => ({ engine }),
  }, HeaderMute))

  // Settings page.
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'dsh-typewriter',
    order: 50,
    label: '🔊 音效',
    inject: () => ({ engine }),
  }, SettingsSection))
}
