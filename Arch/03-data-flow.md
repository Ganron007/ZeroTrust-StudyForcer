# Data Flow: User Action Lifecycle

## Core Flow: Log → Mark Done

```
User clicks [Log] button in ScheduleView
  ↓
ScheduleView calls onLogDay(day, groups)
  ↓
App.tsx sets logDialogDay → LogDialog renders
  ↓
User fills page input(s) and clicks [Save Log]
  ↓
LogDialog calls onSave(date, logs[])
  ↓
App.handleLogDialogSave: 
  for each log → handleLogPlan(date, courseId, pagesRead)
    ↓
  setDailyLog({ ...prev, [date]: { pagesRead, courseId } })  // TEMP state, no disk write
  showToast("Saved: ...")
  ↓
LogDialog closes, [Mark Done] becomes enabled
  ↓
User clicks [Mark Done]
  ↓
handleMarkDone(date):
  1. Read pending log from dailyLog[date]
  2. Look up owning plan via dateToActivePlanId
  3. Merge log into plan.dailyLog in Zustand store
  4. storeUpdatePlan(updatedPlan) → Zustand + SQLite
  5. Clear temp dailyLog[date]
  6. Trigger refreshTick
  7. Schedule recalculates via useMemo
```

---

## Alternative Flows

### Flow: Skip Plan
```
User clicks [Skip] in LogDialog
  ↓
handleSkipPlan(date, courseId):
  setDailyLog({ ...prev, [date]: { pagesRead: 0, courseId } })
  ↓
Dialog closes, [Mark Done] enabled (same as logging)
```

### Flow: Page Input Out of Range
```
User enters pageValue in LogDialog
  ↓
handleLogPlan:
  if pageValue < scheduleStart:
    pagesRead = 0, toast: "before scheduled range"
  if pageValue > scheduleEnd:
    pagesRead = pageValue - scheduleStart, toast: "Ahead of schedule!"
  else:
    pagesRead = pageValue - scheduleStart
```

### Flow: Create Plan
```
User clicks "Create" → PlannerPage opens settings form
  ↓
User fills: name, startDate, anchor, pagesPerDay, studyDays, unitOrder, startingChapter
  ↓
User clicks "Create Plan" → Nothing saved yet until this explicit click
  ↓
defaultPlan() creates plan object → planStorage.save() → storeLoadPlans()
  ↓
Schedule regenerates with new plan
```

---

## Schedule Regeneration (on Mark Done)

```
Mark Done persists → storeUpdatePlan → Zustand updates
  ↓
useMemo([plans, activeCourseId, activePlanIds, ...]) triggers:
  ↓
For each active plan:
  1. getOrderedChapters(course, plan.unitOrder)
  2. syncStudyPlan(plan, chapters, today)
     → consumed = sum(dailyLog.pagesRead for past days)
     → remaining = totalPages - consumed
     → pagesPerDay = derived pace or locked value
     → endDate = locked deadline or derived date
  3. generateSchedule(plan, chapters, today, params)
     → buildPageSequence() from startingChapterId
     → Walk calendar from startDate
     → For each day: slice pageSequence with effective/planned slice size
     → Build StudyDay[] with chapter groups
  ↓
Merge all plan schedules, sort by date
  ↓
Build dateToActivePlanId map
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
dailyLog stores one entry per date (last plan logged wins).
```

### Variant: Adaptive Mode (DayDetailDrawer)
```
ScheduleView.onSelectDay → setDrawerDay(day)
  ↓
DayDetailDrawer renders with day data + onMarkDone
  ↓
Log button still opens LogDialog (same flow)
```

---

## Persistence Rules

| Operation | React State | Zustand Store | SQLite |
|---|---|---|---|
| Log/Skip | ✅ Updated | ❌ | ❌ |
| Mark Done | ✅ Cleared | ✅ Updated | ✅ Saved |
| Create/Edit Plan | ❌ | ✅ Updated | ✅ Saved |
| Load at boot | ❌ | ✅ Populated | ✅ Read |
