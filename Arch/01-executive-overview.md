# Executive Architecture Overview

**System:** CySec CCPTL Desktop Application  
**Stack:** Tauri 2 (Rust) + React 19 (TypeScript) + Tailwind CSS 3  
**State Management:** Zustand 5 (single source of truth) + SQLite (Tauri) / localStorage (Web)  
**Version:** 2.2.1

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
│  │              App.tsx (Handlers)                    │      │
│  │  handleLogPlan / handleSkipPlan / handleMarkDone   │      │
│  │  handleOpenLogDialog / handleLogDialogSave         │      │
│  └────────────────────┬──────────────────────────────┘      │
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
└───────────────────────┼──────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────────┐
│                   Persistence Layer                           │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  database.ts (SQLite / localStorage adapter)          │    │
│  │  plan-storage.ts (public CRUD API)                    │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Course Data (static JSON in data/courses/*.json)     │    │
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

---

## 4. Core Principles

1. **Zustand is the single source of truth** — Components read from store, not from disk
2. **Log/Skip never writes to disk** — Only Mark Done commits
3. **Schedule recalculates only on Mark Done** — Never on Log/Skip
4. **Queue is fixed** — No appending or inserting in the middle
5. **`dailyLog` presence = day is "logged"** — No separate `completedDays` field
6. **Unlogged past days: 0 effective consumption** — Pointer doesn't advance
7. **Toast types:** "complete" (success), "break" (error/warning)
8. **Plan creation delayed** — Full settings form; nothing saved until "Create Plan" clicked
