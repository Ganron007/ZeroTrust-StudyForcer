# Architecture: Frontend-heavy rationale

ZeroTrust.StudyForcer uses a **frontend-heavy architecture** (React TypeScript handles UI + business logic + persistence, Rust handles only the news-proxy command). This is the standard Tauri pattern and is appropriate for this app's scope.

## Why this works for a desktop study planner

| Concern | Why it's fine |
|---|---|
| **No server needed** | All data is local. No cloud sync, no multi-device requirement. |
| **No network latency** | Every action is instant — no API calls to wait on. |
| **Simple deployment** | Single EXE. No Docker, no DB migrations, no auth system. |
| **SQLite from JS** | `@tauri-apps/plugin-sql` handles persistence — no Rust needed for CRUD. |
| **Schedule computation** | `buildPageSequence` / `generateSchedule` process ~100 chapters max. JS handles this in <1ms. Rust's 10-100x speed advantage only matters at 10k+ chapters. |

## What a heavier Rust backend would add (low priority)

| Capability | Effort | Value |
|---|---|---|
| **Native notifications** (auto-reminders when app is closed) | Low — use Tauri notification plugin | Medium — users may want daily reminders |
| **Schedule engine in Rust** (port `buildPageSequence`, `generateSchedule`, `pagesConsumedBeforeToday` to `src-tauri/`) | Medium — rewrite + Tauri commands | Low — JS is fast enough at current scale |
| **Background file watchers** (auto-backup, auto-export on interval) | Medium — `tokio::spawn` + Tauri events | Low — manual export works |
| **Background sync** (WebDAV/S3 push of encrypted plan data) | High — network code + conflict resolution | Medium if multi-device is needed |
| **Full audit log** (immutable append-only event store for every plan action) | High — new SQLite schema + Rust commands crossing IPC | Low — daily log is already append-only |
| **Tamper-proof data validation** (business logic enforced in compiled Rust, not JS) | Very high — duplicate all plan logic in Rust | Low — local app, user trusts their own data |

## If you invest

Port the **schedule engine** to Rust as a Tauri command. Keep the current JS implementation as fallback. This gives:
- A single source of truth for schedule derivation (unitOrder, pageSequence, dailyLog)
- Slightly faster recomputation (not noticeable at current scale, but good practice)
- Cleaner separation: UI in JS, domain logic in Rust

Everything else is **nice-to-have** and should only be done if users explicitly request it.

## Files that would move to Rust

| Current JS file | Proposed Rust location | Notes |
|---|---|---|
| `src/lib/cissp-data.ts` (buildPageSequence, generateSchedule) | `src-tauri/src/schedule.rs` | Core schedule engine |
| `src/lib/plan-engine.ts` (syncStudyPlan, pagesConsumedBeforeToday) | `src-tauri/src/engine.rs` | Plan syncing & progress calc |
| `src/lib/plan-storage.ts` (StudyPlan type + CRUD) | Keep in JS | SQLite is already accessed from JS |
