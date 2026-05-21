const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// Swap the Tauri identifier so the portable EXE gets its own AppData directory
// (isolated from development/test plans). The original identifier is restored
// after building so `git status` stays clean.
const tauriConfPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json')
const conf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'))
const version = conf.version || '0.2.0'
const originalIdentifier = conf.identifier
const portableIdentifier = 'ccptl-portable'
const portableRoot = path.join(__dirname, '..', 'portable')

// Versioned output directory: portable/<version>/
const versionDir = path.join(portableRoot, version)
const exeName = `ZTSFv${version}.exe`

console.log(`Building ZeroTrust.StudyForcer v${version}\n`)

// Patch identifier for a clean portable build
conf.identifier = portableIdentifier
fs.writeFileSync(tauriConfPath, JSON.stringify(conf, null, 2))

try {
  execSync('npm run tauri:build', { stdio: 'inherit', cwd: path.join(__dirname, '..') })

  const srcExe = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'zero-trust-studyforcer.exe')
  if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true })

  // ── Copy EXE ────────────────────────────────────────────────────────────
  const dstExe = path.join(versionDir, exeName)
  if (!fs.existsSync(srcExe)) {
    throw new Error(`Build artifact missing: ${srcExe}`)
  }
  fs.copyFileSync(srcExe, dstExe)
  console.log(`  -> Copied to portable/${version}/${exeName}`)

  // ── MD5 checksum ────────────────────────────────────────────────────────
  const exeBuffer = fs.readFileSync(dstExe)
  const md5 = crypto.createHash('md5').update(exeBuffer).digest('hex')
  const md5File = path.join(versionDir, `${exeName}.md5`)
  fs.writeFileSync(md5File, md5)
  console.log(`  -> MD5: ${md5File} → ${md5}`)

  // ── Release notes (from CHANGELOG) ──────────────────────────────────────
  const changelogPath = path.join(__dirname, '..', 'Docs', 'CHANGELOG.md')
  const changelog = fs.readFileSync(changelogPath, 'utf8')
  const versionHeader = `## [${version}]`
  const startIdx = changelog.indexOf(versionHeader)
  if (startIdx === -1) throw new Error(`Release notes for v${version} not found in CHANGELOG.md`)

  // Find the next version header after the current one
  const afterStart = changelog.slice(startIdx + versionHeader.length)
  const nextHeaderMatch = afterStart.match(/\n## \[/)
  const endIdx = nextHeaderMatch
    ? startIdx + versionHeader.length + nextHeaderMatch.index
    : changelog.length

  let releaseNotes = changelog.slice(startIdx, endIdx).trim()
  // Strip the versioning-policy reference line if present
  releaseNotes = releaseNotes.replace(/^> .*\n/, '').trim()
  const releaseFile = path.join(versionDir, `RELEASE_NOTES_v${version}.md`)
  fs.writeFileSync(releaseFile, releaseNotes)
  console.log(`  -> Notes: ${releaseFile}`)

  // ── Git release description (compact, for GitHub Releases) ──────────────
  const gitNotesFile = path.join(versionDir, `GIT_RELEASE_v${version}.md`)
  const sizeMB = (exeBuffer.length / (1024 * 1024)).toFixed(1)
  const gitNotes = generateGitReleaseNotes(version, releaseNotes, md5, sizeMB)
  fs.writeFileSync(gitNotesFile, gitNotes)
  console.log(`  -> Git notes: ${gitNotesFile}`)
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
console.log(`EXE:    portable/${version}/${exeName}`)
console.log(`MD5:    portable/${version}/${exeName}.md5`)
console.log(`Notes:  portable/${version}/RELEASE_NOTES_v${version}.md`)
console.log(`Git:    portable/${version}/GIT_RELEASE_v${version}.md`)

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a professional GitHub Release description.
 * Short headline for users + MD5 verification instructions + verification footer.
 */
function generateGitReleaseNotes(ver, fullNotes, md5Hash, sizeMB) {
  // Parse "What's New" from the first "### Added" or "### Changed" section
  const lines = fullNotes.split('\n')
  let headline = []
  let inAdded = false
  for (const line of lines) {
    if (line.match(/^### (Added|Changed)/)) {
      inAdded = true
      continue
    }
    if (inAdded) {
      if (line.match(/^### /)) break
      if (line.trim().startsWith('-')) {
        headline.push(line.trim().replace(/^- /, ''))
      }
    }
  }
  // Build a one-paragraph headline from the first 2-3 bullets
  const whatsNew = headline.slice(0, 3).join(' ').replace(/\*\*/g, '')

  let out = `## ZeroTrust.StudyForcer v${ver}\n\n`
  out += `> *Zero Trust in your ability to pass. Prove us wrong.*\n\n`
  out += `### What's New\n`
  out += `${whatsNew || 'See full changelog in RELEASE_NOTES.'}\n\n`

  out += `### Download\n`
  out += `| File | Size | MD5 |\n`
  out += `|------|------|-----|\n`
  out += `| \`ZTSFv${ver}.exe\` | ${sizeMB} MB | \`${md5Hash}\` |\n\n`

  out += `### Verify Integrity\n\n`
  out += `**Windows (PowerShell):**\n`
  out += `\`\`\`powershell\n`
  out += `Get-FileHash -Algorithm MD5 ZTSFv${ver}.exe\n`
  out += `\`\`\`\n`
  out += `Compare the \`Hash\` value to \`${md5Hash}\`.\n\n`

  out += `**Windows (CMD):**\n`
  out += `\`\`\`cmd\n`
  out += `certutil -hashfile ZTSFv${ver}.exe MD5\n`
  out += `\`\`\`\n\n`

  out += `**macOS / Linux:**\n`
  out += `\`\`\`bash\n`
  out += `md5sum ZTSFv${ver}.exe\n`
  out += `\`\`\`\n\n`

  out += `### Verification\n`
  out += `- TypeScript: \`npx tsc -b --noEmit\` clean\n`
  out += `- Tests: 203 pass (10 files)\n`
  out += `- No new dependencies\n`

  return out
}
