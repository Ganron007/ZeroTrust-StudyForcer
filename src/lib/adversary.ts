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
 */

export interface AdversarySettings {
  enabled: boolean
  /** Pace bump percentage (0-100). E.g. 25 = +25% pages/day. */
  paceBoostPct: number
  /** Daily deadline in HH:MM format. After this time, the bump triggers. */
  deadline: string  // e.g. "21:00"
}

const DEFAULT_SETTINGS: AdversarySettings = {
  enabled: false,
  paceBoostPct: 25,
  deadline: "21:00",
}

const STORAGE_KEY = "ztsf:adversary-settings"

export function loadAdversarySettings(): AdversarySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveAdversarySettings(settings: AdversarySettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (e) {
    console.warn("[adversary] save failed:", e)
  }
}

/**
 * Compute the adversary pace bump for tomorrow's plan, given today's
 * date and the deadline string. Returns 0 if no bump is warranted.
 *
 * Logic: if it's past deadline today AND the user hasn't logged
 * today (logged is determined by the caller — we just check the time
 * here), return the configured boost.
 */
export function computeAdversaryBump(
  settings: AdversarySettings,
  today: string,
  nowIso: string = now(),
): number {
  if (!settings.enabled) return 0
  const [hh, mm] = settings.deadline.split(":").map(Number)
  if (hh === undefined || mm === undefined) return 0
  const currentDate = nowIso.substring(0, 10)  // YYYY-MM-DD
  if (currentDate !== today) return 0
  const nowTime = nowIso.substring(11, 16)    // HH:MM
  // Compare times as strings (lexicographic, works for HH:MM format)
  return nowTime >= `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
    ? settings.paceBoostPct
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
): number {
  const bump = computeAdversaryBump(settings, today, nowIso)
  if (bump === 0) return pagesPerDay
  return Math.round(pagesPerDay * (1 + bump / 100))
}
