export interface CourseChapter {
  id: number
  title: string
  pages: number
  /** Actual starting page number in the physical book (if known). */
  bookPageStart?: number
}

export interface CourseUnit {
  id: number
  title: string
  color: string
  weight?: number
  chapters: CourseChapter[]
}

export interface CourseExamInfo {
  format?: string
  duration?: string
  passingScore?: string
  domainsLabel?: string
  experienceReq?: string
}

export interface CourseStudyEstimate {
  minutesPerPage: [number, number]
}

export interface CourseDefaultSettings {
  pagesPerDay: number
  studyDays: number[]
  startingChapterId: number
}

export type TrackingMode = "pages" | "labs" | "machines"

export interface CourseConfig {
  id: string
  name: string
  subtitle?: string
  logo?: string
  edition?: string
  publisher?: string
  totalPages?: number
  studyPages?: number
  examInfo?: CourseExamInfo
  studyEstimate?: CourseStudyEstimate
  units: CourseUnit[]
  defaultSettings: CourseDefaultSettings
  /** How this course tracks progress: pages (default), labs, or machines. */
  trackingMode?: TrackingMode
}

export function getTrackingLabels(mode: TrackingMode = "pages") {
  if (mode === "labs") {
    return {
      item: "lab",
      items: "labs",
      itemCapital: "Lab",
      itemsCapital: "Labs",
      perDay: "Labs/Day",
      totalItems: "Total Labs",
      studyItems: "Labs Remaining",
      pagesRead: "labs done",
      pagesReadShort: "done",
      logLabel: "Labs completed",
      paceLabel: "labs/day",
      bookPages: "Total Labs",
      dailyTarget: "Daily target",
      logPlaceholder: "Labs done today",
    } as const
  }
  if (mode === "machines") {
    return {
      item: "machine",
      items: "machines",
      itemCapital: "Machine",
      itemsCapital: "Machines",
      perDay: "Machines/Day",
      totalItems: "Target Machines",
      studyItems: "Machines Remaining",
      pagesRead: "boxes owned",
      pagesReadShort: "owned",
      logLabel: "Boxes owned",
      paceLabel: "machines/day",
      bookPages: "Target Machines",
      dailyTarget: "Daily target",
      logPlaceholder: "Boxes owned today",
    } as const
  }
  return {
    item: "page",
    items: "pages",
    itemCapital: "Page",
    itemsCapital: "Pages",
    perDay: "Pages/Day",
    totalItems: "Book Pages",
    studyItems: "Study Pages",
    pagesRead: "pages read",
    pagesReadShort: "read",
    logLabel: "Pages read",
    paceLabel: "pages/day",
    bookPages: "Book Pages",
    dailyTarget: "Daily target",
    logPlaceholder: "Pages read today",
  } as const
}

// Flattened chapter used by the schedule engine
export interface Chapter {
  id: number
  unitId: number
  title: string
  pages: number
  color: string
  unitName: string
  bookPageStart?: number
}

export function flattenCourse(config: CourseConfig): Chapter[] {
  const chapters: Chapter[] = []
  for (const unit of config.units) {
    for (const ch of unit.chapters) {
      chapters.push({
        id: ch.id,
        unitId: unit.id,
        title: ch.title,
        pages: ch.pages,
        color: unit.color,
        unitName: unit.title,
        bookPageStart: ch.bookPageStart,
      })
    }
  }
  return chapters
}

export function getUnitMap(config: CourseConfig): Record<number, CourseUnit> {
  const map: Record<number, CourseUnit> = {}
  for (const unit of config.units) {
    map[unit.id] = unit
  }
  return map
}

export function getChapterMap(config: CourseConfig): Record<number, Chapter> {
  const map: Record<number, Chapter> = {}
  for (const ch of flattenCourse(config)) {
    map[ch.id] = ch
  }
  return map
}

export function getUnitColors(config: CourseConfig): Record<number, string> {
  const map: Record<number, string> = {}
  for (const unit of config.units) {
    map[unit.id] = unit.color
  }
  return map
}

export function getUnitNames(config: CourseConfig): Record<number, string> {
  const map: Record<number, string> = {}
  for (const unit of config.units) {
    map[unit.id] = unit.title
  }
  return map
}

export function getUnitWeights(config: CourseConfig): Record<number, number> {
  const map: Record<number, number> = {}
  for (const unit of config.units) {
    map[unit.id] = unit.weight ?? 0
  }
  return map
}

export function computeTotalPages(config: CourseConfig): number {
  return flattenCourse(config).reduce((s, c) => s + c.pages, 0)
}
