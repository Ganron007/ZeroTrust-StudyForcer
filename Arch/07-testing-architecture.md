# Testing Architecture

**Current:** 447 unit tests (27 files) + 11 E2E tests (1 file) = 458 total, all passing  
**Runner:** Vitest v4.1.5 + Playwright 1.60.0  
**Environment:** jsdom (unit), Chromium (E2E)  
**Framework:** @testing-library/react + jest-dom + user-event

---

## 1. Test Organization

```
src/lib/__tests__/
├── plan-engine.test.ts          # 36 — syncStudyPlan, pagesConsumedBeforeToday, anchors
├── cissp-helpers.test.ts        # 52 — getOrderedChapters, buildPageSequence, date math
├── e2e-flows.test.ts            # 24 — create → log → mark-done flows
├── course.test.ts               # 19 — course config + flattening
├── plan-storage.test.ts         # 19 — CRUD over database.ts
├── e2e-comprehensive.test.ts    # 17 — multi-course, multi-plan integration
├── export-utils.test.ts         # 12 — JSON import/export round-trips
├── date-picker.test.tsx         # 10 — react-day-picker wiring
├── planner-page.test.tsx        # 9  — PlannerPage create/edit/delete
├── ui-components.test.tsx       # 5  — misc component smoke tests
├── sanitize-svg.test.ts         # 13 — SVG XSS sanitization (scriptKiddie + h2.3)
├── plan-store.test.ts           # 6  — Zustand store actions (h2.4)
├── database.test.ts             # 5  — readStorage / writeStorage / quota (h2.5)
├── course-storage.test.ts       # 10 — loadAllCourses / loadCourse / logos (h2.6)
├── personality.test.ts          # ~80 — all 13 modes × 7 fallback chains (h2.7)
├── auto-backup.test.ts          # 5  — auto-backup write/prune (Phase 2.4)
├── notifications.test.ts        # 9  — notification settings + scheduler (Phase 2.2)
├── shortcuts.test.ts            # 8  — keyboard shortcuts catalog (Phase 2.5)
└── css-entry-point.test.ts      # 9  — CSS entry point + Phase 2.5 rules (v2.4.11)

src/hooks/__tests__/
└── useFocusTrap.test.tsx        # 6  — focus management hook (Phase 2.5)

src/components/__tests__/
├── StreakChip.test.tsx          # 9  — header streak chip (Phase 2.3)
├── CourseBuilderExport.test.tsx # 3  — Course Builder JSON export (Phase 2.6)
├── ReportGenerator.test.tsx      # 6  — CSV/JSON/PDF report export (Phase 2.1)
├── NotificationSettingsPanel.test.tsx # 5  — notification settings UI (Phase 2.2)
├── KeyboardShortcutsCheatsheet.test.tsx # 8  — cheatsheet modal (Phase 2.5)
└── axe-audit.test.tsx           # 1  — automated WCAG audit (Phase 2.5)
└── bug-fixes.test.ts            # 17 — regression tests for 64 audit bugs
```
Total: **447 unit tests / 27 files** + **11 E2E tests / 1 file** = **458 total**, all passing at v2.4.11. Personality layer has automated fallback-chain coverage. WCAG-AA audited via axe-core in CI. Source-code tests catch "wrong file" bugs (e.g., CSS in dead files). E2E tests catch layout/visibility bugs that jsdom cannot detect.

---

## 2. Test Pyramid (Current)

```
          /\
         /  \     E2E Flows (integration)
        /    \    Full user journeys
       /------\
      /        \   Component Tests
     /          \  UI + interactions
    /------------\
   /              \ Unit Tests
  /                \ Functions in isolation
/------------------\
```

**Current distribution:**
- **Unit tests:** Core math, schedule generation, storage CRUD
- **Integration tests:** Full user flows (create plan → log → mark done → verify stats)
- **Component tests:** PlannerPage, UI components

---

## 3. Mocking Strategy

**Tauri API — Web/Test mode:**
```typescript
vi.mock("../is-tauri", () => ({ IS_TAURI: false }))
```
This forces `database.ts` to use localStorage instead of SQLite, making tests zero-config.

**Storage persistence:**
```typescript
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(window, "localStorage", { value: localStorageMock })
```

**Timers:**
```typescript
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-04-01T00:00:00Z"))
})
```

---

## 4. Test Commands

```bash
# Run all tests
npx vitest run

# Run with coverage
npx vitest run --coverage

# Run specific file
npx vitest run src/lib/__tests__/plan-engine.test.ts

# Watch mode (development)
npx vitest

# TypeScript check (required before commit)
npx tsc -b --noEmit
```

---

## 5. Coverage Targets

| File | Target |
|---|---|
| `plan-engine.ts` | ≥95% |
| `cissp-data.ts` | ≥75% |
| `plan-storage.ts` | ≥80% |
| `App.tsx` | ≥50% (handlers) |
| Components | ≥50% |

---

## 6. Key Test Areas

### Queue-Based Model Tests
- Page sequence built correctly from custom unit order + starting chapter
- `effectiveSliceSize` = 0 for unlogged past days
- `plannedSliceSize` = resolvedPagesPerDay for past unlogged (display continuity)
- Page pointer advances by actual pagesRead only
- Pointer does NOT advance for unlogged past days

### Logging Flow Tests
- Log → temp state only (no disk write)
- Skip → 0 pages, temp state only
- Mark Done → commits to storage, clears temp
- `handleMarkDone` correctly looks up plan via `allPlans.find(courseId + activePlanIds)` (Bug #7 fix — replaced `dateToActivePlanId` map)

### Anchor System Tests
- Velocity anchor: pace locked, end date shifts
- Deadline anchor: end date locked, pace adjusts
- Zero-edge cases (0 remaining, 0 pages read)

### Custom Unit Order Tests
- `getOrderedChapters()` reorders by unitOrder
- `buildPageSequence()` starts from correct chapter in reordered list
- Mid-stream order changes (visual only, consumption math stays correct)

### Known Bug Regressions
| Bug | Fix | Test Guard |
|-----|-----|------------|
| #1 wrong destructure in handleMarkDone | Use direct `allPlans.find` | Error-handling in e2e flows |
| #2 unlogged-past pointer advance | `effectiveSliceSize = 0` | `effectiveSliceSize = 0` assertion in schedule tests |
| #3 multi-plan dailyLog overwrite | `Record<date, Record<courseId, ...>>` nesting | Nested dispatch in logging tests |
| #4 book page display fallback | Use `pagesStart`/`pagesEnd` instead of `?? 1` | Fallback assertion |
| #5 unit order mutable after logs | Freeze guard in PlannerPage | Guard prevents edit after first log |
| #6 calendar selected day lost on nav | Lifted to App.tsx state | Persists across tab switch |
| #7 second plan log dropped on Mark Done | `allPlans.find(courseId + activePlanIds)` | Multi-plan e2e test |
| #8 dashboard avg-% formula | Sum `pagesRead` not `keys.length × pagesPerDay` | Stats calculation test |
| #9 contradictory toasts on out-of-range log | `return` after error toast | Single toast assertion |
| #10 stale unitOrder in deadline pace | Use `updated.unitOrder` not `editUnitOrder` | Pace calculation test |
| #11 empty-object truthiness check | Explicit `Object.keys().length > 0` | Condition coverage |
| #12 stats blank after course switch | 3-part fix + reconciliation effect | Multi-course e2e test |
| #13 `empty("noReadingToday")` interpolation | Use `formatStr()` | Formatting assertion |
| #14 `tToast("courseValidation")` interpolation | Use `formatStr()` | Formatting assertion |

---

## 7. Best Practices

1. **Arrange-Act-Assert** — Clear setup, action, and verification phases
2. **Test data factories** — `makePlan(overrides)` for clean test setup
3. **Isolated tests** — Each test creates fresh data, no shared state
4. **Deterministic** — Fake timers for date-based tests
5. **Queue model tests** — Verify pointer position, not exact chapter display for past completed days
6. **No phantom consumption** — Verify unlogged days contribute 0
