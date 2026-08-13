/** Loopback-only HTTP API for the Typewriter plugin's private settings namespace. */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { SettingsScope } from '@deepseek-ai/dsh-settings'
import {
  TYPEWRITER_SETTINGS_NAMESPACE, TypewriterSettingsSchema, type TypewriterSettings,
} from './typewriter-settings.ts'

export const TYPEWRITER_API_PREFIX = '/plugins/dsh-fun-typewriter/api'
export const TYPEWRITER_SETTINGS_API_PATH = `${TYPEWRITER_API_PREFIX}/settings`
const MAX_BODY_BYTES = 16 * 1024
const KEYS = new Set<keyof TypewriterSettings>([
  'enabled', 'masterVolume', 'streamEnabled', 'streamProfile', 'streamIntervalMs',
  'streamJitter', 'sendEnabled', 'sendVolume', 'dingEnabled', 'dingPitch',
  'errorEnabled', 'typingEnabled',
])

/** Validate and detach an untrusted partial settings payload. */
export function parseTypewriterSettingsPatch(
  value: unknown,
  current: TypewriterSettings,
): Partial<TypewriterSettings> {
  if (!isPlainObject(value)) throw new TypeError('patch must be a JSON object')
  for (const key of Object.keys(value)) {
    if (!KEYS.has(key as keyof TypewriterSettings)) throw new TypeError(`unknown typewriter setting ${JSON.stringify(key)}`)
  }
  const resolved = TypewriterSettingsSchema({ ...current, ...value })
  const patch: Partial<TypewriterSettings> = {}
  for (const key of KEYS) {
    if (key in value) Object.assign(patch, { [key]: resolved[key] })
  }
  return patch
}

/** Serve GET/PATCH for the plugin-owned settings namespace. */
export async function handleTypewriterSettingsApi(
  scope: SettingsScope<TypewriterSettings>,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (!isLoopbackRequest(req)) {
    sendJson(res, 403, { error: 'forbidden', message: 'typewriter settings are loopback-only' })
    return
  }
  if (req.method === 'GET') {
    sendJson(res, 200, { settings: scope.get() })
    return
  }
  if (req.method !== 'PATCH') {
    res.setHeader('allow', 'GET, PATCH')
    sendJson(res, 405, { error: 'method-not-allowed', message: 'use GET or PATCH' })
    return
  }
  if (!String(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
    sendJson(res, 415, { error: 'unsupported-media-type', message: 'PATCH requires application/json' })
    return
  }
  try {
    const body = JSON.parse(await readBody(req)) as unknown
    if (!isPlainObject(body) || !('patch' in body)) throw new TypeError('body must contain patch')
    const patch = parseTypewriterSettingsPatch(body.patch, scope.get())
    await scope.update(patch)
    sendJson(res, 200, { settings: scope.get() })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message === 'request body too large' ? 413 : 400
    sendJson(res, status, { error: 'settings-rejected', namespace: TYPEWRITER_SETTINGS_NAMESPACE, message })
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isLoopbackRequest(req: IncomingMessage): boolean {
  const authority = req.headers.host
  if (authority === undefined) return false
  let hostname: string
  try {
    hostname = normalizeHostname(new URL(`http://${authority}`).hostname)
  } catch {
    return false
  }
  if (!isLoopbackHostname(hostname)) return false
  const site = req.headers['sec-fetch-site']
  if (typeof site === 'string' && site !== 'same-origin' && site !== 'none') return false
  const origin = req.headers.origin
  if (origin !== undefined) {
    try {
      if (normalizeHostname(new URL(origin).hostname) !== hostname) return false
    } catch {
      return false
    }
  }
  return true
}

function normalizeHostname(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname.toLowerCase()
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '::1' || /^127(?:\.[0-9]{1,3}){3}$/.test(hostname)
}

async function readBody(req: IncomingMessage): Promise<string> {
  const advertised = Number(req.headers['content-length'] ?? 0)
  if (Number.isFinite(advertised) && advertised > MAX_BODY_BYTES) throw new Error('request body too large')
  const chunks: Buffer[] = []
  let size = 0
  for await (const raw of req) {
    const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw)
    size += chunk.byteLength
    if (size > MAX_BODY_BYTES) throw new Error('request body too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function sendJson(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  if (res.headersSent) return
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.setHeader('x-content-type-options', 'nosniff')
  res.end(JSON.stringify(body))
}
