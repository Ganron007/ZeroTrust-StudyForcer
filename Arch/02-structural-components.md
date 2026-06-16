# Structural Components

> **Last updated:** v2.7.2 (2026-06-16) — added `<ErrorBoundary>` primitive and wrapped 7 areas.

## 1. Root Application Layer

### 1.1 App.tsx — Container & Dialog State (739 lines post-v2.8.0, ~744 post-v2.7.2)
**Role:** Root React component, layout shell, the single most consequential refactor target.

**v2.7.0 refactor:** All Log/Skip/MarkDone handlers and the schedule/stats derivation moved
to dedicated hooks (`useStudyLogging`, `useSchedule`) and the top toolbar to `<AppHeader>`.
`App.tsx` was 928 lines.

**v2.8.0 refactor (plan D):** Dialog state machine extracted. 5 new hooks (`useOverlayState`,
`useAppViewState`, `useTipState`, `useRefreshController`) and 2 new components
(`<OverlayManager>`, `<TimerLogDialog>`) absorbed the remaining 4 `if (isXxxOpen) return
<Xxx .../>` early-returns, the inline timer dialog JSX, the tip popup state, and the
refresh-tick loop. `App.tsx` is now 739 lines (−20% from v2.7.0).

**v2.7.2 hardening (plan C):** Wrapped all 4 main tab panels (Schedule, Schedule list,
Progress dashboard, Certification paths) in `<ErrorBoundary>` so a single uncaught render
error is contained to a card on that tab. Adds ~5 lines for 4 boundary wrappers.

**Remaining useState in AppContent:**
- `showCheatsheet` (single useState — `?` shortcut) — could be moved to a `useCheatsheet` hook in a future release
- `logDialogDay` / `logDialogGroups` (Log dialog) — lives in `useStudyLogging`

**Refs from `<AppHeader>`:** `themePopoverRef`, `modePopoverRef`, `notifPopoverRef` — `useFocusTrap`
hooks for the three popovers.

### 1.2 Hooks (v2.7.0, extracted from App.tsx)

#### useStudyLogging (`src/hooks/useStudyLogging.ts`, 348 lines, 15 tests)
**Role:** Owns the entire Log/Skip + Mark Done flow. The Mark Done commit is centralized here.

**State:**
- `dailyLog: Record<date, Record<courseId, { pagesRead }>>` — temp React state
- `tempLogsLoaded: boolean` — race-guard against mount-time storage load
- `logDialogDay / logDialogGroups` — dialog state
- (Reads `allPlans`, `activePlanIds`, `storeUpdatePlan` from Zustand)

**Returns:** `dailyLog`, `tempLogsLoaded`, `logDialogDay`, `logDialogGroups`, `handleOpenLogDialog`,
`handleCloseLogDialog`, `handleLogPlan`, `handleSkipPlan`, `handleLogDialogSave`,
`handleLogDialogSkip`, `plansLoggedForDate`, `handleMarkDone`.

**Inviolable Rule 1 enforcement:** every mutator (`handleLogPlan`, `handleSkipPlan`,
`handleMarkDone`) gates on `tempLogsLoaded`. Tests verify the gate.

#### useSchedule (`src/hooks/useSchedule.ts`, 230 lines, 7 tests)
**Role:** Pure derivation of `baseSchedule`, `mergedSchedule`, `selectedCoursesStats`, `showMerged`.

**Inputs:** `allPlans`, `activePlanIds`, `activeCourseId`, `activeCourse`, `primaryActivePlanId`,
`courses`, `selectedCourseIds`, `courseLabel`.

**Returns:** `baseSchedule`, `otherCoursesInfo`, `mergedSchedule`, `schedule`, `selectedCoursesStats`, `showMerged`.

**No side effects, no I/O.** Pure `useMemo` over inputs.

#### useKeyboardShortcuts (`src/hooks/useKeyboardShortcuts.ts`, 159 lines, 18 tests)
**Role:** Global keydown listener with input-field suppression and modal-guard.

**Inputs:** `activeCourseId`, `isPlannerOpen`, `isOnlineLabsOpen`, `isNewsOpen`, `showTimerLog`,
`showModePicker`, `showThemePicker`, `showNotificationSettings`, `showCheatsheet`, `logDialogDay`,
plus a `actions` object with 16 callbacks.

**Shortcuts:** `1/2/3/4` switch tabs, `P` open planner, `L` open labs, `N` toggle news,
`F` fullscreen, `R` refresh, `T` theme picker, `?` open cheatsheet, `Esc` close topmost overlay.

### 1.3 Zustand Store (plan-store.ts)
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

### 2.1 `<AppHeader>` (v2.7.0, extracted) — `src/components/AppHeader.tsx` (359 lines)
**Role:** The full top toolbar. Replaces ~400 lines of inline header JSX in App.tsx.

**Sections (left to right):** logo + version, StreakChip, CourseSelector, planner/labs/news buttons,
StudyTimer (centered), WallClock, tip button, refresh, backup, reset, restore, theme picker,
mode picker, notification settings, OPSEC toggle, fullscreen.

**Props:** `safeLogoSvg`, `courses`, `activeCourseId`, `selectedCourseIds`, `isNewsOpen`, `isFullscreen`,
`refreshing`, `showThemePicker`/`showModePicker`/`showNotificationSettings`, three popover refs,
and an `actions: AppHeaderActions` object with 18 callbacks.

**Popovers:** All three (theme, mode, notification) use the new `<Popover>` primitive.

### 2.2 `<Popover>` (v2.7.0, extracted) — `src/components/Popover.tsx` (~80 lines)
**Role:** Lightweight popover primitive. Replaces 4 inline popover scaffolds.

**Props:** `open`, `onClose`, `align` (`"start"`/`"end"`/`"center"`), `widthClass`, `role` (`"menu"`/`"dialog"`/`"listbox"`),
`ariaLabel`, `children`, `className`, `zIndex`.

**Behavior:** Renders click-outside backdrop + focus management + Escape handler. Returns null when closed.

### 2.3 `<StatsBar>` (v2.7.0, extracted) — `src/components/StatsBar.tsx` (~150 lines)
**Role:** Finish-date row + 6-cell grid (study days, total, read/total, pages/day, frequency, % done).

**Props:** `viewedStats`, `showMerged`, `selectedCoursesStats`, `statsViewCourseId`,
`setStatsViewCourseId`, `activeCourseId`, `labels`, `pLabel`.

### 2.4 `<SprintBanner>` (v2.7.0) — `src/components/SprintBanner.tsx`
**Role:** Surfaces above the tab strip when any active plan has a live sprint. Shows plan name,
days remaining, pace boost. X button cancels the sprint.

### 2.5 `<PostmortemBanner>` (v2.7.0) — `src/components/PostmortemBanner.tsx`
**Role:** Surfaces when any active plan's `targetEndDate` has passed and no postmortem exists.
Clicking "Write postmortem" opens the inline `<PostmortemEditor>` (5-section template).
Dismissed plans don't re-prompt.

### 2.6 `<LabCreditPrompt>` (v2.7.0) — `src/components/LabCreditPrompt.tsx`
**Role:** Modal that surfaces after a lab session is logged. Asks the user to credit the
minutes to a matching exam domain. Accept writes `creditedTo` to the session; dismiss marks
`creditPrompted: true`.

### 2.7 `<OverlayManager>` (v2.8.0) — `src/components/OverlayManager.tsx` (7 tests)
**Role:** Centralizes the 4 full-page overlay early-returns from App.tsx (Labs, News,
CourseBuilder, Planner). Returns null when all overlays are closed. Priority: Labs > News
> CourseBuilder > Planner — only the top-priority overlay renders at a time.

**Props:** four `OverlayController<T>` objects (one per overlay). Each controller owns its
own open/close lifecycle via `useOverlayState`.

### 2.8 `<TimerLogDialog>` (v2.8.0) — `src/components/TimerLogDialog.tsx`
**Role:** Extracted from inline JSX in App.tsx. Shows the timer-elapsed confirmation
("You studied for Xh Ym. Log this?") with Skip / Log buttons. Renders nothing when closed.

**Props:** `isOpen`, `minutos` (minutes), `onClose`.

### 2.9 `<ErrorBoundary>` (v2.7.2) — `src/components/ErrorBoundary.tsx` (10 tests)
**Role:** Class-component error boundary (React 19 still requires class for `getDerivedStateFromError`).
Wraps any major route / overlay / tab panel so a single uncaught render error is contained
to a destructive-themed card instead of taking down the entire app. Logs to `console.error`
and offers two recovery actions:
- **Try again** — clears the boundary's internal error state and calls an optional
  `onReset` callback (used by overlays to close the overlay so the user can re-open it)
- **Reload app** — calls `window.location.reload()` as a last resort

**Props:** `children`, `fallback?` (custom ReactNode), `sectionLabel?` (e.g. "Lab dashboard"),
`onReset?` (enables the Try-again button).

**Wrapped in v2.7.2 (7 areas):**
- 4 tab panels in `App.tsx`: Schedule, Schedule list, Progress dashboard, Certification paths
- 3 overlays + SecurityNewsFeed in `OverlayManager.tsx`: LabDashboard, SecurityNewsFeed,
  CourseBuilder, PlannerPage (each `onReset` calls the overlay's `close`)

**Why it matters:** The three giant components most at risk (PlannerPage 67KB, CourseBuilder
44KB, LabDashboard 40KB) had no isolation. A bad render in any of them used to blank the
entire app. Now a crash is contained, the user can recover by re-opening the overlay or
reloading the page, and the rest of the app (header, sidebar, other tabs) remains usable.

### 2.10 Other Components (unchanged)
- **ScheduleView** — Calendar grid + day detail + Log/MarkDone buttons
- **LogDialog** — Per-plan page input modal
- **ScheduleList** — List view with search/filter
- **ProgressDashboard** — Stats and charts
- **PlannerPage** (67KB) — Plan CRUD + settings form
- **CourseBuilder** (44KB) — Course config creator
- **LabDashboard** (40KB) — Lab session tracker (v2.7.0: wires `<LabCreditPrompt>` in submitLog)
- **SecurityNewsFeed** — RSS/Atom feed reader
- **DailyBriefing** — Personality-driven greeting + empty states + 4-line standup
- **CourseSelector** — Switch between courses
- **CourseProvider** — loads course JSON
- **ThemeProvider** — Light/dark/grey/system theme
- **PersonalityProvider** — React context for `label()`/`toast()`/`empty()`/`greeting()`/`loading()`/`tips()`
- **TipPopup** — `?` button → round-robin tip card
- **WallClock** — Live time
- **StudyTimer** — Pomodoro / stopwatch / countdown
- **SidebarLabsStatus** / **SidebarNewsHighlights** — compact sidebar widgets
- **NotificationToast** — toast renderer (complete/break/info)
- **NotificationSettingsPanel** — notification settings + adversary (v2.7.0)
- **ExamAlertBanner** — T-3 alert
- **ExamCountdownBand** — Calendar-tab countdown
- **BurnDownView** — Gantt-style pages/days (v2.7.0: mounted above tabs)
- **KeyboardShortcutsCheatsheet** — `?` cheatsheet modal
- **StreakChip** — header streak counter
- **DayDetailDrawer** — day detail drawer
- **DatePicker** — date picker primitive
- **ComplianceReport / ReportGenerator / GapAnalysis / CareerMode / DomainAnalyzer** — Cert Path tab sub-widgets
- **SprintBanner** (v2.7.0) — sprint status banner above tabs
- **PostmortemBanner** (v2.7.0) — exam-passed reflection prompt
- **LabCreditPrompt** (v2.7.0) — exam-domain credit modal

---

## 3. Application / Logic Layer

### 3.1 Plan Engine (plan-engine.ts)
**Role:** Core math engine.

- `syncStudyPlan(plan, chapters, today)` — Computes consumed, remaining, adjusted pace, end date
- `pagesConsumedBeforeToday(plan, today)` — Sums `dailyLog.pagesRead` for all past dates
- Handles both anchor modes: Velocity (locked pace) and Deadline (locked end date)
- **v2.7.0: Sprint + Adversary overlays** — when a sprint is active or the adversary bump triggers, the returned
  `pagesPerDay` is layered: first `applySprintPace` (if sprint active), then
  `applyAdversaryPace` on top. The base `plan.pagesPerDay` is never mutated.
  **v2.7.1:** Overlays now apply to both `pagesPerDay` and `endDate` anchors.

### 3.2 Schedule Generator (cissp-data.ts)
**Role:** Builds day-by-day schedule from plan + params.

- `getOrderedChapters(course, unitOrder)` — Reorders chapters by custom unit sequence
- `buildPageSequence(plan, orderedChapters)` — Creates flat page queue starting from `startingChapterId`
- `generateSchedule(plan, orderedChapters, today, pagesPerDay, endDate)` — Walks calendar, slices queue
- `mergeSchedules(items)` — Merges schedules from multiple courses into one calendar
- `dedupeScheduleByDate(schedule)` — Dedupes by date AND by chapter id within day
- `tagChaptersWithCourseId(schedule, courseId, label)` — Tags every chapter with courseId/label

---

## 4. Persistence Layer

### 4.1 database.ts
**Role:** Low-level storage adapter. Auto-selects SQLite (Tauri) or localStorage (Web).

| Method | Description |
|---|---|
| `readStorage()` | Load `{ plans, activePlanIds }` (Tauri cache or web cache) |
| `writeStorage(data)` | **v2.7.0: per-row upsert** — diffs prior snapshot, issues per-row `INSERT`/`UPDATE`/`DELETE` |
| `getDb()` | SQLite plugin init (Tauri only) |

Includes automatic migration from legacy JSON format. The Tauri branch uses an in-memory
cache (tauriCache) invalidated on every write.

### 4.2 plan-storage.ts
**Role:** Public CRUD API — same exports, delegates to database.ts.

### 4.3 Course Data (data/courses/*.json)
**Role:** Static course definitions. Loaded by `CourseProvider` at boot.

---

## 5. Component Dependency Graph (v2.7.0)

```
App.tsx (928 lines, dialog state + layout)
├── PersonalityProvider (context → label/toast/empty/greeting/loading/tips)
├── ThemeProvider (context → theme)
├── CourseProvider (context → course JSON)
├── Zustand store (plan-store.ts)
│   └── allPlans[], activePlanIds[]
│
├── useStudyLogging({ schedule, courseLabel, tToast, onAfterMarkDone })
│   ├── dailyLog, logDialogDay, logDialogGroups (state)
│   ├── handleLogPlan, handleSkipPlan, handleMarkDone
│   └── reads/writes planStore via storeUpdatePlan
│
├── useSchedule({ allPlans, activePlanIds, activeCourse, ... })
│   └── returns baseSchedule, mergedSchedule, selectedCoursesStats, showMerged
│
├── useKeyboardShortcuts({ activeCourseId, isPlannerOpen, ..., actions })
│   └── dispatches to 16 action callbacks
│
├── <AppHeader { ...state, actions } />
│   ├── <Popover /> for theme/mode/notification pickers
│   ├── CourseSelector, StudyTimer, WallClock
│   ├── NotificationSettingsPanel (renders <LabCreditPrompt> indirectly)
│   └── StreakChip
│
├── <StatsBar { viewedStats, showMerged, ..., pLabel } />
│
├── <SprintBanner />      // above tabs, surfaces active sprints
├── <PostmortemBanner />  // above tabs, prompts for past exam dates
├── <BurnDownView />      // above tabs, Gantt-style pages/days
│
├── ScheduleView
│   ├── schedule, dailyLog (props)
│   ├── onMarkDone / onOpenLogDialog (callbacks)
│   └── LogDialog (rendered by App, triggered by onOpenLogDialog)
│
├── ScheduleList
├── ProgressDashboard
├── DailyBriefing
│
├── PlannerPage (full-page overlay)
│   └── plan CRUD via Zustand actions
│
├── CourseBuilder (full-page overlay)
│   └── creates course JSON → saved via Rust FS commands
│
├── LabDashboard (full-page overlay)
│   └── <LabCreditPrompt /> surfaces after submitLog (v2.7.0)
│
├── SecurityNewsFeed (overlay, Tauri only)
├── StudyTimer (sidebar)
├── TipPopup (header button → floating card)
├── WallClock (header)
├── SidebarLabsStatus
├── SidebarNewsHighlights
├── KeyboardShortcutsCheatsheet (?)
├── LogDialog
├── NotificationToast
└── NotificationSettingsPanel (settings popover)
```
