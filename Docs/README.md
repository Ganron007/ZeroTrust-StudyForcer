# CySec CCPTL

A Tauri + React cybersecurity certification tracker (desktop + browser). Built around the CISSP, SecAI+, and OSCP curricula.

## What it does

- Generates a daily reading schedule from a start date, target pages/day, and chosen study days of the week.
- Lets you log actual pages read per day; the remaining schedule recomputes around your real pace.
- Tracks completion, streak, and progress per unit.
- Persists plans and active-plan IDs to a local SQLite database (`<appData>/studyplanner.app/study-planner.db` in Tauri, `localStorage` keys in web/test). Timer state, lab sessions, news cache, course JSONs, and window state are still flat JSON files next to the executable.
- Bundles a Pomodoro/stopwatch/countdown timer and a separate lab-tracker view.

## Project layout

```
src/                  React + TypeScript frontend
  App.tsx             Top-level state, persistence, layout
  components/         UI (calendar, schedule list, progress, planner config, ...)
  lib/                Schedule engine, plan/lab/timer/course storage, SVG sanitizer
    plan-store.ts     Zustand store — single source of truth
    plan-engine.ts    syncStudyPlan(), pagesConsumedBeforeToday()
    cissp-data.ts     generateSchedule, buildPageSequence, getOrderedChapters
    database.ts       SQLite + localStorage adapter
  types/course.ts     Course config schema + flattening helpers
src-tauri/            Rust backend (Tauri commands for FS I/O, news RSS, window state, tray)
public/default-course.json  Seeded on first launch if no course exists
Docs/                 Top-level docs (this folder)
Arch/                 Deep architecture series (01-07 + index)
course-builder/       (removed — now built into the app under Planner → Build Course)
```

Plans live in SQLite (`plans` and `active_plan_ids` tables, see `src/lib/database.ts`). Labs, timer state, news, and window position are JSON files under `<appData>/studyplanner.app/data/`. Schema/data migrations live inline in `database.ts` (legacy JSON → SQLite, `planMode`→`anchor`, numeric→date dailyLog keys, `activePlanId`→`activePlanIds`, `completedDays` removal).

## Development

```sh
npm install
npm run tauri:dev      # Dev shell (Vite + Tauri)
npm run tauri:build:all  # Production EXE (clean portable build)
npm run build          # Type-check + Vite build only (no Tauri)
```

The frontend is plain Vite; you can also run `npm run dev` to iterate on the UI in a browser, but anything that touches the file-backed Tauri commands will fail outside the desktop shell.

## Notes

- Course logos are user-supplied SVG files. They are sanitized via an allow-list parser (`src/lib/sanitize-svg.ts`) before being rendered with `dangerouslySetInnerHTML`.
- A strict CSP is configured in `src-tauri/tauri.conf.json`. Loosening it is generally not what you want — adjust the sanitizer or the asset host instead.
- Window resize/move events throttle their writes to disk to avoid hammering the filesystem during drags.
