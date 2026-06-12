# ZeroTrust.StudyForcer — Architecture Documentation

**Updated:** 2026-06-12  
**System:** ZeroTrust.StudyForcer Desktop Application  
**Stack:** Tauri 2 (Rust) + React 19 (TypeScript) + Tailwind CSS 3  
**State:** Zustand 5 + SQLite / localStorage  
**Version:** 2.6.0 (Phase 0.5 complete, all 642 tests pass)

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
| 07 | `07-testing-architecture.md` | Test pyramid, 642 tests, coverage targets |

---

## Quick Reference

| Goal | Start with |
|---|---|
| Understanding the big picture | `01-executive-overview.md` |
| Debugging data flow | `03-data-flow.md` + `05-state-management.md` |
| Understanding auto-adjust | `06-anchor-system.md` + `04-control-flow.md` |
| Adding tests | `07-testing-architecture.md` |
| Recent decisions / Q&A history | `../ARCHITECTURE.md` |
| Version log | `../CHANGELOG.md` |

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
| `src/App.tsx` | Root component, all logging/mark-done handlers, OPSEC toggle |
| `src/lib/plan-store.ts` | **Zustand store** — single source of truth |
| `src/lib/database.ts` | SQLite + localStorage adapter (with in-memory cache) |
| `src/lib/plan-storage.ts` | Public CRUD API (delegates to database.ts) |
| `src/lib/plan-engine.ts` | `syncStudyPlan()`, `pagesConsumedBeforeToday()`, `computePlanSchedule()` |
| `src/lib/cissp-data.ts` | `generateSchedule()`, `buildPageSequence()`, `getOrderedChapters()` |
| `src/lib/clock.ts` | Single clock source — all time calls go through here |
| `src/lib/personality.ts` | 13 personality mode string maps, `formatStr()`, `getSavedMode()` |
| `src/components/PersonalityProvider.tsx` | React context — `usePersonality()` hook for `label()`, `toast()`, `empty()`, etc. |
| `src/hooks/useOpsec.ts` | OPSEC mode — masks sensitive info for screen-sharing |
| `src/lib/sprint.ts` | Sprint mode — temporary pace boost overlay |
| `src/lib/lab-credit.ts` | Lab → exam-domain credit matching |
| `src/lib/postmortem.ts` | Postmortem mode — exam-passed reflection storage |
| `src/lib/adversary.ts` | Adversary timer — opt-in pace auto-bump |
| `src/lib/temp-log-storage.ts` | Persisted temp Log/Skip state (survives refresh) |
| `src/components/ScheduleView.tsx` | Calendar grid + day detail + Log/MarkDone buttons |
| `src/components/LogDialog.tsx` | Per-plan page input modal |
| `src/components/PlannerPage.tsx` | Plan CRUD + full settings form |
| `src/components/CourseBuilder.tsx` | Built-in course config creator with JSON preview |
| `src/components/ProgressDashboard.tsx` | Stats & charts |
| `src/components/DailyBriefing.tsx` | Personality-driven greeting + empty states + standup card |
| `src/components/StudyTimer.tsx` | Pomodoro / stopwatch / countdown |
| `src/components/LabDashboard.tsx` | Lab session tracker with streaks |
| `src/components/SecurityNewsFeed.tsx` | RSS/Atom feed reader (Tauri only) |
| `src/components/ExamAlertBanner.tsx` | Exam-day alert banner (T-3 or less) |
| `src/components/BurnDownView.tsx` | Gantt-style pages/days remaining view |
| `src/components/SidebarNewsHighlights.tsx` | News highlights with CVE-of-the-day chip |
| `src/lib/tips.ts` | Tip picker — mode-aware round-robin tips |
