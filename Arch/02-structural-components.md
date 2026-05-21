# Structural Components

## 1. Root Application Layer

### 1.1 App.tsx — Container & Handler Hub
**Role:** Root React component, state container, event handler registry.

**State (useState):**
- `dailyLog: Record<date, Record<courseId, {pagesRead}>>` — Temp per-date per-plan log state (not yet committed)
- `logDialogDay / logDialogGroups` — Log dialog open state
- UI state: `activeTab`, `isFullscreen`, `isPlannerOpen`, etc.

**Handlers:**
- `handleLogPlan(date, courseId, pageValue)` — Stores temp log entry
- `handleSkipPlan(date, courseId)` — Stores 0-page temp entry
- `handleMarkDone(date)` — Commits temp log to plan storage (ONLY commit point)
- `handleOpenLogDialog(day, groups)` — Opens the Log dialog
- `handleLogDialogSave(date, logs)` — Batch-saves all plans from dialog

**Derived (useMemo):**
- `schedule: StudyDay[]` — Generated from all active plans (merged across courses)
- `plansLoggedForDate: (date) => boolean` — Checks all per-course temp entries against schedule
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
- **CourseBuilder**: Built-in course config creator with live JSON preview, drag-to-reorder, validation
- **DailyBriefing**: Personality-driven greeting + empty state messages
- **CourseSelector**: Switch between courses with pill toggles
- **ThemeProvider**: Light/dark/grey theme toggle
- **PersonalityProvider**: React context — wraps `label()`, `toast()`, `empty()`, `greeting()`, `loading()`, `tips()` for current mode
- **TipPopup**: `?` button in header — opens floating card with round-robin tips
- **WallClock**: Live time display in header
- **StudyTimer**: Pomodoro/stopwatch/countdown with auto-log
- **LabDashboard**: Lab session tracker with streaks, at-risk alerts, smart scoring
- **SecurityNewsFeed**: RSS news feed (Tauri backend) with category filtering
- **SidebarLabsStatus**: Compact labs status widget in sidebar
- **SidebarNewsHighlights**: Compact news headline widget in sidebar
- **LogDialog**: Modal for per-plan page input across all plans on a day
- **NotificationToast**: Single-slot toast renderer with "complete"/"break"/"info" types

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
├── PersonalityProvider (context → label/toast/empty/greeting/loading/tips)
├── ThemeProvider (context → theme)
├── CourseProvider (context → course JSON)
├── Zustand store (plan-store.ts)
│   └── allPlans[], activePlanIds[]
├── useMemo: schedule (generateSchedule, mergeSchedules)
│
├── ScheduleView
│   ├── schedule[], dailyLog (props)
│   ├── onMarkDone / onOpenLogDialog (callbacks)
│   └── LogDialog (rendered by App, triggered by onOpenLogDialog)
│
├── ScheduleList
│   └── schedule[], dailyLog, onMarkDone
│
├── ProgressDashboard
│   └── stats from useMemo
│
├── DailyBriefing
│   └── greeting/empty from PersonalityProvider
│
├── PlannerPage (full-page overlay)
│   └── plan CRUD via Zustand actions
│
├── CourseBuilder (in-app dialog)
│   └── creates course JSON → saved via Rust FS commands
│
├── LabDashboard (full-page overlay)
├── SecurityNewsFeed (overlay, Tauri only)
├── StudyTimer (Pomodoro/stopwatch/countdown, sidebar)
├── TipPopup (header button → floating card)
├── WallClock (header)
├── SidebarLabsStatus
└── SidebarNewsHighlights
```
