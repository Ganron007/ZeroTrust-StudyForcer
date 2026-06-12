# How to Read These Docs

A short tour of every `.md` file in this repo so you (or future-you, or anyone who stumbles
in) can jump straight to the right place instead of opening files at random.

**Last updated:** 2026-06-12 — for app version **2.6.0** (Phase 0.5 complete, 642 tests passing).

---

## Pick your path

| You are… | Read in this order |
|---|---|
| **Brand-new to the project** | `README.md` → `Arch/01-executive-overview.md` → `ARCHITECTURE.md` |
| **Returning reviewer / future-you** | `CHANGELOG.md` |
| **About to change code** | `ARCHITECTURE.md` (rules) → the relevant `Arch/0X-*.md` |
| **Debugging a data-flow issue** | `Arch/03-data-flow.md` + `Arch/05-state-management.md` |
| **Touching the anchor / schedule math** | `Arch/06-anchor-system.md` + `Arch/04-control-flow.md` |
| **Adding or fixing tests** | `Arch/07-testing-architecture.md` (philosophy) |
| **Understanding personality / mode switching** | Switch modes from the app header (13 themes available) |
| **Exploring certification career paths** | Access the `cert-path` tab via keyboard shortcut `4` — shows 68 certs across 5 tracks (Blue Team, Red Team, Pentest, Management, AI Security) |

---

## Top-level files

| File | What it is | When to read it |
|---|---|---|
| `README.md` | **Public face of the repo.** Feature overview, quick start, download links. | First visit / new contributor. |
| `How_to_read.md` | **You are here.** Doc index + reading order. | First, every time. |

---

## Root-level docs

These are the human-facing project docs. Read these first.

| File | Purpose | Last refresh |
|---|---|---|
| `README.md` | What the app does, project layout, dev commands. | Updated for v2.6.0 |
| `ARCHITECTURE.md` | Canonical design decisions + Q&A history + **inviolable rules** (read before changing logging/scheduling logic). | Updated for v2.6.0 |
| `CHANGELOG.md` | Version-by-version what-changed log. Newest entries on top. | Current through v2.6.0 — 2026-06-12 |

Internal docs (kept in `Docs/Internal/`, not committed): `BUGS.md`, `ROADMAP.md`, `VISION.md`, `TESTING-REPORT.md`, `ZTSF_PERSONALITY_LAYER.md`, `SUGGESTIONS.md`.

---

## `Arch/` — deep architecture series

Seven numbered docs + an index. Cross-linked from `ARCHITECTURE.md`. Open these only
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

**Note on duplication:** `ARCHITECTURE.md` and `Arch/*` overlap on purpose. `ARCHITECTURE.md` is
the **short, authoritative** version (rules + Q&A); `Arch/` is the **long, illustrated**
version (diagrams + decision trees). Read `ARCHITECTURE.md` first; dive into `Arch/`
when something needs more context.

---

For the current testing picture, see `Arch/07-testing-architecture.md`.

---

## Quick sanity checks before you trust a doc

1. **Version at the top.** Anything saying < `2.6.0` may be stale.
2. **Cross-check with `CHANGELOG.md`** — entries dated after the doc's "Updated" line
   probably superseded what you're reading.
3. **Verify code claims.** If a doc names a function/file, run a quick `Grep` before
   relying on it.

---

## What lives _outside_ this index (and why)

- `node_modules/**/*.md` — third-party package READMEs; ignore.
- `coverage/` — Vitest output when run with `--coverage`. Git-ignored.
- `scripts/`, `public/` — code/assets, no docs.
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
