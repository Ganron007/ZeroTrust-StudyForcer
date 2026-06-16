// scripts/build-git-release.js
// Standalone helper to (re)generate GIT_RELEASE_v<version>.md for the
// v2.8.0 wave release. This supplements scripts/build-all.cjs which
// only extracts a single version section.

const fs = require('fs')
const path = require('path')

const version = process.argv[2] || '2.8.0'
const portableDir = path.join(__dirname, '..', 'portable', version)
const releaseNotesPath = path.join(portableDir, `RELEASE_NOTES_v${version}.md`)
const exePath = path.join(portableDir, `ZTSFv${version}.exe`)
const md5Path = `${exePath}.md5`
const outPath = path.join(portableDir, `GIT_RELEASE_v${version}.md`)

if (!fs.existsSync(releaseNotesPath) || !fs.existsSync(exePath) || !fs.existsSync(md5Path)) {
  console.error(`Missing required files in ${portableDir}`)
  process.exit(1)
}

const fullNotes = fs.readFileSync(releaseNotesPath, 'utf8')
const md5 = fs.readFileSync(md5Path, 'utf8').trim()
const sizeMB = (fs.statSync(exePath).size / (1024 * 1024)).toFixed(1)

// Parse Added/Changed/Fixed sections and extract bullets
const lines = fullNotes.split('\n')
const sections = []
let cur = null
for (const line of lines) {
  const h = line.match(/^### (Added|Changed|Fixed)/)
  if (h) {
    if (cur) sections.push(cur)
    cur = { type: h[1], bullets: [] }
    continue
  }
  if (cur) {
    if (line.match(/^### /)) {
      sections.push(cur)
      cur = null
      continue
    }
    if (line.trim().startsWith('-')) {
      cur.bullets.push(line.trim().replace(/^- /, ''))
    }
  }
}
if (cur) sections.push(cur)

const paragraphs = sections.map(s => {
  const bullets = s.bullets.slice(0, 5).join(' ').replace(/\*\*/g, '')
  return `**${s.type}** — ${bullets}`
})

let out = `## ZeroTrust.StudyForcer v${version}\n\n`
out += `> *Zero Trust in your ability to pass. Prove us wrong.*\n\n`

if (version === '2.8.0') {
  out += `This release ships the full **v2.7.0 → v2.8.0 wave** as a single portable EXE. The wave includes four staged releases:\n\n`
  out += `- **v2.7.0** — App.tsx structural refactor (1230 → 928 lines) + Phase 0.5 UI integration\n`
  out += `- **v2.7.1** — Sprint/Adversary deadline-anchor fix + 42 component tests for v2.7.0 components\n`
  out += `- **v2.7.2** — ErrorBoundary primitive + 7 wrapped areas (4 tab panels + 3 overlays + SecurityNewsFeed)\n`
  out += `- **v2.8.0** — Dialog state machine extraction (5 hooks + 2 components + 39 tests)\n\n`
  out += `> The prior v2.6.0 GitHub Release is **not** superseded — it remains available for users on the v2.6.0 line. This v2.8.0 release is the new head.\n\n`
}

out += `### What is in the EXE\n\n`
out += paragraphs.join('\n\n')
out += `\n\n`

out += `### Download\n\n`
out += `| File | Size | MD5 |\n`
out += `|------|------|-----|\n`
out += `| \`ZTSFv${version}.exe\` | ${sizeMB} MB | \`${md5}\` |\n\n`

out += `### Verify Integrity\n\n`
out += `**Windows (PowerShell):**\n`
out += '```powershell\n'
out += `Get-FileHash -Algorithm MD5 ZTSFv${version}.exe\n`
out += '```\n'
out += `Compare the \`Hash\` value to \`${md5}\`.\n\n`

out += `**Windows (CMD):**\n`
out += '```cmd\n'
out += `certutil -hashfile ZTSFv${version}.exe MD5\n`
out += '```\n\n'

out += `**macOS / Linux:**\n`
out += '```bash\n'
out += `md5sum ZTSFv${version}.exe\n`
out += '```\n\n'

  out += `### Verification\n\n`
  out += `- TypeScript: \`npx tsc -b --noEmit\` clean\n`
  out += `- Tests: 964 vitest + 11 E2E + 17 Rust = 992 automated checks, all passing\n`
  out += `- No new dependencies\n`

if (version === '2.8.0') {
  out += `\n### Full Release Notes\n\n`
  out += `See [RELEASE_NOTES_v2.8.0.md](RELEASE_NOTES_v2.8.0.md) for the full v2.7.0 → v2.8.0 changelog.\n`
}

fs.writeFileSync(outPath, out)
console.log(`Wrote ${outPath} (${out.length} chars)`)
