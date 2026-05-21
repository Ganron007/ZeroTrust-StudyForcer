# ZeroTrust.StudyForcer

**Zero Trust in your ability to pass. Prove us wrong.**
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
- **Course Builder** — Built-in tool to create custom course configs (find it in Planner → Build Course)
- **Personality modes** — Switch between 13 text themes (Standard, Drill Sergeant, Cyberpunk, Script Kiddie, Zero Trust Audit, Influencer, Politician, LinkedIn Lunatic, True Crime, Weather Anchor, Passive-Aggressive Mom, Conspiracy Theorist, Elderly Reluctant) from the app header
- **No install required** — Download the portable EXE from Releases and run

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

The Course Builder has a live JSON preview, drag-to-reorder chapters, and built-in validation. Custom courses are stored alongside the built-in ones in your app data folder.

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
| `How_to_read.md` | Doc index with reading paths |

## License

MIT — see [LICENSE](LICENSE).
