# Vision

**Not a plan.** Speculative directions the app *could* take if the goal expanded beyond "single-user CISSP planner." Listed for thinking-out-loud purposes; nothing here is committed.

For actually-committed work, see [`ROADMAP.md`](ROADMAP.md).

---

## Why these are separate from the roadmap

Every direction below shares two disqualifying properties:

1. **It contradicts local-first.** Multi-tenant, sync, RBAC, cloud-hosted anything — each trades the current zero-ops / offline-forever / instant model for cloud infrastructure that needs hosting, monitoring, support, and a billing system to justify its cost.
2. **No user is asking for it.** The current user (you) doesn't need cross-device sync, an admin dashboard, or an LMS integration. Building speculative infrastructure ahead of demand is the single biggest waste in software.

Read this file as "if I changed my mind about what this app is, here's what it could become." Then close the file.

---

## Direction A — Multi-user backend (SaaS)

Adds user identity, RBAC, tenant isolation, OAuth, REST API, PostgreSQL.

- **Why you'd do it:** you decide to sell access to other people.
- **Why you wouldn't:** ops cost, customer support, compliance surface. The current app already serves the current user perfectly.
- **Real effort:** 18–24 months of part-time work to ship something competitive — not the "6 weeks solo" the old roadmap claimed (which omitted security review, deployment, monitoring, support, marketing, churn).
- **Prerequisite:** `ROADMAP.md` Phase 2 (especially 2.1 async storage and 2.3 branded types for tenant fields).

---

## Direction B — Cloud sync (cross-device)

Same data on desktop / web / mobile. CRDT-based offline-first sync.

- **Why you'd do it:** you want to study from a laptop *and* a phone.
- **Why you wouldn't:** the current `dailyLog: Record<date, Record<courseId, ...>>` shape is not CRDT-friendly — it'd be rewritten as a Yjs/Automerge document, touching every read site. Also, the "unit-order freeze after first log" rule (Bug #5) is single-device; two clients can both "first log" before sync.
- **Lighter alternative:** put the SQLite file in a Dropbox/iCloud-synced folder. Manual conflict resolution, ~0 code change.
- **Lighter alternative (more code):** manual JSON export/import. The user is the conflict resolver.

---

## Direction C — Mobile app

- **Why you'd do it:** you want to log progress on a phone.
- **Tauri Mobile vs React Native:** Tauri Mobile reuses the existing React + Tailwind + shadcn/ui stack. React Native rewrites every component for native widgets. The old roadmap picked React Native citing "shared TS types" — but types aren't the bottleneck; UI is. Pick Tauri Mobile if you go this way.
- **Prerequisite:** sync (Direction B), or accept that mobile is a separate data island.

---

## Direction D — AI study recommendations

"ML model analyzes pace, weak spots, suggests adjustments."

- **Reality check:** at the current data scale (one user, ~100 chapters, a few months of logs) there's no signal an LLM can find that the existing math doesn't already surface. "You're behind pace" is one comparison. "Your slowest unit is X" is a sort. Don't reach for AI for problems plain arithmetic solves.
- **Where AI could genuinely help:** generating study questions / quiz items from chapter content, or summarizing weak areas. Both are content-generation, not scheduling.

---

## Direction E — Course marketplace

Upload / sell / share courses, ratings, revenue share.

**This is a different product.** It would warrant its own app, its own monetization model, its own community moderation overhead, and shares almost nothing with the planner beyond the JSON course schema. If you ever want to do this, start it as a separate project from day one.

---

## Direction F — LMS integration (LTI 1.3 — Canvas, Blackboard, Moodle)

**Not a vision item. A customer-specific RFP item.** Listed in the old roadmap as if it were a feature you'd build speculatively; LTI 1.3 is a months-long compliance + integration project that only makes sense when a specific institution is buying.

If a buyer ever shows up, scope it then against their actual environment. Until then, this row is noise.

---

## Nice-to-haves (not directional, not forgotten)

- **Spaced-repetition flashcards** (FSRS algorithm) — orthogonal to scheduling; could ship as a side-mode without architecture change.
- **Calendar sync** (Google/Outlook) — depends on Direction A or B for credential handling, but the export itself is straightforward iCal.
- **Browser extension for quick-log** — depends on Direction A; the extension needs a backend to talk to.

---

## How to decide if any of this becomes real

For each direction, ask:

1. **Is there a specific user/use-case that needs this?** ("I want to study on my phone" beats "users might want cross-device.")
2. **Is local-first preserved?** If no, this is a different project. Be honest about that.
3. **Is the lighter alternative ruled out?** (Dropbox-synced SQLite beats CRDT sync until it doesn't.)
4. **Is the maintenance cost acceptable forever?** Building it is a fraction of the cost of running it.

If all four are yes, promote that direction into `ROADMAP.md` as a new phase with concrete tasks. If even one is no, leave it here.
