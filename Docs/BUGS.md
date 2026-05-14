# Bug Registry

Every bug found and fixed, with root cause and resolution. Use this to avoid re-introducing
fixed bugs and to understand the history of edge cases.

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

