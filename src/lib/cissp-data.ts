export interface StudyDayGroup {
  label: string
  dayNumber: number
  totalPages: number
  chapters: StudyDay["chapters"]
}

export interface StudyDay {
  date: string
  dayNumber: number
  chapters: {
    chapterId: number
    chapterTitle: string
    unit: number
    unitName: string
    pagesStart: number
    pagesEnd: number
    pagesCount: number
    color: string
    courseLabel?: string
    courseId?: string
    /** Actual book page range (if known), otherwise same as pagesStart/pagesEnd. */
    bookPageStart?: number
    bookPageEnd?: number
    /** Total pages in the full chapter (not just today's slice). */
    chapterTotalPages?: number
    /** Full chapter book page range (for logging input bounds). */
    chapterBookStart?: number
    chapterBookEnd?: number
  }[]
  totalPages: number
  groups?: StudyDayGroup[]
}

export interface DailyLogEntry { pagesRead: number; note?: string }

import type { Chapter, CourseConfig } from "@/types/course"
import { flattenCourse } from "@/types/course"
import type { StudyPlan } from "@/lib/plan-storage"

export const DEFAULT_STUDY_DAYS = [1, 2, 3, 4, 5]

/**
 * Flatten a course's units into chapters, respecting the plan's unit order
 * if provided. If unitOrder is absent, returns the course's default order.
 * Units not listed in unitOrder are appended at the end.
 */
export function getOrderedChapters(
  course: CourseConfig,
  unitOrder?: number[],
): Chapter[] {
  if (!unitOrder || unitOrder.length === 0) {
    return flattenCourse(course)
  }
  const unitMap = new Map(course.units.map((u) => [u.id, u]))
  const seen = new Set<number>()
  const ordered: Chapter[] = []
  for (const uid of unitOrder) {
    const unit = unitMap.get(uid)
    seen.add(uid)
    if (!unit) continue
    for (const ch of unit.chapters) {
      ordered.push({
        id: ch.id, title: ch.title, pages: ch.pages,
        unitId: unit.id, unitName: unit.title, color: unit.color,
        bookPageStart: ch.bookPageStart,
      })
    }
  }
  for (const unit of course.units) {
    if (seen.has(unit.id)) continue
    for (const ch of unit.chapters) {
      ordered.push({
        id: ch.id, title: ch.title, pages: ch.pages,
        unitId: unit.id, unitName: unit.title, color: unit.color,
        bookPageStart: ch.bookPageStart,
      })
    }
  }
  return ordered
}

// Hard cap on calendar days the generator will walk before bailing.
// Protects against pathological inputs (every day logged as 0 pages, etc.).
const MAX_CALENDAR_DAYS = 365 * 20

function localDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

interface PageEntry {
  chapterId: number
  chapterTitle: string
  unit: number
  unitName: string
  pageNum: number
  color: string
  bookPageStart?: number
  chapterTotalPages?: number
}

function buildPageSequence(
  plan: StudyPlan,
  chapters: Chapter[]
): PageEntry[] {
  const startIdx = chapters.findIndex((ch) => ch.id === plan.startingChapterId)
  if (startIdx < 0) return []
  const activeChapters = chapters.slice(startIdx).map((ch) => ({
    ...ch,
    startPage: plan.chapterStartOverrides[ch.id] ?? 1,
    chapterTotalPages: ch.pages,
  }))

  const seq: PageEntry[] = []
  for (const ch of activeChapters) {
    for (let p = ch.startPage; p <= ch.pages; p++) {
      seq.push({
        chapterId: ch.id,
        chapterTitle: ch.title,
        unit: ch.unitId,
        unitName: ch.unitName,
        pageNum: p,
        color: ch.color,
        bookPageStart: ch.bookPageStart,
        chapterTotalPages: ch.chapterTotalPages,
      })
    }
  }
  return seq
}

export interface GeneratedSchedule {
  schedule: StudyDay[]
  warnings: string[]
}

/**
 * Mode-agnostic schedule generator.
 *
 * The caller is responsible for resolving the actual pagesPerDay and endDate
 * (via computePlanParams in plan-engine.ts). This function simply generates
 * day-by-day from startDate:
 *   - Past days (< today): use dailyLog if present, else assume plan.pagesPerDay
 *   - Future days (>= today): use resolvedPagesPerDay
 *   - Stops when chapters finish OR when resolvedEndDate is reached
 */
export function generateSchedule(
  plan: StudyPlan,
  chapters: Chapter[],
  today: string,
  resolvedPagesPerDay: number,
  resolvedEndDate: string | null,
): GeneratedSchedule {
  const warnings: string[] = []
  const activeDays = plan.studyDays.length > 0 ? plan.studyDays : DEFAULT_STUDY_DAYS
  const pageSequence = buildPageSequence(plan, chapters)

  const days: StudyDay[] = []
  let pageIdx = 0
  let dayNum = 1
  const cursor = new Date(plan.startDate + "T00:00:00")
  cursor.setHours(0, 0, 0, 0)

  let walked = 0
  while (pageIdx < pageSequence.length && walked < MAX_CALENDAR_DAYS) {
    const dateStr = localDateString(cursor)
    const dow = cursor.getDay()

    // Enforce end-date wall before emitting any study day.
    // This prevents emitting a day when the start date itself is already
    // past the deadline.
    if (resolvedEndDate && dateStr > resolvedEndDate) {
      const remaining = pageSequence.length - pageIdx
      if (remaining > 0) {
        warnings.push(
          `Deadline reached with ${remaining} pages unfinished. Extend deadline or increase pace.`
        )
      }
      break
    }

    if (activeDays.includes(dow) && !plan.skippedDays.includes(dateStr)) {
      // QUEUE RULE:
      //   - Logged days: use actual pagesRead — pointer advances by exactly that many.
      //   - Unlogged past days: show planned pages for display, but pointer does NOT advance.
      //   - Future days (>= today): use the resolved pace for both display and advancement.
      //   - The queue is fixed. Pages only move forward as the pointer advances.
      let effectiveSliceSize: number
      let plannedSliceSize: number
      if (dateStr in plan.dailyLog) {
        // Logged past day: both display and advancement use actual pagesRead
        effectiveSliceSize = Math.max(0, Math.floor(plan.dailyLog[dateStr].pagesRead))
        plannedSliceSize = effectiveSliceSize
      } else if (dateStr >= today) {
        // Future day: both display and advancement use the resolved pace
        effectiveSliceSize = Math.max(1, resolvedPagesPerDay)
        plannedSliceSize = effectiveSliceSize
      } else {
        // Past day without a log: show planned chapters for display continuity,
        // but pointer stays put — nothing was actually consumed.
        effectiveSliceSize = 0
        plannedSliceSize = Math.max(1, resolvedPagesPerDay)
      }

      const dayPages = pageSequence.slice(pageIdx, pageIdx + plannedSliceSize)

      // Map preserves insertion order — critical for non-sequential chapter orders
      // (a Record with numeric keys would sort by key, not by study order).
      const chapterMap = new Map<
        number,
        PageEntry & {
          pagesStart: number
          pagesEnd: number
          pagesCount: number
          bookPageStart?: number
          bookPageEnd?: number
          chapterTotalPages?: number
          chapterBookStart?: number
          chapterBookEnd?: number
        }
      >()
      for (const page of dayPages) {
        const entry = chapterMap.get(page.chapterId)
        // v2.4.5 (root cause fix): always derive a numeric book page for each
        // individual page. When the chapter has no `bookPageStart` (e.g. a
        // front-matter / unnumbered chapter), the queue page number IS the
        // book page. Previously these stayed `undefined`, forcing every
        // consumer to fallback via `?? pagesStart`/`?? pagesEnd` and masking
        // the bug at the engine level. Also fixed: `bps ?` treated `0` as
        // missing; now uses `bps !== undefined`.
        const bps = page.bookPageStart
        const ctp = page.chapterTotalPages
        const thisBookPage = bps !== undefined ? bps + page.pageNum - 1 : page.pageNum
        if (!entry) {
          chapterMap.set(page.chapterId, {
            ...page,
            pagesStart: page.pageNum,
            pagesEnd: page.pageNum,
            pagesCount: 1,
            bookPageStart: thisBookPage,
            bookPageEnd: thisBookPage,
            chapterBookStart: bps,
            chapterBookEnd: bps !== undefined && ctp !== undefined ? bps + ctp - 1 : undefined,
          })
        } else {
          entry.pagesEnd = page.pageNum
          entry.pagesCount++
          // Always update bookPageEnd to the latest page's book position
          // (even if the new page's bps differs from the first page's bps,
          // the queue page number drives the offset within the chapter).
          entry.bookPageEnd = thisBookPage
        }
      }

      days.push({
        date: dateStr,
        dayNumber: dayNum,
        chapters: Array.from(chapterMap.values()).map((c) => ({
          chapterId: c.chapterId,
          chapterTitle: c.chapterTitle,
          unit: c.unit,
          unitName: c.unitName,
          pagesStart: c.pagesStart,
          pagesEnd: c.pagesEnd,
          pagesCount: c.pagesCount,
          color: c.color,
          bookPageStart: c.bookPageStart,
          bookPageEnd: c.bookPageEnd,
          chapterTotalPages: c.chapterTotalPages,
          chapterBookStart: c.chapterBookStart,
          chapterBookEnd: c.chapterBookEnd,
        })),
        totalPages: dayPages.length,
      })

      pageIdx += effectiveSliceSize
      dayNum++
    }

    cursor.setDate(cursor.getDate() + 1)
    walked++
  }

  if (walked >= MAX_CALENDAR_DAYS && pageIdx < pageSequence.length) {
    warnings.push("Schedule generation hit the maximum calendar day limit.")
  }

  return { schedule: days, warnings }
}

/**
 * Count study days between two dates (inclusive).
 */
export function countStudyDays(
  fromDate: string,
  toDate: string,
  studyDaysOfWeek: number[],
  skippedDays: string[] = [],
): number {
  const s = new Date(fromDate + "T00:00:00")
  const e = new Date(toDate + "T00:00:00")
  if (e < s) return 0
  let count = 0
  const curr = new Date(s)
  const skipSet = new Set(skippedDays)
  while (curr <= e) {
    const dateStr = localDateString(curr)
    if (!skipSet.has(dateStr) && studyDaysOfWeek.includes(curr.getDay())) {
      count++
    }
    curr.setDate(curr.getDate() + 1)
  }
  return count
}

/**
 * Return the YYYY-MM-DD of the Nth study day starting from fromDate.
 */
export function nthStudyDay(
  fromDate: string,
  n: number,
  studyDaysOfWeek: number[],
  skippedDays: string[] = [],
): string | null {
  if (n <= 0) return null
  const s = new Date(fromDate + "T00:00:00")
  const curr = new Date(s)
  let count = 0
  const skipSet = new Set(skippedDays)
  for (let i = 0; i < MAX_CALENDAR_DAYS; i++) {
    const dateStr = localDateString(curr)
    if (!skipSet.has(dateStr) && studyDaysOfWeek.includes(curr.getDay())) {
      count++
      if (count === n) return dateStr
    }
    curr.setDate(curr.getDate() + 1)
  }
  return null
}

export function getDayStartBookPage(
  schedule: StudyDay[],
  targetDayNumber: number,
  dailyLog: Record<string, { pagesRead: number }>,
  startingChapterId: number,
  chapterStartOverrides: Record<number, number>,
  chapters: Chapter[] = []
): number {
  const ranges = getChapterPageRanges(chapters)
  const startChapterRange = ranges.find((r) => r.id === startingChapterId)
  const planBookStart =
    startChapterRange
      ? startChapterRange.bookStart + (chapterStartOverrides[startingChapterId] ?? 1) - 1
      : 1

  let pagesConsumed = 0
  for (const day of schedule) {
    if (day.dayNumber >= targetDayNumber) break
    const log = dailyLog[day.date]
    pagesConsumed += log ? log.pagesRead : day.totalPages
  }

  return planBookStart + pagesConsumed
}

export function getChapterPageRanges(chapters: Chapter[] = []): { id: number; bookStart: number; bookEnd: number }[] {
  let cursor = 1
  return chapters.map((ch) => {
    const range = { id: ch.id, bookStart: cursor, bookEnd: cursor + ch.pages - 1 }
    cursor += ch.pages
    return range
  })
}

export function getTotalPages(chapterStartOverrides: Record<number, number>, startingChapterId = 1, chapters: Chapter[] = []): number {
  const startIdx = chapters.findIndex((ch) => ch.id === startingChapterId)
  if (startIdx < 0) return 0
  return chapters.slice(startIdx).reduce((sum, ch) => {
    const start = chapterStartOverrides[ch.id] ?? 1
    return sum + Math.max(0, ch.pages - (start - 1))
  }, 0)
}

/**
 * Derive the required pagesPerDay to finish remaining work between
 * fromDate (defaults to startDate) and targetEndDate, respecting studyDays
 * and excluding skippedDays.
 * Returns null if the targetEndDate is invalid or before fromDate.
 */
export function derivePagesPerDay(
  startDate: string,
  targetEndDate: string,
  studyDays: number[],
  remainingItems: number,
  fromDate?: string,
  skippedDays: string[] = [],
): number | null {
  const effectiveStart = fromDate && fromDate > startDate ? fromDate : startDate
  const s = new Date(effectiveStart + "T00:00:00")
  const e = new Date(targetEndDate + "T00:00:00")
  if (e < s) return null
  let studyDayCount = 0
  const curr = new Date(s)
  const skipSet = new Set(skippedDays)
  while (curr <= e) {
    const dateStr = localDateString(curr)
    if (!skipSet.has(dateStr) && studyDays.includes(curr.getDay())) {
      studyDayCount++
    }
    curr.setDate(curr.getDate() + 1)
  }
  if (studyDayCount <= 0) return null
  return Math.max(1, Math.ceil(remainingItems / studyDayCount))
}

export function derivePagesPerDayFromCount(
  targetDayCount: number,
  remainingItems: number,
): number | null {
  if (targetDayCount <= 0) return null
  return Math.max(1, Math.ceil(remainingItems / targetDayCount))
}

export function resolveBookPage(bookPage: number, chapters: Chapter[] = []): {
  chapterId: number
  pageWithinChapter: number
  bookStart: number
  bookEnd: number
} | null {
  const ranges = getChapterPageRanges(chapters)
  const totalPages = chapters.reduce((s, c) => s + c.pages, 0)
  const clamped = Math.min(Math.max(1, bookPage), totalPages)
  const range = ranges.find((r) => clamped >= r.bookStart && clamped <= r.bookEnd)
  if (!range) return null
  return {
    chapterId: range.id,
    pageWithinChapter: clamped - range.bookStart + 1,
    bookStart: range.bookStart,
    bookEnd: range.bookEnd,
  }
}

/**
 * Walks the calendar from startDate and returns the YYYY-MM-DD of the Nth
 * study day. Used for migrating legacy day-number-keyed plan data.
 */
export function dayNumberToDate(
  startDate: string,
  studyDays: number[],
  targetDayNumber: number
): string | null {
  if (targetDayNumber < 1) return null
  const active = studyDays.length > 0 ? studyDays : DEFAULT_STUDY_DAYS
  const cursor = new Date(startDate + "T00:00:00")
  cursor.setHours(0, 0, 0, 0)
  let dayNum = 0
  for (let i = 0; i < MAX_CALENDAR_DAYS; i++) {
    if (active.includes(cursor.getDay())) {
      dayNum++
      if (dayNum === targetDayNumber) return localDateString(cursor)
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return null
}

/**
 * Merge any number of per-course schedules into a single calendar where
 * each day carries chapters from every contributing course, tagged with
 * `courseLabel` / `courseId`, and `groups` retains a per-course slice.
 */
export function mergeSchedules(
  items: Array<{ schedule: StudyDay[]; label: string; courseId?: string }>,
): StudyDay[] {
  const map = new Map<string, StudyDay>()

  function insert(sched: StudyDay[], label: string, courseId?: string) {
    for (const day of sched) {
      const tagged = day.chapters.map((ch) => ({ ...ch, courseLabel: label, courseId }))
      const group: StudyDayGroup = {
        label,
        dayNumber: day.dayNumber,
        totalPages: day.totalPages,
        chapters: tagged,
      }
      const existing = map.get(day.date)
      if (existing) {
        // groups is always initialised in the else branch below, so this is always defined.
        ; (existing.groups ??= []).push(group)
        existing.chapters.push(...tagged)
        existing.totalPages += day.totalPages
        existing.dayNumber = Math.max(existing.dayNumber, day.dayNumber)
      } else {
        map.set(day.date, {
          ...day,
          // Use a spread copy so existing.chapters and groups[0].chapters are
          // independent arrays — pushing to one must not mutate the other.
          chapters: [...tagged],
          groups: [group],
        })
      }
    }
  }

  for (const item of items) {
    insert(item.schedule, item.label, item.courseId)
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Tag every chapter in a schedule with the given courseId + label.
 * Used to make single-course (baseSchedule) view chapters match the shape
 * of multi-course (mergedSchedule) view chapters, so downstream code
 * (plansLoggedForDate, LogDialog, ScheduleList) can rely on a non-null
 * courseId without conditional logic.
 *
 * Mirrors the tagging that mergeSchedules does internally (line 471).
 * Returns a new schedule — does not mutate the input.
 */
export function tagChaptersWithCourseId(
  schedule: StudyDay[],
  courseId: string | undefined,
  label: string,
): StudyDay[] {
  return schedule.map((day) => ({
    ...day,
    chapters: day.chapters.map((ch) => ({
      ...ch,
      courseId,
      courseLabel: label,
    })),
  }))
}

/**
 * Dedupe a schedule by date, with chapter-level dedup by chapterId within
 * each day. Use this after `flatMap`-ing per-plan schedules for the same
 * course: multiple active plans for the same course would otherwise produce
 * duplicate `StudyDay` rows for the same calendar date, and even within a
 * single day the same `chapterId` could appear twice (one per plan).
 *
 * Root-cause fix for v2.4.5: replaces the v2.4.4 ad-hoc dedup in App.tsx
 * with a centralized, tested helper. Used by `baseSchedule` and
 * `otherCoursesInfo` so both single-course and multi-course views share
 * the same dedup semantics.
 *
 * - First occurrence of a date wins (preserves the first plan's dayNumber).
 * - Within a date, the first occurrence of each `chapterId` wins.
 * - Returns a new schedule; does not mutate the input.
 * - Output is sorted by `date` ascending.
 */
export function dedupeScheduleByDate(schedule: StudyDay[]): StudyDay[] {
  const byDate = new Map<string, StudyDay>()
  for (const d of schedule) {
    const existing = byDate.get(d.date)
    if (!existing) {
      byDate.set(d.date, { ...d, chapters: [...d.chapters] })
      continue
    }
    const seenChapterIds = new Set(existing.chapters.map((c) => c.chapterId))
    for (const ch of d.chapters) {
      if (seenChapterIds.has(ch.chapterId)) continue
      existing.chapters.push(ch)
      seenChapterIds.add(ch.chapterId)
    }
    // Keep the earlier dayNumber (first plan to register this date).
    if (d.dayNumber < existing.dayNumber) existing.dayNumber = d.dayNumber
    // totalPages is the sum of the deduped chapters' pagesCount, not the
    // raw totalPages from the second plan (which would double-count).
    existing.totalPages = existing.chapters.reduce((s, c) => s + c.pagesCount, 0)
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}
