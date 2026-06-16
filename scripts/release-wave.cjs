#!/usr/bin/env node
// scripts/release-wave.cjs
//
// Modular release script for the v2.7.0 → v2.8.0 wave.
//
// Each `node scripts/release-wave.cjs <version>` invocation:
//   1. Checks out the parent tag (e.g. v2.6.0 for v2.7.0)
//   2. Applies the v<version> file subset from the saved stash
//   3. Bumps the 3 version files (package.json, src-tauri/Cargo.toml,
//      src-tauri/tauri.conf.json) to <version>
//   4. Runs the verification gates (tsc, vitest, playwright, cargo test)
//   5. Commits, tags v<version>
//   6. Runs `npm run tauri:build:all` → portable/<version>/
//   7. Creates the GitHub Release with EXE + MD5 + notes
//
// Stash ref: stash@{0} must contain the FULL v2.8.0 state saved by
// `git stash push -u -m release-wave-v2.7.0-to-v2.8.0-full-state`.
//
// Usage:
//   node scripts/release-wave.cjs 2.7.0
//   node scripts/release-wave.cjs 2.7.1
//   node scripts/release-wave.cjs 2.7.2
//   node scripts/release-wave.cjs 2.8.0
//   node scripts/release-wave.cjs restore   # pop the stash back to working tree

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const STASH_REF = 'stash@{0}'

// ─── Per-version file subsets ────────────────────────────────────────────────
// These are the files whose state is INTRODUCED (added) or CHANGED for that
// version. The script applies a subset of the stash to get the right code
// state for that version on top of the parent tag's baseline.
//
// "v2.7.0 NEW" = files that did not exist at v2.6.0
// "v2.7.0 CHANGED" = files modified relative to v2.6.0 (must be applied
//   from stash in their v2.7.0 form — NOT the final v2.8.0 form)
//
// For files that span multiple versions (e.g. App.tsx), we apply the
// v2.7.0 form from the stash, then for v2.7.1 we apply a v2.7.1-specific
// patch that re-introduces the v2.7.1 changes on top of the v2.7.0 state.
// Same for v2.7.2 and v2.8.0.

const V270 = {
  newFiles: [
    'src/hooks/useStudyLogging.ts',
    'src/hooks/useSchedule.ts',
    'src/hooks/useKeyboardShortcuts.ts',
    'src/components/AppHeader.tsx',
    'src/components/Popover.tsx',
    'src/components/StatsBar.tsx',
    'src/components/SprintBanner.tsx',
    'src/components/PostmortemBanner.tsx',
    'src/components/LabCreditPrompt.tsx',
    'src/hooks/__tests__/useStudyLogging.test.tsx',
    'src/hooks/__tests__/useSchedule.test.tsx',
    'src/hooks/__tests__/useKeyboardShortcuts.test.ts',
  ],
  changedFiles: [
    'package.json',
    'src-tauri/Cargo.lock',
    'src-tauri/Cargo.toml',
    'src-tauri/src/main.rs',
    'src-tauri/tauri.conf.json',
    'src/App.tsx',
    'src/components/CertPathView.tsx',
    'src/components/LabDashboard.tsx',
    'src/components/NotificationSettingsPanel.tsx',
    'src/components/ThemeProvider.tsx',
    'src/lib/__tests__/app-temp-log-wiring.test.ts',
    'src/lib/database.ts',
    'src/lib/personality.ts',
    'src/lib/plan-engine.ts',
    'ARCHITECTURE.md',
    'Arch/01-executive-overview.md',
    'Arch/02-structural-components.md',
    'Arch/03-data-flow.md',
    'Arch/04-control-flow.md',
    'Arch/05-state-management.md',
    'Arch/06-anchor-system.md',
    'Arch/07-testing-architecture.md',
    'Arch/README.md',
    'CHANGELOG.md',
    'How_to_read.md',
    'README.md',
  ],
}

const V271 = {
  newFiles: [
    // v2.7.1 introduces direct component tests for the 6 v2.7.0 components
    'src/components/__tests__/AppHeader.test.tsx',
    'src/components/__tests__/Popover.test.tsx',
    'src/components/__tests__/StatsBar.test.tsx',
    'src/components/__tests__/SprintBanner.test.tsx',
    'src/components/__tests__/PostmortemBanner.test.tsx',
    'src/components/__tests__/LabCreditPrompt.test.tsx',
  ],
  // v2.7.1 CHANGED: files that got the v2.7.1-specific deltas.
  // The v2.7.0 form is already on disk from V270.apply(). We need to
  // apply the v2.7.1-specific patch from the stash.
  // Files: App.tsx (overlay truthiness fix), plan-engine.ts
  // (applyPaceOverlays helper), plan-engine.test.ts (6 new tests).
  changedFiles: [
    'package.json',
    'src-tauri/Cargo.lock',
    'src-tauri/Cargo.toml',
    'src-tauri/tauri.conf.json',
    'src/App.tsx',
    'src/lib/plan-engine.ts',
    'src/lib/__tests__/plan-engine.test.ts',
    'CHANGELOG.md',
    'AGENTS.md',
    'Docs/Internal/ROADMAP.md',
    'Docs/Internal/BUGS.md',
    'Arch/02-structural-components.md',
    'Arch/06-anchor-system.md',
  ],
}

const V272 = {
  newFiles: [
    'src/components/ErrorBoundary.tsx',
    'src/components/__tests__/ErrorBoundary.test.tsx',
  ],
  changedFiles: [
    'package.json',
    'src-tauri/Cargo.lock',
    'src-tauri/Cargo.toml',
    'src-tauri/tauri.conf.json',
    'src/App.tsx',
    'src/components/OverlayManager.tsx',
    'CHANGELOG.md',
    'AGENTS.md',
    'Docs/Internal/ROADMAP.md',
    'Docs/Internal/BUGS.md',
    'Arch/02-structural-components.md',
    'Arch/README.md',
  ],
}

const V280 = {
  newFiles: [
    'src/hooks/useOverlayState.ts',
    'src/hooks/useAppViewState.ts',
    'src/hooks/useTipState.ts',
    'src/hooks/useRefreshController.ts',
    'src/components/OverlayManager.tsx',
    'src/components/TimerLogDialog.tsx',
    'src/hooks/__tests__/useOverlayState.test.tsx',
    'src/hooks/__tests__/useAppViewState.test.tsx',
    'src/hooks/__tests__/useTipState.test.tsx',
    'src/hooks/__tests__/useRefreshController.test.tsx',
    'src/components/__tests__/OverlayManager.test.tsx',
  ],
  changedFiles: [
    'package.json',
    'src-tauri/Cargo.lock',
    'src-tauri/Cargo.toml',
    'src-tauri/tauri.conf.json',
    'src/App.tsx',
    'CHANGELOG.md',
    'AGENTS.md',
    'Docs/Internal/ROADMAP.md',
    'Arch/02-structural-components.md',
  ],
}

const SUBSETS = {
  '2.7.0': { parent: 'v2.6.0', ...V270 },
  '2.7.1': { parent: 'v2.7.0', ...V271 },
  '2.7.2': { parent: 'v2.7.1', ...V272 },
  '2.8.0': { parent: 'v2.7.2', ...V280 },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`)
  return execSync(cmd, {
    cwd: ROOT,
    stdio: 'inherit',
    ...opts,
  })
}

function runCapture(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim()
}

function ensureClean() {
  const status = runCapture('git status --porcelain')
  if (status) {
    throw new Error(`Working tree is dirty:\n${status}\nRun from a clean tree.`)
  }
}

function stashExists() {
  try {
    runCapture(`git stash list | grep -F "${STASH_REF.slice(0, -1)}"`)
    return true
  } catch {
    return false
  }
}

function applyNewFiles(newFiles) {
  if (newFiles.length === 0) return
  // untracked files are stored at .git/refs/stash with index 0 → 1
  // `git checkout stash@{0} -- <path>` restores untracked + tracked content
  for (const f of newFiles) {
    run(`git checkout "${STASH_REF}" -- "${f}"`)
  }
  console.log(`  → Restored ${newFiles.length} new file(s) from stash`)
}

function applyChangedFiles(changedFiles) {
  if (changedFiles.length === 0) return
  // Generate a patch for the tracked-file subset and apply it
  const paths = changedFiles.map((f) => `"${f}"`).join(' ')
  run(`git stash show -p "${STASH_REF}" -- ${paths} | git apply --include='*'`)
  console.log(`  → Patched ${changedFiles.length} modified file(s) from stash`)
}

function bumpVersion(version) {
  const files = [
    { path: 'package.json', key: 'version' },
    { path: 'src-tauri/Cargo.toml', regex: /^version = "[\d.]+"$/m },
    { path: 'src-tauri/tauri.conf.json', key: 'version' },
  ]
  for (const { path: p, key, regex } of files) {
    const full = path.join(ROOT, p)
    let content = fs.readFileSync(full, 'utf8')
    if (key) {
      const re = new RegExp(`("${key}"\\s*:\\s*)"[^"]+"`)
      content = content.replace(re, `$1"${version}"`)
    } else if (regex) {
      content = content.replace(regex, `version = "${version}"`)
    }
    fs.writeFileSync(full, content)
    console.log(`  → Bumped ${p} → ${version}`)
  }
}

function runGates() {
  console.log('\n=== Running verification gates ===')
  run('npx tsc -b --noEmit')
  run('npx vitest run')
  run('npx playwright test')
  run('cargo test', { cwd: path.join(ROOT, 'src-tauri') })
  console.log('=== All gates passed ===\n')
}

function buildPortable(version) {
  console.log(`\n=== Building portable EXE for v${version} ===`)
  run('npm run tauri:build:all')
  const exeDir = path.join(ROOT, 'portable', version)
  if (!fs.existsSync(path.join(exeDir, `ZTSFv${version}.exe`))) {
    throw new Error(`Build artifact missing: portable/${version}/ZTSFv${version}.exe`)
  }
  console.log(`=== Build complete: portable/${version}/ ===\n`)
}

function gitCommitTag(version) {
  const subset = SUBSETS[version]
  const parent = subset.parent
  run('git add -A')
  const status = runCapture('git status --porcelain')
  if (status) {
    throw new Error(`Untracked changes after add:\n${status}`)
  }
  const msg = `release: v${version} — see CHANGELOG.md`
  run(`git commit -m "${msg}"`)
  run(`git tag -a "v${version}" -m "v${version}"`)
  console.log(`  → Committed and tagged v${version}`)
}

function createRelease(version) {
  const title = `ZeroTrust.StudyForcer v${version}`
  const notesFile = path.join(ROOT, 'portable', version, `GIT_RELEASE_v${version}.md`)
  if (!fs.existsSync(notesFile)) {
    throw new Error(`Release notes file missing: ${notesFile}`)
  }
  const exeGlob = `portable/${version}/*`
  run(`gh release create "v${version}" ${exeGlob} --title "${title}" --notes-file "${notesFile}" --draft=false`)
  console.log(`  → Created GitHub Release v${version}`)
}

// ─── Main flow per version ──────────────────────────────────────────────────

function releaseVersion(version) {
  const subset = SUBSETS[version]
  if (!subset) throw new Error(`Unknown version: ${version}`)

  console.log(`\n╔════════════════════════════════════════════════════════════╗`)
  console.log(`║  Releasing v${version} (parent: ${subset.parent})`.padEnd(61) + `║`)
  console.log(`╚════════════════════════════════════════════════════════════╝\n`)

  ensureClean()

  // 1. Checkout parent tag
  console.log(`Step 1: Checkout parent tag ${subset.parent}`)
  run(`git checkout "${subset.parent}"`)

  // 2. Apply new files from stash
  console.log(`Step 2: Apply new files from stash`)
  applyNewFiles(subset.newFiles)

  // 3. Apply changed files from stash
  console.log(`Step 3: Apply changed files from stash`)
  applyChangedFiles(subset.changedFiles)

  // 4. Bump version
  console.log(`Step 4: Bump version files to ${version}`)
  bumpVersion(version)

  // 5. Run gates
  console.log(`Step 5: Run verification gates`)
  runGates()

  // 6. Commit + tag
  console.log(`Step 6: Commit and tag`)
  gitCommitTag(version)

  // 7. Build
  console.log(`Step 7: Build portable EXE`)
  buildPortable(version)

  // 8. Create GitHub release
  console.log(`Step 8: Create GitHub release`)
  createRelease(version)

  console.log(`\n✅ v${version} released successfully.\n`)
  console.log(`Next: \`node scripts/release-wave.cjs <next-version>\``)
}

function restoreStash() {
  console.log('Restoring stash to working tree...')
  run(`git checkout main`)
  run(`git stash pop`)
  console.log('Stash restored.')
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

const cmd = process.argv[2]
if (!cmd) {
  console.log('Usage: node scripts/release-wave.cjs <version|restore>')
  console.log('  version: one of 2.7.0, 2.7.1, 2.7.2, 2.8.0')
  console.log('  restore: pop the stash back to the working tree')
  process.exit(1)
}

if (cmd === 'restore') {
  restoreStash()
  process.exit(0)
}

if (!SUBSETS[cmd]) {
  console.error(`Unknown version: ${cmd}`)
  console.error(`Must be one of: ${Object.keys(SUBSETS).join(', ')}`)
  process.exit(1)
}

if (!stashExists()) {
  console.error(`Stash ${STASH_REF} not found.`)
  console.error('Run: git stash push -u -m release-wave-v2.7.0-to-v2.8.0-full-state')
  process.exit(1)
}

try {
  releaseVersion(cmd)
} catch (e) {
  console.error(`\n❌ Release failed: ${e.message}`)
  console.error('Working tree is in an intermediate state. Inspect with `git status`.')
  process.exit(1)
}
