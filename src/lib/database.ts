/**
 * Database abstraction layer.
 *
 * - **Tauri mode**: SQLite via @tauri-apps/plugin-sql (atomic transactions, schema migrations)
 * - **Web / test mode**: localStorage (same API, zero-config for CI)
 *
 * This is the ONLY file that touches raw persistence. All consumers
 * (planStorage, timer-storage, etc.) go through this layer.
 */

import { IS_TAURI } from "./is-tauri"
import type { StudyPlan } from "./plan-storage"

export interface StorageData {
  plans: Record<string, StudyPlan>
  activePlanIds: string[]
}

// ── Web/localStorage adapter ────────────────────────────────────────────────

const WEB_PLANS_KEY = "web:plans"
const WEB_ACTIVE_KEY = "web:activePlanIds"

/** In-memory write-through cache for web mode (avoids JSON parse on every read). */
let webCache: { plans: Record<string, StudyPlan>; activePlanIds: string[] } | null = null

// S25: Listen for cross-tab localStorage changes and invalidate cache
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === WEB_PLANS_KEY || e.key === WEB_ACTIVE_KEY) {
      webCache = null
    }
  })
}

function readWeb(): StorageData {
  if (webCache) return webCache
  const plansRaw = localStorage.getItem(WEB_PLANS_KEY)
  const activeRaw = localStorage.getItem(WEB_ACTIVE_KEY)
  if (plansRaw === null && activeRaw === null) {
    webCache = { plans: {}, activePlanIds: [] }
    return webCache
  }
  try {
    webCache = {
      plans: plansRaw ? JSON.parse(plansRaw) : {},
      activePlanIds: activeRaw ? JSON.parse(activeRaw) : [],
    }
  } catch (e) {
    // v2.4.4: Don't silently return empty — preserve the corrupt blob for recovery.
    const stamp = Date.now()
    console.error("[database] localStorage parse failed, quarantining:", e)
    if (plansRaw) {
      try { localStorage.setItem(`${WEB_PLANS_KEY}.corrupt-${stamp}`, plansRaw) } catch { /* ignore */ }
    }
    if (activeRaw) {
      try { localStorage.setItem(`${WEB_ACTIVE_KEY}.corrupt-${stamp}`, activeRaw) } catch { /* ignore */ }
    }
    try { localStorage.removeItem(WEB_PLANS_KEY) } catch { /* ignore */ }
    try { localStorage.removeItem(WEB_ACTIVE_KEY) } catch { /* ignore */ }
    webCache = { plans: {}, activePlanIds: [] }
  }
  return webCache
}

function writeWeb(data: StorageData): void {
  const previous = webCache
  webCache = data
  try {
    localStorage.setItem(WEB_PLANS_KEY, JSON.stringify(data.plans))
    localStorage.setItem(WEB_ACTIVE_KEY, JSON.stringify(data.activePlanIds))
  } catch (e) {
    webCache = previous
    console.error("[database] localStorage write failed:", e)
    throw new Error("Failed to save data: storage quota exceeded")
  }
}

// ── SQLite adapter (Tauri only) ─────────────────────────────────────────────

/** Database handle type — use `any` since tauri-plugin-sql's type system is complex at runtime. */
type DbHandle = any

let _db: DbHandle | null = null
let _dbPromise: Promise<DbHandle | null> | null = null

async function getDb(): Promise<DbHandle | null> {
  if (_db) return _db
  if (_dbPromise) return _dbPromise
  _dbPromise = initSqlite()
  return _dbPromise
}

async function initSqlite(): Promise<DbHandle | null> {
  try {
    const { default: Database } = await import("@tauri-apps/plugin-sql")
    const db: DbHandle = await Database.load("sqlite:study-planner.db")

    // ── Schema ──────────────────────────────────────────────────────────────
    await db.execute(`CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    )`)
    await db.execute(`CREATE TABLE IF NOT EXISTS active_plan_ids (
      plan_id TEXT PRIMARY KEY
    )`)
    await db.execute(`CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`)

    // ── Migrations ──────────────────────────────────────────────────────────
    // S28: Migration array. Each entry migrates from version N to N+1.
    // Add new migrations here as schema evolves.
    type Migration = { from: number; run: (db: Awaited<ReturnType<typeof Database.load>>) => Promise<void> }
    const MIGRATIONS: Migration[] = [
      {
        from: 0,
        run: async (db) => {
          // v0 → v1: initial schema (plans, active_plan_ids tables already created above)
          await db.execute(
            "INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '1')",
          )
        },
      },
    ]

    const rows: { value: string }[] = await db.select(
      "SELECT value FROM meta WHERE key = 'schema_version'",
    )
    let version = rows.length > 0 ? Number(rows[0].value) : 0
    for (const migration of MIGRATIONS) {
      if (migration.from === version) {
        try {
          await migration.run(db)
          version = migration.from + 1
        } catch (e) {
          console.warn(`[database] migration from v${migration.from} failed:`, e)
          break
        }
      }
    }

    _db = db
    return db
  } catch (e) {
    console.warn("[database] SQLite unavailable:", e)
    _dbPromise = null
    return null
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function readStorage(): Promise<StorageData> {
  if (IS_TAURI) {
    const db = await getDb()
    if (db) {
      try {
        const planRows: { id: string; data: string }[] = await db.select(
          "SELECT id, data FROM plans",
        )
        const activeRows: { plan_id: string }[] = await db.select(
          "SELECT plan_id FROM active_plan_ids",
        )
        const plans: Record<string, StudyPlan> = {}
        for (const row of planRows) {
          try {
            plans[row.id] = JSON.parse(row.data)
          } catch (e) {
            // v2.4.4: Surface per-row corruption instead of silently dropping.
            console.warn(`[database] skipping corrupt plan row ${row.id}:`, e)
          }
        }
        const activePlanIds = (activeRows ?? [])
          .map((r: { plan_id: string }) => r.plan_id)
          .filter((id: string) => !!plans[id])
        return { plans, activePlanIds }
      } catch (e) {
        // S27: Log error before falling back
        console.error("[database] SQLite read failed:", e)
        console.warn("[database] Falling back to localStorage")
        return readWeb()
      }
    }
  }
  return readWeb()
}

export async function writeStorage(data: StorageData): Promise<void> {
    if (IS_TAURI) {
    const db = await getDb()
    if (db) {
      try {
        await db.execute("BEGIN TRANSACTION")
        // C6 fix: DELETE plans first, then INSERT OR REPLACE the new set.
        // Previously only INSERT OR REPLACE was used per row, so plans
        // removed from in-memory state would linger as orphaned SQLite rows
        // and silently resurrect after restart. Mirrors writeWeb's full-replace.
        await db.execute("DELETE FROM plans")
        for (const [id, plan] of Object.entries(data.plans)) {
          await db.execute(
            "INSERT INTO plans (id, data) VALUES ($1, $2)",
            [id, JSON.stringify(plan)],
          )
        }
        await db.execute("DELETE FROM active_plan_ids")
        for (const id of data.activePlanIds) {
          await db.execute(
            "INSERT INTO active_plan_ids (plan_id) VALUES ($1)",
            [id],
          )
        }
        await db.execute("COMMIT")
      } catch (e) {
        try { await db.execute("ROLLBACK") } catch { /* ignore */ }
        throw e
      }
      return
    }
    // Fall through to localStorage
  }
  writeWeb(data)
}
