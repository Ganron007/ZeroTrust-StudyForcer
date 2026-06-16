# ZeroTrust.StudyForcer — Architecture Documentation

**Updated:** 2026-06-15  
**System:** ZeroTrust.StudyForcer Desktop Application  
**Stack:** Tauri 2 (Rust) + React 19 (TypeScript) + Tailwind CSS 3  
**State:** Zustand 5 + SQLite / localStorage  
**Version:** 2.7.0 (App.tsx refactor + Phase 0.5 UI integration: 748 vitest + 11 e2e + 17 Rust tests, all passing)

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
| 07 | `07-testing-architecture.md` | Test pyramid, 748 tests + 17 Rust, coverage targets |

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
| `src/App.tsx` | Root component, dialog state machine, layout shell (928 lines post-v2.7.0) |
| `src/hooks/useStudyLogging.ts` | **v2.7.0** — Log/Skip temp state + Mark Done commit flow |
| `src/hooks/useSchedule.ts` | **v2.7.0** — pure derivation of schedule + stats |
| `src/hooks/useKeyboardShortcuts.ts` | **v2.7.0** — global keydown listener |
| `src/components/AppHeader.tsx` | **v2.7.0** — top toolbar (extracted from App.tsx) |
| `src/components/Popover.tsx` | **v2.7.0** — popover primitive (theme, mode, notification pickers) |
| `src/components/StatsBar.tsx` | **v2.7.0** — finish-date + 6-cell grid |
| `src/components/SprintBanner.tsx` | **v2.7.0** — sprint status banner above tabs |
| `src/components/PostmortemBanner.tsx` | **v2.7.0** — exam-passed reflection prompt + editor |
| `src/components/LabCreditPrompt.tsx` | **v2.7.0** — exam-domain credit offer after lab log |
| `src/components/ErrorBoundary.tsx` | **v2.7.2** — error boundary primitive (class), wraps 7 areas |
| `src/lib/plan-store.ts` | **Zustand store** — single source of truth |
| `src/lib/database.ts` | SQLite + localStorage adapter (per-row upsert v2.7.0) |
| `src/lib/plan-storage.ts` | Public CRUD API (delegates to database.ts) |
| `src/lib/plan-engine.ts` | `syncStudyPlan()` — Sprint + Adversary overlays integrated v2.7.0 |
| `src/lib/cissp-data.ts` | `generateSchedule()`, `buildPageSequence()`, `getOrderedChapters()` |
| `src/lib/clock.ts` | Single clock source — all time calls go through here |
| `src/lib/personality.ts` | 13 personality mode string maps, `formatStr()`, `getSavedMode()` (3896 lines) |
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
| `src/components/LabDashboard.tsx` | Lab session tracker with streaks (v2.7.0: wires LabCreditPrompt) |
| `src/components/SecurityNewsFeed.tsx` | RSS/Atom feed reader (Tauri only) |
| `src/components/ExamAlertBanner.tsx` | Exam-day alert banner (T-3 or less) |
| `src/components/BurnDownView.tsx` | Gantt-style pages/days remaining view (v2.7.0: mounted above tabs) |
| `src/components/SidebarNewsHighlights.tsx` | News highlights with CVE-of-the-day chip |
| `src/components/NotificationSettingsPanel.tsx` | Notification + Adversary settings (v2.7.0) |
| `src/lib/tips.ts` | Tip picker — mode-aware round-robin tips |
| `src-tauri/src/main.rs` | Rust backend (1106 lines + 17 unit tests v2.7.0) |
