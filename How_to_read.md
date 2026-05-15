# How to Read These Docs

A short tour of every `.md` file in this repo so you (or future-you, or anyone who stumbles
in) can jump straight to the right place instead of opening files at random.

**Last updated:** 2026-05-15 — for app version **2.2.1**.

---

## Pick your path

| You are… | Read in this order |
|---|---|
| **Brand-new to the project** | `Docs/README.md` → `Arch/01-executive-overview.md` → `Docs/ARCHITECTURE.md` |
| **Returning reviewer / future-you** | `Docs/CHANGELOG.md` → `suggestions.md` → `Docs/BUGS.md` |
| **About to change code** | `Docs/ARCHITECTURE.md` (rules) → the relevant `Arch/0X-*.md` → `Docs/BUGS.md` (don't reintroduce a fixed bug) |
| **Debugging a data-flow issue** | `Arch/03-data-flow.md` + `Arch/05-state-management.md` |
| **Touching the anchor / schedule math** | `Arch/06-anchor-system.md` + `Arch/04-control-flow.md` |
| **Adding or fixing tests** | `Docs/TESTING-REPORT.md` (current state) → `Arch/07-testing-architecture.md` (philosophy) |
| **Planning the next phase / roadmap** | `Docs/ROADMAP.md` |

---

## Top-level files

| File | What it is | When to read it |
|---|---|---|
| `How_to_read.md` | **You are here.** Doc index + reading order. | First, every time. |
| `suggestions.md` | Architecture rationale — why the app is frontend-heavy + what a heavier Rust backend *could* add (port schedule engine, native notifications, etc.). Not a TODO list. | When weighing whether to invest in Rust. |
| `Suggestions.txt` | Free-form brainstorm about constraint-satisfaction algorithms (MILP/CSP/ASP) for a more advanced scheduler. Not a spec. | Only if you're exploring the deep-research direction. Ignore otherwise. |
| `OSCAR_OVER_ARR.md` | Parallel-universe playbook for "what if I tried to turn this into a $100M ARR SaaS." Positioning canvas + buyer-interview script + 90-day discovery plan. Filed under "things I am not doing because I'm going to Hollywood." | When you need to remember why you chose acting. |

---

## `Docs/` — top-level reference

These are the human-facing project docs. Read these first.

| File | Purpose | Last refresh |
|---|---|---|
| `Docs/README.md` | What the app does, project layout, dev commands. | Updated for v2.1.1 / SQLite storage |
| `Docs/ARCHITECTURE.md` | Canonical design decisions + Q&A history + **inviolable rules** (read before changing logging/scheduling logic). | Updated for v2.1.1 |
| `Docs/BUGS.md` | Every bug found, root cause, and fix. Use it to avoid re-introducing fixed bugs. | Current through Bug #12 (v2.2.1) |
| `Docs/CHANGELOG.md` | Version-by-version what-changed log. Newest entries on top. | Current through 2.2.1 — 2026-05-15 |
| `Docs/ROADMAP.md` | Committed work only — Phase 0 (shipped), Phase 1 (polish/UX), Phase 2 (hardening). | Refreshed 2026-05-13 |
| `Docs/VISION.md` | Speculative directions (SaaS, sync, mobile, AI, marketplace, LMS). Not a plan — thought exercise. | New 2026-05-13 |
| `Docs/TESTING-REPORT.md` | Current test inventory (203 tests / 10 files), coverage targets, commands, regression guards. | Refreshed 2026-05-13 |

---

## `Arch/` — deep architecture series

Seven numbered docs + an index. Cross-linked from `Docs/ARCHITECTURE.md`. Open these only
when you need depth beyond the top-level docs.

| File | Topic |
|---|---|
| `Arch/README.md` | Index + quick-reference table mapping goals → starting doc |
| `Arch/01-executive-overview.md` | High-level stack, layers, key architectural decisions |
| `Arch/02-structural-components.md` | Every component's role + dependency graph |
| `Arch/03-data-flow.md` | User-action lifecycle (Log → Mark Done → schedule recalc) |
| `Arch/04-control-flow.md` | Decision trees: logging, mark-done, schedule generation, slice sizing |
| `Arch/05-state-management.md` | Zustand store + temp React state + SQLite/localStorage schema |
| `Arch/06-anchor-system.md` | Velocity vs Deadline anchors; queue + pointer math |
| `Arch/07-testing-architecture.md` | Test pyramid, mocking strategy, coverage philosophy |

**Note on duplication:** `Docs/ARCHITECTURE.md` and `Arch/*` overlap on purpose. `Docs/` is
the **short, authoritative** version (rules + Q&A); `Arch/` is the **long, illustrated**
version (diagrams + decision trees). Read `Docs/ARCHITECTURE.md` first; dive into `Arch/`
when something needs more context.

---

For the current testing picture, use `Docs/TESTING-REPORT.md`.

---

## Quick sanity checks before you trust a doc

1. **Version at the top.** Anything saying < `2.1.1` may be stale.
2. **Cross-check with `Docs/CHANGELOG.md`** — entries dated after the doc's "Updated" line
   probably superseded what you're reading.
3. **Verify code claims.** If a doc names a function/file, run a quick `Grep` before
   relying on it — see `suggestions.md` for an example of doc-claims-that-no-longer-match
   (the old `migratePlan()` reference, JSON-vs-SQLite, etc.).

---

## What lives _outside_ this index (and why)

- `node_modules/**/*.md` — third-party package READMEs; ignore.
- `coverage/` — Vitest output when run with `--coverage`. Git-ignored.
- `course-builder/`, `scripts/`, `public/` — code/assets, no docs.
- `src-tauri/Cargo.toml` & `package.json` — the **real** version source of truth; trust
  these over any doc header.

---

## Maintaining this index

If you add or rename a doc, update this file in the same commit. The fastest sanity
check:

```sh
find . -name "*.md" -not -path "*/node_modules/*" -not -path "*/coverage/*"
```

…should produce a list that maps 1:1 to a row in this file.
