/** Host registration for Typewriter's durable settings and private HTTP API. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import {
  DEFAULT_TYPEWRITER_SETTINGS, STREAM_PROFILE_LABELS, STREAM_PROFILES,
  TYPEWRITER_SETTINGS_NAMESPACE, TypewriterSettingsSchema,
} from './typewriter-settings.ts'
import { handleTypewriterSettingsApi, TYPEWRITER_API_PREFIX } from './settings-api.ts'

export {
  DEFAULT_TYPEWRITER_SETTINGS, STREAM_PROFILE_LABELS, STREAM_PROFILES,
  TYPEWRITER_SETTINGS_NAMESPACE,
} from './typewriter-settings.ts'
export type { StreamProfile, TypewriterSettings } from './typewriter-settings.ts'
export { TYPEWRITER_API_PREFIX, TYPEWRITER_SETTINGS_API_PATH } from './settings-api.ts'

export const name = 'fun-typewriter'
export const inject = ['settings', 'webServer']

export function apply(ctx: Context): void {
  const settings = ctx.settings.register(
    settingsNamespace(TYPEWRITER_SETTINGS_NAMESPACE),
    TypewriterSettingsSchema,
  )
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: TYPEWRITER_API_PREFIX,
    handler: async (req, res) => {
      const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
      if (pathname !== `${TYPEWRITER_API_PREFIX}/settings`) {
        res.statusCode = 404
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ error: 'not-found' }))
        return
      }
      await handleTypewriterSettingsApi(settings, req, res)
    },
  }), 'typewriter: settings API')
}

// Keep defaults referenced by the Host output so an accidental tree-shake
// cannot turn the exported settings contract into a client-only artifact.
void DEFAULT_TYPEWRITER_SETTINGS
void STREAM_PROFILE_LABELS
void STREAM_PROFILES
