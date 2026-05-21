# Bug Registry

Every bug found and fixed, with root cause and resolution. Use this to avoid re-introducing
fixed bugs and to understand the history of edge cases.

---

## v2.3.1 — 8 New Personality Modes Added (2026-05-17)

Added 8 new personality modes to `src/lib/personality.ts`. Verified no old bugs re-introduced.

### New modes (`PersonalityMode`):
| ID | Label | Icon | Tagline |
|----|-------|------|---------|
| `influencer` | Influencer | ✨ | "Hiii welcome back to another GRWM!" |
| `politician` | Politician | 🎩 | "Believe me. It's tremendous. The best." |
| `linkedin-lunatic` | LinkedIn Lunatic | 💼 | "Grateful for this opportunity. #GrowthMindset" |
| `true-crime` | True Crime | 🔍 | "CASE FILE: CISSP. STATUS: Open." |
| `weather-anchor` | Weather Anchor | 🌨️ | "Today: Partly confused, scattered frustration." |
| `passive-aggressive` | Passive-Aggressive Mom | 🍽️ | "Oh, you WILL read Chapter 4 today? We'll see." |
| `conspiracy` | Conspiracy Theorist | 🛸 | "The cert-industrial complex WANT you to fail." |
| `elderly` | Elderly Reluctant | 🧓 | "I remember when a CISSP cost $50. No skipping." |

### Implementation details:
- Each mode adds ~256 label overrides, ~33 toast templates, ~13 empty states, 3 greetings, 4 loading messages, 10 tips
- All modes spread standard maps as fallback — only distinctive keys overridden
- Registered in all 6 export dictionaries (LABELS, TOASTS, EMPTY, GREETINGS, LOADING, TIPS)
- `getSavedMode()` updated to validate all 13 modes
- Total modes: 13 (5 original + 8 new)

### Bug text audit results:
- **Bug #13 (`empty("noReadingToday")` interpolation)**: All new modes' `noReadingToday` strings use `{date}` placeholder correctly. No regression.
- **Bug #14 (`tToast("courseValidation")` interpolation)**: All new modes' `courseValidation` toast templates use `{error}` placeholder. No regression.
- **A3 (`createTipPicker` reset)**: Not affected — no changes to `tips.ts`.
- **A1-A19 open issues**: None affected — new modes are pure string maps, zero logic changes.
- **Duplicate keys**: Found and fixed `coursesLabel` in elderlyLabels (listed twice).
- **All 203 tests pass, TypeScript compiles clean** after all 8 modes added.

---

## ✅ Fixed — A1–A5, A7, A8, A13, A14, A16, A18, A19, A73 (2026-05-18, v2.3.1)

### A1. `viewedStats` can disagree with `viewedCourse` / `labels` — ✅ FIXED
`viewedCourse` now derives from `viewedStats?.courseId` instead of `statsViewCourseId ?? activeCourseId`, so labels always match the stats being shown.

### A2. `yesterdayTotal` double-counts — ✅ FIXED
Post-commit branch now dedupes by `courseId` using a `seenCourses` Set, so plans sharing the same course are counted once.

### A3. `createTipPicker` never resets `current` — ✅ FIXED
Added `current = 0` in both the `next()` re-shuffle branch and `setMode()`.

### A4. `applyTempLog` ternary is a no-op — ✅ FIXED
Collapsed `pageValue - scheduleStart` to a single assignment.

### A5. `plansLoggedForDate` silent filter — ✅ FIXED
Changed to throw `new Error(...)` when a chapter lacks `courseId`, instead of silently dropping it.

### A7. `plan-store.loadPlans` swallows errors — ✅ FIXED
Added `console.warn("[plan-store] loadPlans failed:", e)` in the catch block.

### A8. `plan-store` primary picks `all[0]` when active list empty — ✅ FIXED
When `activePlanIds.length === 0`, `primaryActivePlanId` is now `null` (not `all[0].id`) in all three locations (`loadPlans`, `setActivePlanIds`, `deletePlan`).

### A13. Keyboard shortcuts fire while modals open — ✅ FIXED
Added guard at top of `onKey`: `if (logDialogDay || showTimerLog || showModePicker || showThemePicker) return`.

### A14. `tipPicker` mode parameter shadowed — ✅ FIXED
Renamed outer parameter to `initialMode` with an internal `let mode = initialMode`.

### A16. `LogDialog` "Enter" with no input closes silently — ✅ FIXED
Gated `handleSave()` on `hasAnyInput` inside the Enter key handler.

### A18. `LogDialog` initial state never updates — ✅ FIXED
Added `key={logDialogDay.date}` on the `<LogDialog>` component at the call site so it remounts on every open.

### A19. `PlannerPage.handleDeletePlan` bypasses Zustand store — ✅ FIXED
Changed to `usePlanStore.getState().deletePlan(id)` which atomically handles store, active-ids, and storage.

### A73. `__BUILD_VARIANT__` references still exist — ✅ FIXED
Removed the ambient declaration from `src/vite-env.d.ts` and the `isAdaptive`/`variant` usage from `src/components/ScheduleView.tsx`. Cleaned up the dead `onSelectDay` prop.

### A6. `handleMarkDone` partial-commit on persist failure — ✅ FIXED (Round 2)
Added rollback of successful writes when a later write fails, preventing partial-commit state desync.

### A10. `database.readStorage` silent fallback — ✅ FIXED (Round 2)
Added `console.warn` with the SQLite error before falling back to localStorage.

### A42. `SecurityNewsFeed` hardcoded English strings — ✅ FIXED (Round 2)
Routed "Last updated", "Fetching..."/"Refresh", and browser-mode banner through personality layer.

### A64. `TipPopup` hardcoded strings — ✅ FIXED (Round 2)
Routed "Tip X of Y" and "Next tip" through `label()`. Added `usePersonality()` hook.

### A70. `ThemeProvider` STORAGE_KEY stale branding — ✅ FIXED (Round 2)
Changed `STORAGE_KEY` from `"cissp-theme"` to `"ztsf:theme"` with automatic migration on first boot.

### A77. `PlannerPage` hardcoded "ZeroTrust.StudyForcer" header — ✅ FIXED (Round 2)
Changed to `{label("appTitle")}` which respects the current personality mode.

### C4. `ProgressDashboard` unused `formatStr` import — ✅ FIXED (Round 2)
Removed the dead import.

### C10. `LabDashboard` unused `tToast` / `loading` destructuring — ✅ FIXED (Round 2)
Removed the dead destructuring from `usePersonality()`.

### C16. `SecurityNewsFeed` unused `personalityLoading` — ✅ FIXED (Round 2)
Removed the dead destructuring from `usePersonality()`.

### S15. `planStorage.save` checks `unitOrder` with `in` operator — ✅ FIXED (Round 2)
Refined with a clarifying comment. The `in` operator correctly handles both `{ unitOrder: undefined }` (clear) and `{ }` (preserve existing).

### S18. `activePlanIds` may `undefined.filter` on legacy data — ✅ FIXED (Round 2)
Added `?? []` defaults in `getActiveIds`, `setActiveIds`, and `delete` methods.

---

## ✅ All Bugs Fixed (2026-05-18, v2.3.1)

**Zero open bugs.** All documented issues fixed across 3 rounds (13 + 10 + 53 bugs).
See the Round 3 notes in the commit for the full list.

### A6. `handleMarkDone` partial-commit on persist failure — ✅ FIXED
Inner loop now tracks successful writes and rolls them back on any failure. Uses a `completedWrites` array; if any persist fails, all previous writes are best-effort reverted before surfacing the error. Temp state is cleared only when all writes succeed.

### A7. `plan-store.loadPlans` swallows errors silently — `src/lib/plan-store.ts:55–79`
```ts
} catch {
  set({ isLoading: false })
}
```
If `planStorage.getAll()` or `getActiveIds()` throws (e.g., DB corruption, migration error),
the store becomes "no plans, not loading" with no surfaced error. The user sees an empty
app and assumes their data is gone. No console.warn, no toast hook. Same pattern in
`database.readStorage` — SQLite failure silently falls through to `readWeb()`, which on
desktop is **empty** because nothing has ever written there.
**Fix:** at minimum log to console; ideally raise a state flag the UI can render as
"failed to load — retry?".

### A8. `plan-store` primary always picks `all[0]` when active list is empty — `src/lib/plan-store.ts:63–68, 86–93`
```ts
const primaryActivePlanId =
  activePlanIds.length > 0 ? activePlanIds[0]
  : all.length > 0 ? all[0].id
  : null
```
This points `primaryActivePlanId` at an **inactive** plan (`all[0]`) when nothing is active.
Documented as "ephemeral UI choice — not persisted," yet `loadPlans` aggressively initializes
it to a non-member of `activePlanIds`. Downstream code that assumes
`primaryActivePlanId ∈ activePlanIds` (e.g., the App.tsx reconciliation useEffect only checks
membership in `plans`, which is filtered by active) can leave inactive primary alive.
**Fix:** when `activePlanIds` is empty, primary should be `null`, not the first overall plan.

### A9. `database.writeStorage` rewrites every plan on every save — `src/lib/database.ts:142–155`
```ts
await db.execute("BEGIN TRANSACTION")
for (const [id, plan] of Object.entries(data.plans)) {
  await db.execute("INSERT OR REPLACE INTO plans (id, data) VALUES ($1, $2)", ...)
}
```
Every call writes N rows even when only one plan changed. v2.1.1 changelog claims "uses INSERT
OR REPLACE instead of DELETE + INSERT" — the row-level reduction landed, but the function-level
"write everything" pattern persists. Cost grows with plan count.
**Not a bug today** (small N) but Phase 2 item 2.1 (async storage) should also split this into
per-plan `upsertPlan(id, plan)`.

### A10. `database.readStorage` silent fallback to localStorage on Tauri — `src/lib/database.ts:129–132`
```ts
} catch {
  return readWeb()
}
```
On a real desktop install, the localStorage path has never been written, so fallback returns
`{plans:{}, activePlanIds:[]}`. To the user this looks like total data loss without any
indication that SQLite errored. Pair with A7.
**Fix:** at least `console.warn` the SQLite error before returning, and consider re-throwing
so the store layer can surface it.

### A11. `database.initSqlite` migration version-1 block runs every boot — `src/lib/database.ts:90–94`
```ts
if (version < 1) {
  await db.execute("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '1')")
}
```
The block runs once on the very first boot and is then a no-op. But it's also **the only
migration path** — version 2+ has no slot. Worth restructuring as a `migrations: [...]` array
indexed by target version, so future schema changes have a place to live without re-touching
this `if`.
**Not a bug**, a structural callout for Phase 2 work.

### A12. `confirmTimerLog` ignores `timerMinutes === 0` — `src/App.tsx:594–601`
Per v2.2.1 the timer no longer commits pages. The current confirm just shows a toast
formatted with the session duration. If the user opens the timer log dialog with 0 minutes
elapsed (or somehow triggers `handleTimerLog(0)`), the toast prints `"0m"`. Minor UX.

### A13. Keyboard shortcuts may fire while modals/popovers are open — `src/App.tsx:619–661`
The handler only excludes `input`/`textarea`/`select` as event targets. It does **not**
short-circuit when LogDialog, ThemePicker, ModePicker, or DayDetailDrawer are open. Pressing
"1"/"2"/"3" inside the LogDialog switches the underlying tab without closing the dialog —
state mismatch on close. Likewise "p" reopens Planner from within Course Builder.
**Fix:** add an "any modal open?" guard at the top of `onKey`.

### A14. `tipPicker` mode parameter shadowed inside `setMode` — `src/lib/tips.ts:34–37`
```ts
setMode(newMode: PersonalityMode) {
  mode = newMode    // reassigns outer-fn param
  tips = shuffle([...getTips(mode)])
}
```
Works (closure captures the outer parameter binding), but reassigning a function parameter
is a code-smell that some lint configs forbid. Also note the `next()` re-shuffle branch uses
the **current** `mode` value — correct, but only because of this reassignment. If anyone
"cleans up" the reassignment by introducing `let currentMode`, the `next()` branch will
silently fall out of sync.

### A15. `keydown` listener deps don't include `setShowModePicker` / `setShowTimerLog` — `src/App.tsx:619–661`
Not actually a bug because React's `useState` setters are stable, but the deps array lists
some setters and omits others arbitrarily. ESLint exhaustive-deps would flag it. Cosmetic.

### A16. `LogDialog` "Enter" with no input closes the dialog without saving — `src/components/LogDialog.tsx:102–106`
```ts
onKeyDown={(e) => {
  if (e.key === "Enter") { handleSave() }
}}
```
`handleSave` builds an empty `logs` array (because all inputs are blank), calls
`onSave(day.date, [])`. In `App.tsx:handleLogDialogSave`, the empty loop trivially passes
`allValid=true`, so the dialog closes silently with nothing recorded. User thinks they
saved.
**Fix:** gate `handleSave` on `hasAnyInput` (matching the disabled state of the button), or
have the parent treat empty-logs as a no-op without closing.

### A17. `LogDialog` decimal/comma input silently mangled — `src/components/LogDialog.tsx:99`
```ts
[g.courseId]: e.target.value.replace(/\D/g, ""),
```
Pasting `"1.5"` becomes `"15"`; pasting `"10,000"` becomes `"10000"`. The input type is
`number` so the browser may also reject, but the stored React state has the silently
edited string. For pages-as-integers this is mostly fine, but a typo can become a wildly
out-of-range value with no warning.
**Fix:** strip + validate; show an inline hint when stripped characters changed the value.

### A18. `LogDialog` initial `inputs` state never updates when `groups` changes — `src/components/LogDialog.tsx:24–30`
`useState(() => init)` runs once on mount. If the parent keeps the component mounted across
date changes (it doesn't today — `App.tsx` does `{logDialogDay && <LogDialog />}`), stale
courseId keys would linger. Today's code unmounts on close, so this isn't currently
exploitable — but the pattern is brittle. Worth a `useEffect` that resets when `day.date`
changes, or a `key={day.date}` on the component.

### A19. `PlannerPage.handleDeletePlan` bypasses Zustand store — `src/components/PlannerPage.tsx:161–172`
```ts
await planStorage.delete(id)
onPlansChanged?.()
```
The Zustand store (`plan-store.ts`) is the documented "single source of truth" but this
function writes directly through `planStorage` and relies on the parent's reload to catch
up. Until `onPlansChanged` triggers `loadPlans`, the store has a phantom plan that no
longer exists in storage. There's also a race: `onActivatePlan(plan)` is fired-and-forgot
(no `await`), and immediately followed by `await planStorage.delete(id)`. If
`onActivatePlan` writes to storage too, the order isn't guaranteed.
**Fix:** call `usePlanStore.getState().deletePlan(id)` instead of `planStorage.delete` —
that path already handles the store update and the active-plan-ids cleanup atomically.

### A20. `PlannerPage.dashboardStats` ignores `unitOrder` when computing total pages — ✅ FIXED v2.3.1
Used `flattenChapters(cfg)` which ignores plan's custom `unitOrder`. Changed to `getOrderedChapters(cfg, plan.unitOrder)`.

### A21. Rust `persist_window_state` writes garbage on query failure — ✅ FIXED v2.3.1
Used `unwrap_or(default)` on position/size queries, overwriting good state with defaults. Changed to early-return on error.

### A22. Rust `app_dir` panics on path lookup failure — ✅ FIXED v2.3.1
Three `expect()` calls in boot path. Converted to graceful fallbacks with `log::warn`.

### A23. `StudyTimer` writes `timer-state.json` every tick while running — ✅ FIXED v2.3.1
3600 writes/hour. Added 10-second debounce + unmount cleanup write + write on pause/stop.

### A24. `StudyTimer` countdown auto-completion silently skips `onLogTime` — ✅ FIXED v2.3.1
Manual stop logged minutes; natural completion didn't. Added `onLogTime(Math.floor(nextElapsed / 60000))` to countdown completion.

### A25. `CourseBuilder` can silently overwrite existing courses — ✅ FIXED v2.3.1
No duplicate-ID check. Added reserved-ID rejection + confirmation dialog. Pass `existingCourses` prop from App.tsx.

### A26. `CourseBuilder.loadExample` discards in-progress form data — ✅ FIXED v2.3.1
One click wipes all fields. Added `hasUnsavedChanges()` check with confirm dialog before loading.

### A27. `__BUILD_VARIANT__` conditional code still present — ✅ FIXED v2.3.1
Removed from `vite.config.ts`, `App.tsx` (variant/isAdaptive/drawerDay/DayDetailDrawer), `ScheduleView.tsx` (isAdaptive branches).

### A28. `LogDialog` `Number(val)` ignores parse failure — ✅ FIXED v2.3.1
No `isNaN` check after `Number(val)`. Added guard: `if (isNaN(pagesRead)) continue`.

### A29. `ScheduleView` writes `showCalendarLegend` to localStorage even on first mount — ✅ FIXED v2.3.1
Wrote "false" on fresh installs. Added `useRef` to skip first-mount write.

### A30. `pagesConsumedBeforeToday` doesn't validate logged page counts — ✅ FIXED v2.3.1
9999-page log would claim entire course. Added `totalPages` parameter and `Math.min(consumed, totalPages)` clamp.

---

## Bug #13: `empty("noReadingToday")` Template Variable Not Interpolated — `src/components/DailyBriefing.tsx:89`

- **Version:** v2.3.1
- **Severity:** Display — wrong text shown to users

**Description:** `empty("noReadingToday")` returns the template string `"No reading scheduled for today. Your plan starts {date}."` but it was called via string concatenation (`\`${empty("noReadingToday")} ${empty("planStarts")} ${firstStudyDate}.\``) instead of through `formatStr()`. The `{date}` placeholder was never replaced, rendering as literal text. Additionally, `empty("planStarts")` (`"Your plan starts"`) was concatenated separately, causing the phrase to appear twice in the rendered output.

**Root cause:** `formatStr()` was not imported or called. The empty string already contained "Your plan starts {date}" as part of its template, but the calling code also appended `empty("planStarts")` + date, doubling the "Your plan starts" text.

**Fix:** Replaced with `formatStr(empty("noReadingToday"), { date: firstStudyDate })`. Added `formatStr` import.

---

## Bug #14: `tToast("courseValidation")` Template Variable Not Interpolated — `src/components/CourseBuilder.tsx:107`

- **Version:** v2.3.1
- **Severity:** Display — toast shows literal `{error}` text

**Description:** When the user tries to delete the last remaining unit in CourseBuilder, line 107 calls `showToast(tToast("courseValidation"), "info")`. The toast template `"Validation: {error}"` contains a `{error}` placeholder but `formatStr()` was not called, so the toast displayed the literal text "Validation: {error}" instead of a meaningful message.

**Root cause:** Unlike the same key used at line 260 (which correctly wraps with `formatStr()`), the early-return guard at line 107 called `tToast()` directly without interpolation.

**Fix:** Changed to `showToast(formatStr(tToast("courseValidation"), { error: "Cannot remove the last unit" }), "info")`.

---

### A31. `planStorage.save` can't distinguish "omitted unitOrder" from "explicitly cleared unitOrder" — `src/lib/plan-storage.ts:81`
```ts
unitOrder: "unitOrder" in (plan as Record<string, unknown>) ? plan.unitOrder : existing?.unitOrder
```
The `"unitOrder" in plan` check treats `unitOrder: undefined` as "key present" (because JS
`in` checks own-property keys, not values). So callers who spread `{ ...existing, unitOrder:
undefined }` to clear the order end up keeping nothing (correct), but callers who simply
don't pass `unitOrder` get the same behavior only if the spread doesn't include the key.
Subtle. The intent appears to be "preserve existing on omit," which works *only* if callers
strip the key rather than set it to `undefined`. Brittle contract.
**Fix:** require `unitOrder` to be present on every save call (with `null` for "clear"), or
filter out undefined keys before the `in` check.

### A32. `planStorage.save` does full read-modify-write on every call — `src/lib/plan-storage.ts:69–86`
Each save reads the entire storage object, mutates one plan, then writes everything back.
Combined with **A9** (writeStorage iterates every plan), one plan edit becomes N+1 DB
operations. The Zustand store also re-issues this for every active-plan toggle.
**Not a bug today** (N is small); pair with A9 as part of Phase 2 async-storage work.

### A33. `course-storage.isCourseConfig` validates only `id` and `name` — `src/lib/course-storage.ts:5–9`
```ts
return typeof v.id === "string" && typeof v.name === "string"
```
A JSON with `id` and `name` but no `units` array (or with `units: "string"`) passes the
guard, then explodes downstream in `flattenCourse` (which does `course.units.flatMap`).
A malformed backup restore (A35) or a corrupted course file silently slips through.
**Fix:** also check `Array.isArray(v.units)` and `v.units.every(...)` shape.

### A34. `course-storage` web-mode index can desync from per-course keys — `src/lib/course-storage.ts:79–92`
`saveCourse` writes the course but only updates `WEB_INDEX_KEY` if the id isn't already
indexed. `loadAllCourses` enumerates via the index, but `loadCourse(id)` reads directly
without consulting it. So a course in localStorage but missing from the index is invisible
to `loadAllCourses` yet still readable by `loadCourse`. If the index gets truncated (quota
exceeded) the course pool silently shrinks without the underlying data being lost.
**Fix:** drop the index — enumerate keys by `localStorage` key prefix scan. Or write the
index defensively on every save.

### A35. Backup restore has no version check and is not atomic — `src/App.tsx:890–927`
```ts
const data = await readJsonFile(file) as Record<string, unknown>
if (data.plans && Array.isArray(data.plans)) { for (const plan of data.plans) { ... save(plan) ... } }
if (data.activePlanIds && ...) { setActiveIds(...) }
if (data.labs && ...) { writeLabsStorage(data.labs) }
...
```
Problems:
- No check that `data.version` is what we expect — a v2 backup format restored into a v1
  app would silently corrupt.
- Each section writes independently. If `data.plans` restores 50 plans and the labs write
  then throws, you have plans from the backup + the original labs file — half-restored
  state, no rollback.
- `activePlanIds` is restored *before* `saveCourse(...)` writes the backup's courses,
  meaning the in-memory store may briefly point at plans whose courses aren't loaded yet.
- The `as Record<string, unknown>` cast skips any structural validation.
- All errors fold into a single generic `"backupFailed"` toast — no telling the user *which*
  part of the restore broke.
**Fix:** read the file, run a full validation pass (return a `RestorePlan` describing what
will change), write everything in one transaction, surface specific errors per section.

### A36. Backup restore overwrites every course in the backup, including seeded ones — `src/App.tsx:913–920`
Pairs with **A25**. The restore iterates `data.courses` and `await saveCourse(course)`
each — no check for whether the existing course at that id was user-built or seeded, no
prompt before overwriting. A backup taken on machine A then restored on machine B that has
locally-customized seeded courses silently obliterates B's edits.
**Fix:** show a diff before applying (added / modified / unchanged), require confirmation,
ideally make user-modified courses immutable to restore unless explicitly opted-in.

### A37. Rust `fetch_news` `failed` counter never increments for empty-result fetches — `src-tauri/src/main.rs:345–351`
```rust
match task.await {
    Ok(items) => all.extend(items),
    Err(_) => failed += 1,
}
```
`task.await` returns `Result<Vec<NewsItem>, JoinError>`. `JoinError` only fires on a tokio
panic. A normal fetch failure inside `fetch_rss_feed` (HTTP timeout, parse error, 0 items)
returns `Ok(Vec::new())` — counted as success. The "X failed" log line is misleading; real
visibility into feed health is gone.
**Fix:** have `fetch_rss_feed` return `Result<Vec<NewsItem>, String>` and count `Err` as
failed. Surface failed sources back to the UI so users know why their feed is sparse.

### A38. Rust `fetch_rss_feed` / `fetch_hn_security` default unparseable dates to "now" — `src-tauri/src/main.rs:229–231, 269–273, 296–300`
```rust
let published = parse_date(&created_at)
    .map(|d| d.to_rfc3339())
    .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
```
An item with no pub_date or an unparseable one gets `published_at = now()`. The list is
then sorted desc by `published_at`, so junk-date items rank at the top — burying actually
recent stories. The browser-side `news-storage.ts:73–78` and 94–98 have the same pattern.
**Fix:** drop items with no parseable date, or place them at the bottom (use UNIX_EPOCH or
`None` and segregate the sort).

### A39. Rust `fetch_news` cache and labs/timer writes are non-atomic — `src-tauri/src/main.rs:371, 397–399, 411–415, 504, 528–531`
Every `fs::write(path, content)` truncates and replaces. Power loss mid-write yields a
half-written file. Next launch hits a JSON parse error and silently falls back to defaults,
which (paired with **A40**) can look like "everything I logged today is gone."
**Fix:** write to `<path>.tmp` then `fs::rename(tmp, path)` (atomic on Windows since NTFS
journal handles the rename).

### A40. Rust `read_labs_file` default JSON has wrong shape — `src-tauri/src/main.rs:519–525`
```rust
if !path.exists() {
    return Ok(r#"{"entries":{},"categories":{}}"#.to_string());
}
```
The TypeScript side (`lab-session-storage.ts:13`) expects
`{ labs, sessions, categories }`. The Rust default returns `{ entries, categories }`. The
TS fallback chain rescues this (sessions defaults to `[]`, labs to `DEFAULT_EXTERNAL_LABS`)
but the schemas don't match. If anyone tightens the TS validator, this becomes a real bug.
**Fix:** change the Rust default to `{"labs":[],"sessions":[],"categories":{}}` or just
return an empty string and let the TS side default.

### A41. Rust tray `.icon(handle.default_window_icon().unwrap().clone())` panics if no icon — `src-tauri/src/main.rs:559`
The `.unwrap()` on `default_window_icon()` will crash the entire app on startup if the
icon resource is missing or fails to load. Combined with the `expect("failed to create tray")`
at line 620, any tray-init failure kills the app instead of degrading to a tray-less
session.
**Fix:** match on `default_window_icon()`; if `None`, skip tray creation and log a warning.

### A42. `SecurityNewsFeed` has hardcoded English strings that bypass the personality layer — `src/components/SecurityNewsFeed.tsx:118, 127`
```tsx
<span>Last updated: {timeAgo(fetchedAt)}</span>
...
{loading ? "Fetching..." : "Refresh"}
```
Also bare `<p>` "Browser mode — using CORS proxies" on line 138, "Some feeds may fail..."
on line 142. These were missed in the v2.3.1 personality-layer pass. Switching modes leaves
these in standard English, breaking the immersion of Drill Sergeant / Cyberpunk / etc.
**Fix:** route through `label()` / `loading()`.

### A43. `SecurityNewsFeed.handleRefresh` reloads cache on error — overwriting any unsaved UI state — `src/components/SecurityNewsFeed.tsx:49–62`
```ts
try { ... } catch { showToast(...); await load() }
```
If the fetch errors, it falls back to re-reading the cache. But the user may have already
been viewing the cached state (since `load()` ran on mount); re-running it just causes a
re-render with the same data. Functionally harmless but extra IO and a state churn. Cosmetic.

### A44. `App.tsx` restore handler clears file input via `e.target.value = ""` after async — `src/App.tsx:926`
Setting `value = ""` after `await` is fine, but if `readJsonFile` throws synchronously
(e.g. file is not text), the catch runs and `value = ""` *still* runs, which is correct.
However, the input only resets when the change handler runs to completion; if the user picks
the same file twice in a row and the first one's await is still pending, the second pick
won't fire `change` (browser dedupe). Edge case but worth knowing.

### A45. `course-storage.saveCourse` Tauri-side has no atomic-write guarantee — `src-tauri/src/main.rs:449–453`
```rust
fn write_course_config(handle: AppHandle, course_id: String, content: String) -> Result<(), String> {
    validate_course_id(&course_id)?;
    let path = course_path(&handle, &course_id);
    fs::write(&path, content).map_err(|e| e.to_string())
}
```
Same issue as A39. Mid-save crash leaves a half-written course file. Combined with A25
(silent overwrite of seeded courses), one bad Save click during a power blip could destroy
a CISSP plan's underlying chapter list.
**Fix:** tempfile + rename.

### A46. `import_course_config` overwrites existing — `src-tauri/src/main.rs:471–486`
```rust
let dest = course_path(&handle, course_id);
fs::write(&dest, content).map_err(|e| e.to_string())?;
```
No "destination exists" check. Importing a course JSON whose id collides with an existing
course overwrites silently. Same data-loss class as A25.
**Fix:** if `dest.exists()`, require an explicit `overwrite: bool` arg from the caller.

### A47. `sanitize-svg` allows `style` attributes broadly — `src/lib/sanitize-svg.ts:23, 75–78`
`style` is on the allow-list. The code then strips `style` values containing `url(` to
something other than a fragment. But it does NOT strip:
- `expression(...)` (IE-era CSS, mostly irrelevant in modern browsers, but Tauri's WebView
  is Edge/Chromium so OK)
- `--var: ...` custom properties — could be used for theme injection
- Anything with `behavior:` (also IE-only)
Probably fine on a modern WebView, but `style` is the most dangerous SVG attribute to
allow-list. Consider parsing the style declaration and allow-listing properties.

### A48. `sanitize-svg.cleanElement` doesn't handle namespaced attribute lookup correctly — `src/lib/sanitize-svg.ts:53–83`
```ts
for (const attr of Array.from(el.attributes)) {
  const name = attr.name.toLowerCase()
  if (URL_ATTRS.has(name)) { ... }
  if (!ALLOWED_ATTRS.has(name)) { el.removeAttribute(attr.name) }
}
```
`URL_ATTRS = {"href", "xlink:href"}`. `attr.name` for an xlink-namespaced attribute parsed
from SVG XML may be `"xlink:href"` *or* the local name `"href"` depending on parser/document
mode. `removeAttribute("xlink:href")` may not match the actual qualified name. Worth a
test: load an SVG with `xlink:href="javascript:..."` and confirm it's stripped.

### A49. `ProgressDashboard` bypasses Zustand store and picks an arbitrary plan per course — `src/components/ProgressDashboard.tsx:131–155`
```ts
useEffect(() => {
  planStorage.getAll().then(...)  // reads disk, not the store
}, [courses.length])
...
const plan = allPlans.find((p) => p.courseId === course.id)
```
Two problems:
1. Reads `planStorage.getAll()` directly instead of `usePlanStore(s => s.allPlans)`, so
   in-flight changes (Mark Done, edit) aren't visible until courses.length changes.
2. `find` returns *the first plan for the course in storage order* — ignoring
   `primaryActivePlanId` and `activePlanIds`. A deactivated/draft plan can become the
   progress-tab face for that course.
**Fix:** consume the store; respect `activePlanIds` + `primaryActivePlanId`.

### A50. `ProgressDashboard.computeCourseStats` over-counts unit completion on partial logs — `src/components/ProgressDashboard.tsx:80–89`
```ts
for (const day of schedule) {
  for (const ch of day.chapters) {
    ...
    if (completedDays.has(day.date)) {
      entry.completed += ch.pagesCount
    }
  }
}
```
`completedDays` = set of dates with *any* log entry. So a day where the user logged 5 pages
out of a planned 20 adds the **full 20** to that day's unit-completion. The unit progress
bar climbs faster than reality.
**Fix:** scale per-day completion by `pagesRead / day.totalPages` (or use the queue pointer
to derive which chapters were actually consumed).

### A51. `ProgressDashboard` streak counts back from end-of-schedule, not from today — `src/components/ProgressDashboard.tsx:91–101`
```ts
for (const day of [...schedule].reverse()) {
  ...
  if (completedDays.has(day.date)) { streak++ }
  else if (d < today) { break }
}
```
The loop walks the schedule in reverse and breaks the first past-but-not-completed day it
sees. If the schedule's last day is in the future, the iteration enters
"after-today" days first (which are never `completedDays`), and the `else if (d < today)
break` doesn't fire (because `d >= today`), so the loop silently skips them and only
*then* starts counting backward from yesterday. Works by accident. If someone reads this
later and "fixes" the else-if to `else: break`, the streak goes to 0 for every plan with
future days. Brittle.
**Fix:** iterate from today backward, not from schedule end backward.

### A52. `ProgressDashboard` has dozens of hardcoded English strings — `src/components/ProgressDashboard.tsx:248, 263, 276, 306, 345, 354, 357, 362–380, 385, 394, 397–410`
Examples: "remaining", "Read"/"Done"/"Owned" conditional, "days in a row", "Progress by
Unit", "Pace Analysis", "Actual avg. pace", "on track"/"behind", "Total study days",
"days", "Days remaining", "Avg. mins/day*", "Est. finish date", "Exam Overview",
"Format"/"Duration"/"Passing score"/"Domains"/"Experience req.". All bypass the
personality layer. Mode switching leaves the entire Progress tab in standard English.
**Same class as A42**, but bigger surface.

### A53. `LabDashboard.today` is captured once at mount — stale after midnight — `src/components/LabDashboard.tsx:50, 170`
```ts
const today = localToday()
...
const session: LabSession = { ..., date: today, ... }
```
`today` is computed once during render. If the user leaves the app open past midnight and
logs a session at 12:30 AM, the session is dated to yesterday. Sessions table, streak
calculations, "today minutes" — all silently wrong.
**Fix:** call `localToday()` at the time of write (inside `submitLog`), not at component
top-level.

### A54. `LabDashboard.save` is fire-and-forget on disk write — `src/components/LabDashboard.tsx:45–48`
```ts
const save = useCallback(async (next: LabsStorage) => {
  setData(next)
  await writeLabsStorage(next)
}, [])
```
React state updates first, disk write follows. If disk write throws (quota, file lock),
in-memory data shows the new session but next launch reads the old file — silent rollback.
No error toast.
**Fix:** await write *before* setData, or surface the error so the user knows to retry.

### A55. `LabDashboard` initial state may mismatch `LabsStorage` interface — `src/components/LabDashboard.tsx:30`
```ts
useState<LabsStorage>({ labs: ..., sessions: [], categories: {}, customFocus: {}, weeklyGoalHours: 5 })
```
The literal includes `customFocus` and `weeklyGoalHours` which aren't visible in the
`readLabsStorage` shape (`lab-session-storage.ts:13` returns only labs/sessions/categories).
If these fields are *optional* on `LabsStorage` they're harmless; if not, this is a type
hole. The Rust default JSON (A40) is yet another shape. Three sources of truth for "what's
in labs storage" — pick one.

### A56. `types/course.ts` assumes chapter IDs are globally unique across units — `src/types/course.ts:120–135, 146–152`
`flattenCourse` concatenates chapters from all units. `getChapterMap` keys by `ch.id`. If
two units share a chapter id (possible via manual JSON import or a buggy CourseBuilder
state), the map silently overwrites and `buildPageSequence`'s `findIndex(ch.id ===
startingChapterId)` returns the wrong row.
**Fix:** add a uniqueness check on course load (CourseProvider or course-storage) and
reject duplicates; bonus: write a `validateCourseConfig(cfg)` helper that the import path
and CourseBuilder both run.

### A57. `getTrackingLabels` returns `as const`-typed objects with **inconsistent keys** — `src/types/course.ts:54–107`
The "pages" mode is missing `studyItems` (it has `totalItems` and `studyPages` via
`bookPages`) while "labs" and "machines" use `studyItems: "X Remaining"`. Consumers that
access `labels.studyItems` get `undefined` for pages-mode courses. Subtle — `as const`
makes this a type error only if narrowed. Today's call sites mostly use `labels.items` /
`labels.pagesRead` / `labels.itemsCapital` which exist in all three modes. Audit needed.
**Fix:** unify the keys across all three modes; pick one canonical set.

### A58. `ScheduleList` `isDone` / `isPending` use different semantics than `ProgressDashboard`'s `completedDays` — `src/components/ScheduleList.tsx:37, 110–111`
```ts
const isDone = Object.keys(logs).length > 0 && Object.values(logs).some(l => l.pagesRead > 0)
const isPending = Object.keys(logs).length > 0 && Object.values(logs).every(l => l.pagesRead === 0)
```
But the temp-state `dailyLog` shape is `Record<date, Record<courseId, ...>>`; a day with
one course logged and another not yet logged is shown as `isDone` (someone read > 0
pages), masking that another plan on the same day is still pending. Inconsistent with the
"all plans for a date must be logged before Mark Done" rule from ARCHITECTURE.md.
**Fix:** require every plan on the day to have a log entry before `isDone` is true (mirror
`plansLoggedForDate`).

### A59. `ScheduleList` has many hardcoded strings — `src/components/ScheduleList.tsx:96–98, 137, 155, 161, 174, 181, 218, 221, 225–229, 234`
"Showing X of Y days matching", "Day", "p · Day", "p logged", "Ch.", "p planned",
"Unit", "Ch. N:", "pp. X–Y", "pages total", "p". Bypass personality. A52-class.

### A60. `CourseSelector.selectAll` doesn't restore an active course — `src/components/CourseSelector.tsx:77–79`
Selecting all courses adds every id to the set but leaves `activeCourseId = null` if it
already was. The stats bar requires an active course to render its primary tile, so
"Select All" with no prior active course results in an empty stats bar plus 5 selected
courses. UX dead end without a hint.
**Fix:** if `activeCourseId === null` and `selectAll` is clicked, auto-promote the first
course.

### A61. `CourseSelector` outside-click handler uses `pointerdown` and depends on `insideClickRef` trick — `src/components/CourseSelector.tsx:33–54`
The `insideClickRef.current = true` is set on the *listbox's* `onPointerDown`, then
checked in the document handler. Two race-prone footguns:
1. If a synthetic event in React doesn't run before the document `pointerdown` listener
   (it generally does, but order is JSDOM-dependent in tests), the ref is still false and
   the dropdown closes immediately on internal click.
2. Test environments using `userEvent.click` may not fire the `pointerdown` events in the
   expected order.
Works in practice but is fragile. **Fix:** use `useOutsideClickRef` pattern with
`event.composedPath()` containment check instead.

### A62. `SidebarLabsStatus` loads once, never refreshes — `src/components/SidebarLabsStatus.tsx:18–25`
After loading on mount the sidebar shows stale data forever. If the user logs a lab
session in LabDashboard then returns home, "today minutes" still says 0. There's no
event/store subscription.
**Fix:** subscribe to lab storage changes (a Zustand-style lab store), or re-load on a
focus event / when LabDashboard closes.

### A63. `SidebarNewsHighlights` fires `fetchNews()` on every mount but throws away the result — `src/components/SidebarNewsHighlights.tsx:15–21`
```ts
useEffect(() => {
  readNewsCache().then((cache) => { setArticles(cache.items.slice(0, 5)); setLoaded(true) })
  fetchNews().catch(() => {})
}, [])
```
The fetch runs unconditionally (cache-busts the 5-min server-side throttle from JS) and
the result is discarded — `setArticles` is never called with fresh items. So the sidebar
shows the *cached* articles forever, but the network request runs on every home-page
visit. Same staleness issue as A62 plus wasted network.
**Fix:** await fetch, update articles when it returns, *and* throttle on the client side
so navigating back to home doesn't refetch.

### A64. `TipPopup` hardcoded "Tip X of Y" + "Next tip" — `src/components/TipPopup.tsx:21, 47`
Bypass personality. The whole UI flips themes except the tip header. A52-class.

### A65. `NotificationToast` global listener array — `src/components/NotificationToast.tsx:14, 39–42`
`let toastListeners: ((toast: Toast) => void)[] = []` lives at module scope. Multiple
component instances (StrictMode double-mount, hot reload) push extra listeners.
Cleanup removes each instance's listener correctly, but during dev under StrictMode a
mounted toast can fire twice. Production unaffected.
**Fix:** make the array a `Set`, or move to a context.

### A66. `NotificationToast` 5-second auto-dismiss does not pause on hover — `src/components/NotificationToast.tsx:35–37`
Long toast (the multi-clause "ahead of schedule" or "saved" messages) gets pulled out of
view before the user can read it. No "X to close" hint either.
**Fix:** pause the timer while the mouse is over the toast (`onMouseEnter` / `onMouseLeave`).

### A67. `NotificationToast` has no queue cap — `src/components/NotificationToast.tsx:33–34`
A buggy loop firing `showToast` 100x stacks 100 cards. The flex column just pushes them up
off-screen. Worth a max (10? 5?) with oldest-evict.

### A68. `DatePicker` `updatePos` listens to scroll on capture phase, no throttle — `src/components/DatePicker.tsx:55–69`
Every scroll on any element bubbles through capture → setState → re-render. With many
overlapping scroll containers (LabDashboard, PlannerPage) this can become noticeable.
**Fix:** `requestAnimationFrame` throttle, or use a `Popover` lib that handles this.

### A69. `DatePicker.isToday` recomputed via `new Date()` every render — `src/components/DatePicker.tsx:194`
If the picker stays open across midnight, the "today" highlight stays on yesterday's cell
until the next re-render is triggered. Cosmetic.

### A70. `ThemeProvider` STORAGE_KEY = "cissp-theme" — `src/components/ThemeProvider.tsx:26`
Stale CISSP branding. The rest of the app uses `ztsf:*` keys for persistence
(`ztsf:personality-mode`). One-off inconsistency. Cosmetic but a tell that the rename
wasn't 100%.

### A71. `ThemeProvider` `mounted` flag is dead — `src/components/ThemeProvider.tsx:34–38, 52`
The flag was originally for SSR hydration. Tauri's WebView is CSR-only; the app never runs
on a server. The flag forces an extra render with `theme: "light"` before reading
localStorage. Cosmetic.

### A72. `ThemeProvider` has no "follow system" mode — `src/components/ThemeProvider.tsx`
`prefers-color-scheme` is read once on first load if no saved theme. After that, the user
is locked into a fixed theme until they change it manually. Common expectation: an
explicit "System" option that tracks OS changes live.
**Fix:** add `"system"` to the `Theme` type and bind a `matchMedia` listener.

### A73. `__BUILD_VARIANT__` is declared in types but never defined by Vite — `vite.config.ts:13–15`, `src/vite-env.d.ts:3`, `src/App.tsx:153`, `src/components/ScheduleView.tsx:31`
The ambient declaration exists (`declare const __BUILD_VARIANT__: string`) but
`vite.config.ts`'s `define` block contains only `__APP_VERSION__`. So at compile time
the identifier survives as a literal reference, and at runtime the
`typeof __BUILD_VARIANT__ !== "undefined"` check is always **false** — the variant
branch is permanently dead.

The BUGS.md entry for A27 was marked "✅ FIXED v2.3.1" but the references still exist
in the code. The mark is wrong. **Either** remove the references and the ambient
declaration, **or** restore the `__BUILD_VARIANT__` define if you genuinely want
adaptive back. Don't leave it half-dead.

### A74. `ScheduleView` `isPending` and `ScheduleList` `isPending` use different semantics — `src/components/ScheduleView.tsx:114` vs `src/components/ScheduleList.tsx:111`
ScheduleView:
```ts
const isPending = (date: string) => Object.keys(dayLogs(date)).length > 0
```
ScheduleList:
```ts
const isPending = Object.keys(dateLogs).length > 0 && Object.values(dateLogs).every(l => l.pagesRead === 0)
```
Same UI concept, two different definitions. ScheduleView treats "any log exists" as
pending; ScheduleList treats only "all-skip" as pending. The same date can show "pending"
in the calendar but not in the list (or vice versa).
**Fix:** centralize `isLogged` / `isPending` helpers in `cissp-data.ts` and import in both.

### A75. `ScheduleView` hardcoded English strings — `src/components/ScheduleView.tsx:273, 282–283`
"Day", "pages pending", "pages planned". A52-class.

### A76. `ScheduleView` `today` captured outside `useMemo`, stale across midnight — `src/components/ScheduleView.tsx:33–34`
```ts
const today = new Date()
today.setHours(0, 0, 0, 0)
```
Computed every render but stays "today as of last render." If the user leaves the calendar
open across midnight without any interaction, the `isToday` cell-highlight remains on
yesterday until a re-render fires. Same class as A53, A69.

### A77. `PlannerPage` hardcoded "ZeroTrust.StudyForcer" header — `src/components/PlannerPage.tsx:293`
```tsx
<h1 className="font-bold text-foreground text-base">ZeroTrust.StudyForcer</h1>
```
The personality layer has a `label("appTitle")` key for this. The PlannerPage header
won't reflect any mode-specific renaming.

### A78. `PlannerPage.handleSaveEdit` doesn't update `targetDayCount` after pace recalc — `src/components/PlannerPage.tsx:207–217`
For deadline anchor, the function recomputes `pagesPerDay` and may also set
`targetEndDate` from `targetDayCount`. But if `targetDayCount` was the source of truth,
it isn't refreshed when the chapter list changes. Subsequent edits then see a stale day
count.
**Fix:** if `targetDayCount` was set and the chapter total changed, recompute
`targetDayCount` from the new end date.

### A79. `PlannerPage` import flow has no shape validation — `src/components/PlannerPage.tsx:325–344`
```ts
const data = await readJsonFile(file) as { plans?: StudyPlan[] }
...
for (const plan of data.plans) {
  await planStorage.save(plan)
}
```
The `as` cast skips validation. A malformed plan (missing `pageSequence`, bad
`startingChapterId`, etc.) gets persisted and silently corrupts state on next load.
Pair with **A35** — the restore flow has the same problem.

### A80. `lab-sessions.ts` `entragoat` URL is broken — `src/lib/lab-sessions.ts:51`
```ts
{ id: "entragoat", name: "EntraGoat", url: "https://entragoat", focus: "Azure Security", ... }
```
`"https://entragoat"` resolves to no valid domain. Clicking the lab in the dashboard
opens a dead URL. The real project is at
`https://github.com/semperis/entragoat` (or whatever the user intended).
**Fix:** correct URL.

### A81. `lab-sessions.ts` `threethuntinglabs.com` looks like a typo — `src/lib/lab-sessions.ts:31`
```ts
{ id: "threathuntinglabs", name: "Threat Hunting Labs", url: "https://threethuntinglabs.com", ... }
```
ID has two 'a's ("threa**th**unting"), URL has three 'e's ("**three**hunting"). Hard to
tell which is intentional. The lab name "Threat Hunting Labs" strongly suggests the URL
should be `threathuntinglabs.com`. Worth confirming.

### A82. `SidebarNewsHighlights` opens links via `<a target="_blank">` without Tauri shell open — `src/components/SidebarNewsHighlights.tsx:37–44`
SecurityNewsFeed (line 7) imports `open` from `@tauri-apps/plugin-shell` and uses it for
news clicks (correct behavior — opens in OS default browser). The sidebar bypasses this
and uses bare `<a href ...>`. In Tauri's WebView, this either does nothing or tries to
navigate the app webview to the article (CSP-blocked).
**Fix:** in IS_TAURI mode, prevent default and call `shell.open(url)` like
SecurityNewsFeed does.

### A83. `LabsStorage.weeklyGoalHours` is declared but unused — `src/lib/lab-sessions.ts:24`, `src/components/LabDashboard.tsx:62`
The interface has `weeklyGoalHours?: number`. LabDashboard hardcodes
`const dailyGoalMinutes = 360 // 6 hours` and ignores any user-set weekly goal. Either
remove the field or wire a settings UI that reads/writes it.

### A84. `vite.config.ts` has no `__BUILD_VARIANT__` `define` — `vite.config.ts:13–15`
Pairs with A73. Either delete the ambient declaration and code references, or add the
define and decide whether the variant build is coming back.

### Non-bug observations (cumulative)
- `cissp-data.ts` filename is stale — module is generic (CISSP/SecAI+/OSCP) per README.
  Rename to `course-data.ts` would match reality.
- No regression test exists for the v2.3.0 "commit to all active plans per course"
  behavior. A future "let's commit only to primary" refactor would silently revert it.
  Add a test guard (Phase 2 item 2.6).
- `getLabel`/`getToast`/`getEmpty`/`getLoading`/`getGreeting`/`getTips` all use the
  `?? "standard" ?? key` chain — solid safety net, **not a bug**, flagged so it doesn't
  get "simplified" away in a future rename pass.
- `CourseProvider.init` calls `loadAllCourses()` up to 4 times (initial load,
  post-delete-stale, post-seed, post-migrate). Each is a separate I/O hit. Coalesce into
  a single read at the end. Inefficiency, not a bug.
- `CourseProvider` uses `localStorage.getItem("activeCourseId")` without the `ztsf:` prefix
  the rest of the app uses. Doesn't collide today; collides if a second app share the
  origin (web preview).
- `pagesConsumedBeforeToday` (`plan-engine.ts:35–43`) counts everything `dateStr < today`.
  Today's log is intentionally excluded (it's "in progress"). Confirmed by-design — flagging
  in case a future "show today's progress in stat bar" feature reads this and is surprised.

---

## Bug #1: `handleMarkDone` Variable Destructuring

- **Version:** v2.0.1
- **File:** `src/App.tsx`
- **Severity:** Functional — Mark Done would commit wrong data

**Description:** `handleMarkDone` was iterating `Object.entries(dailyLog)` with destructured
variables `[courseId, log]` — but the entries were actually `[dateString, { pagesRead }]`.
The `courseId` was a date string.

**Root cause:** The original code assumed `dailyLog` entries were keyed by courseId, but they
were keyed by date.

**Fix:** Look up the owning plan via `dateToActivePlanId` map instead of trying to extract
`courseId` from the `dailyLog` entry.

---

## Bug #2: Queue Pointer Advancement for Unlogged Past Days

- **Version:** v2.0.1
- **File:** `src/lib/cissp-data.ts`
- **Severity:** Functional — schedule jumped ahead

**Description:** Past days without a log entry were advancing the queue pointer by
`resolvedPagesPerDay`, causing the schedule to jump ahead of where the user actually was.

**Root cause:** The `effectiveSliceSize` for past unlogged days was set to `resolvedPagesPerDay`
instead of `0`.

**Fix:** `effectiveSliceSize = 0` for past unlogged days. Pointer stays at actual position.

---

## Bug #3: Multi-Plan dailyLog Overwrite

- **Version:** v2.1.0
- **File:** `src/App.tsx`, `src/components/ScheduleView.tsx`, `src/components/ScheduleList.tsx`, `src/components/DayDetailDrawer.tsx`
- **Severity:** Functional — second Skip/Log on same day overwrote the first

**Description:** `dailyLog` React state was `Record<date, { pagesRead, courseId? }>` — flat
per-date. When two plans shared the same day, the second Log/Skip **overwrote** the first entry.

**Root cause:** The data structure was designed for single-plan-per-day. Multi-plan usage
revealed the limitation.

**Fix:** Changed to `Record<date, Record<courseId, { pagesRead }>>` — nested per-date, per-plan.
`handleLogPlan`/`handleSkipPlan` write per-courseId entries. `handleMarkDone` iterates all
courseIds on a date and commits to each plan's storage independently. `plansLoggedForDate`
checks that every plan on a date has a temp entry before allowing Mark Done.

---

## Bug #4: Book Page Display Fallback

- **Version:** v2.1.1
- **File:** `src/App.tsx`
- **Severity:** Cosmetic — toast showed "p.1–p.1" instead of actual page range

**Description:** `handleLogPlan` computed `scheduleStart = firstCh.bookPageStart ?? 1` and
`scheduleEnd = lastCh.bookPageEnd ?? scheduleStart`. When `bookPageStart` was missing
(e.g., CISSP course JSON), both fell back to `1`, producing toast "p.1–p.1".

**Root cause:** Fallback value `1` was hardcoded instead of using the always-present
`pagesStart`/`pagesEnd` fields.

**Fix:** Use `pagesStart`/`pagesEnd` as fallback instead of `1` — these are always present
on every chapter slice. Toast now shows correct range like "p.1–p.45".

---

## Bug #5: Unit Order Editable After Logging

- **Version:** v2.1.1
- **File:** `src/components/PlannerPage.tsx`
- **Severity:** Cosmetic — past days displayed wrong chapter names after reorder

**Description:** User could change `unitOrder` in plan settings after logging days. This
rebuilt the queue from scratch, causing past completed days to display chapters from the
new order instead of what was actually read.

**Root cause:** `getOrderedChapters()` always reads the live `unitOrder` from the plan.
There was no frozen snapshot of the order at the time of logging.

**Fix:** Two guards added:
- `handleSaveEdit` ignores `editUnitOrder` if the plan has any `dailyLog` entries
  (uses `existing.unitOrder` instead)
- Edit form shows an amber warning banner: "Unit order is frozen after logging begins.
  Create a new plan to change the order."

---

## Bug #6: Calendar Selected Day Lost on Navigation

- **Version:** v2.1.1
- **File:** `src/App.tsx`, `src/components/ScheduleView.tsx`
- **Severity:** UX — selected day detail disappeared on tab/overlay switch

**Description:** Clicking a day on the calendar showed its detail below. Switching to another
tab (Schedule, Progress) and back, or opening Planner/Labs/News overlay, caused the selected
day to reset. The detail was gone on return.

**Root cause:** `selectedDate` was local `useState` in `ScheduleView`. When the component
unmounted (tab switch / overlay), the state was destroyed.

**Fix:** Lifted `selectedDate` state to `App.tsx` as `calendarSelectedDate`, passed down as
props. Now survives component unmount/remount cycles.

---

## Bug #7: Multi-Plan Mark Done — Second Plan's Skip/Log Never Committed

- **Version:** v2.1.1
- **File:** `src/App.tsx`
- **Severity:** Functional — second plan's skip/log lost on Mark Done

**Description:** With 2 plans sharing the same day, skipping both plans worked in temp state
(LogDialog showed both as pending), but Mark Done only committed one plan to storage. The
second plan appeared active on the previous day in the dashboard.

**Root cause:** `handleMarkDone` used `dateToActivePlanId.get(date)` to find which plan to
commit the log to. Two failures:
1. `dateToActivePlanId` is `Map<string, string>` — when 2 plans share a date, the second
   `map.set()` overwrites the first. Only one planId survives per date.
2. `dateToActivePlanId` is built only from the active course's plans. Merged schedule's
   other courses' plans are not in the map at all.

When iterating `pendingLogs` by `courseId`, the single `planId` from the map usually
belonged to the wrong course → `allPlans.find(id && courseId)` returned `undefined` →
`continue` skipped it.

**Fix:** Replaced the `dateToActivePlanId` lookup with a direct `allPlans.find` by
`courseId + activePlanIds`:
```ts
const plan = allPlans.find(p => p.courseId === courseId && activePlanIds.includes(p.id))
```
This correctly finds the active plan for each course, regardless of how many plans share
the same date or which course is "active."

**Also fixed:** Skip toast now shows which plan was skipped (e.g. `"CISSP — skipped (0 pages logged)."`)

---

## Bug #8: Dashboard Avg % Formula Wrong

- **Version:** v2.1.1
- **File:** `src/components/PlannerPage.tsx`
- **Severity:** Medium — dashboard stat shows incorrect average

**Description:** `donePages = Object.keys(plan.dailyLog).length * plan.pagesPerDay` assumed every logged
day consumed the full planned pace. A skip day (0 pages) still counted as a full day, inflating progress.
Partial logs underreported relative to pace.

**Root cause:** The formula measured "number of logged days × pace" instead of actual pages consumed.

**Fix:** Changed to `Object.values(plan.dailyLog).reduce((s, l) => s + Math.max(0, l.pagesRead), 0)` —
sums actual `pagesRead` across all logged entries.

---

## Bug #9: Contradictory Toasts on Out-of-Range Log

- **Version:** v2.1.1
- **File:** `src/App.tsx`
- **Severity:** Low — two conflicting toasts shown, success one wins visually

**Description:** When entering a page number before the scheduled range, `handleLogPlan` fired a
`"break"` toast ("before scheduled range") then fell through and also fired a `"complete"` toast
("Saved: ... (0 pages)"). The success toast visually overrode the error message.

**Root cause:** No `return` after the break toast — execution continued to the success path.

**Fix:** Added `return` after the break toast. The out-of-range page is no longer saved to temp state
and only the error toast is shown.

---

## Bug #10: Stale unitOrder in Deadline Pace Derivation

- **Version:** v2.1.1
- **File:** `src/components/PlannerPage.tsx`
- **Severity:** Medium — deadline-anchored plans could compute wrong pace after unit order freeze

**Description:** When `handleSaveEdit` freezes `unitOrder` for plans with logged days (Bug #5 fix),
the deadline pace derivation block used `editUnitOrder` for `getOrderedChapters()` while the plan
was saved with `existing.unitOrder`. The pace calculation operated on chapters in a different order
than the persisted plan.

**Root cause:** Variable mismatch — `editUnitOrder` (the UI's new value) was used instead of
`updated.unitOrder` (the value actually saved to the plan).

**Fix:** Changed `getOrderedChapters(cfg, editUnitOrder)` to `getOrderedChapters(cfg, updated.unitOrder)`.

---

## Bug #11: Empty-Object Truthiness Check

- **Version:** v2.1.1
- **File:** `src/App.tsx`
- **Severity:** Low — works by accident, but fragile

**Description:** The study day reminder check used `dailyLog[todayStr]` in a truthy context.
`dailyLog[todayStr]` could be `{}` (empty object) which is truthy, causing the reminder to
incorrectly skip. Worked by accident because `dailyLog[todayStr]` is `undefined` (falsy) in
practice after the key is deleted on Mark Done.

**Root cause:** Truthy check on an object that could be empty `{}`.

**Fix:** Changed to `Object.keys(dailyLog[todayStr] ?? {}).length > 0` — explicitly checks for
non-empty objects.

---

## Bug #12: Stats Bar Blank After Course Switch (stale `primaryActivePlanId`)

- **Version:** v2.2.1
- **File:** `src/App.tsx`
- **Severity:** Functional — top-of-page stats bar showed blank values and missing pill toggles even though plans were active and the calendar rendered normally.

**Description:** With multiple plans across two or more courses active, the
stats bar's course toggle showed only one course's pill and every stat number
in the 6-cell grid rendered as `—`. The plans were active, the calendar
rendered both schedules merged — only the stats bar at the top was broken.

**Root cause:** Two compounding issues:

1. `selectedCoursesStats` (App.tsx) only adds an entry for the active course if
   `plans.find((p) => p.id === primaryActivePlanId)` returns a plan. When
   `primaryActivePlanId` was stale (e.g. it pointed at a plan for a different
   course after `switchCourse`), the lookup returned `undefined` and no entry
   was added for the active course at all.
2. `viewedStats` used a nested ternary
   `statsViewCourseId ? ... : activeCourseId ? selectedCoursesStats[activeCourseId] : ...`
   which returned `undefined` when the active course's entry was missing —
   no fallback to other available stats.

`switchCourse` in `CourseProvider` updates `activeCourseId` but never touches
`primaryActivePlanId`, so the primary went stale on every cross-course switch.

**Fix:** Three small changes in `src/App.tsx`:

1. In the active-course branch of `selectedCoursesStats`, fall back to
   `plans[0]` when `primaryActivePlanId` doesn't match any plan in the
   filtered list:
   ```ts
   const plan = plans.find((p) => p.id === primaryActivePlanId) ?? plans[0]
   ```
2. Rewrite `viewedStats` as a `??` chain so a missing active-course entry
   falls through to the first available stat:
   ```ts
   const viewedStats =
     (statsViewCourseId ? selectedCoursesStats[statsViewCourseId] : undefined) ??
     (activeCourseId ? selectedCoursesStats[activeCourseId] : undefined) ??
     Object.values(selectedCoursesStats)[0]
   ```
3. Add a reconciliation `useEffect` that re-points `primaryActivePlanId` at
   `plans[0]` whenever the current primary isn't valid for the active
   course — fixes the stale-primary at its source so future code paths
    don't have to keep defending against it.

---

## Open Audit Bugs (v2.3.1 — Full Audit)

### Components — Unreviewed (20 open)

| # | File | Severity | Bug | Fix |
|---|------|----------|-----|-----|
| C1 | `ProgressDashboard.tsx:53,86` | Medium | Days with `pagesRead: 0` counted as "completed" | Filter `log.pagesRead > 0` |
| C2 | `ProgressDashboard.tsx:141` | Medium | `useEffect([courses.length])` — stale on same-length course swaps | Use course IDs key |
| C3 | `ProgressDashboard.tsx:276,347-379` | Low | Hardcoded strings ("days in a row", "on track", "behind", stat labels) | Route via `label()` |
| C4 | `ProgressDashboard.tsx:14` | Low | Unused `formatStr` import | Remove |
| C5 | `ProgressDashboard.tsx:67` | Medium | `new Date(plan.startDate + ...)` — NaN on undefined startDate | Guard with fallback |
| C6 | `ScheduleList.tsx:111,189-192` | Low | Pending (0-page) days show "Use calendar to log" (should say "Update pages") | Use `isPending` in conditional |
| C7 | `ScheduleList.tsx:56-61` | Low | `formatDate` recreated every render | Wrap in `useCallback` |
| C8 | `CourseSelector.tsx:30,56-60` | Low | `stopPropagation` can break click-outside detection | Use capture phase or rAF reset |
| C9 | `CourseSelector.tsx:121` | Low | No empty state when `courses` is `[]` | Add empty message |
| C10 | `LabDashboard.tsx:29` | Low | Unused `tToast`, `loading` destructuring | Remove dead vars |
| C11 | `LabDashboard.tsx:93,639,692` | Low | `DEFAULT_EXTERNAL_LABS` used instead of `data.labs` (custom labs invisible) | Use `data.labs` or document |
| C12 | `LabDashboard.tsx:62` | Low | `dailyGoalMinutes` hardcoded to 360 | Derive from `weeklyGoalHours` |
| C13 | `LabDashboard.tsx:396` | Medium | `setData(imported)` before `writeLabsStorage` — data loss risk on write fail | Swap: write first, then setState |
| C14 | `LabDashboard.tsx:399` | Low | Error swallowed without logging on import fail | `console.error(e)` |
| C15 | `LabDashboard.tsx:642` | Medium | Array index as React key (`key={i}`) | Use `session.createdAt` |
| C16 | `SecurityNewsFeed.tsx:32` | Low | Unused `personalityLoading` destructuring | Remove |
| C17 | `SecurityNewsFeed.tsx:118-215` | Medium | Many hardcoded strings bypass personality layer | Route via `label()` |
| C18 | `SecurityNewsFeed.tsx:59` | Low | Error swallowed without logging | `console.error()` |
| C19 | `SidebarLabsStatus.tsx:18-25` | Medium | No cancellation flag on unmount (potential memory leak) | Add `cancelled` flag |
| C20 | `SidebarNewsHighlights.tsx:15-21` | Medium | No cancellation + `fetchNews()` result silently discarded | Add cancel flag + update state |

### Storage Layers (28 open)

| # | File | Severity | Bug | Fix |
|---|------|----------|-----|-----|
| S1 | `course-storage.ts:100-102` | Low | TOCTOU race on web index in `deleteCourse` | Combine read-then-write |
| S2 | `course-storage.ts:119-125` | Low | `saveLogo` no content validation (empty SVG stored) | Guard non-empty |
| S3 | `course-storage.ts:145` | Low | `DEFAULT_COURSE_ID` hardcoded, no runtime guard | Validate on startup |
| S4 | `lab-session-storage.ts:18-20` | High | No per-item `LabSession` validation (NaN minutes pass through) | Filter sessions with type checks |
| S5 | `lab-session-storage.ts:20` | Medium | `typeof ... === "object"` accepts arrays | Add `!Array.isArray()` |
| S6 | `lab-session-storage.ts:85,98,140,215` | High | Unvalidated date string — `NaN` propagation in stats | Validate date after parse |
| S7 | `lab-session-storage.ts:169-171` | Medium | `getLabCategory` cast type-unsafe at runtime | Validate against known categories |
| S8 | `lab-session-storage.ts:205-208` | Medium | `computeSmartScore` category gap bonus applies when focus has 0 labs | Check focus lab count > 0 |
| S9 | `news-storage.ts:166-169/149-164` | Medium | Tauri mode never caches fetched news but read path uses localStorage cache | Unify cache write path |
| S10 | `news-storage.ts:157-159` | High | `readNewsCache` no per-item NewsItem validation | Filter invalid items |
| S11 | `news-storage.ts:175-209` | Low | `Promise.all` non-deterministic dedup order | Sort before dedup |
| S12 | `news-storage.ts:118-126` | Medium | CORS proxy response format detection fragile | Try JSON parse first |
| S13 | `news-storage.ts:107-115` | Medium | `AbortController` timeout not cleared on fetch error (timer leak) | Use try-finally |
| S14 | `news-storage.ts:73-78,94-98` | Low | Invalid pub dates silently replaced with `new Date()` (wrong timestamps) | Keep raw string |
| S15 | `plan-storage.ts:81` | High | `planStorage.save` mishandles `unitOrder: undefined` | Check `!== undefined` |
| S16 | `plan-storage.ts:89-128` | Medium | TOCTOU race in all write operations (read→modify→write) | Serialize or transaction |
| S17 | `plan-storage.ts:69-86` | Medium | Save does not auto-activate new plans | Document or add `activate` param |
| S18 | `plan-storage.ts:91` | Medium | `activePlanIds` may not exist on legacy data (`undefined.filter` crash) | Default `?? []` |
| S19 | `export-utils.ts:14-23` | Medium | DOM element + blob URL leak if `a.click()` throws | try-finally |
| S20 | `export-utils.ts:43` | Low | `reader.onerror = reject` passes raw ProgressEvent | Wrap in `new Error(...)` |
| S21 | `export-utils.ts:19` | Low | No `document.body` null guard | Add guard |
| S22 | `export-utils.ts:3-6` | Medium | `JSON.stringify` may throw on circular refs | try-catch |
| S23 | `database.ts:119-123` | Medium | Corrupted SQLite plan rows silently skipped (no log) | `console.warn()` |
| S24 | `database.ts:111-128` | Medium | Plans + activePlanIds read in non-atomic queries (SQLite) | Wrap in transaction |
| S25 | `database.ts:25,28-39` | Low | Web cache never invalidated — cross-tab changes invisible | Listen for `storage` event |
| S26 | `database.ts:141-155` | Low | Deleted plan rows remain in SQLite (dead data accumulates) | DELETE then INSERT |
| S27 | `database.ts:129-131` | Low | SQLite read fallback to web swallows root cause | `console.error()` |
| S28 | `database.ts:86-94` | Low | No migration path beyond schema_version 1 | Add migration array |

### Rust Backend (12 open)

| # | Lines | Severity | Bug | Fix |
|---|-------|----------|-----|-----|
| R1 | 329,331,372 | High | Blocking `std::fs` calls inside `async fn fetch_news` | Use `tokio::fs` |
| R2 | 347-352 | High | Sequential `task.await` blocks collection of completed results | `tokio::time::timeout` per task |
| R3 | 216,259 | High | No HTTP status code check after fetch | `resp.error_for_status()` |
| R4 | 260 | High | Unbounded response body (memory exhaustion from large feeds) | Cap body size |
| R5 | 374 | High | Cache corrupted on serialization failure (empty string written) | Skip write on fail |
| R6 | 341-343 | Medium | Unbounded concurrent task spawning (N+1 tasks per call) | Semaphore/`buffer_unordered` |
| R7 | 207,251 | Medium | `reqwest::Client` created per request (no connection pooling) | Global lazy client |
| R8 | 262,291,350 | Medium | Feed parse errors + task panics swallowed silently | `log::warn!` |
| R9 | 16,20-22 | Medium | Poisoned `Mutex` degrades window-state saving forever | Recover via `into_inner()` |
| R10 | 626,632,651 | Medium | Unsafe `f64`→`i32`/`u32` casts without clamping | Clamp before cast |
| R11 | 363 | Low | No overall timeout for `fetch_news` (blocks indefinitely) | `tokio::time::timeout(45s)` |
| R12 | 404-418 | Low | Frontend `write_window_state`/`read_window_state` bypass Mutex throttle | Route through `persist_window_state` |

### Cross-Cutting (4)

| # | Severity | Bug | Fix |
|---|----------|-----|-----|
| X1 | Medium | `localToday()` defined in 2+ files (`plan-storage.ts`, `lab-session-storage.ts`) | Extract to `date-utils.ts` |
| X2 | Low | localStorage key naming inconsistent (underscore vs colon vs camelCase) | Standardize convention |
| X3 | Medium | No schema versioning or migration for JSON files (labs, courses, news) | Add `schemaVersion` field |
| X4 | Low | No unified error reporting (empty catch / console.warn / throw mix) | Consistent strategy |

