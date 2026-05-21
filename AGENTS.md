# ZeroTrust.StudyForcer — AGENTS.md

## Verify (pre-commit)
- `npx tsc -b --noEmit` — TypeScript must compile clean
- `npx vitest run` — all 203 tests (10 files) must pass
- `npm run build` — Vite production build succeeds (runs tsc + vite build)

## Commands
| Action | Command |
|--------|---------|
| Dev (browser) | `npm run dev` |
| Dev (desktop) | `npm run tauri:dev` |
| Single test file | `npx vitest run src/lib/__tests__/<file>` |
| Test watch | `npx vitest` |
| Production EXE | `npm run tauri:build:all` |
| Type-check only | `npx tsc -b --noEmit` |

Build output: `portable/<version>/ZTSFv<version>.exe` (e.g. `portable/2.3.1/ZTSFv2.3.1.exe`)

## Architecture
- **Stack**: Tauri 2 + React 19 + TypeScript 6 + Vite 8 + Tailwind 3 + Zustand 5
- **Rust backend**: `src-tauri/src/main.rs` — FS I/O (course configs, timer, window state, labs, news cache), RSS/Atom feed fetcher, tray icon, window-state persistence with throttle
- **Storage**: SQLite via `@tauri-apps/plugin-sql` (desktop), localStorage (web/test). `database.ts` is the only persistence entrypoint
- **Zustand store**: `plan-store.ts` — single source of truth for plans, active IDs. Every mutation writes through to storage synchronously
- **Personality layer**: 13 text themes in `personality.ts` via `PersonalityProvider` React context. Pure string overlay — never modify engine/logic/data files
- **Path aliases**: `@/*` → `./src/*`, `@components/*`, `@lib/*`

## Inviolable constraints
- **Log/Skip = temp React state only** — never writes to disk. `Mark Done` is the only commit point. Schedule recalculation only on Mark Done
- **Toast types**: `"complete"` (success), `"break"` (error/warning), `"info"`. One toast per action
- **DailyLog (React state)**: `Record<date, Record<courseId, { pagesRead }>>` — nested per-date, per-plan
- **DailyLog (storage)**: `{ pagesRead, note? }` — no other fields
- **Version bump**: update all 3 — `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`
- **Personality modes** add no logic or storage — only string maps. `label(key)` falls back to raw key if missing (never blank)

## Testing quirks
- **Vitest + jsdom**: `vitest.config.ts`; setup file `src/test-setup.ts`
- **Web mode**: mock `IS_TAURI` to run in localStorage (no SQLite):
  ```ts
  vi.mock("../is-tauri", () => ({ IS_TAURI: false }))
  ```
- **Date-dependent tests**: use `vi.useFakeTimers()` + `vi.setSystemTime(new Date("..."))`
- All test files in `src/lib/__tests__/`

## Key docs
- `Docs/ARCHITECTURE.md` — design decisions, inviolable rules, Q&A history
- `Docs/BUGS.md` — 14 fixed bugs with root causes, ~64 open audit bugs
- `Docs/TESTING-REPORT.md` — test inventory, coverage targets, pre-commit list
- `Docs/ZTSF_PERSONALITY_LAYER.md` — personality mode details
- `How_to_read.md` — doc index with reading paths
