# Changelog

All notable changes to this project are documented here.

> **Versioning**: Follows [SemVer](https://semver.org). See `Docs/ARCHITECTURE.md` → Versioning Policy for bump rules.

---

## [2.2.1] — 2026-05-15

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
- `src-tauri/Cargo.toml` still reads `version = "2.2.0"` — cosmetic only (the user-visible version is sourced from `tauri.conf.json`), will be reconciled on next intentional Rust-side change.
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
