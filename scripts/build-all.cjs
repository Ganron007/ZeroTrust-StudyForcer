const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// No installers — set bundle.active = false in tauri.conf.json. The standalone
// study-planner.exe is copied to portable/ as the sole distribution artifact.

const tauriConfPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json')
const conf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'))
const version = conf.version || '0.2.0'

console.log(`Building Study Planner v${version}\n`)

try {
  execSync('npm run tauri:build', { stdio: 'inherit', cwd: path.join(__dirname, '..') })

  const srcExe = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'study-planner.exe')
  const dstDir = path.join(__dirname, '..', 'portable')
  if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true })
  const dstExe = path.join(dstDir, `Study Planner v${version}.exe`)

  if (!fs.existsSync(srcExe)) {
    throw new Error(`Build artifact missing: ${srcExe}`)
  }
  fs.copyFileSync(srcExe, dstExe)
  console.log(`  -> Copied to portable/Study Planner v${version}.exe`)
} catch (e) {
  console.error('Build failed:', e.message)
  process.exit(1)
}

console.log('\n=== Build complete ===')
console.log(`Version: v${version}`)
console.log(`Portable: portable/Study Planner v${version}.exe`)
