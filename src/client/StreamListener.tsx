/**
 * StreamListener: the invisible session-scope ear of the plugin. Registered
 * into `conversation.input.dock` (a session list slot) so it mounts exactly
 * once per session and renders null.
 *
 * It subscribes the ConversationSnapshot through the framework `useSession`
 * seat and diffs the live assistant partial:
 * - partial text growth  -> one click per growth event, drained on a timer
 *   throttled by `streamIntervalMs` +- the configured jitter (token floods
 *   never stack voices — the queue is capped and cleared on turn end);
 * - running false -> true -> send rebound clack;
 * - running true -> false -> ding on a clean turn, buzz when the turn ended
 *   with an error/interrupt (lastAgentError, a turn-error node, or a frozen
 *   interrupted assistant node).
 */
import { useEffect, useRef } from 'react'
import type { AssistantBlock, ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the conversation SlotMap merge (conversation.input.dock) and the
// ui-conversation session standard seats.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SoundEngine } from './SoundEngine.ts'

/** Injected business face: the shared engine (see the client apply). */
export interface StreamListenerInjected {
  engine: SoundEngine
}

/** Full component props: input-dock runtime share + injected engine. */
export type StreamListenerProps = PropsRuntime<'conversation.input.dock'> & StreamListenerInjected

/** Max queued clicks: a token flood throttles instead of stacking. */
const MAX_PENDING_CLICKS = 3

/** Count the visible text of one assistant's blocks (body + reasoning). */
function textLength(blocks: readonly AssistantBlock[]): number {
  let length = 0
  for (const block of blocks) {
    if (block.kind === 'text' || block.kind === 'reasoning') length += block.text.length
  }
  return length
}

/**
 * Error/interrupt fingerprint of the current turn: the last agent error, the
 * seqs of every turn-error node, and the seq of an interrupted assistant
 * node. A change means "buzz" exactly once per turn.
 */
function turnFingerprint(snap: ConversationSnapshot): string {
  const parts: string[] = [snap.lastAgentError ?? '']
  let interruptedSeq = -1
  for (let i = snap.nodes.length - 1; i >= 0; i -= 1) {
    const node = snap.nodes[i]
    if (node === undefined) continue
    if (node.kind === 'turn-error') parts.push(`error:${node.seq}`)
    if (interruptedSeq < 0 && node.kind === 'assistant' && node.interrupted === true) {
      interruptedSeq = node.seq
    }
  }
  if (interruptedSeq >= 0) parts.push(`interrupted:${interruptedSeq}`)
  return parts.join('|')
}

/**
 * Mount the diff loop and render nothing.
 * @param props - composed slot props (the owner share is ignored).
 * @returns null — this entry is pure behavior, zero chrome.
 */
export function StreamListener({ useSession, engine }: StreamListenerProps) {
  const snap = useSession(s => s)
  const state = useRef({
    lastRunning: snap.running,
    lastPartialLen: snap.partial === null ? 0 : textLength(snap.partial.blocks),
    fingerprint: turnFingerprint(snap),
    pendingClicks: 0,
    errored: false,
  })
  const drainTimer = useRef<number | null>(null)
  const runningRef = useRef(snap.running)

  const stopDrain = (): void => {
    if (drainTimer.current !== null) {
      window.clearTimeout(drainTimer.current)
      drainTimer.current = null
    }
    state.current.pendingClicks = 0
  }

  const scheduleDrain = (): void => {
    if (drainTimer.current !== null) return
    const tick = (): void => {
      drainTimer.current = null
      const current = state.current
      if (current.pendingClicks <= 0) return
      if (!runningRef.current) {
        current.pendingClicks = 0
        return
      }
      current.pendingClicks -= 1
      engine.playClick()
      const config = engine.getConfig()
      if (!config.enabled || !config.streamEnabled) {
        current.pendingClicks = 0
        return
      }
      const jitterRange = config.streamJitter * config.streamIntervalMs
      const delay = Math.max(30, config.streamIntervalMs + (Math.random() * 2 - 1) * jitterRange)
      drainTimer.current = window.setTimeout(tick, delay)
    }
    tick()
  }

  // Diff one snapshot generation against the previous one.
  useEffect(() => {
    const current = state.current
    const partialLen = snap.partial === null ? 0 : textLength(snap.partial.blocks)
    const fingerprint = turnFingerprint(snap)

    if (snap.running && !current.lastRunning) {
      // A new turn started: rebound clack, fresh error baseline, no backlog.
      stopDrain()
      current.fingerprint = fingerprint
      current.errored = false
      engine.playSend()
    } else if (!snap.running && current.lastRunning) {
      // The turn ended: buzz once if it died with an error/interrupt (whether
      // surfaced mid-turn or at the end), otherwise the completion ding.
      stopDrain()
      if (!current.errored && fingerprint !== current.fingerprint) engine.playBuzz()
      else if (!current.errored) engine.playDing()
      current.errored = false
      current.fingerprint = fingerprint
    } else if (fingerprint !== current.fingerprint) {
      // Error/interrupt surfaced while the turn is still running.
      engine.playBuzz()
      current.fingerprint = fingerprint
      current.errored = true
    }

    // Growth counts only against the live partial accumulator, so a finalized
    // node landing after turn end never replays its whole text as clicks.
    if (snap.partial !== null && partialLen > current.lastPartialLen) {
      current.pendingClicks = Math.min(current.pendingClicks + 1, MAX_PENDING_CLICKS)
      scheduleDrain()
    }

    current.lastPartialLen = partialLen
    current.lastRunning = snap.running
    runningRef.current = snap.running
  }, [snap, engine])

  // Clear any in-flight drain timer when the session scope unmounts.
  useEffect(() => () => {
    if (drainTimer.current !== null) window.clearTimeout(drainTimer.current)
  }, [])

  return null
}
