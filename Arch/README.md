# CySec CCPTL — Architecture Documentation

**Updated:** 2026-05-17  
**System:** CySec CCPTL Desktop Application  
**Stack:** Tauri 2 (Rust) + React 19 (TypeScript) + Tailwind CSS 3  
**State:** Zustand 5 + SQLite / localStorage  
**Version:** 2.2.1 (renamed to CySec CCPTL, clean portable builds)

---

## Document Index

| # | Document | Description |
|---|---|---|
| 01 | `01-executive-overview.md` | High-level architecture, stacks, core principles |
| 02 | `02-structural-components.md` | Component breakdown with responsibilities |
| 03 | `03-data-flow.md` | Data lifecycle: Log/Skip temp → Mark Done commit |
| 04 | `04-control-flow.md` | Decision trees for logging, queue advancement, autodjust |
| 05 | `05-state-management.md` | Zustand + SQLite architecture, persistence patterns |
| 06 | `06-anchor-system.md` | Auto-adjust engine: effective vs planned slice sizes |
| 07 | `07-testing-architecture.md` | Test pyramid, 203 tests, coverage targets |

---

## Quick Reference

| Goal | Start with |
|---|---|
| Understanding the big picture | `01-executive-overview.md` |
| Debugging data flow | `03-data-flow.md` + `05-state-management.md` |
| Understanding auto-adjust | `06-anchor-system.md` + `04-control-flow.md` |
| Adding tests | `07-testing-architecture.md` |
| Recent decisions / Q&A history | `../Docs/ARCHITECTURE.md` |
| Bug history (root causes + fixes) | `../Docs/BUGS.md` |
| Version log | `../Docs/CHANGELOG.md` |
| Future direction | `../Docs/ROADMAP.md` |

---

## Architecture at a Glance

```
User Action → App.tsx handlers → React state (dailyLog temp)
                                   ↓
                             Mark Done → Zustand store → SQLite
                                   ↓
                   schedule recalc → React re-render
```

---

## Key Files Reference

| File | Role |
|---|---|
| `src/App.tsx` | Root component, all logging/mark-done handlers |
| `src/lib/plan-store.ts` | **Zustand store** — single source of truth |
| `src/lib/database.ts` | SQLite + localStorage adapter |
| `src/lib/plan-storage.ts` | Public CRUD API (delegates to database.ts) |
| `src/lib/plan-engine.ts` | `syncStudyPlan()`, `pagesConsumedBeforeToday()` |
| `src/lib/cissp-data.ts` | `generateSchedule()`, `buildPageSequence()`, `getOrderedChapters()` |
| `src/components/ScheduleView.tsx` | Calendar grid + day detail + Log/MarkDone buttons |
| `src/components/LogDialog.tsx` | Per-plan page input modal |
| `src/components/PlannerPage.tsx` | Plan CRUD + full settings form |
| `src/components/ProgressDashboard.tsx` | Stats & charts |
