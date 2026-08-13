import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const root = new URL('../', import.meta.url)
const readText = (path: string): Promise<string> => readFile(new URL(path, root), 'utf8')

describe('DSH rc.3 package contract', () => {
  it('is a Profile Bundle with one host row and exact client dependencies', async () => {
    const manifest = JSON.parse(await readText('package.json')) as {
      version: string
      dsh: { bundle: { patch: string }; client: { inject: string[]; platform: string } }
      peerDependencies: Record<string, string>
    }
    const patch = await readText('cordis.patch.yml')
    expect(manifest.version).toBe('0.0.1-rc.3')
    expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(manifest.dsh.client.inject).toEqual([
      '@deepseek-ai/dsh-client-runtime',
      '@deepseek-ai/dsh-client-ui-settings',
      '@deepseek-ai/dsh-client-ui-conversation',
      '@deepseek-ai/dsh-client-ui-primitives',
      '@deepseek-ai/dsh-client-ui-slots',
    ])
    expect((patch.match(/id: fun-typewriter/g) ?? [])).toHaveLength(1)
    expect(manifest.peerDependencies['@deepseek-ai/dsh-host-webserver']).toBe('>=0.1.0-rc.3 <0.2.0')
  })

  it('uses its own settings API and the rc.3 webServer service', async () => {
    const files = [
      'src/index.ts', 'src/settings-api.ts', 'src/client/index.ts',
      'src/client/settings-client.ts', 'src/client/SoundEngine.ts', 'README.md',
    ]
    const text = (await Promise.all(files.map(readText))).join('\n')
    expect(text).toContain('ctx.webServer.register')
    expect(text).not.toContain('ctx.httpServer')
    expect(text).not.toContain('settingsScope.bind')
    expect(text).not.toContain('@deepseek-ai/dsh-api-remotes')
  })

  it('keeps CSS virtual ids and published maps free of the checkout path', async () => {
    const build = await readText('scripts/build.mjs')
    const config = await readText('tsdown.config.ts')
    expect(build).toContain('sanitizeClient(stagingLib)')
    expect(build).toContain("root.replaceAll('/', '\\\\')")
    expect(config).toContain('sourcemap: false')
    expect(config).toContain('basename(absolute)')
  })
})
