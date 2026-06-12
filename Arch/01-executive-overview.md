# Executive Architecture Overview

**System:** ZeroTrust.StudyForcer Desktop Application  
**Stack:** Tauri 2 (Rust) + React 19 (TypeScript) + Tailwind CSS 3  
**State Management:** Zustand 5 (single source of truth) + SQLite (Tauri) / localStorage (Web)  
**Personality Layer:** 13 text themes via `PersonalityProvider` React context — pure string overlay  
**Version:** 2.6.0 (Phase 0.5 complete, 642 tests)

---

## 1. System Purpose

A desktop study planner that generates daily reading schedules from course configs, tracks progress via
plan-level page logging (queue-based), and supports custom unit ordering for non-linear curricula.
Users log pages read per plan per day (temporary state), then commit with "Mark Done" to persist.

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  Presentation Layer (React)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │Schedule  │ │Schedule  │ │Progress  │ │Planner   │       │
│  │View      │ │List      │ │Dashboard │ │Page      │       │
│  │(Calendar)│ │          │ │(Stats)   │ │(CRUD)    │       │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘       │
│       │            │            │            │              │
│  ┌────▼────────────▼────────────▼────────────▼──────┐      │
│  │           PersonalityProvider (Context)            │      │
│  │  label(key) → string | toast(key) → string       │      │
│  │  empty(key) → string | greeting(key) → string    │      │
│  └────────────────────┬──────────────────────────────┘      │
│                       │                                      │
│  ┌────────────────────▼──────────────────────────────────────┐│
│  │              App.tsx (Handlers)                           ││
│  │  handleLogPlan / handleSkipPlan / handleMarkDone          ││
│  │  handleOpenLogDialog / handleLogDialogSave                ││
│  │  handleTimerLog / handleSaveEdit / handleDeletePlan       ││
│  └────────────────────┬──────────────────────────────────────┘│
└───────────────────────┼──────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────────┐
│                 Application / State Layer                     │
│  ┌──────────────────────────────────────────────────────┐    │
│  │         Zustand Store (plan-store.ts)                 │    │
│  │  allPlans[] | activePlanIds[] | primaryActivePlanId   │    │
│  └────────────────────┬─────────────────────────────────┘    │
│                       │                                      │
│  ┌────────────────────▼─────────────────────────────────┐    │
│  │              Plan Engine (Core Logic)                  │    │
│  │  syncStudyPlan() | generateSchedule()                  │    │
│  │  buildPageSequence() | getOrderedChapters()            │    │
│  └────────────────────┬─────────────────────────────────┘    │
│                       │                                      │
│  ┌────────────────────▼─────────────────────────────────┐    │
│  │         Personality Data (personality.ts)             │    │
│  │  13 modes × full string maps — zero logic impact      │    │
│  └──────────────────────────────────────────────────────┘    │
└───────────────────────┼──────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────────┐
│                   Persistence Layer                           │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  database.ts (SQLite / localStorage adapter)          │    │
│  │  plan-storage.ts (public CRUD API)                    │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Course Data (JSON in <appDir>/data/courses/*.json)   │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Rust Backend (src-tauri/src/main.rs)                │    │
│  │  FS I/O, RSS feeds, tray icon, window state          │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Key Architectural Decisions

| Decision | Rationale |
|---|---|
| **Tauri over Electron** | Smaller bundle, native Rust backend, better security |
| **Zustand as SSOT** | Plans loaded at boot, all mutations go through store |
| **SQLite + localStorage** | Tauri: real DB. Web fallback: localStorage for dev/testing |
| **Queue-based logging** | Fixed `pageSequence` + `pageIdx`. No chapter checkboxes |
| **Log/Skip = temp, Mark Done = commit** | Prevents data loss from accidental clicks; only intentional commits persist |
| **Two slice sizes** | `effectiveSliceSize` (actual pointer advancement) vs `plannedSliceSize` (display) |
| **Unlogged past days: pointer stays** | Prevents schedule from jumping ahead |
| **Computed schedule (not stored)** | Always derived from plan + logs |
| **Custom unit ordering** | `unitOrder` stored per plan; `getOrderedChapters()` reorders chapters |
| **Anchor system** | Two modes: Velocity (locked pace) or Deadline (locked end date) |
| **Personality layer** | 13 text themes via `PersonalityProvider` context — `label(key)`/`toast(key)`/`empty(key)`/`greeting(key)`/`loading(key)`/`tips()`. Pure string overlay, no engine/logic changes |
| **Course Builder** | Built-in course config creator with JSON preview, validation, drag-to-reorder |
| **StudyTimer** | Pomodoro/stopwatch/countdown with 10s disk-write debounce |
| **Security News** | RSS/Atom feed reader (Rust backend, 13 feeds + HN Algolia) + CVE-of-the-day chip |
| **Lab Tracker** | Session logging with streaks, at-risk alerts, smart scoring |
| **OPSEC mode** | Masks sensitive info for screen-sharing — persisted to localStorage |
| **Sprint mode** | Temporary pace boost overlay on `pagesPerDay` — auto-expires |
| **Lab credit** | Lab → exam-domain fuzzy matching — optional credit prompt |
| **Postmortem** | 5-section exam-passed reflection template — persisted per-plan |
| **Adversary timer** | Opt-in pace auto-bump when deadline missed — settings layer |
| **Temp log persistence** | Log/Skip state survives refresh via `temp-log-storage.ts` |
| **Single clock source** | `src/lib/clock.ts` — all time calls centralized, mockable |
| **Branded domain types** | `PlanId`, `CourseId`, `ISODate`, `ISOTimestamp` — compile-time type safety |
| **Inviolable rules tests** | 15 regression tests mapping 1:1 to `ARCHITECTURE.md` rules |

---

## 4. Core Principles

1. **Zustand is the single source of truth** — Components read from store, not from disk
2. **Log/Skip never writes to disk** — Only Mark Done commits
3. **Schedule recalculates only on Mark Done** — Never on Log/Skip
4. **Queue is fixed** — No appending or inserting in the middle
5. **`dailyLog` presence = day is "logged"** — No separate `completedDays` field
6. **Unlogged past days: 0 effective consumption** — Pointer doesn't advance
7. **Toast types:** "complete" (success), "break" (error/warning), "info"
8. **Plan creation delayed** — Full settings form; nothing saved until "Create Plan" clicked
9. **Personality layer is pure string overlay** — Never modify engine/logic/data files. `label(key)` falls back to raw key if missing
10. **`dailyLog` (storage) = `{ pagesRead, note? }`** — No `chapterChecks`, no `chapterProgress`. **`dailyLog` (React state) = `Record<date, Record<courseId, { pagesRead }>>`** — nested per-date, per-plan
