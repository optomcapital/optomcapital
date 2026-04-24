import { mkdir, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

async function writeBuildMeta() {
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
  return meta
}

async function runViteBuild(buildId) {
  const root = process.cwd()
  const viteBin = resolve(root, 'node_modules', 'vite', 'bin', 'vite.js')

  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [viteBin, 'build'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_BUILD_ID: buildId,
      },
    })
    child.on('error', rejectPromise)
    child.on('close', (code) => {
      if (code === 0) resolvePromise()
      else rejectPromise(new Error(`vite build failed with exit code ${code}`))
    })
  })
}

async function main() {
  const meta = await writeBuildMeta()
  await runViteBuild(meta.buildId)
}

main().catch((err) => {
  console.error('[build] failed:', err)
  process.exit(1)
})

