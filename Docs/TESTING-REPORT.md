# Testing Report

**Updated:** 2026-05-17
**Version:** 2.2.1
**Runner:** Vitest v4.1.5 + jsdom
**Total tests:** 203 across 10 files
**Status:** all passing

For deeper test-architecture context (pyramid, mocking strategy, coverage targets), see
[`../Arch/07-testing-architecture.md`](../Arch/07-testing-architecture.md).

---

## 1. Test files & counts

| File | Tests | Focus |
|---|---|---|
| `src/lib/__tests__/plan-engine.test.ts` | 36 | `syncStudyPlan`, `pagesConsumedBeforeToday`, both anchor modes, edge cases |
| `src/lib/__tests__/cissp-helpers.test.ts` | 52 | `getOrderedChapters`, `buildPageSequence`, date math helpers |
| `src/lib/__tests__/e2e-flows.test.ts` | 24 | Full create-plan → log → mark-done flows |
| `src/lib/__tests__/course.test.ts` | 19 | Course config flattening + validation |
| `src/lib/__tests__/plan-storage.test.ts` | 19 | CRUD over `database.ts` |
| `src/lib/__tests__/e2e-comprehensive.test.ts` | 17 | Multi-course, multi-plan integration |
| `src/lib/__tests__/export-utils.test.ts` | 12 | JSON import/export round-trips |
| `src/lib/__tests__/date-picker.test.tsx` | 10 | `react-day-picker` wiring |
| `src/lib/__tests__/planner-page.test.tsx` | 9 | PlannerPage component (create/edit/delete) |
| `src/lib/__tests__/ui-components.test.tsx` | 5 | Misc component tests |

---

## 2. Commands

```sh
npx vitest run                          # All tests
npx vitest run --coverage               # With coverage (@vitest/coverage-v8)
npx vitest run src/lib/__tests__/<file> # Single file
npx vitest                              # Watch mode
npx tsc -b --noEmit                     # Type-check only (required before commit)
```

---

## 3. Coverage targets

| Module | Target | Why |
|---|---|---|
| `plan-engine.ts` | ≥95% | Pure math, no excuses |
| `cissp-data.ts` | ≥75% | Schedule generator — most logic, some date-walk paths hard to hit |
| `plan-storage.ts` | ≥80% | CRUD over `database.ts` |
| `App.tsx` | ≥50% | Handlers exercised via e2e tests |
| Components | ≥50% | Render + interaction smoke |

---

## 4. Key areas under test

### Queue-based model
- Page sequence built correctly from custom unit order + starting chapter
- `effectiveSliceSize = 0` for past unlogged days (pointer does not advance)
- `plannedSliceSize = resolvedPagesPerDay` for past unlogged (calendar display continuity)
- Pointer advances by actual `dailyLog.pagesRead` only

### Logging flow
- Log/Skip update React temp state only — no disk write
- Mark Done commits temp state to plan storage, then clears temp
- `handleMarkDone` resolves the owning plan via `allPlans.find(courseId + activePlanIds)` (Bug #7 fix)
- Skip → `pagesRead: 0`, day still "logged" (pages stay in queue)

### Anchor system
- Velocity (`pagesPerDay` locked) — end date shifts
- Deadline (`targetEndDate` locked) — pace adjusts
- Infeasible deadlines → fallback to stored pace + warning
- Zero-edge: 0 remaining, 0 pages logged, all-zero days

### Custom unit ordering
- `getOrderedChapters` reorders chapters per `unitOrder`
- `buildPageSequence` starts from `startingChapterId` in the reordered list
- Unit order freeze after first log (Bug #5): edit form ignores `editUnitOrder` if `dailyLog` non-empty

### Regression coverage
| Bug | Test guard |
|---|---|
| #1 wrong destructure in handleMarkDone | `handleMarkDone` uses date→plan map / direct find |
| #2 unlogged-past pointer advance | `effectiveSliceSize = 0` assertion |
| #3 multi-plan dailyLog overwrite | `Record<date, Record<courseId, ...>>` nesting |
| #5 unit-order mutates after logs | freeze guard in PlannerPage |
| #7 second plan log dropped | direct `allPlans.find` lookup |
| #8 dashboard avg-% formula | sums `pagesRead`, not `keys.length × pagesPerDay` |

---

## 5. Storage notes

Tests run in **web/test mode** — `IS_TAURI` is false, so `database.ts` falls back to
`localStorage`. Each test resets the keys it touches via `beforeEach`. SQLite paths are
exercised manually in the running Tauri build, not in the test suite.

---

## 6. Pre-commit checklist

1. `npx tsc -b --noEmit` — TypeScript clean
2. `npx vitest run` — all 203 tests pass
3. `npm run build` — Vite production build succeeds
4. (Optional) `npm run tauri:build` — full desktop bundle before tagging a release

---

## 7. Coverage output

Raw test logs and coverage HTML may live under `coverage/` (Vitest's default output
directory) when you run with `--coverage`. That folder is git-ignored.
