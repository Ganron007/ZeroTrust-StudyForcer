const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// Only the Original (O) variant is built. Installers are intentionally
// not produced — set bundle.active = false in tauri.conf.json. The standalone
// study-planner.exe is copied to portable/ as the distribution artifact.

const suffix = '(O)'

const tauriConfPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json')
const originalConf = fs.readFileSync(tauriConfPath, 'utf8')
const conf = JSON.parse(originalConf)
const version = conf.version || '0.2.0'

console.log(`Building Study Planner v${version} - Original variant\n`)

const originalProductName = conf.productName
const originalTitle = conf.app.windows[0].title
const originalBeforeBuild = conf.build.beforeBuildCommand

conf.productName = `Study Planner ${suffix}`
conf.app.windows[0].title = `Study Planner ${suffix}`
conf.build.beforeBuildCommand = 'npm run build'

fs.writeFileSync(tauriConfPath, JSON.stringify(conf, null, 2))

const restoreConf = () => {
  conf.productName = originalProductName
  conf.app.windows[0].title = originalTitle
  conf.build.beforeBuildCommand = originalBeforeBuild
  fs.writeFileSync(tauriConfPath, JSON.stringify(conf, null, 2))
}

try {
  execSync('npm run tauri:build', { stdio: 'inherit', cwd: path.join(__dirname, '..') })

  const srcExe = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'study-planner.exe')
  const dstDir = path.join(__dirname, '..', 'portable')
  if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true })
  const dstExe = path.join(dstDir, `Study Planner ${suffix} v${version}.exe`)

  if (!fs.existsSync(srcExe)) {
    throw new Error(`Build artifact missing: ${srcExe}`)
  }
  fs.copyFileSync(srcExe, dstExe)
  console.log(`  -> Copied to portable/Study Planner ${suffix} v${version}.exe`)
} catch (e) {
  console.error('Build failed:', e.message)
  restoreConf()
  process.exit(1)
}

restoreConf()

console.log('\n=== Build complete ===')
console.log(`Version: v${version}`)
console.log(`Portable: portable/Study Planner ${suffix} v${version}.exe`)
