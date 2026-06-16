# Data Flow: User Action Lifecycle

> **v2.7.0:** Log → Mark Done flow is now in `useStudyLogging`. Schedule derivation is in
> `useSchedule`. The flow below describes the same logic, but the call sites moved.

## Core Flow: Log → Mark Done

```
User clicks [Log] button in ScheduleView
  ↓
ScheduleView calls onLogDay(day, groups)
  ↓
App.tsx → useStudyLogging.handleOpenLogDialog(day, groups)
  ↓
useStudyLogging sets logDialogDay → LogDialog renders
  ↓
User fills page input(s) and clicks [Save Log]
  ↓
LogDialog calls onSave(date, logs[])
  ↓
useStudyLogging.handleLogDialogSave:
  for each log → handleLogPlan(date, courseId, pagesRead)
    ↓
   setDailyLog({ ...prev, [date]: { [courseId]: { pagesRead } } })  // nested per-plan TEMP state, no disk write
   applyTempLog(date, courseId, pagesRead) → temp-log-storage.ts        // PERSISTED in localStorage (survives refresh)
   showToast(tToast("savedLog", ...))                                       // personality-routed
  ↓
LogDialog closes, [Mark Done] becomes enabled
  ↓
User clicks [Mark Done]
  ↓
useStudyLogging.handleMarkDone(date):
   0. tempLogsLoaded gate — abort if mount-load still in flight (Bug #6 fix)
   1. plansLoggedForDate(date) check — every plan on the date must have a temp entry
   2. For each [courseId, log] in dailyLog[date]:
      a. Find owning plan via allPlans.find(p => p.courseId === courseId && activePlanIds.includes(p.id))
      b. updatedPlan = { ...plan, dailyLog: { ...plan.dailyLog, [date]: { pagesRead } } }
      c. await storeUpdatePlan(updatedPlan)  // Zustand + database.writeStorage (per-row upsert)
      d. on failure, rollback all completed writes; show error toast
   3. clearTempLog(date)  → temp-log-storage.ts
   4. showToast(tToast("markDoneConfirm", ...))
   5. onAfterMarkDone()  → App.tsx setRefreshTick
  ↓
refreshTick triggers loadPlans() → useSchedule recomputes
```

## Alternative Flows

### Flow: Skip Plan
```
User clicks [Skip] in LogDialog
  ↓
useStudyLogging.handleSkipPlan(date, courseId):
  setDailyLog({ ...prev, [date]: { ...prev[date], [courseId]: { pagesRead: 0 } } })
  applyTempLog(date, courseId, 0)  → temp-log-storage.ts
  showToast(tToast("skipped", ...))
  ↓
Dialog closes, [Mark Done] enabled (same as logging)
```

### Flow: Page Input Out of Range
```
User enters pageValue in LogDialog
  ↓
useStudyLogging.handleLogPlan (validateLogEntry gate):
  if !Number.isFinite(pageValue) || !Number.isInteger(pageValue) || pageValue < 0:
    abort — invalid input
  if pageValue < scheduleStart:
    pagesRead = 0, toast: "before scheduled range"
  if pageValue > scheduleEnd:
    pagesRead = pageValue - scheduleStart, toast: "Ahead of schedule!"
  else:
    pagesRead = pageValue - scheduleStart
```

### Flow: Create Plan
```
User clicks "Create" in PlannerPage
  ↓
PlannerPage opens settings form (NOT saved yet)
  ↓
User fills: name, startDate, anchor, pagesPerDay, studyDays, unitOrder, startingChapter
  ↓
User clicks "Create Plan"
  ↓
defaultPlan() creates plan object → planStorage.save() → storeLoadPlans()
  ↓
Schedule regenerates with new plan
```

---

## Schedule Regeneration (on Mark Done)

```
Mark Done commits → storeUpdatePlan → Zustand updates
  ↓
useSchedule's deps change → recomputes
  ↓
For each active plan for the course:
  1. getOrderedChapters(course, plan.unitOrder)
  2. syncStudyPlan(plan, chapters, today)
     → consumed = sum(dailyLog.pagesRead for past days)
     → remaining = totalPages - consumed
     → If anchor === "endDate":
         → available = countStudyDays(today, targetEndDate)
         → pagesPerDay = max(1, ceil(remaining / available))  ← no overlay
     → If anchor === "pagesPerDay":
         → basePPD = max(1, plan.pagesPerDay)
         → if sprint active (v2.7.0): pagesPerDay = applySprintPace(basePPD, plan.sprint, today)
         → if adversary enabled (v2.7.0): pagesPerDay = applyAdversaryPace(prev, settings, today)
         → endDate = nthStudyDay(today, ceil(remaining / pagesPerDay))
  3. generateSchedule(plan, chapters, today, params)
     → buildPageSequence() from startingChapterId
     → Walk calendar from startDate
     → For each day: slice pageSequence with effective/planned slice size
     → Build StudyDay[] with chapter groups
  ↓
dedupeScheduleByDate() (in useSchedule)
  ↓
React re-render → ScheduleView / ScheduleList / ProgressDashboard update
```

---

## Data Flow Variants

### Variant: Multiple Plans on Same Day
```
The Log dialog shows all plan groups for the day.
Each group gets its own input row.
Save iterates all plans and calls handleLogPlan for each.
dailyLog stores per-courseId entries: { [courseId1]: { pagesRead }, [courseId2]: { pagesRead } }
Mark Done iterates each courseId and finds the owning plan for each.
```

### Variant: Sprint mode (v2.7.0 — now affects derived pace)
```
When plan.sprint is set and isSprintActive(sprint, today):
  → useSchedule reads plan with applySprintPace overlay applied
  → pagesPerDay is round(pagesPerDay * (1 + paceBoost/100))
  → <SprintBanner> surfaces above the tab strip showing the boost
Sprint auto-expires (no Mark Done needed to clean up)
```

### Variant: Adversary timer (v2.7.0 — now affects derived pace)
```
When adversary is enabled in <NotificationSettingsPanel> and deadline has passed:
  → useSchedule applies applyAdversaryPace on top of the sprint boost
  → pagesPerDay becomes round(prevPPD * (1 + paceBoostPct/100))
Adversary is transient — not persisted to planStorage
```

### Variant: Lab credit (v2.7.0)
```
User logs a lab session via <LabDashboard>
  ↓
submitLog() saves the session, then schedules a LabCreditPrompt (setTimeout 50ms)
  ↓
<LabCreditPrompt> modal appears if findDomainMatches() returns ≥1 match
  ↓
User accepts → session.creditedTo is set to "courseId:domainId"
User dismisses → session.creditPrompted = true (don't re-prompt)
```

---

## Persistence Rules

| Operation | React State | Temp Storage | Zustand Store | SQLite |
|---|---|---|---|---|
| Log/Skip | ✅ Updated | ✅ Updated | ❌ | ❌ |
| Mark Done | ✅ Cleared | ✅ Cleared | ✅ Updated | ✅ Saved (per-row upsert) |
| Create/Edit Plan | ❌ | ❌ | ✅ Updated | ✅ Saved |
| Load at boot | ✅ Populated from Temp Storage | ✅ Read | ✅ Populated | ✅ Read |

**Temp Storage** (v2.5.0+): Log/Skip state is persisted to `temp-log-storage.ts` (localStorage) in addition to React state. This survives page refreshes. Mark Done clears both React state and temp storage.

**Sprint overlay** (v2.7.0+): If `plan.sprint` is set and active, `applySprintPace()` is called inside `plan-engine.ts:syncStudyPlan` and modifies the effective `pagesPerDay` for the returned params. Sprint is a read-time overlay — not persisted to `dailyLog`.

**Adversary overlay** (v2.7.0+): `applyAdversaryPace()` is layered on top of sprint in the same `syncStudyPlan` function. Driven by `ztsf:adversary-settings` localStorage key.

**Per-row upsert** (v2.7.0+): `database.writeStorage` no longer rewrites the entire SQLite table on every save. It reads the prior snapshot (from `tauriCache` or a fallback `SELECT`), diffs against the new data, and issues per-row `INSERT`/`UPDATE`/`DELETE`.
