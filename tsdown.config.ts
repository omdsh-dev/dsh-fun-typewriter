import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve as resolvePath, sep } from 'node:path'
import { transform } from 'lightningcss'
import type { UserConfig } from 'tsdown'

const ID = '@deepseek-ai/dsh-fun-typewriter'
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-slots',
] as const
const BUNDLED_DEEPSEEK_PACKAGES = new Set(['@deepseek-ai/schemastery', '@deepseek-ai/cosmokit'])
const CSS_VIRTUAL_PREFIX = '\u0000dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'
const cssFiles = new Map<string, string>()

function sourceAssetPath(source: string, importer: string): string {
  const emitted = resolvePath(dirname(importer), source)
  if (existsSync(emitted)) return emitted
  const marker = `${sep}lib${sep}types${sep}`
  const boundary = emitted.indexOf(marker)
  if (boundary < 0) return emitted
  return resolvePath(emitted.slice(0, boundary), 'src', emitted.slice(boundary + marker.length))
}

export default {
  name: `${ID}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: false,
  clean: false,
  deps: {
    neverBundle: [...CLIENT_EXTERNALS],
    alwaysBundle: (id: string) => CLIENT_EXTERNALS.includes(id as typeof CLIENT_EXTERNALS[number]) ? undefined : true,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
  plugins: [{
    name: 'dsh-client-bundle-purity',
    resolveId(source: string) {
      if (!source.startsWith('@deepseek-ai/')) return null
      if (CLIENT_EXTERNALS.includes(source as typeof CLIENT_EXTERNALS[number])) return null
      if (BUNDLED_DEEPSEEK_PACKAGES.has(source)) return null
      throw new Error(`client bundle purity: ${JSON.stringify(source)} is not an allowed platform or bundled library`)
    },
  }, {
    name: 'dsh-css-modules-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.module.css')) return null
      const absolute = importer === undefined ? source : sourceAssetPath(source, importer)
      const virtualId = `${CSS_VIRTUAL_PREFIX}${basename(absolute)}-${String(cssFiles.size)}${CSS_VIRTUAL_SUFFIX}`
      cssFiles.set(virtualId, absolute)
      return virtualId
    },
    async load(virtualId: string) {
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const fileId = cssFiles.get(virtualId)
      if (fileId === undefined) throw new Error(`missing CSS module source for ${virtualId}`)
      this.addWatchFile(fileId)
      const source = await readFile(fileId)
      const { code, exports: cssExports } = transform({
        filename: fileId,
        code: source,
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      const classMap: Record<string, string> = {}
      for (const [local, exported] of Object.entries(cssExports ?? {})) classMap[local] = exported.name
      const tagId = `${ID}/${basename(fileId)}`
      return [
        `const css = ${JSON.stringify(code.toString())};`,
        `const tagId = ${JSON.stringify(tagId)};`,
        `const pluginId = ${JSON.stringify(ID)};`,
        "if (typeof document !== 'undefined') {",
        "  let tag = Array.from(document.querySelectorAll('style[data-plugin-css]')).find(candidate => candidate.dataset.pluginCss === tagId);",
        "  if (tag === undefined) { tag = document.createElement('style'); tag.dataset.plugin = pluginId; tag.dataset.pluginCss = tagId; document.head.appendChild(tag); }",
        '  tag.textContent = css;',
        '}',
        `export default ${JSON.stringify(classMap)};`,
      ].join('\n')
    },
  }],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
} satisfies UserConfig
