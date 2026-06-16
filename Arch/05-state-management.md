# State Management Architecture

## 1. State Categories

| Category | Storage | Lifecycle | Examples |
|---|---|---|---|
| **Persistent** | SQLite / localStorage | Survives restart | Plans, dailyLog, active IDs |
| **Zustand Store** | In-memory + synced to disk | Load at boot, update on mutation | allPlans, activePlanIds |
| **React Temp State** | Component memory | Lost on page reload | dailyLog (temp), UI state |
| **Derived (useMemo)** | Computed | Recalculated on deps change | schedule, stats |
| **Custom Hooks (v2.7.0)** | Encapsulated React state | Lifetime = consuming component | useStudyLogging, useSchedule, useKeyboardShortcuts |

---

## 2. Zustand Store (Single Source of Truth)

**File:** `src/lib/plan-store.ts`

```typescript
interface PlanStore {
  // State
  allPlans: StudyPlan[]
  activePlanIds: string[]
  primaryActivePlanId: string | null
  isLoading: boolean

  // Actions
  loadPlans: () => Promise<void>
  updatePlan: (plan: StudyPlan) => Promise<void>
  deletePlan: (id: string) => Promise<void>
  renamePlan: (id: string, name: string) => Promise<void>
  setActivePlanIds: (ids: string[]) => void
  setPrimaryActivePlanId: (id: string | null) => void
  addActivePlanId: (id: string) => Promise<void>
  removeActivePlanId: (id: string) => Promise<void>
}
```

**Principles:**
- Components read from Zustand selectors (`usePlanStore(s => s.allPlans)`)
- Mutations go through store actions (which also persist to SQLite)
- No direct disk reads/writes from components

---

## 3. React State (Temp / Ephemeral)

### In useStudyLogging hook (v2.7.0, extracted from App.tsx)
```typescript
// Temp logging state (NOT persisted until Mark Done)
const [dailyLog, setDailyLog] = useState<Record<string, Record<string, { pagesRead: number }>>>({})

// Race-guard against mount-time storage load
const [tempLogsLoaded, setTempLogsLoaded] = useState(false)

// Log dialog
const [logDialogDay, setLogDialogDay] = useState<StudyDay | null>(null)
const [logDialogGroups, setLogDialogGroups] = useState<LogGroup[]>([])
```

### In useAppViewState hook (v2.8.0, extracted from App.tsx)
```typescript
// UI state
const [activeTab, setActiveTab] = useState<Tab>("calendar")
const [isFullscreen, setIsFullscreen] = useState(false)
const [calendarSelectedDate, setCalendarSelectedDate] = useState<string | null>(null)
const [statsViewCourseId, setStatsViewCourseId] = useState<string | null>(null)
const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(() => loadSelectedCourseIds())
```

### In 5 useOverlayState hooks (v2.8.0, extracted from App.tsx)
```typescript
const onlineLabs = useOverlayState<null>(null)
const news = useOverlayState<null>(null)
const courseBuilder = useOverlayState<null>(null)
const planner = useOverlayState<{ initialCourseId: string | null }>({ initialCourseId: null })
const timerLog = useOverlayState<{ minutes: number }>({ minutes: 0 })
```

### In useTipState hook (v2.8.0)
```typescript
const tip = useTipState(mode)
// tip.showTip, tip.currentTip, tip.tipNumber, tip.totalTips, tip.nextTip
```

### In useRefreshController hook (v2.8.0)
```typescript
const refresh = useRefreshController()
// refresh.tick, refresh.isRefreshing, refresh.trigger, refresh.triggerWithToast
```

### In App.tsx (v2.8.0 — only the cheatsheet state remains here)
```typescript
// The cheatsheet is the only remaining useState in AppContent.
// 8 overlay open/close flags are gone. 4 early-returns are gone.
const [showCheatsheet, setShowCheatsheet] = useState(false)
```

### In ScheduleView
```typescript
// Calendar navigation
const [currentMonth, setCurrentMonth] = useState({ year, month })
const [selectedDate, setSelectedDate] = useState<string | null>(null)
```

---

## 4. Derived State (v2.7.0 — encapsulated in `useSchedule`)

```typescript
// In useSchedule({ allPlans, activePlanIds, activeCourse, courses, ... })
const baseSchedule = useMemo(() => {
  // For each active plan: getOrderedChapters, syncStudyPlan (with Sprint + Adversary overlays),
  // generateSchedule, tagChaptersWithCourseId
}, [plans, activeCourseId, activePlanIds, activeCourse, courseLabel])

const mergedSchedule = useMemo(() => {
  // mergeSchedules across base + other selected courses
}, [showMerged, baseSchedule, otherCoursesInfo, activeCourseId, courseLabel])

const selectedCoursesStats = useMemo(() => {
  // per-course: pagesRead, pctDone, endDate, weeksAway
}, [activeCourseId, activeCourse, primaryActivePlanId, plans, baseSchedule, otherCoursesInfo, courses, allPlans, activePlanIds])

return { baseSchedule, otherCoursesInfo, mergedSchedule, schedule, selectedCoursesStats, showMerged }
```

---

## 5. Persistence Architecture

```
useStudyLogging.handleMarkDone(date) (v2.7.0)
  │
  ├─ storeUpdatePlan(updatedPlan)             // Zustand
  │   └─ planStorage.save(plan)               // → database.writeStorage
  │       └─ IS_TAURI: per-row upsert (v2.7.0)
  │           ├─ Read prior snapshot from tauriCache
  │           ├─ Diff against new data
  │           └─ Issue per-row INSERT/UPDATE/DELETE
  │       └─ !IS_TAURI: writeWeb (localStorage, full blob)
  │
  ├─ temp-log-storage.ts                      // persisted temp state
  │   ├─ applyTempLog(date, courseId, pagesRead)
  │   ├─ clearTempLog(date)                   // On Mark Done
  │   └─ readTempLogs()                       // On mount
  │
  └─ onAfterMarkDone()                        // App.tsx setRefreshTick
      └─ triggers loadPlans() → planStorage.getAll() (on next tick)
```

### Additional Storage Modules (Phase 0.5)

| Module | Storage Key | Purpose |
|---|---|---|
| `temp-log-storage.ts` | `web:temp_logs` | Persisted temp Log/Skip state (survives refresh) |
| `postmortem.ts` | `ztsf:postmortems` | Per-plan 5-section postmortem templates |
| `adversary.ts` | `ztsf:adversary-settings` | Adversary timer settings (enabled, paceBoostPct, deadline) |
| `notifications.ts` | `ztsf:notification-settings` | Notification settings (enabled, dailyTime, labsAlert) |
| `useOpsec.ts` | `ztsf:opsec` | OPSEC mode state (boolean) |
| `auto-backup.ts` | `ztsf:backup-index` | Backup index (one-per-day) |
| `lab-session-storage.ts` | `web:labs_sessions` | Lab sessions (via Tauri file or localStorage) |
| `course-storage.ts` | `data/courses/*.json` | Course configs (via Tauri FS or localStorage) |

### SQLite Schema (Tauri mode)
```sql
CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL  -- JSON-encoded StudyPlan
);

CREATE TABLE active_plan_ids (
  id TEXT PRIMARY KEY
);

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

### localStorage Schema (Web/Test mode)
- Plans: `web:plans` (JSON blob of `Record<string, StudyPlan>`)
- Active IDs: `web:activePlanIds` (JSON array)
- In-memory write-through cache avoids JSON parse on every read

---

## 6. StudyPlan Shape

```typescript
interface StudyPlan {
  id: string
  courseId: string
  name: string
  createdAt: string
  updatedAt: string
  startDate: string
  pagesPerDay: number
  studyDays: number[]         // 0=Sun, 1=Mon, ...
  startingChapterId: number
  chapterStartOverrides: Record<number, number>
  targetEndDate?: string
  targetDayCount?: number
  anchor: "pagesPerDay" | "endDate"
  unitOrder?: number[]         // Custom unit sequence (optional)
  dailyLog: Record<string, DailyLog>
  skippedDays: string[]        // YYYY-MM-DD dates explicitly skipped
  // NO completedDays field — dailyLog presence is the indicator
  // NO chapterChecks or chapterProgress fields
  sprint?: {                   // Phase 0.5.4 (lib v2.6.0, UI v2.7.0)
    startDate: string          // YYYY-MM-DD when sprint starts
    days: number               // Number of days sprint lasts
    paceBoost: number          // Percentage boost (0-100)
  }
}

interface DailyLog {
  pagesRead: number
  note?: string
}
```

---

## 7. State Synchronization Rules

| Rule | Implementation |
|---|---|
| Every mutation persists | `storeUpdatePlan` → SQLite save |
| Read after write | After save, store state is authoritative |
| Temp state is separate | `dailyLog` React state never written to disk |
| Mark Done bridges temp→persistent | Reads temp state, merges into plan, persists, clears temp |
| UI state is ephemeral | Tabs, modals, calendar view — lost on refresh |

---

## 8. Migration System

Auto-migrations run at load time in `database.ts`:

| Migration | Description |
|---|---|
| `plans.json` → per-plan keys | Legacy single-file → key-value |
| `planMode` → `anchor` | Renamed field |
| numeric keys → date keys | `dailyLog[1]` → `dailyLog["2026-04-01"]` |
| `activePlanId` → `activePlanIds` | Single ID → array |
| `completedDays` removal | Now detected by dailyLog presence |

---

## 9. Personality Layer State

The personality mode is managed outside Zustand — it's pure React context + localStorage.

| Category | Storage | Mechanism |
|---|---|---|
| Current mode | React state (PersonalityProvider) | `useState<PersonalityMode>` |
| Persisted mode | localStorage | `ztsf:personality-mode` key |
| String maps | Static module data (`personality.ts`) | 13 modes × 6 dictionaries (labels ~256, toasts ~33, empties ~13, greetings 3, loading 4, tips 10) |

**Access pattern:**
```tsx
const { label, toast, empty, greeting, loading, tips, mode, setMode } = usePersonality()
label("planner")        // → "Planner" (or themed variant)
toast("planCreated")    // → toast template string
empty("noData")         // → empty state message
```

**Rules:**
- `label(key)` falls back to raw `key` if not found in current mode — never blank/undefined
- `formatStr(template, params)` interpolates `{var}` placeholders in toast/empty templates
- Mode switch re-seeds tip picker via `tipPicker.setMode(newMode)`
- Personality layer has zero impact on engine logic — pure string overlay
- New modes add string maps only — no logic, storage, or component changes required
