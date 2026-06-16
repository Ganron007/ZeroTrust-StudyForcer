// Pure helper functions extracted from src/components/CourseBuilder.tsx
// so they can be unit-tested in isolation. All functions here are
// side-effect-free.

import type { CourseConfig, CourseUnit, CourseChapter } from "@/types/course"

/**
 * Sanitize a user-typed course ID: lowercase + strip everything that's
 * not a-z, 0-9, or hyphen. Examples:
 *   "Atomic Habits" → "atomic-habits"
 *   "OSCP_2024"     → "oscp-2024"
 *   "  bad!@# "     → "-bad--"
 */
export function validateId(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9-]/g, "")
}

/**
 * Reserved seed course IDs that cannot be overwritten via the builder.
 * Currently just `cissp-10th-ed` — the built-in CISSP course.
 */
export const RESERVED_IDS: readonly string[] = ["cissp-10th-ed"]

/**
 * Compute the next chapter ID given the current set of chapters.
 * Returns 1 if no chapters exist.
 */
export function getNextChapterId(
  units: Array<{ chapters: Array<{ id: number }> }>,
): number {
  const allIds = units.flatMap((u) => u.chapters.map((c) => c.id))
  return allIds.length > 0 ? Math.max(...allIds) + 1 : 1
}

/**
 * Compute the next unit ID given the current set of units.
 * Returns 1 if no units exist.
 */
export function getNextUnitId(units: Array<{ id: number }>): number {
  return units.length > 0 ? Math.max(...units.map((u) => u.id)) + 1 : 1
}

/**
 * Internal: cast a chapter-state "pages" field to a positive integer.
 * Falls back to 1 on NaN, 0, or negative.
 */
export function clampPages(value: string | number): number {
  const n = typeof value === "number" ? value : Number(value)
  return Math.max(1, isNaN(n) ? 1 : n)
}

/**
 * Internal: cast a chapter-state "id" field to a positive integer.
 * Falls back to 1 on NaN, 0, or negative.
 */
export function clampId(value: string | number): number {
  const n = typeof value === "number" ? value : Number(value)
  return Math.max(1, isNaN(n) ? 1 : n)
}

/**
 * Internal: cast a chapter-state "bookPageStart" field to a positive
 * integer or undefined. Empty string, NaN, or < 1 → undefined.
 */
export function clampBookPageStart(value: string): number | undefined {
  if (value === "") return undefined
  const n = parseInt(value, 10)
  if (isNaN(n) || n < 1) return undefined
  return n
}

/**
 * Check whether a chapter-state field name maps to a numeric or
 * bookPageStart editor — used to know whether to apply clamping.
 */
export function isNumericField(
  field: string,
): field is "pages" | "id" | "bookPageStart" {
  return field === "pages" || field === "id" || field === "bookPageStart"
}

/**
 * Apply a typed value to a chapter field, returning a new chapter
 * with the field updated. Centralizes the clamping rules so tests
 * don't have to mock the JSX onChange handler.
 */
export function applyChapterFieldChange<
  T extends { id: number; title: string; pages: number; bookPageStart: number | undefined },
>(chapter: T, field: keyof T, rawValue: string): T {
  if (field === "pages") return { ...chapter, pages: clampPages(rawValue) }
  if (field === "id") return { ...chapter, id: clampId(rawValue) }
  if (field === "bookPageStart") {
    return { ...chapter, bookPageStart: clampBookPageStart(rawValue) }
  }
  // For non-numeric fields (title), pass through
  return { ...chapter, [field]: rawValue } as T
}

/**
 * Toggle a day-of-week in a sorted list. If the day is already
 * present, remove it (unless it's the only one remaining). If not
 * present, add it and re-sort ascending.
 */
export function toggleStudyDay(days: number[], dow: number): number[] {
  if (days.includes(dow)) {
    if (days.length <= 1) return days
    return days.filter((d) => d !== dow)
  }
  return [...days, dow].sort((a, b) => a - b)
}

/**
 * Build a CourseConfig from the builder's UI state. This is the
 * single source of truth for what gets saved to disk.
 *
 * The `pages` field is clamped to >= 1; the `id` field is sanitized
 * via validateId. Empty unit/chapter titles fall back to a default
 * (`Unit ${id}` / `Chapter ${id}`).
 */
export interface BuilderUnit {
  id: number
  title: string
  color: string
  chapters: BuilderChapter[]
}

export interface BuilderChapter {
  id: number
  title: string
  pages: number
  bookPageStart: number | undefined
}

export interface BuilderExamInfo {
  examFormat: string
  examDuration: string
  examPassing: string
  examDomains: string
  examExperience: string
}

export interface BuilderStudyEstimate {
  estMin: number
  estMax: number
}

export interface BuilderInput {
  courseId: string
  courseName: string
  subtitle: string
  edition: string
  publisher: string
  units: BuilderUnit[]
  studyDays: number[]
  defaultPagesPerDay: number
  defaultStartingChapter: number
  exam: BuilderExamInfo
  estimate: BuilderStudyEstimate
}

export function buildCourseConfig(input: BuilderInput): CourseConfig {
  let totalPages = 0
  const configUnits: CourseUnit[] = input.units.map((unit) => {
    const chapters: CourseChapter[] = unit.chapters.map((ch) => {
      totalPages += ch.pages
      const chapter: CourseChapter = {
        id: ch.id,
        title: ch.title || `Chapter ${ch.id}`,
        pages: ch.pages,
      }
      if (ch.bookPageStart) chapter.bookPageStart = ch.bookPageStart
      return chapter
    })
    return {
      id: unit.id,
      title: unit.title || `Unit ${unit.id}`,
      color: unit.color,
      chapters,
    }
  })

  const { examFormat, examDuration, examPassing, examDomains, examExperience } = input.exam
  const hasExamInfo = examFormat || examDuration || examPassing || examDomains || examExperience

  const { estMin, estMax } = input.estimate

  return {
    id: validateId(input.courseId),
    name: input.courseName || "Untitled Course",
    ...(input.subtitle && { subtitle: input.subtitle }),
    ...(input.edition && { edition: input.edition }),
    ...(input.publisher && { publisher: input.publisher }),
    totalPages,
    studyPages: totalPages,
    ...(hasExamInfo && {
      examInfo: {
        ...(examFormat && { format: examFormat }),
        ...(examDuration && { duration: examDuration }),
        ...(examPassing && { passingScore: examPassing }),
        ...(examDomains && { domainsLabel: examDomains }),
        ...(examExperience && { experienceReq: examExperience }),
      },
    }),
    ...((estMin !== 3 || estMax !== 5) && {
      studyEstimate: { minutesPerPage: [estMin, estMax] as [number, number] },
    }),
    units: configUnits,
    defaultSettings: {
      pagesPerDay: input.defaultPagesPerDay,
      studyDays: [...input.studyDays],
      startingChapterId: input.defaultStartingChapter,
    },
    trackingMode: "pages",
  }
}

/**
 * Validate a CourseConfig and return a list of human-readable error
 * messages. An empty array means the config is valid.
 */
export function validateCourseConfig(config: CourseConfig): string[] {
  const errors: string[] = []
  if (!config.id) errors.push("Course ID is required")
  if (!config.name) errors.push("Course name is required")
  if (config.units.length === 0) errors.push("At least one unit is required")
  config.units.forEach((u, i) => {
    if (!u.title) errors.push(`Unit ${i + 1} needs a name`)
    if (u.chapters.length === 0) errors.push(`Unit ${i + 1} needs at least one chapter`)
    u.chapters.forEach((c, j) => {
      if (!c.title) errors.push(`Unit ${i + 1}, Chapter ${j + 1} needs a title`)
    })
  })
  return errors
}
