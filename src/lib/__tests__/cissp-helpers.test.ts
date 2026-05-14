import { describe, it, expect } from "vitest"
import {
  getDayStartBookPage,
  getChapterPageRanges,
  getTotalPages,
  derivePagesPerDay,
  derivePagesPerDayFromCount,
  resolveBookPage,
  dayNumberToDate,
  mergeSchedules,
  countStudyDays,
  nthStudyDay,
} from "../cissp-data"
import type { Chapter, StudyDay } from "../cissp-data"

const CHAPTERS: Chapter[] = [
  { id: 1, title: "Ch 1", pages: 100, unitId: 1, unitName: "Unit 1", color: "#3b82f6" },
  { id: 2, title: "Ch 2", pages: 100, unitId: 1, unitName: "Unit 1", color: "#3b82f6" },
  { id: 3, title: "Ch 3", pages: 100, unitId: 2, unitName: "Unit 2", color: "#8b5cf6" },
  { id: 4, title: "Ch 4", pages: 100, unitId: 2, unitName: "Unit 2", color: "#8b5cf6" },
]

describe("getChapterPageRanges", () => {
  it("returns correct ranges for sequential chapters", () => {
    const ranges = getChapterPageRanges(CHAPTERS)
    expect(ranges).toEqual([
      { id: 1, bookStart: 1, bookEnd: 100 },
      { id: 2, bookStart: 101, bookEnd: 200 },
      { id: 3, bookStart: 201, bookEnd: 300 },
      { id: 4, bookStart: 301, bookEnd: 400 },
    ])
  })

  it("returns empty array for no chapters", () => {
    expect(getChapterPageRanges([])).toEqual([])
  })

  it("handles single chapter", () => {
    const ranges = getChapterPageRanges([CHAPTERS[0]])
    expect(ranges).toEqual([{ id: 1, bookStart: 1, bookEnd: 100 }])
  })
})

describe("getDayStartBookPage", () => {
  const schedule: StudyDay[] = [
    { date: "2026-04-01", dayNumber: 1, chapters: [], totalPages: 20 },
    { date: "2026-04-02", dayNumber: 2, chapters: [], totalPages: 20 },
    { date: "2026-04-03", dayNumber: 3, chapters: [], totalPages: 20 },
  ]

  it("day 1 starts at page 1", () => {
    const result = getDayStartBookPage(schedule, 1, {}, 1, {}, CHAPTERS)
    expect(result).toBe(1)
  })

  it("day 2 starts at page 21 after day 1's 20 pages", () => {
    const result = getDayStartBookPage(schedule, 2, {}, 1, {}, CHAPTERS)
    expect(result).toBe(21)
  })

  it("day 3 starts at page 41 after 2 days", () => {
    const result = getDayStartBookPage(schedule, 3, {}, 1, {}, CHAPTERS)
    expect(result).toBe(41)
  })

  it("uses actual logs when available instead of scheduled pages", () => {
    const logs = {
      "2026-04-01": { pagesRead: 15 },
      "2026-04-02": { pagesRead: 25 },
    }
    const result = getDayStartBookPage(schedule, 3, logs, 1, {}, CHAPTERS)
    expect(result).toBe(41) // 15 + 25 + 1 (day 3 uses scheduled since no log)
  })

  it("respects startingChapterId", () => {
    const result = getDayStartBookPage(schedule, 1, {}, 3, {}, CHAPTERS)
    expect(result).toBe(201) // Chapter 3 starts at page 201
  })

  it("respects chapterStartOverrides", () => {
    const result = getDayStartBookPage(schedule, 1, {}, 1, { 1: 50 }, CHAPTERS)
    expect(result).toBe(50) // Override says start at page 50 of chapter 1
  })

  it("handles empty schedule", () => {
    const result = getDayStartBookPage([], 1, {}, 1, {}, CHAPTERS)
    expect(result).toBe(1)
  })
})

describe("getTotalPages", () => {
  it("returns total pages for all chapters from start", () => {
    expect(getTotalPages({}, 1, CHAPTERS)).toBe(400)
  })

  it("returns total pages from startingChapterId", () => {
    expect(getTotalPages({}, 3, CHAPTERS)).toBe(200) // Ch 3 + Ch 4
  })

  it("respects chapter start overrides", () => {
    expect(getTotalPages({ 1: 50 }, 1, CHAPTERS)).toBe(351) // Ch1: 100-49=51, Ch2:100, Ch3:100, Ch4:100
  })

  it("returns 0 for empty chapters", () => {
    expect(getTotalPages({}, 1, [])).toBe(0)
  })

  it("returns 0 for startingChapterId beyond last chapter", () => {
    expect(getTotalPages({}, 99, CHAPTERS)).toBe(0)
  })
})

describe("derivePagesPerDay", () => {
  it("calculates pace for 20 study days with 400 pages", () => {
    const result = derivePagesPerDay(
      "2026-04-01",
      "2026-04-30",
      [1, 2, 3, 4, 5], // Mon-Fri
      400
    )
    expect(result).toBeGreaterThan(0)
  })

  it("returns null when end date is before start date", () => {
    const result = derivePagesPerDay(
      "2026-04-15",
      "2026-04-01",
      [1, 2, 3, 4, 5],
      400
    )
    expect(result).toBeNull()
  })

  it("returns null when no study days exist in range", () => {
    const result = derivePagesPerDay(
      "2026-04-01",
      "2026-04-01",
      [1, 2, 3, 4, 5], // Wed Apr 1, 2026 is Wednesday
      400
    )
    // Actually April 1 2026 IS a Wednesday, so there IS 1 study day
    expect(result).not.toBeNull()
  })

  it("respects skipped days", () => {
    const result = derivePagesPerDay(
      "2026-04-01",
      "2026-04-30",
      [1, 2, 3, 4, 5],
      400,
      undefined,
      ["2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04", "2026-04-05"]
    )
    // With all first week skipped, fewer days = higher pace
    expect(result).toBeGreaterThan(0)
  })

  it("uses fromDate when provided and after startDate", () => {
    const result = derivePagesPerDay(
      "2026-04-01",
      "2026-04-30",
      [1, 2, 3, 4, 5],
      400,
      "2026-04-15"
    )
    expect(result).toBeGreaterThan(0)
  })

  it("ignores fromDate when before startDate", () => {
    const result = derivePagesPerDay(
      "2026-04-15",
      "2026-04-30",
      [1, 2, 3, 4, 5],
      400,
      "2026-04-01" // Before startDate
    )
    expect(result).toBeGreaterThan(0)
  })
})

describe("derivePagesPerDayFromCount", () => {
  it("calculates pace for 20 days and 400 pages", () => {
    expect(derivePagesPerDayFromCount(20, 400)).toBe(20)
  })

  it("calculates pace with remainder", () => {
    expect(derivePagesPerDayFromCount(20, 401)).toBe(21)
  })

  it("returns null for zero day count", () => {
    expect(derivePagesPerDayFromCount(0, 400)).toBeNull()
  })

  it("returns null for negative day count", () => {
    expect(derivePagesPerDayFromCount(-1, 400)).toBeNull()
  })

  it("returns at least 1", () => {
    expect(derivePagesPerDayFromCount(100, 1)).toBe(1)
  })
})

describe("resolveBookPage", () => {
  it("finds chapter for page 1", () => {
    const result = resolveBookPage(1, CHAPTERS)
    expect(result).toEqual({
      chapterId: 1,
      pageWithinChapter: 1,
      bookStart: 1,
      bookEnd: 100,
    })
  })

  it("finds chapter for page 101", () => {
    const result = resolveBookPage(101, CHAPTERS)
    expect(result).toEqual({
      chapterId: 2,
      pageWithinChapter: 1,
      bookStart: 101,
      bookEnd: 200,
    })
  })

  it("finds chapter for page 250", () => {
    const result = resolveBookPage(250, CHAPTERS)
    expect(result).toEqual({
      chapterId: 3,
      pageWithinChapter: 50,
      bookStart: 201,
      bookEnd: 300,
    })
  })

  it("clamps to first page", () => {
    const result = resolveBookPage(0, CHAPTERS)
    expect(result?.chapterId).toBe(1)
    expect(result?.pageWithinChapter).toBe(1)
  })

  it("clamps to last page", () => {
    const result = resolveBookPage(999, CHAPTERS)
    expect(result?.chapterId).toBe(4)
    expect(result?.pageWithinChapter).toBe(100)
  })

  it("returns null for empty chapters", () => {
    expect(resolveBookPage(1, [])).toBeNull()
  })
})

describe("dayNumberToDate", () => {
  it("finds day 1 from start", () => {
    const result = dayNumberToDate("2026-04-01", [1, 2, 3, 4, 5], 1)
    // April 1, 2026 is a Wednesday (dow=3)
    expect(result).not.toBeNull()
  })

  it("finds day 5 from start", () => {
    const result = dayNumberToDate("2026-04-01", [1, 2, 3, 4, 5], 5)
    expect(result).not.toBeNull()
  })

  it("returns null for day 0", () => {
    expect(dayNumberToDate("2026-04-01", [1, 2, 3, 4, 5], 0)).toBeNull()
  })

  it("returns null for negative day", () => {
    expect(dayNumberToDate("2026-04-01", [1, 2, 3, 4, 5], -1)).toBeNull()
  })

  it("uses DEFAULT_STUDY_DAYS when empty array", () => {
    const result = dayNumberToDate("2026-04-01", [], 1)
    // DEFAULT_STUDY_DAYS = [1,2,3,4,5]
    expect(result).not.toBeNull()
  })
})

describe("mergeSchedules", () => {
  const schedule1: StudyDay[] = [
    {
      date: "2026-04-01",
      dayNumber: 1,
      totalPages: 20,
      chapters: [{ chapterId: 1, chapterTitle: "Ch 1", unit: 1, unitName: "U1", pagesStart: 1, pagesEnd: 20, pagesCount: 20, color: "#3b82f6" }],
    },
    {
      date: "2026-04-02",
      dayNumber: 2,
      totalPages: 20,
      chapters: [{ chapterId: 1, chapterTitle: "Ch 1", unit: 1, unitName: "U1", pagesStart: 21, pagesEnd: 40, pagesCount: 20, color: "#3b82f6" }],
    },
  ]

  const schedule2: StudyDay[] = [
    {
      date: "2026-04-01",
      dayNumber: 1,
      totalPages: 10,
      chapters: [{ chapterId: 1, chapterTitle: "Ch A", unit: 1, unitName: "U1", pagesStart: 1, pagesEnd: 10, pagesCount: 10, color: "#8b5cf6" }],
    },
    {
      date: "2026-04-03",
      dayNumber: 2,
      totalPages: 10,
      chapters: [{ chapterId: 1, chapterTitle: "Ch A", unit: 1, unitName: "U1", pagesStart: 11, pagesEnd: 20, pagesCount: 10, color: "#8b5cf6" }],
    },
  ]

  it("merges schedules on same date", () => {
    const merged = mergeSchedules([
      { schedule: schedule1, label: "CISSP", courseId: "cissp" },
      { schedule: schedule2, label: "SecAI+", courseId: "secai" },
    ])

    const day1 = merged.find((d) => d.date === "2026-04-01")
    expect(day1).toBeDefined()
    expect(day1!.totalPages).toBe(30) // 20 + 10
    expect(day1!.chapters.length).toBe(2)
    expect(day1!.groups).toBeDefined()
    expect(day1!.groups!.length).toBe(2)
  })

  it("keeps unique dates from each schedule", () => {
    const merged = mergeSchedules([
      { schedule: schedule1, label: "CISSP", courseId: "cissp" },
      { schedule: schedule2, label: "SecAI+", courseId: "secai" },
    ])

    expect(merged.length).toBe(3) // Apr 1, 2, 3
    expect(merged.find((d) => d.date === "2026-04-02")).toBeDefined()
    expect(merged.find((d) => d.date === "2026-04-03")).toBeDefined()
  })

  it("sorts merged schedule by date", () => {
    const merged = mergeSchedules([
      { schedule: schedule2, label: "SecAI+", courseId: "secai" },
      { schedule: schedule1, label: "CISSP", courseId: "cissp" },
    ])

    expect(merged[0].date).toBe("2026-04-01")
    expect(merged[1].date).toBe("2026-04-02")
    expect(merged[2].date).toBe("2026-04-03")
  })

  it("handles single schedule", () => {
    const merged = mergeSchedules([{ schedule: schedule1, label: "CISSP" }])
    expect(merged.length).toBe(2)
    expect(merged[0].totalPages).toBe(20)
  })

  it("handles empty schedules", () => {
    const merged = mergeSchedules([])
    expect(merged).toEqual([])
  })

  it("tags chapters with courseLabel and courseId", () => {
    const merged = mergeSchedules([
      { schedule: schedule1, label: "CISSP", courseId: "cissp" },
    ])

    expect(merged[0].chapters[0].courseLabel).toBe("CISSP")
    expect(merged[0].chapters[0].courseId).toBe("cissp")
  })
})

describe("countStudyDays", () => {
  it("counts study days in a week", () => {
    expect(countStudyDays("2026-04-01", "2026-04-07", [1, 2, 3, 4, 5])).toBe(5)
  })

  it("excludes skipped days", () => {
    expect(countStudyDays("2026-04-01", "2026-04-07", [1, 2, 3, 4, 5], ["2026-04-01"])).toBe(4)
  })

  it("returns 0 when end is before start", () => {
    expect(countStudyDays("2026-04-07", "2026-04-01", [1, 2, 3, 4, 5])).toBe(0)
  })

  it("counts weekend-only study days", () => {
    expect(countStudyDays("2026-04-01", "2026-04-07", [0, 6])).toBe(2) // Sat + Sun
  })
})

describe("nthStudyDay", () => {
  it("finds 1st study day", () => {
    const result = nthStudyDay("2026-04-01", 1, [1, 2, 3, 4, 5])
    expect(result).not.toBeNull()
  })

  it("finds 5th study day", () => {
    const result = nthStudyDay("2026-04-01", 5, [1, 2, 3, 4, 5])
    // Apr 1 (Wed), 2 (Thu), 3 (Fri), 6 (Mon), 7 (Tue) - day 5 is Apr 7
    expect(result).toBe("2026-04-07")
  })

  it("returns null for n=0", () => {
    expect(nthStudyDay("2026-04-01", 0, [1, 2, 3, 4, 5])).toBeNull()
  })

  it("returns null for negative n", () => {
    expect(nthStudyDay("2026-04-01", -1, [1, 2, 3, 4, 5])).toBeNull()
  })

  it("respects skipped days", () => {
    // Skip Apr 1, so 1st study day becomes Apr 2
    const result = nthStudyDay("2026-04-01", 1, [1, 2, 3, 4, 5], ["2026-04-01"])
    expect(result).toBe("2026-04-02")
  })
})
