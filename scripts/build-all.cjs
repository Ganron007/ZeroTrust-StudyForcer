const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const variants = [
  { name: 'original', suffix: '(O)', env: '' },
  { name: 'adaptive', suffix: '(A)', env: 'VITE_VARIANT=adaptive' },
]

const tauriConfPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json')
const originalConf = fs.readFileSync(tauriConfPath, 'utf8')
const conf = JSON.parse(originalConf)
const version = conf.version || '0.2.0'

console.log(`Building Study Planner v${version} - All Variants\n`)

// Clean old bundle artifacts to prevent stale installers from being copied
const msiDir = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'bundle', 'msi')
const nsisDir = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'bundle', 'nsis')
for (const dir of [msiDir, nsisDir]) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

for (const variant of variants) {
  console.log(`\n=== Building ${variant.name.toUpperCase()} variant ===`)

  // Update tauri.conf.json
  const originalProductName = conf.productName
  const originalTitle = conf.app.windows[0].title
  const originalBeforeBuild = conf.build.beforeBuildCommand

  conf.productName = `Study Planner ${variant.suffix}`
  conf.app.windows[0].title = `Study Planner ${variant.suffix}`

  if (variant.env) {
    conf.build.beforeBuildCommand = `cross-env ${variant.env} npm run build`
  } else {
    conf.build.beforeBuildCommand = 'npm run build'
  }

  fs.writeFileSync(tauriConfPath, JSON.stringify(conf, null, 2))

  try {
    // Build Tauri (includes frontend build via beforeBuildCommand)
    execSync('npm run tauri:build', { stdio: 'inherit', cwd: path.join(__dirname, '..') })

    // Copy portable exe with version in filename
    const srcExe = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'study-planner.exe')
    const dstExe = path.join(__dirname, '..', 'portable', `Study Planner ${variant.suffix} v${version}.exe`)

    if (fs.existsSync(srcExe)) {
      fs.copyFileSync(srcExe, dstExe)
      console.log(`  -> Copied to portable/Study Planner ${variant.suffix} v${version}.exe`)
    }

    // Copy installers
    const msiDir = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'bundle', 'msi')
    const nsisDir = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'bundle', 'nsis')

    if (fs.existsSync(msiDir)) {
      const msiFiles = fs.readdirSync(msiDir).filter(f => f.endsWith('.msi'))
      for (const f of msiFiles) {
        const src = path.join(msiDir, f)
        const dst = path.join(__dirname, '..', 'Installers', f)
        fs.copyFileSync(src, dst)
        console.log(`  -> Copied installer: ${f}`)
      }
    }

    if (fs.existsSync(nsisDir)) {
      const nsisFiles = fs.readdirSync(nsisDir).filter(f => f.endsWith('-setup.exe'))
      for (const f of nsisFiles) {
        const src = path.join(nsisDir, f)
        const dst = path.join(__dirname, '..', 'Installers', f)
        fs.copyFileSync(src, dst)
        console.log(`  -> Copied installer: ${f}`)
      }
    }

  } catch (e) {
    console.error(`Failed to build ${variant.name}:`, e.message)
    // Restore config before exit
    conf.productName = originalProductName
    conf.app.windows[0].title = originalTitle
    conf.build.beforeBuildCommand = originalBeforeBuild
    fs.writeFileSync(tauriConfPath, JSON.stringify(conf, null, 2))
    process.exit(1)
  }

  // Restore config for next iteration
  conf.productName = originalProductName
  conf.app.windows[0].title = originalTitle
  conf.build.beforeBuildCommand = originalBeforeBuild
  fs.writeFileSync(tauriConfPath, JSON.stringify(conf, null, 2))
}

console.log('\n=== All variants built successfully ===')
console.log(`Version: v${version}\n`)
console.log('Portable executables:')
for (const v of variants) {
  console.log(`  portable/Study Planner ${v.suffix} v${version}.exe`)
}
console.log('\nInstallers copied to Installers/')
