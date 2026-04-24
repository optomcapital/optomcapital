import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

async function main() {
  const root = process.cwd()
  const publicDir = resolve(root, 'public')
  const outFile = resolve(publicDir, 'build-meta.json')

  const meta = {
    buildId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    builtAt: new Date().toISOString(),
  }

  await mkdir(publicDir, { recursive: true })
  await writeFile(outFile, JSON.stringify(meta, null, 2) + '\n', 'utf8')
  console.log(`[build-meta] wrote ${outFile}`)
}

main().catch((err) => {
  console.error('[build-meta] failed:', err)
  process.exit(1)
})
