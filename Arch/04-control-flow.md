# Control Flow & Decision Trees

## 1. Logging Decision Tree

```
User opens Log dialog for a day
  │
  ├─ User enters page number + clicks [Save Log]
  │   ↓
  │  handleLogPlan(date, courseId, pageValue):
  │   ├─ pageValue < scheduleStart → pagesRead = 0, toast: "before range"
  │   ├─ pageValue > scheduleEnd → pagesRead = pageValue - scheduleStart, toast: "ahead"
  │   └─ else → pagesRead = pageValue - scheduleStart
  │   ↓
  │  setDailyLog({ ...prev, [date]: { pagesRead, courseId } })  // TEMP only
  │
  └─ User clicks [Skip]
      ↓
     handleSkipPlan(date, courseId):
      setDailyLog({ ...prev, [date]: { pagesRead: 0, courseId } })
```

## 2. Mark Done Decision Tree

```
User clicks [Mark Done]
  │
  ├─ Is date logged? (plansLoggedForDate)
  │  ├─ NO → Toast: "Log or Skip first", abort
  │  └─ YES → Continue
  │
  ├─ Is there a pending log in dailyLog[date]?
  │  ├─ NO → Toast: "No pending log", abort
  │  └─ YES → Continue
  │
  ├─ Find owning plan: dateToActivePlanId.get(date) ?? primaryActivePlanId
  │  ├─ No plan found → Toast: "No active plan", abort
  │  └─ Plan found → Continue
  │
  └─ Commit:
      updatedPlan = { ...plan, dailyLog: { ...plan.dailyLog, [date]: { pagesRead } } }
      storeUpdatePlan(updatedPlan)  // Zustand + SQLite
      clear dailyLog[date]
      triggerRefresh()
```

## 3. Schedule Generation Decision Tree

```
Trigger: plans[] or activePlanIds changes (after Mark Done or plan edit)
  │
  ├─ For each active plan for the course:
  │  ├─ getOrderedChapters(course, plan.unitOrder)
  │  ├─ syncStudyPlan(plan, chapters, today):
  │  │   ├─ consumed = pagesConsumedBeforeToday(plan, today)
  │  │   ├─ remaining = totalPages - consumed
  │  │   ├─ If anchor === "endDate":
  │  │   │   → available = countStudyDays(today, targetEndDate)
  │  │   │   → pagesPerDay = max(1, ceil(remaining / available))
  │  │   │   → endDate = targetEndDate (locked)
  │  │   └─ If anchor === "pagesPerDay":
  │  │       → pagesPerDay = plan.pagesPerDay (locked)
  │  │       → neededDays = ceil(remaining / pagesPerDay)
  │  │       → endDate = nthStudyDay(today, neededDays)
  │  │
  │  └─ generateSchedule(plan, chapters, today, params):
  │      ├─ buildPageSequence() from startingChapterId
  │      ├─ Walk calendar from startDate
  │      ├─ For each day, compute slice sizes:
  │      │   ├─ Logged day: effective = planned = pagesRead
  │      │   ├─ Past unlogged: effective = 0, planned = resolvedPagesPerDay
  │      │   └─ Future day: effective = planned = resolvedPagesPerDay
  │      │   → Slice pageSequence at pageIdx by slice size
  │      │   → pageIdx += effectiveSliceSize
  │      └─ Stop when pageSequence exhausted or deadline reached
  │
  └─ Merge all schedules, sort by date, build dateToActivePlanId map
```

## 4. Plan Creation Decision Tree

```
User clicks "Create" in PlannerPage
  │
  ├─ Opens full settings form (NOT saved yet)
  │   Fields: name, startDate, anchor, pagesPerDay/targetEndDate,
  │           studyDays, unitOrder, startingChapter
  │
  └─ User clicks "Create Plan"
      ├─ defaultPlan() creates initial plan object
      ├─ planStorage.save(plan) → disk
      ├─ loadPlans() → Zustand store updated
      └─ App re-renders with new plan in schedule
```

## 5. Slice Size Selection

| Day Status | `effectiveSliceSize` (pageIdx advance) | `plannedSliceSize` (calendar display) |
|---|---|---|
| Past, logged | `dailyLog[date].pagesRead` | Same |
| Past, skipped (0 pages) | 0 | Same |
| Past, unlogged | **0** | `resolvedPagesPerDay` |
| Future | `resolvedPagesPerDay` | Same |

**Why the split?**  
Past unlogged days should NOT advance the queue pointer (prevents schedule jumps), but
the calendar should still show what *would* have been planned for visual continuity.

## 6. Auto-Adjust Logic

```
After Mark Done commits:
  1. consumed recalculated (sum of dailyLog entries)
  2. remaining = totalPages - consumed
  3. If Velocity anchor: endDate shifts (same pace, fewer/more days needed)
  4. If Deadline anchor: pace adjusts (same end date, faster/slower per day)
  5. schedule regenerates with new params
```

## 7. When State Changes

| Action | Temp State | Zustand Store | SQLite | Schedule Recalc |
|---|---|---|---|---|
| Log page | ✅ updated | ❌ | ❌ | ❌ |
| Skip plan | ✅ updated | ❌ | ❌ | ❌ |
| Mark Done | ✅ cleared | ✅ updated | ✅ saved | ✅ triggered |
| Create plan | ❌ | ✅ updated | ✅ saved | ✅ triggered |
| Edit plan | ❌ | ✅ updated | ✅ saved | ✅ triggered |
| Delete plan | ❌ | ✅ updated | ✅ saved | ✅ triggered |
