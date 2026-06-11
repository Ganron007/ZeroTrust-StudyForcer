/**
 * Phase 2.2: Native OS notifications.
 *
 * Wraps the @tauri-apps/plugin-notification API with a no-op fallback
 * for web/test mode. Also exposes a tiny "isNativeAvailable()" check so
 * the UI can show "Notifications unavailable in browser mode" gracefully.
 *
 * Settings (enabled/disabled, daily time) are persisted to localStorage
 * and respected by the reminder scheduler in App.tsx.
 */

import { IS_TAURI } from "./is-tauri"
import { nowDate } from "./clock"

const STORAGE_KEY = "ztsf:notification-settings"

export interface NotificationSettings {
  enabled: boolean
  /** Time of day in 24h "HH:MM" format. Default "18:00" (6pm). */
  dailyTime: string
  /** Whether to notify when at-risk labs are detected. */
  labsAlert: boolean
}

const DEFAULTS: NotificationSettings = {
  enabled: false,
  dailyTime: "18:00",
  labsAlert: true,
}

export function loadSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(settings: NotificationSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function isNativeAvailable(): boolean {
  return IS_TAURI
}

let permissionRequested = false
let permissionGranted = false

/**
 * Request OS permission for notifications. Idempotent — only requests
 * once per session. Returns true if permission is granted.
 */
export async function requestPermission(): Promise<boolean> {
  if (!IS_TAURI) return false
  if (permissionGranted) return true
  if (permissionRequested) return permissionGranted
  permissionRequested = true
  try {
    const { isPermissionGranted, requestPermission } = await import(
      "@tauri-apps/plugin-notification"
    )
    let granted = await isPermissionGranted()
    if (!granted) {
      const result = await requestPermission()
      granted = result === "granted"
    }
    permissionGranted = granted
    return granted
  } catch (e) {
    console.warn("[notifications] permission request failed:", e)
    return false
  }
}

/**
 * Send a native OS notification. Falls back to a no-op in web/test mode.
 * Caller is responsible for permission-check; this function will silently
 * skip if permission was not granted.
 */
export async function sendNotification(title: string, body: string): Promise<boolean> {
  if (!IS_TAURI) return false
  try {
    const granted = await requestPermission()
    if (!granted) return false
    const { sendNotification: tauriSend } = await import(
      "@tauri-apps/plugin-notification"
    )
    await tauriSend({ title, body })
    return true
  } catch (e) {
    console.warn("[notifications] send failed:", e)
    return false
  }
}

/**
 * Schedule a daily notification at the user's chosen time. The Tauri
 * notification plugin does not provide native scheduling, so this uses
 * a setTimeout-based approach: compute ms until next fire time, then
 * re-arm. Returns a function to cancel.
 */
export function scheduleDaily(
  settings: NotificationSettings,
  onFire: (today: string) => void,
): () => void {
  if (!settings.enabled) {
    return () => {}
  }
  let cancelled = false
  let timerId: ReturnType<typeof setTimeout> | null = null

  function arm() {
    if (cancelled) return
    const now = nowDate()
    const [hh, mm] = settings.dailyTime.split(":").map(Number)
    const next = new Date(now)
    next.setHours(hh ?? 18, mm ?? 0, 0, 0)
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1)
    }
    const delay = next.getTime() - now.getTime()
    const today = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`
    timerId = setTimeout(() => {
      onFire(today)
      arm()
    }, delay)
  }
  arm()
  return () => {
    cancelled = true
    if (timerId) clearTimeout(timerId)
  }
}
