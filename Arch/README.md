# ZeroTrust.StudyForcer — Architecture Documentation

**Updated:** 2026-05-18  
**System:** ZeroTrust.StudyForcer Desktop Application  
**Stack:** Tauri 2 (Rust) + React 19 (TypeScript) + Tailwind CSS 3  
**State:** Zustand 5 + SQLite / localStorage  
**Version:** 2.3.1 (13 personality modes, bug fixes)

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
| Version log | `../Docs/CHANGELOG.md` |

---

## Architecture at a Glance

```
User Action → App.tsx handlers → React state (dailyLog temp)
                                   ↓
                             Mark Done → Zustand store → SQLite
                                   ↓
                   schedule recalc → React re-render
                                   
All user-facing text routed through PersonalityProvider (React context):
  label(key) | toast(key) | empty(key) | greeting(key) | loading(key) | tips()
  → Pure string overlay — never modifies engine/logic/data files
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
| `src/lib/personality.ts` | 13 personality mode string maps, `formatStr()`, `getSavedMode()` |
| `src/components/PersonalityProvider.tsx` | React context — `usePersonality()` hook for `label()`, `toast()`, `empty()`, etc. |
| `src/components/ScheduleView.tsx` | Calendar grid + day detail + Log/MarkDone buttons |
| `src/components/LogDialog.tsx` | Per-plan page input modal |
| `src/components/PlannerPage.tsx` | Plan CRUD + full settings form |
| `src/components/CourseBuilder.tsx` | Built-in course config creator with JSON preview |
| `src/components/ProgressDashboard.tsx` | Stats & charts |
| `src/components/DailyBriefing.tsx` | Personality-driven greeting + empty states |
| `src/components/StudyTimer.tsx` | Pomodoro / stopwatch / countdown |
| `src/components/LabDashboard.tsx` | Lab session tracker with streaks |
| `src/components/SecurityNewsFeed.tsx` | RSS/Atom feed reader (Tauri only) |
| `src/lib/tips.ts` | Tip picker — mode-aware round-robin tips |
