# Changelog

All notable changes to this project are documented here.

> **Versioning**: Follows [SemVer](https://semver.org). See `ARCHITECTURE.md` → Versioning Policy for bump rules.

---

## [2.4.11] — 2026-06-10

### Fixed — Phase 2.5 CSS bundled into production build

**Critical bug**: Phase 2.5 CSS rules (skip-link, focus-visible, sr-only, prefers-reduced-motion) were added to `src/index.css`, but `src/main.tsx` imports `src/globals.css`. The CSS was never bundled into the production build, so the "Skip to main content" link was visible at the top of the page in every release.

**Root cause**: The Phase 2.5 commit added CSS to the wrong file. `src/index.css` was a dead file that no entry point imported.

**Fix**: Moved all Phase 2.5 CSS rules from `src/index.css` to `src/globals.css` (the file that actually gets imported by `main.tsx`). Deleted the dead `src/index.css`.

**Regression test**: `src/lib/__tests__/css-entry-point.test.ts` (9 new tests) verifies:
- `main.tsx` imports `globals.css` (not `index.css`)
- `src/index.css` does not exist
- The skip-link rule uses `transform: translateY(-150%)` (not `top: -100px`, which leaks visible text)
- `:focus-visible`, `.sr-only`, and `prefers-reduced-motion` are present in the correct file

This test would have caught the bug at the source-code level instead of shipping to production.

Test count: 421 → 430 (+9 new CSS regression tests), 25 → 26 test files.

---

## [2.4.11] — 2026-06-09

### Fixed — Comprehensive Audit Remediation (46 bugs)

Full audit pass addressing open bugs from the v2.3.1 audit. All fixes verified with TypeScript compilation, Rust compilation, and 421/421 tests passing. All critical/high-priority bugs resolved.

**Components (4 fixes)**:
- **C11** — LabDashboard now uses `data.labs` instead of hardcoded `DEFAULT_EXTERNAL_LABS`
- **C12** — LabDashboard derives `dailyGoalMinutes` from `weeklyGoalHours` (defaults to 6h if unset)
- **C15** — LabDashboard uses `session.createdAt` as React key instead of array index
- **C17** — SecurityNewsFeed routes all remaining hardcoded strings through personality `label()`

**Storage Layers (19 fixes)**:
- **S1** — Atomic course deletion (read index, remove course+logo, write index)
- **S3** — Runtime guard validating `DEFAULT_COURSE_ID` exists
- **S7** — `getLabCategory` validates against known category enum
- **S8** — `computeSmartScore` category gap bonus checks `focusLabsCount > 0`
- **S9** — Unified news cache validation for both Tauri and web modes
- **S10** — `readNewsCache` validates each `NewsItem` has required fields
- **S11** — News feed deduplication sorts feeds before dedup for deterministic order
- **S12** — CORS proxy response detection tries JSON parse first
- **S13** — `AbortController` timeout cleared in `finally` block to prevent timer leaks
- **S14** — Invalid dates kept as raw strings instead of replaced with `new Date()`
- **S15** — Clarified `unitOrder` handling with inline comments
- **S16** — OnceLock singleton pattern for plan storage to prevent races
- **S17** — Auto-activate newly created plans on save
- **S18** — `addActiveId` and `removeActiveId` guard against undefined `activePlanIds`
- **S23** — Enhanced corrupt row logging with data preview
- **S24** — SQLite reads wrapped in transaction for atomicity
- **S25** — Storage event listener invalidates webCache on cross-tab changes
- **S26** — DELETE+INSERT pattern prevents orphaned SQLite rows
- **S27** — Error details logged before falling back to localStorage

**Rust Backend (10 fixes)**:
- **R1** — Replaced blocking `std::fs` with `tokio::fs` in async `fetch_news`
- **R2** — Added per-task 20-second timeout
- **R3** — Added `resp.error_for_status()` check after HTTP fetch
- **R4** — Streaming body read with 10MB limit for HN and RSS feeds
- **R5** — Cache write skipped if serialization produces empty string
- **R6** — Added `tokio::sync::Semaphore` to limit concurrent feed fetches to 5
- **R7** — Global lazy `OnceLock<reqwest::Client>` for connection pooling
- **R8** — Added `log::warn!` for feed parse errors and task panics
- **R11** — Added overall 45-second timeout for `fetch_news`
- **R12** — Window state uses atomic write pattern (tmp + rename)

**Cross-Cutting (4 fixes)**:
- **X1** — Extracted `localToday()` and `toDateStr()` to shared `src/lib/date-utils.ts`
- **X2** — Created `src/lib/storage-keys.ts` with centralized constants and `migrateLegacyKeys()`
- **X3** — Schema versioning constants defined
- **X4** — Unified error logging pattern across storage layer

**A-Series (8 fixes)**:
- **A53** — LabDashboard calls `localToday()` at write time instead of capturing at mount
- **A54** — LabDashboard writes to disk before updating state to prevent silent rollback
- **A68** — DatePicker throttles scroll/resize handlers with requestAnimationFrame
- **A69** — DatePicker adds midnight timer to refresh isToday state
- **A72** — ThemeProvider adds 'system' theme mode with matchMedia listener
- **A74** — ScheduleView centralized isPending helper for consistent semantics
- **A76** — ScheduleView adds midnight timer to refresh today state
- **A79** — App.tsx validates import file structure before processing

### Changed
- **New files**: `src/lib/date-utils.ts`, `src/lib/storage-keys.ts`
- **Files modified**: 35 TypeScript, 1 Rust, 1 Cargo.toml
- **Version bumped**: 2.4.10 → 2.4.11

### Notes
- 421 tests pass. TypeScript and Rust compile clean.
- **All critical/high-priority bugs resolved.** ~30 low-priority cosmetic bugs remain (unused imports, minor UI strings, edge cases).
- Remaining open: ~30 bugs (16 component, 9 storage, 2 Rust, 0 cross-cutting, ~3 A-series).

---

## [2.4.10] — 2026-06-05

### Added — Phase 2.5 Keyboard nav + ARIA pass (WCAG-AA compliance)

Full gold-standard pass on accessibility — screen reader users can navigate the entire app with a keyboard, focus is managed on every modal/popover, and the keyboard shortcut cheatsheet is now a proper dialog instead of a transient toast.

- **`src/hooks/useFocusTrap.ts`** (NEW) — Generic focus trap hook. Moves focus to the first focusable on mount, cycles Tab/Shift+Tab within the container, fires `onEscape`, returns focus to the previously-focused element on unmount. WCAG 2.4.3 + 2.1.2 compliant.
- **`src/lib/shortcuts.ts`** (NEW) — Centralized keyboard shortcuts catalog. Single source of truth for `SHORTCUTS` array. The cheatsheet reads from this; the `?` and `Esc` handlers dispatch consistently.
- **`src/components/KeyboardShortcutsCheatsheet.tsx`** (NEW) — Modal triggered by `?`. Lists every shortcut in a categorized table. Uses `useFocusTrap`, has `role="dialog"`, `aria-modal="true"`, `aria-labelledby`. Closes on backdrop click, Esc, or X button. Returns focus to the trigger.
- **`src/index.css`** — Phase 2.5 styles added:
  - `:focus-visible` ring on every interactive element (2px solid ring token, 2px offset)
  - Skip link styles (`.skip-link`) — hidden by default, slides in on focus
  - `prefers-reduced-motion` — disables non-essential animations
  - `.sr-only` — screen-reader-only text utility
- **`src/components/NotificationToast.tsx`** — `role="status"` + `aria-live="polite"` on the toast container; `role="alert"` + `aria-live="assertive"` on `break`-type toasts so screen readers announce them.
- **`src/components/ScheduleList.tsx`** — Added `aria-label` to the search input.
- **`src/App.tsx`** — Phase 2.5 wiring:
  - **Skip link** at the top of the app, jumps to `#main-content` on Tab.
  - `<header role="banner">` and `<aside role="complementary">` landmark roles.
  - `<main id="main-content" tabIndex={-1}>` with `aria-label="Main content"`.
  - Tab strip: `role="tablist"`, each tab `role="tab"` with `aria-selected` and `aria-controls`.
  - Tab panels: `role="tabpanel"` with `id="tabpanel-{id}"` and `aria-labelledby`.
  - All 3 popovers (theme, mode, notification settings) use `useFocusTrap` for keyboard navigation.
  - `?` shortcut opens the cheatsheet, `Esc` closes it (and any open popover/modal).
- **New personality labels** (`cheatsheetTitle`, `cheatsheetSubtitle`, `cheatsheetFooter`, `skipToContent`) added to all 13 modes.
- **New dev dependency**: `vitest-axe` for automated WCAG audits in CI.
- **23 new tests** across 4 new test files: `useFocusTrap` (6), `KeyboardShortcutsCheatsheet` (8), `shortcuts` (8), `axe-audit` (1).
- **Version bumped 2.4.9→2.4.10** in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`.
- **Test count**: 398 → **421** (+23 new tests across 4 new test files).

### Notes
- 421 tests pass (25 files). TypeScript compiles clean. Rust compiles clean. Vite build succeeds.
- All Phase 2 features shipped with **zero engine/logic changes** — pure UI/accessibility additions.

## [2.4.9] — 2026-06-05

### Added — Phase 2 quick wins (2.1, 2.2)

- **2.1 PDF/CSV report export** (`src/components/ReportGenerator.tsx`) — New card in the Cert Path tab with three export modes:
  - **CSV** — Per-plan summary (course, plan, pages read, total, %, deadline) + domain coverage + category coverage sections
  - **JSON** — Full audit-report payload, byte-identical to the markdown export
  - **PDF** — Opens a print-friendly HTML view; user uses their browser's "Save as PDF" action. Zero PDF dependencies. Works in Tauri WebView2 AND any browser.
  - New personality labels (`reportTitle`, `reportSubtitle`, `reportExportCsv`/`Json`/`Pdf`, `reportExportSuccess`/`Failed`, `reportPrintOpened`) added to all 13 modes.
  - **6 new tests** in `src/components/__tests__/ReportGenerator.test.tsx`.

- **2.2 Native notifications** (`src/lib/notifications.ts`, `src/components/NotificationSettingsPanel.tsx`, `src-tauri/Cargo.toml`, `src-tauri/src/main.rs`)
  - New Tauri plugin: `tauri-plugin-notification` v2 registered in Rust.
  - New TS module: `loadSettings`, `saveSettings`, `requestPermission`, `sendNotification`, `scheduleDaily` (one-per-day at user-configured time).
  - New settings panel accessible via **Bell icon** in the app header — toggle daily reminder, pick time (HH:MM), toggle at-risk labs alert.
  - Browser-mode hint shown gracefully when not in Tauri.
  - In-app toast used as fallback when native send fails.
  - New personality labels (`notificationTitle`/`Subtitle`/`Enable`/`Time`/`LabsAlert`/`BrowserModeHint`/`PermissionDenied`/`Enabled`/`Disabled`/`ReminderTitle`/`ReminderBody`) added to all 13 modes.
  - **9 + 5 = 14 new tests** in `src/lib/__tests__/notifications.test.ts` and `src/components/__tests__/NotificationSettingsPanel.test.tsx`.

- **Version bumped 2.4.8→2.4.9** in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`.
- **Test count**: 378 → **398** (+20 new tests across 3 new test files).
- **New dependency**: `@tauri-apps/plugin-notification` (npm) + `tauri-plugin-notification` v2 (Rust Cargo).

### Notes
- 398 tests pass (21 files). TypeScript compiles clean. Rust compiles clean. Vite build succeeds.
- All Phase 2 quick wins shipped with **zero engine/logic changes** — pure additions: 2 new components, 1 new TS lib module, 1 new Tauri plugin, no `plan-engine.ts`/`plan-storage.ts`/`cissp-data.ts` modifications.

## [2.4.8] — 2026-06-05

### Added — Phase 2 quick wins (2.3, 2.4, 2.6)

- **2.3 Study Streak Counter** (`src/components/StreakChip.tsx`) — Inline header chip showing the current consecutive-day study streak. Pure derivation from `dailyLog` keys + `activePlanIds` — no new state, no new storage. Hidden when streak is 0. Orange flame icon + numeric badge. Wired into `App.tsx` header next to the version chip. 9 new regression tests in `src/components/__tests__/StreakChip.test.tsx`.
- **2.4 Auto-backup to file** (`src/lib/auto-backup.ts`, `src-tauri/src/main.rs:write_backup_file`) — On any plan-store mutation, snapshot the current plan set to `<appData>/backups/YYYY-MM-DD.json` (Tauri) or a parallel `localStorage` key (web/test). Idempotent: one backup per day, regardless of how many times the user logs. Auto-prune keeps the last 10 backups. New Rust commands: `write_backup_file` (validates `YYYY-MM-DD.json` filename), `list_backups`, `prune_old_backups`. 5 new tests in `src/lib/__tests__/auto-backup.test.ts`.
- **2.6 Course Builder Export** (`src/components/CourseBuilder.tsx:handleExport`) — New "Export JSON" button in the Course Builder header. Downloads the current builder state as `<course-id>.json` without persisting to the library. Re-uses the same `buildCourseConfig()` as Save, so the exported file is byte-identical to what would be saved. New personality labels: `exportCourseJson` (button text in 5 modes) and `courseExported` (toast in all 13 modes). 3 new tests in `src/components/__tests__/CourseBuilderExport.test.tsx`.
- **Version bumped 2.4.7→2.4.8** in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`.
- **Test count**: 361 → **378** (+17 new tests across 3 new test files).

### Notes
- 378 tests pass (18 files). TypeScript compiles clean. Rust compiles clean. Vite build succeeds.
- All Phase 2 quick wins shipped with **zero engine/logic changes** — pure additions: one new TS component, one new TS lib module, three new Rust commands, no `plan-engine.ts`/`plan-storage.ts`/`cissp-data.ts` modifications.

## [2.4.7] — 2026-06-05

### Added — Phase 1 completion (1.3, 1.4, 1.5, 1.6)

All four remaining Phase 1 features shipped. All are pure read-only visualizations derived from existing data — zero engine or storage changes.

- **1.3 Exam Countdown Band** (`src/components/ExamCountdownBand.tsx`). New banner at the top of the Calendar tab. Shows T-XX days remaining for each active plan that has a `targetEndDate`, plus pace status (On Track / Behind / Critical) and a small progress bar. Color-coded: green (≥ target pace), amber (lagging), red (past deadline or pace < 70%). Plans with no deadline show "No deadline" in muted text. Hidden when no active plans exist.
- **1.4 Gap Analysis** (`src/components/GapAnalysis.tsx`). New section in the Cert Path tab. Analyzes cert coverage across the 5 categories (Blue Team, Red Team, Pentest, Management, AI Security). Three tiers: **Strong** (≥ 3 certs or ≥ 15% of category), **Light** (any in-progress or planned), **Missing** (zero). Each tier grouped with its own icon and color. Empty state if no certs touched yet.
- **1.5 Career Mode** (`src/components/CareerMode.tsx`). New section in the Cert Path tab. User picks a track (5 categories) → app generates a recommended study sequence across Entry → Intermediate → Advanced → Expert levels. Shows cost estimate (parsed from `cert.cost`) and timeline estimate (2-4 months per cert). Completed certs get a green checkmark, next-up cert gets a "Next" badge, prior certs are dimmed.
- **1.6 Compliance Report** (`src/lib/audit-report.ts`, `src/components/ComplianceReport.tsx`). New section in the Cert Path tab with an "Export Report" button. Generates a markdown report: executive summary table (hours, pages, certs, readiness score, gaps), per-active-plan details, per-category coverage, gap list. Uses File System Access API (`showSaveFilePicker`) where available, falls back to download link. Report is `compliance-report-YYYY-MM-DD.md` — ready for employer budget justification.
- **`src/lib/personality.ts`** — 30+ new label keys added to all 13 personality modes (countdown, gap analysis, career mode, compliance report). Each mode gets personality-appropriate text (e.g., drill sergeant: "Battle Countdown", cyberpunk: "Exam Sys.Countdown", zero trust: "Assessment Countdown").
- **Version bumped 2.4.6→2.4.7** in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`.

### Notes
- 361 tests pass (15 files). TypeScript compiles clean. Vite build succeeds.
- **Phase 1 fully shipped**: 1.1 (Cert Roadmap) + 1.2 (Domain Analyzer) + 1.3 (Countdown) + 1.4 (Gap Analysis) + 1.5 (Career Mode) + 1.6 (Compliance Report).

## [2.4.6] — 2026-06-05

### Added — Domain Weakness Analyzer (Phase 1.2)

- **`src/components/DomainAnalyzer.tsx`** — New component that shows per-exam-domain progress vs target exam weight. Horizontal bars with dashed target-weight markers, color-coded status: "WEAK" (red) when domain progress lags target weight by >20%, "STRONG" (green) otherwise. Auto-bundles weak domains to the top with an alert banner. Wired into the Progress tab below Unit Breakdown. Only renders when the course has `examDomains` in its config — silent no-op for courses without domain data.
- **`src/types/course.ts`** — Added `CourseExamDomain` interface (id, name, weight) and `examDomains?: CourseExamDomain[]` field to `CourseConfig`. Added `domainId?: string` to `CourseUnit` to link units to exam domains.
- **`public/default-course.json`** — CISSP config now includes all 8 CBK domains as structured `examDomains` data, with each unit tagged by `domainId`.
- **`src/lib/personality.ts`** — 9 new label keys added to all 13 personality modes (`domainWeaknessAnalysis`, `domainTargetWeight`, `domainCurrentProgress`, `domainReadinessWeight`, `domainWeakness`, `domainWeak`, `domainStrong`, `domainThreshold`, `domainWeakness`-related text). Each mode gets personality-appropriate text (e.g., drill sergeant: "Enemy weight", cyberpunk: "Sector weight", zero trust: "Authorized weight").
- **No engine or storage changes** — pure read-only visualization from existing `unitProgress` data.

### Fixed — Shell injection, HTTP body, cache race, cache corruption (Rust)

- **M-29: Shell injection via RSS feed URL** (`src/components/SidebarNewsHighlights.tsx`, `src/components/SecurityNewsFeed.tsx`). Untrusted URLs from RSS/Atom feeds were passed directly to `@tauri-apps/plugin-shell`'s `open()`, allowing `file://`, `javascript:`, or `data:` URLs to execute in the desktop context. **Fix**: both news components now validate URLs with `^https://` regex before calling `open()`. Non-https URLs are logged and silently dropped.
- **M-7: HTTP body size cap** (`src-tauri/src/main.rs:225,275`). `fetch_hn_security` and `fetch_rss_feed` had no limit on response body size — a malicious or misconfigured feed could OOM the Rust process. **Fix**: both functions now check `body_text.len() > 10_000_000` (10 MB) and return empty results for oversized responses.
- **M-5: News cache write race** (`src-tauri/src/main.rs:135`). `fetch_news` spawned concurrent tasks for HN + RSS feeds, all of which wrote to the same cache file via `fs::write(news_path(&handle), ...)`. The last writer won, but intermediate writes could interleave under heavy load. **Fix**: added `NEWS_CACHE_LOCK` (std Mutex) that serializes cache file writes.
- **H-1: Cache corruption recovery** (`src-tauri/src/main.rs:386-404`). `read_news_cache` propagated read/parse errors to the frontend, causing the news UI to crash when the cache file was partially written (e.g., power loss at the wrong moment). **Fix**: on read error or invalid JSON, returns empty state (`{"items":[],"fetched_at":""}`) with a `log::warn` message. The app recovers gracefully and re-fetches on next refresh.
- **Version bumped 2.4.5→2.4.6** in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`.
- **Docs updated**: `Docs/CHANGELOG.md`, `Docs/Internal/BUGS.md`, `AGENTS.md`.

### Notes
- 361 tests pass (15 files). TypeScript compiles clean. Rust compiles clean. Vite build succeeds.
- All pending audit items (M-29, M-7, M-5, H-1) from BUGS.md are now fixed. Remaining open: M-1/M-2/M-4 (async blocking I/O — deferred to Phase 3).

## [2.4.5] — 2026-06-02

### Fixed — Root-cause hardening (replaces v2.4.4 workarounds)
The v2.4.4 patch included some defensive guards that were **workarounds** for underlying engine bugs. v2.4.5 fixes those bugs at the root so the workarounds are no longer needed.

- **`bookPageStart` / `bookPageEnd` now always defined by the engine** (`src/lib/cissp-data.ts:206-252`). Previously, when a chapter had no `bookPageStart` (e.g., front-matter / unnumbered pages), the engine left `bookPageStart` and `bookPageEnd` as `undefined`, forcing every consumer to fallback via `?? pagesStart` / `?? pagesEnd`. The v2.4.4 `applyTempLog` `effectiveEnd` fallback was a workaround for this. **Root-cause fix**: the engine now derives `bookPageEnd` from the queue page number when the chapter has no book page data — `bps + pageNum - 1` if `bps` is defined, else `pageNum`. Also fixed the `bps ?` falsy-zero bug to `bps !== undefined`.
- **`bookPageEnd` always tracks the last page in the chapter slice** (`src/lib/cissp-data.ts:251`). Previously, the update logic only fired when both `entry.bookPageEnd` and `page.bookPageStart` were defined — if the first page had `bps` but the second didn't, `bookPageEnd` stayed at the first page's book position, mismatching `pagesEnd`. **Root-cause fix**: every subsequent page now updates `bookPageEnd` to its own book position.
- **New `dedupeScheduleByDate(schedule)` helper** (`src/lib/cissp-data.ts:555-579`). Centralized dedup-by-date + dedup-by-`chapterId`-within-day for multi-plan per-course schedules. The v2.4.4 inline dedup in `App.tsx` `baseSchedule` concatenated duplicates (would double-count pages if 2 plans had DIFFERENT chapters for the same date) and `otherCoursesInfo` had no dedup at all (same bug, just less visible). **Root-cause fix**: both views now call the same helper, with chapter-level dedup that handles the edge case correctly.
- **Removed `1e9` upper-bound cap** from `validateLogEntry` (`src/App.tsx:471-477`). Arbitrary hack — the real upper bound is the schedule's `scheduleEnd` (checked in `applyTempLog`), and `pagesPerDay` math is bounded by the engine. The `Number.isFinite` / `Number.isInteger` / `< 0` checks are kept (they catch `NaN`, `Infinity`, non-integer, and negative inputs).
- **Removed `effectiveEnd` dead code** from `applyTempLog` (`src/App.tsx:517-521`). Was unreachable — `scheduleEnd` is `lastCh.bookPageEnd ?? lastCh.pagesEnd` and `lastCh.pagesEnd` is always a number, so the `??` fallback never fired.

### Added
- **`dedupeScheduleByDate(schedule)`** in `src/lib/cissp-data.ts` — see above.
- **10 new regression tests** in `cissp-helpers.test.ts` covering `dedupeScheduleByDate` (empty, single-day, multi-day dup, chapter-dedup, dayNumber preservation, sort, immutability) and the engine book-page fix (always-defined, pageNum fallback, last-page tracking).
- **1 updated test** in `plan-engine.test.ts` (the "falls back to sequential pages" test now asserts the v2.4.5 root-cause behavior: `bookPageStart: 1`, `bookPageEnd: 20` instead of `undefined`).

### Notes
- 217 tests pass (10 new). TypeScript compiles clean. Vite build succeeds.
- Zero engine semantics changed — only the bug fixes above. Queue math, anchor system, page sequencing, `mergeSchedules`, `tagChaptersWithCourseId`, `buildPageSequence`, and `syncStudyPlan` are **untouched**.
- This is the "no workarounds" patch — every defensive guard added in v2.4.4 was re-examined; those that masked engine bugs are now fixed at the root, those that were genuine defensive guards (e.g., `plansLoggedForDate` `console.error`, `handleMarkDone` rollback logging, `database.ts` corrupt-row quarantine) are kept.

## [2.4.4] — 2026-06-02

### Fixed
- **`baseSchedule` produced duplicate dates when multiple active plans share a course** (audit C1). `flatMap` of per-plan schedules would emit the same `date` twice (or more), then `mergedSchedule` would double the chapters. `src/App.tsx:262` now dedupes by date in a `Map`, concatenating chapters for plans covering the same day.
- **`yesterdayTotal` ignored committed storage when temp state was partial** (audit M-3). The temp branch returned early on the first non-empty `tempLogs` entry, missing any committed `plan.dailyLog` rows from other courses. Now sums temp state per-course (deduped) and adds committed storage for any course not yet in temp state.
- **`applyTempLog` used a non-null assertion** (audit C5) — replaced `schedule.find(d => d.date === date)!` with a real guard that logs and returns. Also added `Number.isFinite` / `Number.isInteger` / upper-bound validation in `validateLogEntry`.
- **`plansLoggedForDate` would throw in the render path** (audit H5) — replaced `throw` with `console.error` + skip-chapter. Defensive guard preserved (the v2.4.3 fix prevents the upstream bug).
- **`handleMarkDone` rollback silently swallowed failures** (audit M-31) — rollback failures now log + show a toast so the user can recover manually.
- **`database.ts` silently dropped corrupt rows / localStorage payloads** (audit H1) — SQLite corrupt rows now `console.warn` with the row id; localStorage payloads are quarantined as `<key>.corrupt-<timestamp>` and the live key cleared (recoverable vs previous silent return-empty).
- **Pace calculation could divide by NaN/Infinity** (audit M-33) — `syncStudyPlan` (`src/lib/plan-engine.ts:124`) now validates `plan.pagesPerDay` and `remaining` with `Number.isFinite` before division.
- **Placeholder test in `ui-components.test.tsx:220`** (audit C1.3) — removed. No real assertion was being made.
- **`plan-storage.test.ts` used real `setTimeout`** (audit H2.2) — replaced with `vi.setSystemTime` for deterministic time control.

### Changed
- **`package.json` scripts** (audit C1.2) — added `test`, `test:watch`, `test:coverage`, `typecheck` scripts (the `test` script was previously undocumented and only worked via direct `npx vitest`).

### Notes
- 207 tests pass (208 → 207: 1 placeholder test removed). TypeScript compiles clean. Vite build succeeds.
- All fixes are **defensive guards** — no engine, storage, or schedule logic refactored.

## [2.4.3] — 2026-05-26

### Fixed
- **"Chapter X has no courseId" runtime crash on single-course view.** `baseSchedule` builder (`src/App.tsx:250`) did not tag chapters with `courseId`/`courseLabel`, so the defensive throw in `plansLoggedForDate` (A5 fix from v2.3.1) fired whenever the user was in single-course view (the default for new installs). Extracted chapter-tagging into a pure helper `tagChaptersWithCourseId(schedule, courseId, label)` in `src/lib/cissp-data.ts`, mirroring the pattern `mergeSchedules` already uses for multi-course view. Both views now produce identical chapter shapes. The A5 throw is preserved as a defensive guard for any future code path that builds a schedule without tagging.

### Added
- **`tagChaptersWithCourseId(schedule, courseId, label)`** in `src/lib/cissp-data.ts` — pure helper that tags every chapter in a schedule with the given `courseId` and `courseLabel`. Returns a new schedule; does not mutate input. 5 new unit tests in `cissp-helpers.test.ts` cover tagging, immutability, undefined fallback, property preservation, and the regression scenario.

### Notes
- 208 tests pass (5 new, 203 existing). TypeScript compiles clean. Vite build succeeds.

## [2.4.2] — 2026-05-26

### Changed — Comprehensive Certification Roadmap Restructure
- **`src/data/cert-roadmap.json`** — Complete restructure from 4 categories to **5 high-level categories** with difficulty levels:
  - **Blue Team** (Defensive): Entry (6 certs), Intermediate (10 certs), Advanced (6 certs) — 22 total
  - **Red Team** (Offensive): Entry (2 certs), Intermediate (4 certs), Advanced (7 certs), Expert (2 certs) — 15 total
  - **Pentest**: Entry (3 certs), Intermediate (5 certs), Advanced (3 certs) — 11 total
  - **Management**: Entry (2 certs), Intermediate (3 certs), Advanced (5 certs), Expert (3 certs) — 13 total
  - **AI Security**: Entry (2 certs), Intermediate (2 certs), Advanced (3 certs) — 7 total
- **Total: 68 certifications** from reputable providers only (SANS/GIAC, OffSec, HTB, CompTIA, ISC2, ISACA, Altered Security, Zero Point Security, Security Blue Team, CyberDefenders, INE).
- **Difficulty levels** now explicit (Entry/Intermediate/Advanced/Expert) instead of 1-5 scale.
- **Cost information** standardized: SANS training noted as "~$8,949" (training + exam), self-study option mentioned.
- **Removed non-reputable providers**: EC-Council, Mosse Institute, and other low-quality certs eliminated.
- **Added comprehensive coverage**: All SANS forensics certs (GCFE, GIME, GASF, GCFA, GEIR, GNFA, GCFR, GREM, GLIR), all OffSec certs (OSCP, OSEP, OSWE, OSED, OSEE, OSCE3, OSAI, OSIR, OSTH), all HTB certs (CDSA, CPTS, CWEE, CADE, COAE), all CompTIA certs (Security+, CySA+, CASP+, PenTest+, AI+, Data+, Project+), all ISC2 certs (CISSP, CCSP, SSCP, concentrations), all ISACA certs (CISM, CISA, CRISC).
- **JSON schema changed**: `paths` → `categories`, each category has `levels` array with `entry`/`intermediate`/`advanced`/`expert` tiers.
- **`src/components/CertPathView.tsx`** — Rewritten to handle new structure:
  - Category-level collapse (shows category description and completion count)
  - Level headers within each category (Entry Level, Intermediate, Advanced, Expert)
  - Cert cards show provider, cost, and status badge
  - Progress bars for in-progress certs
  - Manual "Mark as Certified" override persisted to localStorage
  - Icon mapping updated for new category IDs (blue-team, red-team, pentest, management, ai-security)
- **No engine or storage changes** — pure read-only visualization from existing `dailyLog` data.

## [2.4.1] — 2026-05-26

### Changed — Security Operations Focus
- **`src/data/cert-roadmap.json`** — Refined from 26 certifications across 6 broad paths to **20 curated certifications** focused exclusively on **Security Operations**. Removed Foundations, Cloud Security, GRC, and Management paths. New structure:
  - **Forensics** (5 certs): CHFI, EnCE, GCFE, GCFA, CFCE
  - **Incident Handling** (5 certs): ECIH, GCIH, GSNA, BTL2, MTIA
  - **Penetration Testing** (7 certs): eJPT, Pentest+, BTL1, OSCP, GPEN, OSWE, OSEP
  - **Exploitation** (3 certs): GREM, OSEE, OSCE3
- **Difficulty ratings** now reflect Paul Jerimy's Security Certification Roadmap tiers (1-5 scale).
- **Prerequisites documented** in descriptions (e.g., OSCP required for OSEP, SANS training costs noted for GIAC certs).
- **Removed non-security-ops certs**: Network+, Security+, SecAI+, SSCP, CySA+, CCSP, AWS Security, Azure Security, GCLD, CISA, CISM, CISSP, CRISC, CISSP-ISSMP, PMP.

## [2.4.0] — 2026-05-26

### Added — Certification Roadmap (Phase 1)
- **`src/data/cert-roadmap.json`** — Static certification roadmap with 26 certifications across 6 career paths (Foundations, Pen Testing, Cloud Security, DFIR & Threat Intel, GRC, Management). Each entry includes difficulty rating (1–5), provider, exam cost, courseId prefix matching, and description.
- **`src/components/CertPathView.tsx`** — New "Cert Path" tab (4th tab alongside Calendar/List/Progress). Visual career ladder showing per-cert status: Not Started → Planned → In Progress → Completed. Progress derived from existing `dailyLog` data — auto-detects when all pages are consumed. Manual "Mark Certified" override persisted to localStorage (`ztsf:certified-certs`). Collapsible path sections with completion counts.
- **`src/App.tsx`** — Added `"cert-path"` tab type, keyboard shortcut `4`, Award icon, and `<CertPathView>` render slot. No engine or storage changes — pure read-only visualization.

## [2.3.1] — 2026-05-17

### Added — Personality Layer Foundation (Stage 1)
- **ZeroTrust.StudyForcer rename.** App renamed from "CySec CCPTL" across all files: `package.json`, `index.html`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src/App.tsx`, `src/components/PlannerPage.tsx`, `scripts/build-all.cjs`, `README.md`, `Docs/*.md`, `Arch/*.md`, User-Agent strings, test assertions.
- **`src/lib/personality.ts`** — Central personality module with 13 mode-keyed string dictionaries (3515 lines, ~256 labels + ~33 toasts + ~13 empties + 3 greetings + 4 loading + 10 tips per mode): Standard, Drill Sergeant, Cyberpunk, Script Kiddie, Zero Trust Audit, Influencer, Politician, LinkedIn Lunatic, True Crime, Weather Anchor, Passive-Aggressive Mom, Conspiracy Theorist, Elderly Reluctant. All accessors fall back to standard mode or raw key. New modes spread standard maps as fallback — only distinctive keys overridden (~20–30 explicit lines per mode).
- **`src/components/PersonalityProvider.tsx`** — React context that persists active mode to localStorage (`ztsf:personality-mode`). Provides `label()`, `toast()`, `empty()`, `greeting()`, `loading()`, `tips()` functions pre-bound to current mode.
- **`src/hooks/usePersonality.ts`** — Re-exports `usePersonality` hook + `PersonalityMode` type.

### Added — 8 Additional Personality Modes
- **Expanded from 5 to 13 modes.** 8 new personality modes added to `src/lib/personality.ts`: Influencer (`influencer`), Politician (`politician`), LinkedIn Lunatic (`linkedin-lunatic`), True Crime (`true-crime`), Weather Anchor (`weather-anchor`), Passive-Aggressive Mom (`passive-aggressive`), Conspiracy Theorist (`conspiracy`), Elderly Reluctant (`elderly`).
- **All 6 export dictionaries updated.** LABELS, TOASTS, EMPTY, GREETINGS, LOADING, TIPS each have 13 entries. Each mode spreads standard maps as fallback (~20–30 explicit overrides per mode).
- **`getSavedMode()` validation updated.** Accepts all 13 mode IDs from localStorage.
- **Duplicate key fixed.** `coursesLabel` appeared twice in elderlyLabels — removed second occurrence.
- **All 203 tests pass, TypeScript compiles clean, ESLint zero warnings** after expansion.
- **Portable EXE rebuilt.** `portable/2.3.1/ZTSFv2.3.1.exe` with all 13 modes baked in.

### Changed — Personality Layer Wired (Stages 2–7)
- **All user-facing strings** in every component now route through the personality layer: `App.tsx`, `DailyBriefing.tsx`, `PlannerPage.tsx`, `LogDialog.tsx`, `ScheduleView.tsx`, `ScheduleList.tsx`, `StudyTimer.tsx`, `ProgressDashboard.tsx`, `SidebarLabsStatus.tsx`, `SidebarNewsHighlights.tsx`, `CourseSelector.tsx`, `LabDashboard.tsx`, `SecurityNewsFeed.tsx`, `CourseBuilder.tsx`.
- **Tips system updated.** `createTipPicker()` now accepts a `PersonalityMode` parameter and pulls tips from the personality module. Includes `setMode()` for live updates.
- **Mode switch UI added** in the app header (next to theme picker). Dropdown with all 13 modes, each with icon + label + tagline. Persisted to localStorage on selection.
- **Test mocks added.** Both `ui-components.test.tsx` and `planner-page.test.tsx` mock `usePersonality()` and `formatStr()` to avoid requiring `PersonalityProvider` wrapper in tests.

### Changed — App Display
- App header title → **ZeroTrust.StudyForcer** (standard mode). Mode switch changes all text app-wide instantly.
- All toasts, empty states, greetings, loading messages, button labels, section titles, and tooltips sourced from personality module.

### Fixed
- `getLabel()` now falls back to standard mode before returning raw key, matching the behavior of `getToast()`, `getEmpty()`, etc.
- Added missing `planStarts`, `page`, `read`, `logThisToEntry` labels to standard mode dictionary.
- **DailyBriefing `noReadingToday` template not formatted.** `empty("noReadingToday")` contains `{date}` placeholder but was called without `formatStr()`, displaying literal `{date}` in the UI. Now uses `formatStr(empty("noReadingToday"), { date })`.
- **CourseBuilder `courseValidation` toast not formatted.** `tToast("courseValidation")` contains `{error}` placeholder but was called without `formatStr()` when deleting the last unit, showing literal `{error}`. Now passes proper error message.
- **Theme picker header hardcoded.** Header said "Theme" instead of using personality `label("theme")` — fixed.
- **Dead `Smile` icon import** removed from App.tsx.

### Notes
- Standard mode text is identical to the pre-personality app text in English.
- All engine/logic/data files remain untouched (queue system, anchor math, plan CRUD, schedule generation, persistence, types).

## [2.3.0] — 2026-05-17

### Added — Course Builder (in-app)
- **Course Builder integrated into the React app.** Replaces the standalone `course-builder/course-builder.html` file. Users can now create custom course configs directly inside the app: open **Planner** → click **Build Course**.
- Full-page overlay with the same form sections as the standalone tool:
  - **Course Basics:** ID (URL-safe slug), display name, subtitle, edition, publisher
  - **Units & Chapters:** Add/remove/reorder units, add/remove/reorder chapters, per-chapter page count, optional `bookPageStart`, per-unit color picker
  - **Default Settings:** pages per day, study days (day-of-week toggles), starting chapter
  - **Exam Info** (collapsible optional): format, duration, passing score, domains label, experience requirement
  - **Study Estimate** (collapsible optional): min/max minutes per page
- **Live JSON preview** in right column with validation badge — shows errors inline, disables Save until valid.
- **"Save Course to Library"** button calls `saveCourse()` → course is persisted to `data/courses/{id}.json` and immediately available in the course selector for plan creation.
- Standalone `course-builder/course-builder.html` deleted — all functionality now lives in `src/components/CourseBuilder.tsx`.

### Changed
- PlannerPage header now shows **"Build Course"** button (next to Export/Import) that opens the Course Builder overlay.
- `README.md` updated: Course Builder instructions now say "Planner → Build Course" instead of opening a standalone HTML file.
- `Docs/README.md`, `How_to_read.md` — references to `course-builder/` directory removed.

### Fixed
- **DailyBriefing `yesterdayTotal`** no longer shows 0 pages after Mark Done clears temp state. Now reads from both React temp state (pending) and committed `plan.dailyLog` (after Mark Done), so yesterday's page count persists.
- **Backup restore now includes courses.** Previously, the backup JSON contained courses but the import handler skipped them. Now courses are restored from the backup alongside plans, labs, and timer data.
- **Mark Done commits to ALL active plans per course, not just the primary.** When a course had multiple active plans sharing the same date, only the primary plan got the log entry. Now every active plan for that `courseId` receives the same commit — no more accidental data loss for non-primary plans.

### Notes
- 203 existing tests pass; `tsc -b --noEmit` clean.
- Bundle size increased by ~26 KB (CourseBuilder component).
- New `INEFFECTIVE_DYNAMIC_IMPORT` warning for `course-storage.ts` — CourseBuilder imports it statically alongside App.tsx's dynamic import. Harmless.

---

## [2.2.1] — 2026-05-15

### Changed — Rename
- **App renamed from "Study Planner" to "CySec CCPTL".** Acronym stands for "Certification Progress Tracker for Losers." Updated across 19 files: `index.html`, `tauri.conf.json`, `package.json`, `Cargo.toml`, `README.md`, `Docs/README.md`, `Docs/ARCHITECTURE.md`, `Docs/SUGGESTIONS.md`, `Arch/README.md`, `Arch/01-executive-overview.md`, `src/App.tsx`, `src/components/PlannerPage.tsx`, `src/lib/__tests__/ui-components.test.tsx`, `scripts/build-all.cjs`, `src-tauri/src/main.rs` (User-Agent), `src/lib/news-storage.ts` (User-Agent), `course-builder/course-builder.html`. Logo (graduation cap) unchanged.
- **Clean portable builds.** `scripts/build-all.cjs` now swaps the Tauri identifier to `ccptl-portable` during the build so the portable EXE gets its own AppData directory — no development/test plans leak into the release build. Identifier is restored to `studyplanner.app` after building (no diff, no git changes). Dev builds (`npm run tauri:dev`) continue to use `studyplanner.app` and keep all test data.
- **MD5 + release notes generated per build.** `scripts/build-all.cjs` now computes an MD5 hash (`CySec CCPTL vX.X.X.exe.md5`) and extracts release notes (`RELEASE_NOTES_vX.X.X.md`) from `Docs/CHANGELOG.md` into `portable/` — ready to paste straight into a GitHub Release.

### Changed — Code cleanup
- **Dead code removed.** Deleted `src/components/DailyLogModal.tsx` (replaced by LogDialog in v2.0.1), `src/variants/adaptive.css` (unused since single-variant build), `public/cissp-custom-order.json` (never referenced by seed logic). Removed empty `src/variants/` directory.
- **ESLint fixes in production code.** Removed unused imports (`DailyLog`, `getUnitColors`, `LogIn`), unused variables (`startDate`, `pagesPerDay`, `startingChapterId`, `chapterStartOverrides`, `targetEndDate`, `targetDayCount`, `anchor`, `dateToActivePlanId`, `chapters`, `isActive`, `completed`, `log`, `onMarkDone`), unused parameter (`_courseId`), cleaned up dependency arrays. Production code now has 0 ESLint errors and 0 warnings.
- **Docs reference fixed.** Removed stale `../suggestions.md` row from `Docs/ARCHITECTURE.md` Reference Documents table.

### Fixed — Data integrity
- **Timer no longer corrupts schedule math.** The timer confirmation dialog previously saved minutes as `pagesRead` in the daily log (e.g., 30 timer minutes = 30 pages consumed), which caused the queue pointer to advance incorrectly and stats to be wrong. Now the timer logs a standalone toast notification and does not touch the daily log at all — pages only come from the Log dialog. Removed related dead code in `confirmTimerLog`.
- **Multi-plan-per-course Mark Done now uses primaryActivePlanId.** When a course had multiple active plans, `handleMarkDone` found the first plan matching `courseId` via `allPlans.find()`, which could commit to an arbitrary plan. Changed to prefer `primaryActivePlanId` first, then fall back to the first active plan. Non-primary plans are no longer accidentally updated.
- **LogDialog partial failure handled gracefully.** `handleLogDialogSave` previously called `handleLogPlan` in a loop — if one plan's page value was out of range, it returned early with a break toast while other plans in the same batch still saved to temp state. Refactored `handleLogPlan` into `validateLogEntry` + `applyTempLog` so the dialog stays open on partial failure, and only valid entries are committed.
- **Mark Done toast type respects skip.** Mark Done with 0 pages (all skips) now shows an "info" toast instead of "complete", accurately reflecting that no pages were logged.

### Added
- **MIT LICENSE file at repo root.** Copyright (c) 2026 Ganron. `"license": "MIT"` added to `package.json`. Required for public GitHub repo.

### Changed — Repo cleanup
- **`tools/` renamed to `course-builder/`.** Directory and all references (`How_to_read.md`) updated.
- **`.gitignore` cleaned.** Removed redundant `/OSCAR_OVER_ARR.md` entry. Added `desktop.ini`.
- **Root `README.md` created.** Public-facing overview with features (Labs, News, timer, Course Builder), desktop + browser modes, quick start table, and link to Releases. `Docs/README.md` updated — removed stale `reports/` reference, replaced with `course-builder/`. `How_to_read.md` updated with entry for root README.
- **Course Builder docs added to README.** New "Creating Your Own Course" section with step-by-step instructions: open the HTML, fill out form, download JSON, import into app.
- **Build script simplified.** Removed `(O)` suffix logic — only one variant exists now. No tauri.conf.json patching needed.
- **Old portable EXEs removed.** `Study Planner (A) v2.2.1.exe` and `Study Planner (O) v2.2.1.exe` deleted. Replaced with `Study Planner v2.2.1.exe`.
- **Fresh portable EXE built.** `portable/Study Planner v2.2.1.exe` (16.7 MB). Installers disabled (`bundle.active: false`).

### Fixed
- **`course-builder.html`: `bookPageStart: null` → omitted.** When the book page start field is empty, the tool now uses `undefined` instead of `null`, so `JSON.stringify` omits the key entirely. Previously `"bookPageStart": null` did not match the TypeScript type (`bookPageStart?: number`, not nullable).
- **Stats bar blank / missing course pill (Bug #12).** Top-of-page stats bar showed only one course pill in the toggle and "—" in every stat cell once a second plan was created across a second course. Three fixes in `src/App.tsx`: (1) active-course stats fall back to `plans[0]` when `primaryActivePlanId` doesn't match an active plan for the current course, (2) `viewedStats` uses a `??` chain so a missing active-course entry falls through to any available stat instead of returning `undefined`, (3) new `useEffect` reconciles `primaryActivePlanId` to point at a valid plan for the current course whenever it goes stale. Calendar, schedule, and Mark Done were unaffected because they read `plans` directly without going through `primaryActivePlanId`.

### Changed — Build pipeline
- **Original variant only.** `scripts/build-all.cjs` no longer builds the Adaptive `(A)` variant. The script now runs a single Tauri build, copies `study-planner.exe` to `portable/Study Planner (O) v<version>.exe`, and exits. Adaptive-variant source (`src/variants/adaptive.css`, `VITE_VARIANT=adaptive` conditional rendering) is left in place but no longer compiled into a shipped artifact.
- **No more installers.** `src-tauri/tauri.conf.json` `bundle.active` flipped from `true` → `false`. Tauri skips MSI + NSIS bundling entirely, so builds are faster and `Installers/` is no longer populated. Removed the `msi/`/`nsis/` cleanup loop and the installer-copy blocks from `build-all.cjs`.
- The standalone exe is still produced at `src-tauri/target/release/study-planner.exe` (Cargo always produces it; bundling was the only thing skipped) and is the sole distribution artifact going forward.

### Changed — Docs
- **Roadmap split.** `Docs/ROADMAP.md` rewritten to cover only committed work — Phase 0 (shipped), Phase 1 (UX polish, 6 items), Phase 2 (hardening, 6 items: async storage, persisted temp Log/Skip, branded domain IDs, single clock source, schedule derivation in store, inviolable-rule tests). Speculative material (multi-tenant SaaS, cloud sync, mobile, AI, marketplace, LTI) moved into new `Docs/VISION.md` with a 4-question decision rubric.
- **suggestions.md description corrected.** `How_to_read.md` previously labelled it "Latest code review with H/M/L bugs"; it is actually an architecture-rationale doc explaining the frontend-heavy choice and what a Rust backend port would add. Description rewritten.
- **`OSCAR_OVER_ARR.md` added at repo root.** Parallel-universe playbook for the "$100M ARR" daydream — positioning canvas, buyer-interview script, 90-day discovery plan. Deliberately decoupled from the technical roadmap; filed alongside `How_to_read.md` and referenced from the top-level files index.
- `Docs/ARCHITECTURE.md` Reference Documents table updated to point at both `ROADMAP.md` (grounded) and `VISION.md` (speculative).
- `How_to_read.md` updated: new rows for `Docs/VISION.md` and `OSCAR_OVER_ARR.md`; suggestions.md description fixed.

### Notes
- No new dependencies. All 203 existing tests pass; `tsc -b --noEmit` clean.
- Regression in Bug #12 appeared during the 2.2.0 left-side sidebar work (`DailyBriefing`, `SidebarLabsStatus`, `SidebarNewsHighlights`). Exact triggering edit is unclear without git history, but the fix removes the failure mode regardless.

---

## [2.2.0] — undated (no changelog entry, included anyway)

### Added (inferred from code, since this version was not changelogged at the time)
- Left-side sidebar: `DailyBriefing`, `SidebarLabsStatus`, `SidebarNewsHighlights` components mounted in the desktop layout (`lg:` breakpoint) and inline on small screens.
- Browser-shell handling for these sidebar widgets via dedicated open-overlay callbacks.

### Known issue (fixed in 2.2.1)
- Stats bar regression — see Bug #12.

---

## [2.1.1] — 2026-05-09

### Fixed
- Book page display in Log dialog toast: fallback `?? 1` changed to `?? pagesStart/pagesEnd` so missing `bookPageStart` shows correct range (e.g. "p.1–p.45") instead of "p.1–p.1"
- Unit order can no longer be changed after logging begins — `handleSaveEdit` ignores `editUnitOrder` if plan has `dailyLog` entries; edit form shows amber warning banner
- Calendar selected day now persists across tab switches and overlay navigation (planner, labs, news) — state lifted from ScheduleView to App.tsx
- **Multi-plan Mark Done:** `handleMarkDone` was using `dateToActivePlanId.get(date)` to find which plan to commit to — this overwrote on shared dates and only covered the active course's plans. Changed to find plan directly by `courseId` via `allPlans`. Both plans now commit their skip/log independently.
- Skip toast now shows which plan was skipped: `"CISSP — skipped (0 pages logged)."` instead of generic message.
- **Dashboard avg % formula:** `donePages` was using `Object.keys(plan.dailyLog).length * plan.pagesPerDay` which inflated progress for skip days. Now sums actual `pagesRead` values for accurate percentage.
- **Contradictory toasts:** Entering a page before the scheduled range no longer fires both a "break" toast and a "complete" toast — now fires just the break toast and returns without saving.
- **Deadline pace with frozen unitOrder:** `handleSaveEdit` now uses the frozen `updated.unitOrder` (not `editUnitOrder`) when computing deadline-derived pace, fixing mismatch between stored order and pace calculation.
- **Empty-object truthiness:** `dailyLog[todayStr]` check now uses `Object.keys().length` instead of truthy `{}` check.
- **Removed dead code:** `flattenCourseChapters` function deleted (unused, duplicate of `flattenCourse`).
- **Course selector no longer persists selections:** `selectedCourseIds` always starts empty. No courses pre-checked in dropdown on launch.
- **Timer settings click-away dismiss:** Added fixed backdrop overlay — click anywhere outside the settings popup to close. Also closes on Escape key.
- **Timer log now persists minutes:** `confirmTimerLog` now saves timer minutes to dailyLog for the active plan. The timer modal actually does something now.
- **Backup restore validates + restores active IDs:** Imported plans are checked for `id`/`courseId` shape; malformed entries are skipped. `activePlanIds` are restored from backup.
- **Notification effect no longer re-runs on every log keystroke:** `dailyLog` removed from deps, read from ref instead. Performance fix.
- **pagesConsumedBeforeToday optimized:** Now iterates `Object.keys(plan.dailyLog)` (O(logged days)) instead of walking every day from start date to today (O(calendar days)).
- **LogDialog input upper bound:** Added `max={g.totalPages * 3}` to prevent typo-driven extreme values.
- **SVG sanitizer allows aria attrs:** Added `aria-label`, `aria-labelledby`, `aria-hidden`, `aria-describedby`, `role` to the allow-list.
- **SQLite writeStorage uses INSERT OR REPLACE:** Instead of DELETE + INSERT (full table rewrite) for every save.
- **Rust: fetch_news rate limited:** Cache file age is checked (< 5 min) before re-fetching all 15+ sources. Pressing refresh rapidly now returns cached results.
- **Rust: fragile unwrap_or fixed:** Changed `.unwrap_or(&format!(...))` to `.map(|s| s.to_string()).unwrap_or_else(|| format!(...))`.
- **Rust: dead code removed:** Deleted `read_plans_file`, `write_plans_file`, and `plans_path()` — unused since SQLite migration.
- **plan-storage.ts unitOrder check simplified:** `"unitOrder" in plan ? plan.unitOrder : existing?.unitOrder` replaces the verbose double-cast ternary.
- **ARCHITECTURE.md toast rule added:** "One toast per user action; pick the most severe outcome."
- **suggestions.md updated:** All H and M items marked as fixed. "Suggested order of attack" replaced with status table.
- **Updated date:** 2026-05-11

### Changed
- AGENTS.md renamed to ARCHITECTURE.md
- Bug history extracted to BUGS.md; changelog extracted to CHANGELOG.md

---

## [2.1.0] — 2026-05-08

### Added
- Multi-plan temp logging: `dailyLog` React state changed from flat `Record<date, entry>` to nested `Record<date, Record<courseId, {pagesRead}>>` — per-plan entries are now independent
- Dismissible tip popup (`?` button in header) with 10 rotating tips, round-robin
- Calendar legend toggle (`⚙` button in calendar header) — hidden by default, persisted in localStorage
- Tip banner (old static one below stats bar) removed — replaced by `?` button

### Fixed
- Multi-plan dailyLog overwrite: when two plans shared the same day, the second Log/Skip overwrote the first. Now per-plan entries are preserved.
- Mark Done now iterates all courseIds on a date and commits to each plan's storage independently

---

## [2.0.1] — 2026-05-06

### Added
- Queue-based scheduling model (major architectural change)
- `effectiveSliceSize` vs `plannedSliceSize` split for past unlogged days
- Fixed page queue with pointer advancement by actual consumption
- `LogDialog` modal replacing inline per-plan logging UI
- Plan creation delayed — no save until user clicks "Create Plan" in full settings form

### Fixed
- `handleMarkDone` variable destructuring bug: was iterating `Object.entries(dailyLog)` with wrong variable names (`courseId` was actually date string)
- Queue pointer advancement for unlogged past days: was advancing by `resolvedPagesPerDay`, now stays at 0

### Removed
- `completedDays` field — `dailyLog` presence is the single indicator
- `chapterChecks`, `chapterProgress` from DailyLog — simplified to `{ pagesRead, note? }`
- Inline per-plan logging UI from ScheduleView — replaced by LogDialog
- `handleToggleDay` — replaced by `handleMarkDone` as only commit point
- `DailyLogModal` component — replaced by LogDialog
