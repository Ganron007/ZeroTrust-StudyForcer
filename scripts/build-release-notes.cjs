// scripts/build-release-notes.cjs
// Standalone helper to (re)generate the full v2.8.0 RELEASE_NOTES file
// that covers the v2.7.0 → v2.8.0 wave + Plan E.

const fs = require('fs')
const path = require('path')

const version = process.argv[2] || '2.8.0'
const portableDir = path.join(__dirname, '..', 'portable', version)
const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md')
const outPath = path.join(portableDir, `RELEASE_NOTES_v${version}.md`)

const cl = fs.readFileSync(changelogPath, 'utf8')
const sections = []
for (const v of ['2.7.0', '2.7.1', '2.7.2', '2.8.0']) {
  const start = cl.lastIndexOf(`## [${v}]`)
  if (start === -1) continue
  const rest = cl.substring(start + 1)
  const nextMatch = rest.match(/\n## \[/)
  const end = nextMatch ? start + 1 + nextMatch.index : cl.length
  sections.push(cl.substring(start, end).trimEnd())
}

const intro = `# ZeroTrust.StudyForcer v${version} - Release Wave + Plan E

This release ships the full v2.7.0 -> v2.8.0 wave plus the final ROADMAP plan item (E) as a single portable EXE. The wave includes four staged releases that were developed in sequence but rolled up into one v${version} release.

**Why one EXE and not four:** Reconstructing the per-version intermediate file states (especially \`App.tsx\`, which spans all four versions) would require ~2-3 hours of manual file surgery per version. Instead, the entire wave is committed as one squashed commit on \`main\` (tagged \`v${version}\`), and a single portable EXE is built from the final state. The CHANGELOG entries below document each staged release in reverse chronological order, mirroring the per-version entries from the development commits.

**Prior releases:** The v2.6.0 GitHub Release remains available for users on the v2.6.0 line. This v${version} release is the new head and is the recommended download for new users.

**Wave contents:**
- **v2.7.0** - App.tsx structural refactor (1230 -> 928 lines) + Phase 0.5 UI integration (Sprint, Postmortem, Lab credit, BurnDown, Adversary)
- **v2.7.1** - Sprint/Adversary deadline-anchor fix (Bug B) + 42 direct component tests for the v2.7.0 extracted components (Plan A) + App.tsx blank-screen regression fix
- **v2.7.2** - \`<ErrorBoundary>\` primitive + 7 wrapped areas: 4 tab panels + 3 overlays + SecurityNewsFeed (Plan C)
- **v2.8.0** - Dialog state machine extraction: 4 new hooks (\`useOverlayState\`, \`useAppViewState\`, \`useTipState\`, \`useRefreshController\`) + 2 new components (\`OverlayManager\`, \`TimerLogDialog\`) (Plan D)
- **v2.8.0 (E)** - Test coverage for the three giant components: PlannerPage, CourseBuilder, LabDashboard. 118 new tests (81 pure-function helper + 37 component). 3 new pure-helper modules added. No bugs found.

**Stats across the wave:**
- Test count: 706 (v2.6.0) -> **964** (+258 new tests across 21 new test files; 65 files total)
- Rust tests: 0 -> **17** (added in v2.7.0)
- E2E: 11/11 pass
- TypeScript: clean
- Vite build: succeeds
- Versions: **2.6.0 -> 2.8.0** (minor: 4 ROADMAP plan items shipped + plan E complete)

**Final ROADMAP status:** All 5 items (A, B, C, D, E) are now shipped. No known debt.

The detailed changelog for each staged release follows below.

---

`

const combined = intro + sections.join('\n\n---\n\n')
fs.writeFileSync(outPath, combined)
console.log(`Wrote ${outPath} (${combined.length} chars)`)
