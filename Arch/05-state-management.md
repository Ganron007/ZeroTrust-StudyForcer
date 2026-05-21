# State Management Architecture

## 1. State Categories

| Category | Storage | Lifecycle | Examples |
|---|---|---|---|
| **Persistent** | SQLite / localStorage | Survives restart | Plans, dailyLog, active IDs |
| **Zustand Store** | In-memory + synced to disk | Load at boot, update on mutation | allPlans, activePlanIds |
| **React Temp State** | Component memory | Lost on page reload | dailyLog (temp), UI state |
| **Derived (useMemo)** | Computed | Recalculated on deps change | schedule, stats |

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

### In App.tsx
```typescript
// Temp logging state (NOT persisted until Mark Done)
const [dailyLog, setDailyLog] = useState<Record<string, Record<string, { pagesRead: number }>>>({})

// Log dialog
const [logDialogDay, setLogDialogDay] = useState<StudyDay | null>(null)
const [logDialogGroups, setLogDialogGroups] = useState<LogGroup[]>([])

// UI state
const [activeTab, setActiveTab] = useState<Tab>("calendar")
const [isFullscreen, setIsFullscreen] = useState(false)
const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set())
```

### In ScheduleView
```typescript
// Calendar navigation
const [currentMonth, setCurrentMonth] = useState({ year, month })
const [selectedDate, setSelectedDate] = useState<string | null>(null)
```

---

## 4. Derived State (useMemo)

```typescript
// Schedule (computed, never stored)
const schedule = useMemo(() => {
  for (const plan of activePlans) {
    const chapters = getOrderedChapters(course, plan.unitOrder)
    const params = syncStudyPlan(plan, chapters, today)
    const result = generateSchedule(plan, chapters, today, params.pagesPerDay, params.endDate)
    // ...
  }
}, [plans, activeCourseId, activePlanIds, activeCourse])

// Stats
const selectedCoursesStats = useMemo(() => {
  for (const plan of selectedPlans) {
    const params = syncStudyPlan(plan, chapters, today)
    // Compute pctDone, endDate, etc.
  }
}, [plans, activeCourseId, ...])
```

---

## 5. Persistence Architecture

```
App.tsx (handler)
  │
  ├─ storeUpdatePlan(updatedPlan)   // Zustand
  │   └─ planStorage.save(plan)     // → database.ts
  │       ├─ IS_TAURI → SQLite (tauri-plugin-sql)
  │       └─ !IS_TAURI → localStorage
  │
  └─ loadPlans()                    // Reload from disk
      └─ planStorage.getAll()       // → database.ts.getAll()
```

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
