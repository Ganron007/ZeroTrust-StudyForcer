/**
 * X2: Centralized localStorage key constants
 *
 * All localStorage keys used by the app, organized by convention:
 * - `ztsf:*` — cross-mode settings (persist regardless of Tauri/web)
 * - `web:*` — web-mode data storage (replaces SQLite when not in Tauri)
 *
 * Use these constants instead of raw strings to prevent typos and
 * make key renaming a single-file change.
 */

// ── Cross-mode settings (ztsf: prefix) ────────────────────────────────────
export const KEYS = {
  THEME: "ztsf:theme",
  PERSONALITY_MODE: "ztsf:personality-mode",
  NOTIFICATION_SETTINGS: "ztsf:notification-settings",
  CERTIFIED_CERTS: "ztsf:certified-certs",
  BACKUP_INDEX: "ztsf:backup-index",
  BACKUP_PREFIX: "ztsf:backup:",
  CALENDAR_LEGEND: "ztsf:showCalendarLegend",
  ACTIVE_COURSE: "ztsf:activeCourseId",
  SELECTED_COURSES: "ztsf:selectedCourseIds",
  EXPANDED_COURSES: "ztsf:planner:expandedCourses",
} as const

// ── Web-mode data storage (web: prefix) ───────────────────────────────────
export const WEB_KEYS = {
  PLANS: "web:plans",
  ACTIVE_PLAN_IDS: "web:activePlanIds",
  COURSES_INDEX: "web:courses:index",
  COURSE_PREFIX: "web:course:",
  LOGO_PREFIX: "web:logo:",
  LABS_SESSIONS: "web:labs_sessions",
  NEWS_CACHE: "web:news_cache",
  TIMER: "web:timer",
} as const

// ── Legacy keys (migrated on first boot) ──────────────────────────────────
const LEGACY_KEYS: Record<string, string> = {
  "cissp-theme": KEYS.THEME,
  "activeCourseId": KEYS.ACTIVE_COURSE,
  "selectedCourseIds": KEYS.SELECTED_COURSES,
  "showCalendarLegend": KEYS.CALENDAR_LEGEND,
  "planner:expandedCourses": KEYS.EXPANDED_COURSES,
}

/**
 * Run once on app boot: migrate any legacy bare keys to ztsf: prefix.
 * Safe to call repeatedly — only migrates if the legacy key exists
 * and the new key does not.
 */
export function migrateLegacyKeys(): void {
  try {
    for (const [oldKey, newKey] of Object.entries(LEGACY_KEYS)) {
      const value = localStorage.getItem(oldKey)
      if (value !== null && localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, value)
        localStorage.removeItem(oldKey)
        console.info(`[storage] migrated key "${oldKey}" → "${newKey}"`)
      }
    }
  } catch (e) {
    console.warn("[storage] legacy key migration failed:", e)
  }
}
