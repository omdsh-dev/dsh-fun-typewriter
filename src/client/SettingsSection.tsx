/**
 * The plugin's settings page (settings.section entry id `dsh-typewriter`):
 * master switch + master volume (drag previews, release persists), then one
 * card per sound family — stream cadence (profile select, interval, jitter,
 * 3s preview), send rebound, turn-complete ding (pitch), error buzz — plus
 * the input typing switch. Every durable write goes through the engine's
 * settings-scope route; every preview runs inside the user's gesture so the
 * lazy AudioContext unlocks naturally.
 */
import { useRef, useSyncExternalStore } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the settings shell's SlotMap merge (settings.section).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  STREAM_PROFILE_LABELS, STREAM_PROFILES, type StreamProfile,
} from '../typewriter-settings.ts'
import type { SoundEngine } from './SoundEngine.ts'
import css from './SettingsSection.module.css'

/** Injected business face: the shared engine (see the client apply). */
export interface SettingsSectionInjected {
  engine: SoundEngine
}

/** Full component props: settings-section runtime share + injected engine. */
export type SettingsSectionProps = PropsRuntime<'settings.section'> & SettingsSectionInjected

/** Minimum ms between drag previews (a 60Hz range event must not machine-gun). */
const PREVIEW_THROTTLE_MS = 120

/** Throttle one preview callback per component instance. */
function usePreviewThrottle(): (preview: () => void) => void {
  const last = useRef(0)
  return (preview) => {
    const now = performance.now()
    if (now - last.current < PREVIEW_THROTTLE_MS) return
    last.current = now
    preview()
  }
}

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}

/** Role=switch button (no external dependency; the knob rides CSS). */
function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={checked ? `${css.switch} ${css.switchOn}` : css.switch}
      onClick={() => { onChange(!checked) }}
    >
      <span className={css.knob} />
    </button>
  )
}

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (value: number) => string
  disabled?: boolean
  /** Fired continuously while dragging (local preview only). */
  onInput: (value: number) => void
  /** Fired once on release/commit (durable write). */
  onCommit: (value: number) => void
}

/** Labeled range slider; commit on pointer-up / keyboard-up / blur. */
function Slider({ label, value, min, max, step, format, disabled = false, onInput, onCommit }: SliderProps) {
  const commit = (target: HTMLInputElement): void => { onCommit(Number(target.value)) }
  return (
    <label className={css.slider}>
      <span className={css.sliderLabel}>{label}</span>
      <input
        type="range"
        className={css.range}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => { onInput(Number(event.target.value)) }}
        onPointerUp={(event) => { commit(event.target as HTMLInputElement) }}
        onKeyUp={(event) => { commit(event.target as HTMLInputElement) }}
        onBlur={(event) => { commit(event.target as HTMLInputElement) }}
      />
      <span className={css.sliderValue}>{format(value)}</span>
    </label>
  )
}

/**
 * Render the settings page.
 * @param props - composed slot props (owner `close` unused).
 * @returns the section tree.
 */
export function SettingsSection({ engine }: SettingsSectionProps) {
  const config = useSyncExternalStore(engine.subscribe, engine.getConfig)
  const preview = usePreviewThrottle()

  const masterVolume = Math.round(config.masterVolume * 100)

  return (
    <section className={css.section}>
      <h2 className={css.title}>🔊 音效</h2>
      <p className={css.intro}>
        打字机与机械键盘氛围音效，全部由 WebAudio 实时合成，零音频文件、零网络请求。
      </p>

      <div className={css.card} data-disabled={!config.enabled || undefined}>
        <div className={css.row}>
          <div className={css.rowText}>
            <span className={css.rowLabel}>总开关</span>
            <span className={css.rowHint}>关闭后完全静音，头部喇叭按钮与此联动</span>
          </div>
          <Switch
            checked={config.enabled}
            onChange={(checked) => {
              engine.unlock()
              engine.setSetting('enabled', checked)
            }}
            label="总开关"
          />
        </div>
        <div className={css.row}>
          <div className={css.rowText}>
            <span className={css.rowLabel}>总音量</span>
            <span className={css.rowHint}>拖动即时试听，松开后保存</span>
          </div>
          <div className={css.rowControl}>
            <Slider
              label="总音量"
              value={masterVolume}
              min={0}
              max={100}
              step={1}
              format={value => `${value}%`}
              disabled={!config.enabled}
              onInput={(value) => {
                engine.unlock()
                engine.applyLocal({ masterVolume: value / 100 })
                preview(() => engine.playClick(config.streamProfile))
              }}
              onCommit={(value) => { engine.setSetting('masterVolume', value / 100) }}
            />
          </div>
        </div>
      </div>

      <div className={css.card} data-disabled={!config.enabled || undefined}>
        <div className={css.row}>
          <div className={css.rowText}>
            <span className={css.rowLabel}>打字机流</span>
            <span className={css.rowHint}>助手流式回复逐 token 敲击</span>
          </div>
          <Switch
            checked={config.streamEnabled}
            onChange={(checked) => { engine.setSetting('streamEnabled', checked) }}
            label="打字机流开关"
          />
        </div>
        <div className={css.row}>
          <div className={css.rowText}>
            <span className={css.rowLabel}>音色</span>
          </div>
          <div className={css.rowControl}>
            <select
              className={css.select}
              value={config.streamProfile}
              disabled={!config.enabled || !config.streamEnabled}
              aria-label="音色"
              onChange={(event) => {
                const profile = event.target.value as StreamProfile
                engine.setSetting('streamProfile', profile)
                preview(() => engine.playClick(profile))
              }}
            >
              {STREAM_PROFILES.map(profile => (
                <option key={profile} value={profile}>{STREAM_PROFILE_LABELS[profile]}</option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={!config.enabled || !config.streamEnabled}
              onClick={() => { engine.previewStream(config.streamProfile, 3000) }}
            >
              ▶ 试听 3 秒
            </Button>
          </div>
        </div>
        <Slider
          label="敲击间隔"
          value={config.streamIntervalMs}
          min={30}
          max={1000}
          step={10}
          format={value => `${value}ms`}
          disabled={!config.enabled || !config.streamEnabled}
          onInput={(value) => { engine.applyLocal({ streamIntervalMs: value }) }}
          onCommit={(value) => { engine.setSetting('streamIntervalMs', value) }}
        />
        <Slider
          label="随机化"
          value={Math.round(config.streamJitter * 100)}
          min={0}
          max={100}
          step={5}
          format={value => `${value}%`}
          disabled={!config.enabled || !config.streamEnabled}
          onInput={(value) => { engine.applyLocal({ streamJitter: value / 100 }) }}
          onCommit={(value) => { engine.setSetting('streamJitter', value / 100) }}
        />
      </div>

      <div className={css.card} data-disabled={!config.enabled || undefined}>
        <div className={css.row}>
          <div className={css.rowText}>
            <span className={css.rowLabel}>发送回弹</span>
            <span className={css.rowHint}>回车发送时的一声低音“咔”</span>
          </div>
          <Switch
            checked={config.sendEnabled}
            onChange={(checked) => { engine.setSetting('sendEnabled', checked) }}
            label="发送回弹开关"
          />
        </div>
        <Slider
          label="音量"
          value={Math.round(config.sendVolume * 100)}
          min={0}
          max={100}
          step={1}
          format={value => `${value}%`}
          disabled={!config.enabled || !config.sendEnabled}
          onInput={(value) => {
            engine.unlock()
            engine.applyLocal({ sendVolume: value / 100 })
            preview(() => engine.previewSend())
          }}
          onCommit={(value) => { engine.setSetting('sendVolume', value / 100) }}
        />
      </div>

      <div className={css.card} data-disabled={!config.enabled || undefined}>
        <div className={css.row}>
          <div className={css.rowText}>
            <span className={css.rowLabel}>回合完成“叮”</span>
            <span className={css.rowHint}>一次完整回复结束时的提示音</span>
          </div>
          <Switch
            checked={config.dingEnabled}
            onChange={(checked) => { engine.setSetting('dingEnabled', checked) }}
            label="回合完成叮开关"
          />
        </div>
        <Slider
          label="音高"
          value={config.dingPitch}
          min={600}
          max={1600}
          step={20}
          format={value => `${value}Hz`}
          disabled={!config.enabled || !config.dingEnabled}
          onInput={(value) => {
            engine.unlock()
            engine.applyLocal({ dingPitch: value })
            preview(() => engine.previewDing())
          }}
          onCommit={(value) => { engine.setSetting('dingPitch', value) }}
        />
      </div>

      <div className={css.card} data-disabled={!config.enabled || undefined}>
        <div className={css.row}>
          <div className={css.rowText}>
            <span className={css.rowLabel}>错误 / 中断“嗡”</span>
            <span className={css.rowHint}>出错或手动中断时的低鸣</span>
          </div>
          <div className={css.rowControl}>
            <Button
              size="sm"
              variant="outline"
              disabled={!config.enabled || !config.errorEnabled}
              onClick={() => { engine.previewBuzz() }}
            >
              ▶ 试听
            </Button>
            <Switch
              checked={config.errorEnabled}
              onChange={(checked) => { engine.setSetting('errorEnabled', checked) }}
              label="错误嗡开关"
            />
          </div>
        </div>
      </div>

      <div className={css.card} data-disabled={!config.enabled || undefined}>
        <div className={css.row}>
          <div className={css.rowText}>
            <span className={css.rowLabel}>输入区打字音</span>
            <span className={css.rowHint}>在输入框键入时播放按键音（组合键与输入法组合不触发）</span>
          </div>
          <Switch
            checked={config.typingEnabled}
            onChange={(checked) => { engine.setSetting('typingEnabled', checked) }}
            label="输入区打字音开关"
          />
        </div>
      </div>
    </section>
  )
}
