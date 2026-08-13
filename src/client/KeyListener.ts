/**
 * Document-level input listener: plays the keystroke tick while the user
 * types into an editable field (composer, settings inputs, any textarea).
 *
 * Capture phase on purpose — the plugin never stops, prevents, or rewrites
 * anything; it only reads the event and the focus target. Modifier-only
 * keys, shortcuts, IME composition (e.isComposing), and non-editable targets
 * are all silently skipped, so no keyboard behavior is ever hijacked.
 */
import type { SoundEngine } from './SoundEngine.ts'

/** Input types that carry no editable text. */
const NON_TEXT_INPUT_TYPES = new Set([
  'button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit',
])

/** Whether the event target is a field the user types text into. */
function isEditable(target: HTMLElement): boolean {
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === 'TEXTAREA') return true
  if (tag !== 'INPUT') return false
  return !NON_TEXT_INPUT_TYPES.has((target as HTMLInputElement).type)
}

/** Whether a keydown is an actual typing action (printable or text-editing). */
function isTypingKey(key: string): boolean {
  if (key.length === 1) return true
  return key === 'Backspace' || key === 'Delete' || key === 'Enter' || key === 'Spacebar'
}

/**
 * Install the capture-phase keydown listener and the first-gesture unlock.
 * @param engine - the audio owner.
 * @returns the disposer removing every listener.
 */
export function installKeyListener(engine: SoundEngine): () => void {
  // Any gesture unlocks the lazy AudioContext (the browser autoplay policy
  // demands it): clicks, drags, and keystrokes all qualify.
  const unlock = (): void => { engine.unlock() }
  const onKeyDown = (event: KeyboardEvent): void => {
    engine.unlock()
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return
    if (!isTypingKey(event.key)) return
    const target = event.target
    if (!(target instanceof HTMLElement) || !isEditable(target)) return
    engine.playKeyTick()
  }
  // IME commit: the composition process itself stays silent (every composing
  // keydown is filtered above — Chinese input would otherwise never sound),
  // but when the composed text lands in the field, play a short burst sized
  // by the committed length.
  const onCompositionEnd = (event: CompositionEvent): void => {
    engine.unlock()
    const text = event.data ?? ''
    if (text.length === 0) return
    const target = event.target
    if (!(target instanceof HTMLElement) || !isEditable(target)) return
    engine.playKeyBurst(Math.min(3, Math.ceil(text.length / 2)))
  }
  document.addEventListener('pointerdown', unlock, true)
  document.addEventListener('keydown', unlock, true)
  document.addEventListener('keydown', onKeyDown, true)
  document.addEventListener('compositionend', onCompositionEnd, true)
  return () => {
    document.removeEventListener('pointerdown', unlock, true)
    document.removeEventListener('keydown', unlock, true)
    document.removeEventListener('keydown', onKeyDown, true)
    document.removeEventListener('compositionend', onCompositionEnd, true)
  }
}
