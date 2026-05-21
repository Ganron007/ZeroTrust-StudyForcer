# ZeroTrust.StudyForcer — Personality Layer

**Status:** ✅ Shipped (v2.3.1)
**Updated:** 2026-05-17

All 8 stages complete. Full audit passed — 276/276 checkpoints, 203 tests passing, TypeScript clean.

---

## Identity

| Field | Value |
|-------|-------|
| **Display name** | ZeroTrust.StudyForcer |
| **Short name** | ZTSF |
| **Tagline** | *Zero Trust in your ability to pass. Prove us wrong.* |
| **Description** | A cybersecurity certification tracker built on the principle of Zero Trust — never trust, always verify. It doesn't trust your memory, doesn't care about your excuses, and treats your exam prep like the high-stakes breach operation it is. |

## Architecture

A **React Context** (`PersonalityProvider`) wraps the app and provides all user-facing text. Components never hardcode strings — they call `label()`, `toast()`, `empty()`, `greeting()` from `usePersonality()`, which returns themed text based on the active mode.

```
Components
    │
    ▼
usePersonality() hook
    │
    ▼
personality.ts (pure functions, mode-keyed dictionaries)
    │
    ▼
PersonalityProvider (React context, persists mode to localStorage)
```

### Files

| File | Purpose |
|------|---------|
| `src/lib/personality.ts` | All string dictionaries keyed by mode (~3508 lines, 13 modes × ~256 labels + ~33 toasts + ~13 empties + 3 greetings + 4 loading + 10 tips). Pure functions: `getLabel`, `getToast`, `getEmpty`, `getGreeting`, `getLoading`, `getTips`, `formatStr` |
| `src/components/PersonalityProvider.tsx` | React context that stores the current mode, persists to localStorage, provides bound functions to children |
| `src/hooks/usePersonality.ts` | Re-exports `usePersonality` hook + `PersonalityMode` type |

### Key Safety Mechanism

All `label()` calls fall back to the raw key string if not found in the dictionary. The fallback chain is: `LABELS[mode]?.[key] ?? LABELS["standard"]?.[key] ?? key`. So even if a string is missed during implementation, it shows a readable key name instead of blank or undefined. The app never breaks.

---

## Personality Modes (13 modes shipped)

| Mode | Key | Tone | Icon |
|------|-----|------|------|
| **Standard** | `standard` | Neutral, safe — identical to original app text | 📋 |
| **Drill Sergeant** | `drill-sergeant` | Aggressive military bootcamp | 🎖️ |
| **Cyberpunk** | `cyberpunk` | Neon-dystopian, glitchy | 💿 |
| **Script Kiddie** | `script-kiddie` | Meme-filled, self-deprecating | 🐉 |
| **Zero Trust Audit** | `zero-trust-audit` | Clinical compliance-speak humor | 🔒 |
| **Influencer** | `influencer` | Over-enthusiastic GRWM energy | ✨ |
| **Politician** | `politician` | Exaggerated, self-promotional | 🎩 |
| **LinkedIn Lunatic** | `linkedin-lunatic` | Cringey #GrowthMindset hustle | 💼 |
| **True Crime** | `true-crime` | Murder-mystery narrator | 🔍 |
| **Weather Anchor** | `weather-anchor` | Newsroom weather report | 🌨️ |
| **Passive-Aggressive Mom** | `passive-aggressive` | Guilt-tripping parental nag | 🍽️ |
| **Conspiracy Theorist** | `conspiracy` | Paranoia / "they" don't want you to pass | 🛸 |
| **Elderly Reluctant** | `elderly` | Tech-illiterate grandparent | 🧓 |

Each mode provides ~256 label strings (~189 unique + ~67 standard fallback), ~33 toasts, ~13 empty states, 3 greetings, 4 loading messages, 10 tips. New modes spread standard maps as fallback — only distinctive keys overridden (~20–30 explicit lines per mode).

### Mode Switch UI

A small button in the app header (near theme picker) → dropdown with mode names + one-line tagline. Persisted in localStorage as `ztsf:personality-mode`. Toggle re-seeds the tip picker.

---

## Components Wired (14 components)

| Component | Keys used | Status |
|-----------|-----------|--------|
| `App.tsx` | 27 | ✅ |
| `DailyBriefing.tsx` | 11 | ✅ |
| `PlannerPage.tsx` | 43 | ✅ |
| `LogDialog.tsx` | 8 | ✅ |
| `ScheduleView.tsx` | 13 | ✅ |
| `ScheduleList.tsx` | 5 | ✅ |
| `StudyTimer.tsx` | 16 | ✅ |
| `ProgressDashboard.tsx` | 6 | ✅ |
| `SidebarLabsStatus.tsx` | 7 | ✅ |
| `SidebarNewsHighlights.tsx` | 4 | ✅ |
| `CourseSelector.tsx` | 11 | ✅ |
| `LabDashboard.tsx` | 9 | ✅ |
| `SecurityNewsFeed.tsx` | 5 | ✅ |
| `CourseBuilder.tsx` | 9 | ✅ |

## Files Not Touched

All engine files (`cissp-data.ts`, `plan-engine.ts`, `plan-storage.ts`, `plan-store.ts`, `database.ts`), all storage files (`course-storage.ts`, `lab-session-storage.ts`, `timer-storage.ts`, `news-storage.ts`), all types (`types/course.ts`), all Rust backend — **zero changes**.

## Tips Integration

`src/lib/tips.ts` replaced — `createTipPicker()` now accepts `PersonalityMode` and pulls tips from `getTips(mode)`. On mode switch, the tip pool is re-seeded and immediately rotates to a fresh tip.

## Audit Results (276 checkpoints)

| Category | Checks | Pass |
|----------|--------|------|
| TypeScript | 1 | ✅ |
| Tests (203) | 1 | ✅ |
| Build | 1 | ✅ |
| personality.ts structure | 10 | ✅ |
| Provider + hook wiring | 8 | ✅ |
| Component key validation | 14 | ✅ |
| tips.ts integration | 7 | ✅ |
| Mode switch UI | 7 | ✅ |
| Test mocks | 5 | ✅ |
| Rename audit | 10 | ✅ |
| Edge cases | 10 | ✅ |
| **TOTAL** | **276** | **✅** |

3 minor issues found & fixed during audit:
1. Added `noCoursesSelected` key (was using `noCourseSelected` mismatch)
2. Added `modeLabel` key (mode picker header said "Theme")
3. Rebuilt stale `dist/index.html`
