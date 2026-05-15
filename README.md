# Study Planner

A cross-platform study planner that generates daily reading schedules from any course config. Runs as a desktop app *(recommended)* or locally in your browser.

Built with [Tauri](https://v2.tauri.app) + React + TypeScript.

## Features

- **Schedule engine** — Set pages/day, study days, start date; generates a day-by-day plan
- **Multi-course** — Track CISSP, SecAI+, OSCP side by side; view a merged calendar
- **Per-plan logging** — Log actual pages read or skip a day; each plan tracked independently
- **Mark Done** — One-click commit point; schedule recomputes around your real pace
- **Progress dashboard** — % done, pages consumed vs planned, per-unit breakdown
- **Study timer** — Pomodoro / stopwatch / countdown with auto-log
- **Online Labs** *(optional)* — Track lab sessions, streaks, at-risk alerts
- **Security News** *(optional)* — Built-in RSS/Atom feed reader
- **Course Builder** — Standalone tool to create custom course configs (open `course-builder/course-builder.html` in any browser)
- **No install required** — Download the portable EXE from Releases and run

## Quick Start

| Platform | How to run |
|----------|-----------|
| **Desktop** | Download `Study Planner vX.X.X.exe` from [Releases](https://github.com/Ganron007/Study-Planner-app/releases) and double-click |
| **Browser** | `npm install && npm run dev` — opens at `http://localhost:5173` |

> Note: In browser mode, News RSS is unavailable (requires the Tauri backend). Everything else works using localStorage.

## Build from source

```sh
npm install
npm run tauri:dev    # Dev shell (hot-reload)
npm run tauri:build  # Production EXE
```

## Documentation

| File | What it covers |
|------|---------------|
| `Docs/README.md` | Technical overview, project layout |
| `Docs/ARCHITECTURE.md` | Design decisions and inviolable rules |
| `Docs/CHANGELOG.md` | Version history |
| `Docs/BUGS.md` | Bug registry with root causes |
| `How_to_read.md` | Doc index with reading paths |

## License

MIT — see [LICENSE](LICENSE).
