/**
 * Session-header mute quick access: the plugin's only daily-driver surface.
 * One click flips the master switch (persisted through the settings scope);
 * the icon swaps between the audible and the strike-through states, and the
 * tooltip reports the current master volume (or the muted state).
 */
import { useSyncExternalStore } from 'react'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SoundEngine } from './SoundEngine.ts'
import { SpeakerMutedIcon, SpeakerOnIcon } from './icons.tsx'
import css from './HeaderMute.module.css'

/** Injected business face: the shared engine (see the client apply). */
export interface HeaderMuteInjected {
  engine: SoundEngine
}

/** Full component props: session-header action runtime share + injected engine. */
export type HeaderMuteProps = PropsRuntime<'conversation.session.header.actions'> & HeaderMuteInjected

/**
 * Render the mute toggle.
 * @param props - composed slot props.
 * @returns the tooltip-wrapped icon button.
 */
export function HeaderMute({ engine }: HeaderMuteProps) {
  const config = useSyncExternalStore(engine.subscribe, engine.getConfig)
  const muted = !config.enabled
  const tooltip = muted ? '音效已静音' : `音效音量 ${Math.round(config.masterVolume * 100)}%`
  return (
    <Tooltip label={tooltip} side="bottom">
      <button
        type="button"
        className={css.trigger}
        aria-label={muted ? '开启音效' : '静音'}
        aria-pressed={muted}
        onClick={() => {
          engine.unlock()
          engine.toggleMuted()
        }}
      >
        {muted ? <SpeakerMutedIcon /> : <SpeakerOnIcon />}
      </button>
    </Tooltip>
  )
}
