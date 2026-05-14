# Roadmap

**Updated:** 2026-05-13
**Scope:** Concrete work for the current architecture (local-first Tauri desktop app).
**Vision items** (SaaS, multi-tenant, sync, mobile, marketplace, AI) live in [`VISION.md`](VISION.md) — they're exploration, not committed work.

---

## Phase 0: Foundation ✓ (Shipped — v2.1.1)

Listed for context. Already in `main`.

- Queue-based scheduling (fixed `pageSequence` + `pageIdx`)
- Multi-plan per-day logging (`dailyLog: Record<date, Record<courseId, { pagesRead }>>`)
- Mark Done as the only commit point; Log/Skip are temp React state
- LogDialog modal, tip popup, calendar legend toggle
- Custom unit ordering, Velocity/Deadline anchors
- Unit-order freeze after first log (Bug #5)
- 203 tests across 10 files, all passing
- Local SQLite via `@tauri-apps/plugin-sql` (Tauri) + `localStorage` (web/test)

### Current architecture

```
┌────────────────────────────────────────────┐
│ React UI (App.tsx + components)            │
│ Zustand store (plan-store.ts)              │
│ plan-engine.ts   (pure scheduling math)    │
│ plan-storage.ts  (CRUD abstraction)        │
│ database.ts      (SQLite | localStorage)   │
└────────────────────────────────────────────┘
```

---

## Phase 1: Polish & UX (1–3 weeks, no architecture change)

Low-effort items that fit the current model. Pick the ones you'll actually use; none are blockers for anything else.

| # | Feature | Effort | Files | Notes |
|---|---|---|---|---|
| 1.1 | PDF/CSV report export | Medium | `src/lib/report-generator.ts`, header button | `jspdf` or render-to-canvas for PDF; CSV trivial. |
| 1.2 | Native notifications | Low | `@tauri-apps/plugin-notification`, settings popup | Daily reminder at user-set time. |
| 1.3 | Study streak counter | Low | Derive from `dailyLog` keys; render in stats bar | Pure derivation — no new state. |
| 1.4 | Auto-backup to file | Low | App-close hook → `<appData>/backups/YYYY-MM-DD.json` | Roll oldest after N backups. |
| 1.5 | Keyboard nav + ARIA pass | Medium | All components | WCAG-AA: focus rings, `aria-label`, contrast audit. |
| 1.6 | Course builder export | Low | Export button in PlannerPage | Re-uses existing JSON shape. |

**Dropped from the old roadmap on purpose:**

- **i18n framework** — adds dependency surface for ~zero current value. Defer until a second-language user shows up.
- **Gamification beyond a streak counter** — easy to add later; don't bloat the stats bar now.

---

## Phase 2: Hardening (2–4 weeks)

Technical-debt cleanup that has to happen *before* anything beyond Phase 1 (sync, mobile, web build, multi-user) becomes feasible. Worth doing even if those never happen — these are general code-quality wins.

| # | Item | Why it matters | Files most affected |
|---|---|---|---|
| 2.1 | Break the synchronous-storage assumption | `plan-storage` is consumed via sync `useMemo`. Any future swap (REST, sync engine, mobile bridge) requires async. Refactor to a `Promise`-returning API now, with an in-memory cache for the render path. | `plan-storage.ts`, `plan-store.ts`, every `useMemo` reading storage |
| 2.2 | Persist temp Log/Skip state | Today temp state lives in React only — lost on refresh/crash. Promote to a separate `temp_logs` table; keep "Mark Done is the only commit to the durable `dailyLog`" rule. | `plan-store.ts`, `database.ts` |
| 2.3 | Sharpen domain types | `dailyLog` shape is implicit `Record<date, Record<courseId, ...>>`. Branded types (`PlanId`, `CourseId`, `ISODate`) make future tenant fields a one-line addition instead of a migration. | `types.ts`, downstream consumers |
| 2.4 | Single clock source | `new Date()` is scattered. Tests use fake timers but prod code doesn't go through a single module. Introduce `lib/clock.ts` → injectable. | `plan-engine.ts`, `cissp-data.ts`, components reading `Date.now()` |
| 2.5 | Move schedule derivation into the store | Schedule is re-derived inline in `useMemo` today. Move it to a Zustand selector with memoization — same UX, one testable place. | `plan-store.ts`, `PlannerPage.tsx` |
| 2.6 | Encode inviolable rules as tests | Each rule in `ARCHITECTURE.md` ("Queue is fixed", "Skip = 0", "Unit-order freeze") should map 1:1 to a regression test. Most already exist; close the gaps. | `src/lib/__tests__/` |

**Done-when:** every architecture-doc invariant has a regression test, the store derivation is async-ready, and `StudyPlan` types make tenant fields a one-line addition.

---

## Out of scope (and why)

The previous roadmap committed to a multi-tenant SaaS (Auth0, RBAC, CRDT sync, LTI 1.3, marketplace, mobile, AI). Those are **vision-level explorations**, not a build plan:

- Each requires abandoning local-first — currently the app's strongest property (zero ops, instant, offline, private).
- None has a concrete user asking for it.
- Effort numbers in the old doc were optimistic by ~2–3× (omitted ops, security review, monitoring, support, marketing).
- For most of them, greenfield would beat retrofit.

If you decide to chase any of them, **Phase 2 above is the prerequisite** — skipping it makes every later phase harder.

See [`VISION.md`](VISION.md) for what those directions would look like.

---

## How to use this doc

1. Phase 0 is history.
2. Phase 1 is "what I might want to actually build next." Pick à la carte.
3. Phase 2 is "what I must build before any path beyond Phase 1 becomes feasible." Skip Phase 2 only if Phase 1 is also where you stop.
4. Anything else: open `VISION.md` and treat it as a thought exercise — not a backlog.
