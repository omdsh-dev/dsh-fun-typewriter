import { createServer, request as httpRequest } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { SettingsScope } from '@deepseek-ai/dsh-settings'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_TYPEWRITER_SETTINGS, TypewriterSettingsSchema, type TypewriterSettings,
} from '../src/typewriter-settings.ts'
import {
  handleTypewriterSettingsApi, parseTypewriterSettingsPatch, TYPEWRITER_SETTINGS_API_PATH,
} from '../src/settings-api.ts'

const servers: Array<ReturnType<typeof createServer>> = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => { resolve() }))))
})

function memoryScope(): { scope: SettingsScope<TypewriterSettings>; read: () => TypewriterSettings } {
  let value = TypewriterSettingsSchema(DEFAULT_TYPEWRITER_SETTINGS)
  return {
    read: () => value,
    scope: {
      get: () => value,
      watch: () => () => {},
      update: async (patch) => { value = TypewriterSettingsSchema({ ...value, ...patch }) },
      replace: async (section) => { value = TypewriterSettingsSchema(section as TypewriterSettings) },
    },
  }
}

async function mounted() {
  const state = memoryScope()
  const server = createServer((req, res) => { void handleTypewriterSettingsApi(state.scope, req, res) })
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port
  return { ...state, port, base: `http://127.0.0.1:${port}` }
}

describe('typewriter settings API', () => {
  it('validates field names and schema ranges', () => {
    expect(parseTypewriterSettingsPatch({ enabled: false, streamProfile: 'mechanical' }, DEFAULT_TYPEWRITER_SETTINGS))
      .toEqual({ enabled: false, streamProfile: 'mechanical' })
    expect(() => parseTypewriterSettingsPatch({ dingPitch: 12 }, DEFAULT_TYPEWRITER_SETTINGS)).toThrow()
    expect(() => parseTypewriterSettingsPatch({ apiKey: 'never' }, DEFAULT_TYPEWRITER_SETTINGS)).toThrow(/unknown typewriter setting/)
  })

  it('reads and persists settings with no external network', async () => {
    const { base, read } = await mounted()
    const before = await fetch(`${base}${TYPEWRITER_SETTINGS_API_PATH}`)
    expect(before.status).toBe(200)
    expect((await before.json() as { settings: TypewriterSettings }).settings.enabled).toBe(true)
    const changed = await fetch(`${base}${TYPEWRITER_SETTINGS_API_PATH}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ patch: { enabled: false, masterVolume: 0.25 } }),
    })
    expect(changed.status).toBe(200)
    expect(read()).toMatchObject({ enabled: false, masterVolume: 0.25 })
  })

  it('keeps the settings plane loopback-only', async () => {
    const { port } = await mounted()
    const status = await new Promise<number>((resolve, reject) => {
      const req = httpRequest({
        host: '127.0.0.1', port, path: TYPEWRITER_SETTINGS_API_PATH,
        headers: { host: 'example.com' },
      }, res => { res.resume(); res.on('end', () => { resolve(res.statusCode ?? 0) }) })
      req.on('error', reject)
      req.end()
    })
    expect(status).toBe(403)
  })
})
