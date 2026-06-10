import { invoke } from "@tauri-apps/api/core"
import { IS_TAURI } from "./is-tauri"
import { DEFAULT_EXTERNAL_LABS, type LabsStorage, type LabSession } from "./lab-sessions"
import type { LabCategory } from "./lab-data"
import { localToday } from "./date-utils"

const WEB_LABS_SESSIONS_KEY = "web:labs_sessions"

export async function readLabsStorage(): Promise<LabsStorage> {
  try {
    const data = IS_TAURI
      ? await invoke<string>("read_labs_file")
      : localStorage.getItem(WEB_LABS_SESSIONS_KEY) ?? ""
    if (!data) return { labs: DEFAULT_EXTERNAL_LABS, sessions: [], categories: {} }
    const parsed = JSON.parse(data)
    if (!parsed || typeof parsed !== "object") {
      return { labs: DEFAULT_EXTERNAL_LABS, sessions: [], categories: {} }
    }
    const labs = Array.isArray(parsed.labs) ? parsed.labs : DEFAULT_EXTERNAL_LABS
    // S4/S5/S6: Validate each session — reject arrays, NaN minutes, unparseable dates
    const rawSessions = Array.isArray(parsed.sessions) ? parsed.sessions : []
    const sessions = rawSessions.filter((s: unknown): s is LabSession => {
      if (!s || typeof s !== "object" || Array.isArray(s)) return false
      const session = s as Record<string, unknown>
      if (typeof session.labId !== "string") return false
      if (typeof session.date !== "string" || isNaN(new Date(session.date + "T00:00:00").getTime())) return false
      if (typeof session.minutes !== "number" || isNaN(session.minutes) || session.minutes <= 0) return false
      return true
    })
    const categories = parsed.categories && typeof parsed.categories === "object" ? parsed.categories : {}
    return { labs, sessions, categories }
  } catch {
    return { labs: DEFAULT_EXTERNAL_LABS, sessions: [], categories: {} }
  }
}

export async function writeLabsStorage(data: LabsStorage): Promise<void> {
  const content = JSON.stringify(data, null, 2)
  if (IS_TAURI) {
    await invoke("write_labs_file", { content })
    return
  }
  localStorage.setItem(WEB_LABS_SESSIONS_KEY, content)
}

export function getLast14Days(): string[] {
  const days: string[] = []
  const today = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    days.push(`${y}-${m}-${day}`)
  }
  return days
}

export function getLast7Days(): string[] {
  const days: string[] = []
  const today = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    days.push(`${y}-${m}-${day}`)
  }
  return days
}

export function getTodayMinutes(sessions: LabSession[]): number {
  const today = localToday()
  return sessions
    .filter((s) => s.date === today)
    .reduce((sum, s) => sum + s.minutes, 0)
}

export function getMonthMinutes(sessions: LabSession[]): number {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  return sessions
    .filter((s) => {
      const d = new Date(s.date + "T00:00:00")
      return d.getFullYear() === year && d.getMonth() === month
    })
    .reduce((sum, s) => sum + s.minutes, 0)
}

export function getDaysInCurrentMonth(): number {
  const today = new Date()
  return new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
}

export function getDaysSince(date: string | null): number | null {
  if (!date) return null
  const today = new Date(localToday() + "T00:00:00")
  const past = new Date(date + "T00:00:00")
  return Math.floor((today.getTime() - past.getTime()) / 86400000)
}

export function getStreak(sessions: LabSession[]): number {
  const today = localToday()
  const completedDates = [...new Set(sessions.map((s) => s.date))].sort()
  if (completedDates.length === 0) return 0

  let streak: number
  const check = new Date()

  if (completedDates.includes(today)) {
    streak = 1
  } else {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`
    if (!completedDates.includes(yStr)) return 0
    check.setDate(check.getDate() - 1)
    streak = 1
  }

  while (true) {
    check.setDate(check.getDate() - 1)
    const dStr = `${check.getFullYear()}-${String(check.getMonth() + 1).padStart(2, "0")}-${String(check.getDate()).padStart(2, "0")}`
    if (completedDates.includes(dStr)) {
      streak++
    } else {
      break
    }
  }

  return streak
}

export function getWeekMinutes(sessions: LabSession[]): number {
  const today = new Date()
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  return sessions
    .filter((s) => new Date(s.date + "T00:00:00") >= weekAgo)
    .reduce((sum, s) => sum + s.minutes, 0)
}

export function getCoverage14(sessions: LabSession[]): { used: number; total: number } {
  const last14 = getLast14Days()
  const usedLabIds = new Set(
    sessions.filter((s) => last14.includes(s.date)).map((s) => s.labId)
  )
  return { used: usedLabIds.size, total: DEFAULT_EXTERNAL_LABS.length }
}

export function getAtRiskCount(sessions: LabSession[]): number {
  const labLastUse = new Map<string, string>()
  for (const s of sessions) {
    const existing = labLastUse.get(s.labId)
    if (!existing || s.date > existing) {
      labLastUse.set(s.labId, s.date)
    }
  }
  let count = 0
  for (const lab of DEFAULT_EXTERNAL_LABS) {
    const lastDate = labLastUse.get(lab.id)
    const daysSince = getDaysSince(lastDate ?? null)
    if (daysSince === null || daysSince >= 14) count++
  }
  return count
}

// S7: Valid LabCategory set for runtime validation
const VALID_LAB_CATEGORIES: ReadonlySet<LabCategory> = new Set([
  "blue", "red", "dfir", "purple",
])

export function getLabCategory(data: LabsStorage, labId: string): LabCategory {
  const stored = data.categories[labId]
  if (stored && VALID_LAB_CATEGORIES.has(stored)) return stored
  const labDefault = DEFAULT_EXTERNAL_LABS.find((l) => l.id === labId)?.defaultCategory
  if (labDefault && VALID_LAB_CATEGORIES.has(labDefault)) return labDefault
  return "purple"
}

// ── Smart scoring ────────────────────────────────────────────────────────────
// Multi-factor priority score (0–100) that balances recency, coverage,
// diversification, and subscription waste risk.

export interface SmartScoreFactors {
  base: number
  atRiskBonus: number
  unexploredBonus: number
  categoryGapBonus: number
  recentUsePenalty: number
  final: number
}

export function computeSmartScore(
  labId: string,
  daysSince: number | null,
  totalMinutes: number,
  sessions: LabSession[],
): { score: number; factors: SmartScoreFactors } {
  // 1. Base recency score (days since × 3, capped at 100)
  const base = daysSince === null ? 100 : Math.min(daysSince * 3, 100)

  // 2. At-risk bonus (+20 if not used in 14 days)
  const atRiskBonus = daysSince === null || daysSince >= 14 ? 20 : 0

  // 3. Unexplored bonus (+15 if never used)
  const unexploredBonus = totalMinutes === 0 ? 15 : 0

  // 4. Category gap bonus (+10 if this lab's focus has 0 sessions in last 14 days)
  const labDef = DEFAULT_EXTERNAL_LABS.find((l) => l.id === labId)
  const focus = labDef?.focus ?? ""
  const last14 = getLast14Days()
  // S8: Only apply category gap bonus if this focus has labs OTHER than the current one
  const otherLabsWithFocus = DEFAULT_EXTERNAL_LABS.some((l) => l.focus === focus && l.id !== labId)
  const focusSessions14 = sessions.filter(
    (s) => last14.includes(s.date) && DEFAULT_EXTERNAL_LABS.find((l) => l.id === s.labId)?.focus === focus,
  )
  const categoryGapBonus = otherLabsWithFocus && focusSessions14.length === 0 ? 10 : 0

  // 5. Recent use penalty (−10 if used in last 7 days)
  const today = new Date()
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const recentUse = sessions.some(
    (s) => s.labId === labId && new Date(s.date + "T00:00:00") >= weekAgo,
  )
  const recentUsePenalty = recentUse ? 10 : 0

  const final = Math.max(0, Math.min(100, base + atRiskBonus + unexploredBonus + categoryGapBonus - recentUsePenalty))

  return {
    score: final,
    factors: { base, atRiskBonus, unexploredBonus, categoryGapBonus, recentUsePenalty, final },
  }
}
