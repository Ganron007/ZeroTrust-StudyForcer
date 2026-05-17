# CySec CCPTL
**Certification Progress Tracker for Losers**

A cybersecurity certification study tracker — one plan at a time, no fluff. Runs as a desktop app *(recommended)* or locally in your browser.

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
| **Desktop** | Download `CySec CCPTL vX.X.X.exe` from [Releases](https://github.com/Ganron007/Study-Planner-app/releases) and double-click |
| **Browser** | `npm install && npm run dev` — opens at `http://localhost:5173` |

> Note: In browser mode, News RSS is unavailable (requires the Tauri backend). Everything else works using localStorage.

## Creating Your Own Course

Use the included **Course Builder** to create custom study material.

1. Open `course-builder/course-builder.html` in any browser
2. Fill out the form — add units, chapters, and page counts
3. Click **Download JSON**
4. In the app, click the **Import** button (Upload icon in the header) and select the file
5. The course appears in the dropdown — select it and create a plan

The Course Builder is a standalone HTML tool with live JSON preview and built-in validation. No build step, no server — just open in a browser.

## Build from source

```sh
npm install
npm run tauri:dev        # Dev shell (hot-reload)
npm run tauri:build:all  # Production EXE (clean portable build)
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
