import { now } from "./clock"

/**
 * Phase 0.5.9: Adversary timer (opt-in).
 *
 * Off by default. When enabled, if the user hasn't logged today
 * by their deadline, tomorrow's pace auto-bumps by `paceBoostPct`.
 *
 * Settings persisted to localStorage. The UI surface (toggle in
 * settings) is out of scope for this commit — this is the storage
 * + math layer.
 *
 * How it works:
 *   1. The user opts in via settings (out of scope here).
 *   2. On each page load, `applyAdversaryPace` checks:
 *      - Was today logged in any active plan?
 *      - If not, is "now" past today's deadline?
 *   3. If both true, add a transient `adversaryBump` to the plan's
 *      pagesPerDay for tomorrow's plan computation.
 *
 * Adversary bumps are transient (NOT persisted to planStorage).
 * They only apply for the next day's schedule generation, and
 * disappear once the user logs.
 *
 * v2.6.0 audit fixes:
 *   - Timezone: previously the function compared `nowIso.substring(0,10)`
 *     (UTC date from `now()`) against `today` (local date from
 *     `localToday()`). For users west of UTC in the late evening,
 *     these differ and the bump was suppressed. Now we derive the
 *     "current local date" from `nowIso` by parsing it as UTC then
 *     converting to local — or accept an explicit `nowLocalDate`
 *     parameter.
 *   - paceBoostPct validation: clamped to 0-200 to prevent runaway boosts.
 */

export interface AdversarySettings {
  enabled: boolean
  /** Pace bump percentage (0-200). E.g. 25 = +25% pages/day. */
  paceBoostPct: number
  /** Daily deadline in HH:MM format. After this time, the bump triggers. */
  deadline: string  // e.g. "21:00"
}

export const ADVERSARY_MAX_BOOST = 200  // sanity cap

const DEFAULT_SETTINGS: AdversarySettings = {
  enabled: false,
  paceBoostPct: 25,
  deadline: "21:00",
}

const STORAGE_KEY = "ztsf:adversary-settings"

function clampBoost(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS.paceBoostPct
  if (value < 0) return 0
  if (value > ADVERSARY_MAX_BOOST) return ADVERSARY_MAX_BOOST
  return value
}

export function loadAdversarySettings(): AdversarySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return DEFAULT_SETTINGS
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      paceBoostPct: clampBoost(parsed.paceBoostPct ?? DEFAULT_SETTINGS.paceBoostPct),
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveAdversarySettings(settings: AdversarySettings): void {
  try {
    const safe = { ...settings, paceBoostPct: clampBoost(settings.paceBoostPct) }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe))
  } catch (e) {
    console.warn("[adversary] save failed:", e)
  }
}

/**
 * Compute the local YYYY-MM-DD date from an ISO timestamp.
 * Treats the timestamp as UTC and returns the local date. This matches
 * how `now()` builds the timestamp and how `localToday()` builds its
 * local-date string.
 */
function localDateFromIso(iso: string): string {
  // Parse as UTC and convert to local YYYY-MM-DD
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/**
 * Compute the adversary pace bump for tomorrow's plan, given today's
 * date and the deadline string. Returns 0 if no bump is warranted.
 *
 * v2.6.0 audit fix: takes `nowLocalDate` explicitly so callers can
 * pass the local date, avoiding the UTC/local mismatch that
 * previously suppressed bumps in late-evening hours.
 */
export function computeAdversaryBump(
  settings: AdversarySettings,
  today: string,
  nowIso: string = now(),
  nowLocalDate?: string,
): number {
  if (!settings.enabled) return 0
  const [hh, mm] = settings.deadline.split(":").map(Number)
  if (hh === undefined || mm === undefined) return 0
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0
  // Use caller-provided local date if given, else derive from nowIso.
  // This avoids the UTC/local mismatch that broke late-evening users.
  const currentLocalDate = nowLocalDate ?? localDateFromIso(nowIso)
  if (currentLocalDate !== today) return 0
  // Use the LOCAL clock time, not the UTC time from nowIso.
  // This makes the bump trigger at the user's wall-clock deadline.
  const d = new Date(nowIso)
  if (isNaN(d.getTime())) return 0
  const localHH = String(d.getHours()).padStart(2, "0")
  const localMM = String(d.getMinutes()).padStart(2, "0")
  const localTime = `${localHH}:${localMM}`
  return localTime >= `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
    ? clampBoost(settings.paceBoostPct)
    : 0
}

/**
 * Apply the adversary bump to a pagesPerDay value. Returns the
 * boosted value if the bump is non-zero, else the original.
 */
export function applyAdversaryPace(
  pagesPerDay: number,
  settings: AdversarySettings,
  today: string,
  nowIso: string = now(),
  nowLocalDate?: string,
): number {
  const bump = computeAdversaryBump(settings, today, nowIso, nowLocalDate)
  if (bump === 0) return pagesPerDay
  return Math.round(pagesPerDay * (1 + bump / 100))
}
