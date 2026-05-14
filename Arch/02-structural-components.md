# Structural Components

## 1. Root Application Layer

### 1.1 App.tsx — Container & Handler Hub
**Role:** Root React component, state container, event handler registry.

**State (useState):**
- `dailyLog: Record<date, {pagesRead, courseId?}>` — Temp per-date log state (not yet committed)
- `logDialogDay / logDialogGroups` — Log dialog open state
- UI state: `activeTab`, `isFullscreen`, `isPlannerOpen`, etc.

**Handlers:**
- `handleLogPlan(date, courseId, pageValue)` — Stores temp log entry
- `handleSkipPlan(date, courseId)` — Stores 0-page temp entry
- `handleMarkDone(date)` — Commits temp log to plan storage (ONLY commit point)
- `handleOpenLogDialog(day, groups)` — Opens the Log dialog
- `handleLogDialogSave(date, logs)` — Batch-saves all plans from dialog

**Derived (useMemo):**
- `schedule: StudyDay[]` — Generated from all active plans
- `dateToActivePlanId: Map<date, planId>` — Which plan owns each date
- `selectedCoursesStats` — Stats for all selected courses

### 1.2 Zustand Store (plan-store.ts)
**Role:** Single source of truth for all plan data.

| State | Description |
|---|---|
| `allPlans: StudyPlan[]` | All plans across all courses |
| `activePlanIds: string[]` | Globally active plan IDs |
| `primaryActivePlanId: string | null` | Primary plan for active course |
| `isLoading: boolean` | Initial load flag |

**Actions:** `loadPlans`, `updatePlan`, `deletePlan`, `renamePlan`, `setActivePlanIds`, etc.

---

## 2. Presentation Components

### 2.1 ScheduleView.tsx
**Role:** Calendar grid + day detail panel.

**Props:** `schedule`, `dailyLog`, `onMarkDone`, `onLogDay`, `plansLoggedForDate`

**Features:**
- Month-based calendar with navigation
- Day cells show status: completed (green), pending (amber), unlogged (color dots)
- Day detail: chapter listing with unit colors and page ranges
- Action bar: `[Log]` button (opens LogDialog) + `[Mark Done]` button (commits)

### 2.2 LogDialog.tsx
**Role:** Modal dialog for per-plan page input.

**Props:** `day`, `groups[]`, `onSave`, `onSkip`, `onClose`

**Behavior:**
- Lists all active plans for the selected day
- Each plan row has a numeric page input + Skip button
- "Save Log" calls `handleLogPlan` for each plan with a value
- "Skip" per plan calls `handleSkipPlan`
- No save happens until "Save Log" is clicked

### 2.3 ScheduleList.tsx
**Role:** List view of all study days with search/filter.

**Props:** `schedule`, `dailyLog`, `onMarkDone`

### 2.4 ProgressDashboard.tsx
**Role:** Stats and charts (completion %, pace, timeline).

### 2.5 PlannerPage.tsx
**Role:** Full-page overlay for plan CRUD.
- Create: Opens settings form (name, start date, anchor, pace, study days, unit order, starting chapter)
- Edit: Modify existing plan settings
- Delete/rename/duplicate plan

### 2.6 Other Components
- **DayDetailDrawer**: Adaptive mode slide-out day detail
- **CourseSelector**: Switch between courses
- **ThemeProvider**: Light/dark theme toggle
- **StudyTimer**: Pomodoro/stopwatch/countdown
- **LabDashboard**: Lab session tracker
- **SecurityNewsFeed**: RSS news feed

---

## 3. Application / Logic Layer

### 3.1 Plan Engine (plan-engine.ts)
**Role:** Core math engine.

- `syncStudyPlan(plan, chapters, today)` — Computes consumed, remaining, adjusted pace, end date
- `pagesConsumedBeforeToday(plan, today)` — Sums `dailyLog.pagesRead` for all past dates
- Handles both anchor modes: Velocity (locked pace) and Deadline (locked end date)

### 3.2 Schedule Generator (cissp-data.ts)
**Role:** Builds day-by-day schedule from plan + params.

- `getOrderedChapters(course, unitOrder)` — Reorders chapters by custom unit sequence
- `buildPageSequence(plan, orderedChapters)` — Creates flat page queue starting from `startingChapterId`
- `generateSchedule(plan, orderedChapters, today, pagesPerDay, endDate)` — Walks calendar, slices queue
- `mergeSchedules(items)` — Merges schedules from multiple courses into one calendar

---

## 4. Persistence Layer

### 4.1 database.ts
**Role:** Low-level storage adapter. Auto-selects SQLite (Tauri) or localStorage (Web).

| Method | Description |
|---|---|
| `getAll()` | Load all plans |
| `save(plan)` | Create or update plan |
| `delete(id)` | Remove plan |
| `getActiveIds()` / `setActiveIds(ids)` | Active plan management |

Includes automatic migration from legacy JSON format.

### 4.2 plan-storage.ts
**Role:** Public CRUD API — same exports, delegates to database.ts.

### 4.3 Course Data (data/courses/*.json)
**Role:** Static course definitions. Loaded by `CourseProvider` at boot.

---

## 5. Component Dependency Graph

```
App.tsx
├── CourseProvider (context → course JSON)
├── Zustand store (plan-store.ts)
│   └── allPlans[], activePlanIds[]
├── useMemo: schedule (generateSchedule)
│
├── ScheduleView
│   ├── schedule[], dailyLog (props)
│   ├── onMarkDone / onLogDay (callbacks)
│   └── LogDialog (rendered by App, triggered by onLogDay)
│
├── ScheduleList
│   └── schedule[], dailyLog, onMarkDone
│
├── ProgressDashboard
│   └── stats from useMemo
│
├── PlannerPage (full-page overlay)
│   └── plan CRUD via Zustand actions
│
└── DayDetailDrawer (adaptive mode)
    └── day detail + onMarkDone
```
