const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// Swap the Tauri identifier so the portable EXE gets its own AppData directory
// (isolated from development/test plans). The original identifier is restored
// after building so `git status` stays clean.
const tauriConfPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json')
const conf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'))
const version = conf.version || '0.2.0'
const originalIdentifier = conf.identifier
const portableIdentifier = 'ccptl-portable'

console.log(`Building CySec CCPTL v${version}\n`)

// Patch identifier for a clean portable build
conf.identifier = portableIdentifier
fs.writeFileSync(tauriConfPath, JSON.stringify(conf, null, 2))

try {
  execSync('npm run tauri:build', { stdio: 'inherit', cwd: path.join(__dirname, '..') })

  const srcExe = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'cysec-ccptl.exe')
  const dstDir = path.join(__dirname, '..', 'portable')
  if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true })
  const dstExe = path.join(dstDir, `CySec CCPTL v${version}.exe`)

  if (!fs.existsSync(srcExe)) {
    throw new Error(`Build artifact missing: ${srcExe}`)
  }
  fs.copyFileSync(srcExe, dstExe)
  console.log(`  -> Copied to portable/CySec CCPTL v${version}.exe`)
} catch (e) {
  console.error('Build failed:', e.message)
  process.exit(1)
} finally {
  // Restore original identifier
  conf.identifier = originalIdentifier
  // Write without extra trailing newline to match original file format
  fs.writeFileSync(tauriConfPath, JSON.stringify(conf, null, 2))
}

console.log('\n=== Build complete ===')
console.log(`Version: v${version}`)
console.log(`Portable: portable/CySec CCPTL v${version}.exe`)
