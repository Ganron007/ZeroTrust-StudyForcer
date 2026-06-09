# ZeroTrust.StudyForcer — ARCHITECTURE.md

**Purpose**: Canonical reference for design decisions, constraints, and project conventions.
Read this before making any change to ensure consistency with prior decisions.

---

## Project Overview

A Tauri + React + TypeScript cybersecurity certification tracker. Generates daily reading schedules from course
configs, tracks progress via page-level logging (queue-based), and supports custom unit ordering
for non-linear curricula (e.g., CISSP domain reordering).

---

## Q&A History & Design Decisions

### 1. Queue-Based Logging Model (v2.0.0+)

**Q: How should daily reading progress be tracked at the plan level?**
**A:** Plan-level queue-based logging. Each plan has a fixed `pageSequence` (ordered list of chapter
page "slots") + a `pageIdx` pointer. Logging records how many pages were consumed from the queue
each day. No chapter-level checkboxes or per-chapter progress — just a simple page count per day.

**Key decisions:**
- `DailyLog` simplified to `{ pagesRead: number; note?: string }` — no `chapterChecks`, no `chapterProgress`.
- `completedDays` field removed entirely. `dailyLog` presence is the single indicator of day completion.
- Queue is **fixed** (determined at plan creation time). No appending, no inserting in the middle.
- Pointer advances by actual page consumption only (not planned).

### 2. Slice Size Split: `effectiveSliceSize` vs `plannedSliceSize`

**Q: What happens for past unlogged days (skipped/backlog)?**
**A:** Two different slice sizes:
- **`effectiveSliceSize`** — the actual advancement of `pageIdx`. For logged days = `pagesRead`.
  For skipped days = 0. For unlogged past days = **0** (pointer does NOT advance).
- **`plannedSliceSize`** — what's shown in the calendar display. For past unlogged days, this is
  `resolvedPagesPerDay` (so the calendar shows planned chapters for visual continuity even though
  the pointer hasn't advanced). For future days, both sizes equal `resolvedPagesPerDay`.

**Rationale:** Prevents the schedule from jumping ahead when the user hasn't logged past days.
The calendar still shows what *would* have been planned for visual reference.

### 3. Mark Done = Only Commit Point

**Q: When does data get persisted to storage?**
**A:** Only on "Mark Done". Log/Skip operations are **temporary** — they update React state
(`dailyLog`) but never write to disk. Mark Done reads the temp state, merges it into the plan's
`dailyLog` in storage, and clears the temp entry.

**Flow:** Log/Skip (temp) → Mark Done (commit) → schedule recalculation

### 4. Plan Creation: No Premature Save

**Q: When should a new plan be saved?**
**A:** The full settings form (name, start date, anchor, pagesPerDay, studyDays, unitOrder,
starting chapter) opens when user clicks "Create". **Nothing is saved until user explicitly
clicks "Create Plan"** in the settings form. This prevents plans with throwaway defaults from
polluting storage.

### 5. One Action Per Plan Per Day

**Q: Can a user log multiple times per plan per day?**
**A:** No. Only one action (Log or Skip) per plan per day. The last action replaces any previous
temp entry for that plan on that date.

### 6. Page Range Display

**Q: How are book page ranges computed for display?**
**A:** `bookPageStart + pageNum - 1` for each queue position. The range shown for a day's allocation
is from the first chapter's `bookPageStart` to the last chapter's `bookPageEnd`.

### 7. Out-of-Range Logging

**Q: What happens when the user enters a page number outside the day's range?**
**A:**
- `pageValue < scheduleStart` → clamped to 0 (cannot go backward), toast: "before scheduled range"
- `pageValue > scheduleEnd` → allowed (ahead of schedule), toast: "Ahead of schedule!" Pages
  consumed = `pageValue - scheduleStart`. Schedule recalculates to account for extra pages.

### 8. Custom Unit Ordering

**Q: How are non-sequential chapter orders handled?**
**A:** Each plan stores `unitOrder: number[]`. `getOrderedChapters()` reorders chapters by custom
unit sequence. `buildPageSequence()` starts from `startingChapterId` within this reordered list.

**Limitation:** Changing `unitOrder` mid-stream rebuilds the entire queue from scratch. Past
completed days retroactively display chapters from the new order in the calendar (cosmetic only —
consumption math via `dailyLog.pagesRead` is always correct).

### 9. Toast Types

- "complete" — for successful operations (NOT "success")
- "break" — for errors/warnings (NOT "warning" or "error")
- "info" — for informational messages

### 10. Personality Layer

**Q: How are user-facing strings themed without touching engine logic?**
**A:** A React Context (`PersonalityProvider`) wraps the app and provides `label()`, `toast()`, `empty()`, `greeting()`, `loading()`, `tips()` functions. These read from mode-keyed dictionaries in `personality.ts` (13 modes, ~256 labels + ~33 toasts + ~13 empties + 3 greetings + 4 loading + 10 tips per mode).

**Key decisions:**
- `label(key)` falls back to raw `key` if not found in current mode — never blank/undefined
- `formatStr(template, {var})` interpolates `{var}` placeholders in toast/empty templates
- New modes add string maps only — no logic, storage, or component changes
- Mode persisted in `localStorage('ztsf:personality-mode')`
- Mode switch re-seeds tip picker via `tipPicker.setMode(newMode)`

---

## Constraints & Inviolable Rules

1. **Log/Skip never writes to disk.** Only Mark Done commits to storage.
2. **Schedule recalculation only happens on Mark Done.** Never on Log/Skip.
3. **`dailyLog` presence = day is "logged".** No separate `completedDays` field.
4. **`dailyLog` (storage) = `{ pagesRead, note? }`.** No `chapterChecks`, no `chapterProgress`.
   **`dailyLog` (React state) = `Record<date, Record<courseId, { pagesRead }>>`** — nested per-date, per-plan.
5. **Queue is rebuilt only at plan creation and during pre-log edits.** `buildPageSequence()` is called from the schedule `useMemo`, so it re-derives every render — but `unitOrder` and `startingChapterId` (its only inputs besides the immutable course) are frozen by the edit form once `plan.dailyLog` has any entry (see internal bug registry: Bug #5 — unit order frozen after logging). Effect: stable queue for any plan with progress; no appending, no mid-stream inserts.
6. **One action per plan per day.** Log or Skip — either replaces the previous temp entry.
7. **Unlogged past days: pointer does NOT advance.** `effectiveSliceSize = 0`.
8. **Skip = 0 pages consumed.** Pages stay in queue for future days.
9. **Past completed days use actual `pagesRead` for slice size.** Enables recalibration.
10. **Toast types:** "complete" (success), "break" (error/warning), "info". **One toast per user action; pick the most severe outcome.** Never fire two toasts for the same action.
11. **Version 2.0.1+** — queue-based model.
12. **Personality layer is a pure string overlay.** `label(key)`/`toast(key)`/`empty(key)`/`greeting(key)`/`loading(key)`/`tips()` route through `PersonalityProvider` React context. Never modify engine/logic/data files — only `personality.ts` string maps and component call sites.

---

## Testing

```sh
npx vitest run          # Run all tests (430 tests, 26 files)
npx tsc -b --noEmit     # TypeScript type checking
```

---

## Reference Documents

| File | Purpose |
|---|---|---|
| `README.md` | What the app does + how to run it |
| `CHANGELOG.md` | Version history with dates and summaries |
| `Arch/` | Deep architecture series (01 overview → 07 testing) |
| `How_to_read.md` | Doc index — start here if you're new |
| — | Internal docs (`Docs/Internal/`): BUGS.md, ROADMAP.md, VISION.md, TESTING-REPORT.md, etc. |

---

## UI Architecture

### Log Dialog
The logging UI was refactored from inline per-plan inputs/buttons into a single modal dialog
(`LogDialog.tsx`) opened by a "Log" button. Purely visual — no functional changes.

- Opens at the day level, lists all plans for that day
- Each plan row has a numeric page input and a Skip button
- Save calls `handleLogPlan` for each plan sequentially
- Mark Done remains as the commit point (unchanged)

### Tip Popup (`?` button)
- Located in the header between WallClock and Refresh button
- Click to open a floating card with a random app tip
- Rotates through 10 tips round-robin (no repeats until all seen)
- Session-only — resets on page refresh
- Replaces the old static tip banner that was below the stats bar

### Calendar Legend Toggle (`⚙` button)
- Located in the calendar header next to the month navigation
- Toggles the "How to read the calendar" legend card on/off
- Default: **hidden** (never shown)
- State persisted in `localStorage('showCalendarLegend')` — survives refresh

---

## Versioning Policy

This project follows **Semantic Versioning** (`MAJOR.MINOR.PATCH`):

| Bump | When | Example |
|------|------|---------|
| **MAJOR** | Breaking change to storage schema, plan data format, or user workflow | Renaming `dailyLog` fields, changing queue model |
| **MINOR** | New backward-compatible feature | New sidebar widget, new tab, new tool |
| **PATCH** | Bug fix, refactor, doc update, build change, repo cleanup | Stats bar fix, .gitignore cleanup, LICENSE added |

**Always update all three version locations:** `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`.
