# Changelog

All notable changes to this project are documented here.

> **Versioning**: Follows [SemVer](https://semver.org). See `Docs/ARCHITECTURE.md` → Versioning Policy for bump rules.

---

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
