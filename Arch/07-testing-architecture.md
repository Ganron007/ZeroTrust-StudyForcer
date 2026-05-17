# Testing Architecture

**Current:** 203 tests, 10 files, all passing  
**Runner:** Vitest v4.1.5  
**Environment:** jsdom  
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
└── ui-components.test.tsx       # 5  — misc component smoke tests
```
Total: **203 tests / 10 files**, all passing at v2.2.1.

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

**Tauri API:**
```typescript
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn()
}))
```

**Storage:**
```typescript
vi.mock("@/lib/plan-storage", async () => {
  const actual = await vi.importActual("@/lib/plan-storage")
  return { ...actual, planStorage: { /* mock implementations */ } }
})
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
- `handleMarkDone` correctly looks up plan via `dateToActivePlanId`

### Anchor System Tests
- Velocity anchor: pace locked, end date shifts
- Deadline anchor: end date locked, pace adjusts
- Zero-edge cases (0 remaining, 0 pages read)

### Custom Unit Order Tests
- `getOrderedChapters()` reorders by unitOrder
- `buildPageSequence()` starts from correct chapter in reordered list
- Mid-stream order changes (visual only, consumption math stays correct)

### Known Bug Regressions
| Bug | Fix |
|---|---|
| Past unlogged days advancing pointer | `effectiveSliceSize = 0` |
| Multi-plan Mark Done dropped second plan | Direct `allPlans.find(courseId + activePlanIds)` |
| Multi-plan dailyLog overwrite | `Record<date, Record<courseId, ...>>` nesting |
| completedDays showing stale data | Removed entirely, dailyLog is the indicator |

---

## 7. Best Practices

1. **Arrange-Act-Assert** — Clear setup, action, and verification phases
2. **Test data factories** — `makePlan(overrides)` for clean test setup
3. **Isolated tests** — Each test creates fresh data, no shared state
4. **Deterministic** — Fake timers for date-based tests
5. **Queue model tests** — Verify pointer position, not exact chapter display for past completed days
6. **No phantom consumption** — Verify unlogged days contribute 0
