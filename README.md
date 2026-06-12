# ZeroTrust.StudyForcer

**Zero Trust in your ability to pass. Prove us wrong.**
A cybersecurity certification study tracker — one plan at a time, no fluff. Runs as a desktop app *(recommended)* or locally in your browser.

Built with [Tauri](https://v2.tauri.app) + React + TypeScript.

## Features

- **Schedule engine** — Set pages/day, study days, start date; generates a day-by-day plan
- **Multi-course** — Track CISSP, SecAI+, OSCP side by side; view a merged calendar
- **Per-plan logging** — Log actual pages read or skip a day; each plan tracked independently
- **Mark Done** — One-click commit point; schedule recomputes around your real pace
- **Progress dashboard** — % done, pages consumed vs planned, per-unit breakdown, domain weakness analysis
- **Study timer** — Pomodoro / stopwatch / countdown with auto-log
- **Streak counter** — Header chip showing consecutive-day study streak (derived from `dailyLog`)
- **Auto-backup** — One snapshot of all plans per day to `<appData>/backups/YYYY-MM-DD.json` (keeps last 10)
- **Native notifications** *(desktop only)* — Daily reminder at your chosen time, even when the app is in the background. Toggle via the Bell icon in the header.
- **Report Generator** — Export your study progress as CSV, JSON, or PDF (print-to-PDF) from the Cert Path tab
- **Accessibility (WCAG-AA)** — Skip link, focus traps on every modal, `?` opens a keyboard shortcuts cheatsheet, screen-reader landmarks, axe-core CI test
- **Online Labs** *(optional)* — Track lab sessions, streaks, at-risk alerts
- **Security News** *(optional)* — Built-in RSS/Atom feed reader
- **Course Builder** — Built-in tool to create custom course configs (find it in Planner → Build Course → Export JSON)
- **Personality modes** — Switch between 13 text themes (Standard, Drill Sergeant, Cyberpunk, Script Kiddie, Zero Trust Audit, Influencer, Politician, LinkedIn Lunatic, True Crime, Weather Anchor, Passive-Aggressive Mom, Conspiracy Theorist, Elderly Reluctant) from the app header
- **Certification Roadmap** — Explore 68 certifications across 5 career tracks (Blue Team, Red Team, Pentest, Management, AI Security). Auto-detects progress from your study plans. Includes Gap Analysis, Career Mode sequencer, Compliance Report export, and Exam Countdown banner. Keyboard shortcut `4` to open.
- **OPSEC mode** — Mask course names, plan names, and page counts for screen-sharing. Toggle via the eye-off icon in the header. Persisted across sessions.
- **Sprint mode** — Temporary pace boost overlay. Set a start date, duration, and boost percentage. Auto-expires when the sprint ends. Engine unchanged.
- **CVE-of-the-day** — Pin the freshest security vulnerability (CVE) from your news feed at the top of the sidebar. Highlighted with a red badge.
- **Exam-day alert** — Surfaces imminent exam deadlines (T-3 or less) above the tab strip. Color-coded by urgency.
- **Morning standup** — 4-line incident report: today's queue, yesterday's progress, week pace, top news headline.
- **Temp log persistence** — Log/Skip state survives page refreshes. Your in-progress logs are saved to localStorage and restored on next visit.
- **No install required** — Download the portable EXE from [Releases](https://github.com/Ganron007/Study-Planner-app/releases) and run

## Quick Start

| Platform | How to run |
|----------|-----------|
| **Desktop** | Download `ZTSFvX.X.X.exe` from [Releases](https://github.com/Ganron007/Study-Planner-app/releases) and double-click |
| **Browser** | `npm install && npm run dev` — opens at `http://localhost:5173` |

> Note: In browser mode, News RSS is unavailable (requires the Tauri backend). Everything else works using localStorage.

## Creating Your Own Course

Use the built-in **Course Builder** to create custom study material.

1. Open **Planner** → click **Build Course**
2. Fill out the form — add units, chapters, and page counts
3. Click **Save Course to Library**
4. The course appears in the course selector immediately — create a plan for it

The Course Builder has a live JSON preview, drag-to-reorder chapters, and built-in validation. Custom courses are stored alongside the built-in ones in your app data folder. Use the **Export JSON** button to download the current builder state as a `.json` file (useful for sharing or backing up a draft).

## Project layout

```
src/                  React + TypeScript frontend
  App.tsx             Top-level state, persistence, layout
  components/         UI (calendar, schedule list, progress, planner config, PersonalityProvider, ...)
  lib/                Schedule engine, plan/lab/timer/course storage, SVG sanitizer, personality.ts
    plan-store.ts     Zustand store — single source of truth
    plan-engine.ts    syncStudyPlan(), pagesConsumedBeforeToday()
    cissp-data.ts     generateSchedule, buildPageSequence, getOrderedChapters
    database.ts       SQLite + localStorage adapter
  types/course.ts     Course config schema + flattening helpers
src-tauri/            Rust backend (Tauri commands for FS I/O, news RSS, window state, tray)
public/default-course.json  Seeded on first launch if no course exists
Arch/                 Deep architecture series
```

Plans live in SQLite (`plans` and `active_plan_ids` tables, see `src/lib/database.ts`). Labs, timer state, news, and window position are JSON files under `<appData>/studyplanner.app/data/`. Schema/data migrations live inline in `database.ts` (legacy JSON → SQLite, `planMode`→`anchor`, numeric→date dailyLog keys, `activePlanId`→`activePlanIds`, `completedDays` removal).

## Build from source

```sh
npm install
npm run tauri:dev        # Dev shell (hot-reload)
npm run tauri:build:all  # Production EXE (clean portable build)
npm run build            # Type-check + Vite build only (no Tauri)
```

The frontend is plain Vite; you can also run `npm run dev` to iterate on the UI in a browser, but anything that touches the file-backed Tauri commands will fail outside the desktop shell.

## Documentation

| File | What it covers |
|------|---------------|
| `ARCHITECTURE.md` | Design decisions and inviolable rules |
| `CHANGELOG.md` | Version history |
| `How_to_read.md` | Doc index with reading paths |

## Notes

- Course logos are user-supplied SVG files. They are sanitized via an allow-list parser (`src/lib/sanitize-svg.ts`) before being rendered with `dangerouslySetInnerHTML`.
- A strict CSP is configured in `src-tauri/tauri.conf.json`. Loosening it is generally not what you want — adjust the sanitizer or the asset host instead.
- Window resize/move events throttle their writes to disk to avoid hammering the filesystem during drags.

## License

MIT — see [LICENSE](LICENSE).
