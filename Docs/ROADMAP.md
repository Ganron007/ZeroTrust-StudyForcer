# Roadmap

**Updated:** 2026-05-18 (added Phase 1.5 — Identity & Differentiation)
**Scope:** Concrete work for the current architecture (local-first Tauri desktop app).
**Vision items** (SaaS, multi-tenant, sync, mobile, marketplace, AI) live in [`VISION.md`](VISION.md) — they're exploration, not committed work.

---

## Phase 0: Foundation ✓ (Shipped — v2.1.1 through v2.3.1)

All listed items are in `main`.

- Queue-based scheduling (fixed `pageSequence` + `pageIdx`)
- Multi-plan per-day logging (`dailyLog: Record<date, Record<courseId, { pagesRead }>>`)
- Mark Done as the only commit point; Log/Skip are temp React state
- LogDialog modal, tip popup, calendar legend toggle
- Custom unit ordering, Velocity/Deadline anchors
- Unit-order freeze after first log (Bug #5)
- 203 tests across 10 files, all passing
- Local SQLite via `@tauri-apps/plugin-sql` (Tauri) + `localStorage` (web/test)
- **Personality layer (v2.3.1):** 13-mode text theming engine — Standard, Drill Sergeant, Cyberpunk, Script Kiddie, Zero Trust Audit, Influencer, Politician, LinkedIn Lunatic, True Crime, Weather Anchor, Passive-Aggressive Mom, Conspiracy Theorist, Elderly Reluctant. Mode switch UI in app header, all user-facing text routed through `PersonalityProvider` React context. ~3508-line string dictionary in `personality.ts` across 14 components. Engine/logic files untouched.

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

## Phase 1.5: Identity & Differentiation (in-character features)

These are the features that turn ZTSF from "another study tracker" into the only one a cybersec person would pick. Each one doubles down on the **Zero Trust** framing and the **personality layer**, without touching the queue/anchor/Mark-Done core.

Picked à la carte. None depends on another. Effort estimates assume the personality dictionaries already exist and the standard mode is the canonical fallback.

| # | Feature | Effort | Files | Notes |
|---|---|---|---|---|
| 1.5.1 | **Exam-day countdown band** | Low | New `ExamCountdownBanner.tsx`; extend `StudyPlan.examDate?: string`; banner in `App.tsx` above tabs | Uses existing `examInfo` per course. Personality-themed copy: Drill Sergeant "T-12 DAYS, RECRUIT"; Audit "Risk score: AMBER · mitigation: +5 pages/day". One line per active plan. Hide if no exam date set. |
| 1.5.2 | **Morning standup card upgrade** | Low | Extend `DailyBriefing.tsx` | Promote the existing briefing into a 5-line incident report: today's queue, yesterday's delta, week-to-date pace, at-risk lab streaks, top news headline. Each line themed by mode (Cyberpunk: "Today's quota: 30 packets"). Pure derivation from existing data — no new storage. |
| 1.5.3 | **Compliance-style audit report export** | Medium | New `src/lib/audit-report.ts`; Export button in header | Markdown + optional PDF: hours logged, coverage by exam domain (uses `unit.weight`), exam-readiness score, gaps. Frame copy as a SOC-2 report. Big differentiator vs. generic exporters. Useful for justifying employer-funded study budgets. |
| 1.5.4 | **Sprint mode** | Medium | New `SprintOverlay` field on `StudyPlan` (`{ startDate, days, paceBoost }`); read-only modifier in `syncStudyPlan` | One-click temporary pace boost for N days. Schedule renders with the boosted pace; auto-reverts when window ends. Engine unchanged — it reads the overlay alongside the anchor. Includes 1–2 pre-declarable "no-fault rest days/month" that don't break the streak. |
| 1.5.5 | **OPSEC mode** | Low | New `useOpsec()` hook + toggle in header (next to mode picker); CSS class + label transformer | Single toggle that masks course names ("CISSP" → "PROJ-001"), plan names ("My Plan" → "WORKLOAD-A"), and page counts above a threshold. Schedule structure stays visible. For screen-sharing without leaking specifics. Fits the Zero Trust tagline natively. |
| 1.5.6 | **Lab → exam-domain credit** | Medium | Extend `LabSession` with optional `creditedTo: { courseId, domainId, minutes }`; prompt in LabDashboard after long sessions | When a lab's `focus` matches a course's domain, prompt: "60 min on EntraGoat (Azure) — credit 30 min toward CISSP Cloud Security?" Off by default. Wires labs + courses without merging the data models. |
| 1.5.7 | **Reverse burn-down view** | Medium | New `BurnDownView.tsx` tab option | Horizontal Gantt-style "pages remaining vs days remaining" bar. Third option next to Calendar / List. Cyber/SRE folks read burn-downs daily — feels native, costs one component. |
| 1.5.8 | **Postmortem mode** | Low | New `Postmortem.tsx`; storage at `data/postmortems/{courseId}-{date}.md`; trigger on exam-date pass | One-page template (timeline · root cause · what worked · what didn't · action items) when a plan's exam date passes. Stored as plain markdown next to the EXE. Builds institutional memory across certs — no other tracker does this. |
| 1.5.9 | **Adversary timer (opt-in)** | Low | Toggle in settings; cron-style check on app boot | Off by default. When on, if today wasn't logged by a user-set deadline (e.g. 21:00), tomorrow's pace auto-bumps to compensate. Reinforces "zero trust in your discipline" — but only for users who opt in. |
| 1.5.10 | **CVE-of-the-day chip** | Low | Extend `SidebarNewsHighlights` | Filter the news feed for the freshest *Vulnerabilities*-category item with a CVE ID in the title; pin it above the rest. Two extra lines of code; big "this app is for cyber people" signal. |

**Recommended first three (cheapest, highest signal):** 1.5.1 (countdown band) · 1.5.2 (standup upgrade) · 1.5.5 (OPSEC mode). Each is one component, no engine changes, and each says "this is for cybersec people" in a way no generic study tracker does.

**Prerequisites from BUGS.md before starting:** A42, A52, A59, A64, A75, A77 — fix the existing hardcoded-English strings *before* adding more personality-themed surfaces, otherwise the new code adds to the cleanup debt instead of being clean from the start.

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
