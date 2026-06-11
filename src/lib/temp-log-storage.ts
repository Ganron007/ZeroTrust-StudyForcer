import { IS_TAURI } from "./is-tauri"

/**
 * Phase 3.2: Persisted temp Log/Skip state.
 *
 * Problem: when the user clicks "Log 15 pages" on today, that state
 * currently lives in React useState. If the browser refreshes or
 * the app crashes, the temp state is lost.
 *
 * Solution: persist temp state to localStorage (web/test) or a
 * Tauri-managed file. "Mark Done" still moves it from temp to
 * durable dailyLog (per inviolable Rule 1).
 *
 * Inviolable Rule 1 is preserved: only Mark Done commits to
 * planStorage.save(). Temp state goes to a SEPARATE storage path
 * (this module) that is wiped on Mark Done.
 *
 * Shape:
 *   TempLogStore = Record<date, Record<courseId, { pagesRead: number }>>
 *   (same as the React temp state, so consumers can swap easily)
 */

const WEB_TEMP_LOGS_KEY = "web:temp_logs"

export type TempLogStore = Record<string, Record<string, { pagesRead: number }>>

/**
 * Read the temp log store from the underlying storage layer.
 * Returns empty object on error or first read.
 */
export async function readTempLogs(): Promise<TempLogStore> {
  try {
    if (IS_TAURI) {
      // For Tauri, we use localStorage as a temp cache (Tauri's
      // app data dir persists across sessions). The "durable" store
      // is planStorage; temp is ephemeral within a session.
      // For Tauri, we still persist to localStorage so refresh
      // doesn't lose data.
      const raw = localStorage.getItem(WEB_TEMP_LOGS_KEY) ?? ""
      if (!raw) return {}
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== "object") return {}
      return parsed as TempLogStore
    }
    const raw = localStorage.getItem(WEB_TEMP_LOGS_KEY) ?? ""
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return {}
    return parsed as TempLogStore
  } catch {
    return {}
  }
}

/**
 * Write the temp log store to the underlying storage layer.
 * Best-effort: errors are logged but not thrown (temp state is not
 * critical, the user can re-enter their log).
 */
export async function writeTempLogs(store: TempLogStore): Promise<void> {
  try {
    const content = JSON.stringify(store)
    localStorage.setItem(WEB_TEMP_LOGS_KEY, content)
  } catch (e) {
    console.warn("[temp-log-storage] write failed:", e)
  }
}

/**
 * Apply a temp log for a specific date + course. Creates the
 * nested structure if needed. Returns the updated store.
 */
export async function applyTempLog(
  date: string,
  courseId: string,
  pagesRead: number,
): Promise<TempLogStore> {
  const store = await readTempLogs()
  if (!store[date]) store[date] = {}
  store[date][courseId] = { pagesRead }
  await writeTempLogs(store)
  return store
}

/**
 * Clear a specific date's temp log (e.g., when Mark Done is clicked,
 * or when the user cancels).
 */
export async function clearTempLog(date: string): Promise<TempLogStore> {
  const store = await readTempLogs()
  delete store[date]
  await writeTempLogs(store)
  return store
}

/**
 * Clear all temp logs. Called when Mark Done commits a batch.
 */
export async function clearAllTempLogs(): Promise<void> {
  await writeTempLogs({})
}

/**
 * Convenience: get temp logs for a specific date.
 */
export async function getTempLogsForDate(date: string): Promise<Record<string, { pagesRead: number }>> {
  const store = await readTempLogs()
  return store[date] ?? {}
}
