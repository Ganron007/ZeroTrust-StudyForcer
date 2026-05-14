import { readStorage, writeStorage } from "./database"

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export interface ChapterCheck {
  writtenLab?: boolean
  reviewQuestions?: boolean
}

export interface ChapterProgress {
  count: number
  practiceDone?: boolean
  skipped?: boolean
}

export interface DailyLog {
  pagesRead: number
  note?: string
}

export type Anchor = "endDate" | "pagesPerDay"

export interface StudyPlan {
  id: string
  courseId: string
  name: string
  createdAt: string
  updatedAt: string
  startDate: string
  pagesPerDay: number
  studyDays: number[]
  startingChapterId: number
  chapterStartOverrides: Record<number, number>
  /** Optional target end date (YYYY-MM-DD). When anchor="endDate", this is the locked deadline. */
  targetEndDate?: string
  /** Legacy field — kept for migration. Computed on-the-fly for fixedDuration. */
  targetDayCount?: number
  /** The locked anchor: "endDate" or "pagesPerDay". */
  anchor: Anchor
  /** Map of YYYY-MM-DD → daily log. Presence means the day was logged/processed. */
  dailyLog: Record<string, DailyLog>
  /** YYYY-MM-DD date strings of explicitly skipped study days. */
  skippedDays: string[]
  /** Ordered unit IDs for this plan. If absent, the course's default unit order is used. */
  unitOrder?: number[]
}

// readStorage and writeStorage are now imported from ./database
// (they delegate to SQLite in Tauri mode, or localStorage in web/test mode)

export const planStorage = {
  async getAll(): Promise<StudyPlan[]> {
    const { plans } = await readStorage()
    return Object.values(plans).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  },

  async get(id: string): Promise<StudyPlan | null> {
    const { plans } = await readStorage()
    return plans[id] ?? null
  },

  async save(plan: Omit<StudyPlan, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<StudyPlan> {
    const data = await readStorage()
    const now = new Date().toISOString()
    const id = plan.id ?? generateId()
    const existing = data.plans[id]
    const saved: StudyPlan = {
      ...plan,
      id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      dailyLog: plan.dailyLog ?? {},
      skippedDays: plan.skippedDays ?? [],
      unitOrder: "unitOrder" in (plan as Record<string, unknown>) ? plan.unitOrder : existing?.unitOrder,
    }
    data.plans[id] = saved
    await writeStorage(data)
    return saved
  },

  async delete(id: string): Promise<void> {
    const data = await readStorage()
    delete data.plans[id]
    data.activePlanIds = data.activePlanIds.filter((pid) => pid !== id)
    await writeStorage(data)
  },

  async rename(id: string, name: string): Promise<void> {
    const data = await readStorage()
    if (data.plans[id]) {
      data.plans[id].name = name
      data.plans[id].updatedAt = new Date().toISOString()
      await writeStorage(data)
    }
  },

  async getActiveIds(): Promise<string[]> {
    const data = await readStorage()
    return data.activePlanIds
  },

  async setActiveIds(ids: string[]): Promise<void> {
    const data = await readStorage()
    data.activePlanIds = ids.filter((id) => data.plans[id])
    await writeStorage(data)
  },

  async addActiveId(id: string): Promise<void> {
    const data = await readStorage()
    if (!data.plans[id]) return
    if (!data.activePlanIds.includes(id)) {
      data.activePlanIds.push(id)
      await writeStorage(data)
    }
  },

  async removeActiveId(id: string): Promise<void> {
    const data = await readStorage()
    data.activePlanIds = data.activePlanIds.filter((pid) => pid !== id)
    await writeStorage(data)
  },

  async clearAll(): Promise<void> {
    await writeStorage({ plans: {}, activePlanIds: [] })
  },
}

function localToday(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function defaultPlan(
  courseId: string,
  overrides?: Partial<StudyPlan>,
  courseDefaults?: { pagesPerDay?: number; studyDays?: number[]; startingChapterId?: number },
): Omit<StudyPlan, "id" | "createdAt" | "updatedAt"> {
  return {
    courseId,
    name: "My Study Plan",
    startDate: localToday(),
    pagesPerDay: courseDefaults?.pagesPerDay ?? 20,
    studyDays: courseDefaults?.studyDays ?? [1, 2, 3, 4, 5],
    startingChapterId: courseDefaults?.startingChapterId ?? 1,
    chapterStartOverrides: {},
    targetEndDate: undefined,
    targetDayCount: undefined,
    anchor: "pagesPerDay",
    dailyLog: {},
    skippedDays: [],
    ...overrides,
  }
}
