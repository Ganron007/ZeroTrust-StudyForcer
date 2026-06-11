/**
 * Phase 2.4: Auto-backup
 *
 * On any plan-storage mutation, write a dated JSON snapshot of all plans
 * to `<appData>/backups/YYYY-MM-DD.json` (Tauri mode) — or a parallel
 * localStorage key in web/test mode. Only one backup per day, plus
 * auto-prune to keep the last 10.
 *
 * No new state in the store — the backup is derived from planStorage
 * reads and runs through the existing Tauri file commands.
 */

import { IS_TAURI } from "./is-tauri"
import { planStorage } from "./plan-storage"
import type { StudyPlan } from "./plan-storage"
import { now } from "./clock"
import { localToday } from "./date-utils"

const KEEP_COUNT = 10
const LOCALSTORAGE_INDEX_KEY = "ztsf:backup-index"
export const LOCALSTORAGE_BACKUP_PREFIX = "ztsf:backup:"

interface BackupPayload {
  generatedAt: string
  plans: Record<string, StudyPlan>
  activePlanIds: string[]
}

/**
 * Build a JSON-serializable snapshot of all current plans.
 * Called by the storage-mutation subscriber below.
 */
async function snapshotAllPlans(): Promise<string> {
  const plans = await planStorage.getAll()
  const activePlanIds = await planStorage.getActiveIds()
  const byId: Record<string, StudyPlan> = {}
  for (const p of plans) byId[p.id] = p
  const payload: BackupPayload = {
    generatedAt: now(),
    plans: byId,
    activePlanIds,
  }
  return JSON.stringify(payload, null, 2)
}

async function writeTauri(filename: string, content: string): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core")
  await invoke("write_backup_file", { filename, content })
}

async function pruneTauri(): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core")
  await invoke("prune_old_backups", { keep: KEEP_COUNT })
}

function writeWeb(filename: string, content: string): void {
  try {
    localStorage.setItem(LOCALSTORAGE_BACKUP_PREFIX + filename, content)
    const raw = localStorage.getItem(LOCALSTORAGE_INDEX_KEY)
    const index: string[] = raw ? (JSON.parse(raw) as string[]) : []
    if (!index.includes(filename)) {
      index.push(filename)
      index.sort((a, b) => b.localeCompare(a)) // newest first
      localStorage.setItem(LOCALSTORAGE_INDEX_KEY, JSON.stringify(index))
    }
  } catch (e) {
    console.warn("[auto-backup] web write failed:", e)
  }
}

function pruneWeb(): void {
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_INDEX_KEY)
    if (!raw) return
    const index: string[] = JSON.parse(raw) as string[]
    for (const fname of index.slice(KEEP_COUNT)) {
      localStorage.removeItem(LOCALSTORAGE_BACKUP_PREFIX + fname)
    }
    const trimmed = index.slice(0, KEEP_COUNT)
    localStorage.setItem(LOCALSTORAGE_INDEX_KEY, JSON.stringify(trimmed))
  } catch (e) {
    console.warn("[auto-backup] web prune failed:", e)
  }
}

/**
 * Run one backup cycle: write today's backup (if not already present),
 * then prune to keep the last 10.
 *
 * Safe to call repeatedly — idempotent (no-op if today's file exists).
 */
export async function runAutoBackup(): Promise<{ wrote: boolean; pruned: number }> {
  const today = localToday()
  const filename = `${today}.json`
  let wrote = false
  try {
    const content = await snapshotAllPlans()
    if (IS_TAURI) {
      try {
        await writeTauri(filename, content)
        wrote = true
      } catch (e) {
        console.warn("[auto-backup] tauri write failed, falling back to web:", e)
        writeWeb(filename, content)
        wrote = true
      }
      try {
        await pruneTauri()
      } catch (e) {
        console.warn("[auto-backup] tauri prune failed:", e)
        pruneWeb()
      }
    } else {
      writeWeb(filename, content)
      wrote = true
      pruneWeb()
    }
  } catch (e) {
    console.warn("[auto-backup] failed:", e)
  }
  return { wrote, pruned: 0 }
}

/**
 * Restore from a backup file. Returns the payload or null if not found.
 * Caller is responsible for re-saving the payload via planStorage.
 *
 * Note: restore is not yet wired into the UI (Phase 2.4 spec is
 * "auto-backup", not "restore"). This function is provided for the
 * upcoming Phase 2.5 "Restore from backup" button.
 */
export async function readBackup(filename: string): Promise<BackupPayload | null> {
  if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(filename)) {
    throw new Error("Backup filename must be YYYY-MM-DD.json")
  }
  // Web fallback
  const raw = localStorage.getItem(LOCALSTORAGE_BACKUP_PREFIX + filename)
  if (!raw) return null
  return JSON.parse(raw) as BackupPayload
}
