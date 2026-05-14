import { describe, it, expect } from "vitest"
import type { CourseConfig } from "@/types/course"
import {
  getTrackingLabels,
  flattenCourse,
  getUnitMap,
  getChapterMap,
  getUnitColors,
  getUnitNames,
  getUnitWeights,
  computeTotalPages,
} from "@/types/course"

const TEST_COURSE: CourseConfig = {
  id: "cissp",
  name: "ISC2 CISSP",
  totalPages: 400,
  studyPages: 400,
  trackingMode: "pages",
  units: [
    {
      id: 1,
      title: "Unit 1",
      color: "#3b82f6",
      weight: 0.3,
      chapters: [
        { id: 1, title: "Ch 1", pages: 100 },
        { id: 2, title: "Ch 2", pages: 100 },
      ],
    },
    {
      id: 2,
      title: "Unit 2",
      color: "#8b5cf6",
      weight: 0.7,
      chapters: [
        { id: 3, title: "Ch 3", pages: 100 },
        { id: 4, title: "Ch 4", pages: 100 },
      ],
    },
  ],
  defaultSettings: { pagesPerDay: 20, studyDays: [1, 2, 3, 4, 5], startingChapterId: 1 },
}

describe("getTrackingLabels", () => {
  it("returns page labels for default mode", () => {
    const labels = getTrackingLabels("pages")
    expect(labels.item).toBe("page")
    expect(labels.items).toBe("pages")
    expect(labels.paceLabel).toBe("pages/day")
    expect(labels.totalItems).toBe("Book Pages")
    expect(labels.logPlaceholder).toBe("Pages read today")
  })

  it("returns lab labels for labs mode", () => {
    const labels = getTrackingLabels("labs")
    expect(labels.item).toBe("lab")
    expect(labels.items).toBe("labs")
    expect(labels.paceLabel).toBe("labs/day")
    expect(labels.totalItems).toBe("Total Labs")
    expect(labels.logPlaceholder).toBe("Labs done today")
  })

  it("returns machine labels for machines mode", () => {
    const labels = getTrackingLabels("machines")
    expect(labels.item).toBe("machine")
    expect(labels.items).toBe("machines")
    expect(labels.paceLabel).toBe("machines/day")
    expect(labels.totalItems).toBe("Target Machines")
    expect(labels.logPlaceholder).toBe("Boxes owned today")
  })

  it("defaults to pages when no mode specified", () => {
    const labels = getTrackingLabels()
    expect(labels.item).toBe("page")
    expect(labels.paceLabel).toBe("pages/day")
  })
})

describe("flattenCourse", () => {
  it("flattens all chapters with unit metadata", () => {
    const chapters = flattenCourse(TEST_COURSE)
    expect(chapters).toHaveLength(4)
    expect(chapters[0]).toEqual({
      id: 1,
      unitId: 1,
      title: "Ch 1",
      pages: 100,
      color: "#3b82f6",
      unitName: "Unit 1",
    })
    expect(chapters[2]).toEqual({
      id: 3,
      unitId: 2,
      title: "Ch 3",
      pages: 100,
      color: "#8b5cf6",
      unitName: "Unit 2",
    })
  })

  it("returns empty array for course with no units", () => {
    const emptyCourse: CourseConfig = {
      id: "empty",
      name: "Empty",
      units: [],
      defaultSettings: { pagesPerDay: 20, studyDays: [1, 2, 3, 4, 5], startingChapterId: 1 },
    }
    expect(flattenCourse(emptyCourse)).toEqual([])
  })

  it("returns empty array for course with units but no chapters", () => {
    const emptyCourse: CourseConfig = {
      id: "empty",
      name: "Empty",
      units: [{ id: 1, title: "U1", color: "#000", chapters: [] }],
      defaultSettings: { pagesPerDay: 20, studyDays: [1, 2, 3, 4, 5], startingChapterId: 1 },
    }
    expect(flattenCourse(emptyCourse)).toEqual([])
  })
})

describe("getUnitMap", () => {
  it("maps unit ids to unit objects", () => {
    const map = getUnitMap(TEST_COURSE)
    expect(map[1]).toBeDefined()
    expect(map[1].title).toBe("Unit 1")
    expect(map[2]).toBeDefined()
    expect(map[2].title).toBe("Unit 2")
  })

  it("returns empty map for no units", () => {
    const emptyCourse: CourseConfig = {
      id: "empty",
      name: "Empty",
      units: [],
      defaultSettings: { pagesPerDay: 20, studyDays: [1, 2, 3, 4, 5], startingChapterId: 1 },
    }
    expect(getUnitMap(emptyCourse)).toEqual({})
  })
})

describe("getChapterMap", () => {
  it("maps chapter ids to chapter objects", () => {
    const map = getChapterMap(TEST_COURSE)
    expect(map[1]).toBeDefined()
    expect(map[1].title).toBe("Ch 1")
    expect(map[4]).toBeDefined()
    expect(map[4].title).toBe("Ch 4")
  })

  it("returns empty map for no chapters", () => {
    const emptyCourse: CourseConfig = {
      id: "empty",
      name: "Empty",
      units: [],
      defaultSettings: { pagesPerDay: 20, studyDays: [1, 2, 3, 4, 5], startingChapterId: 1 },
    }
    expect(getChapterMap(emptyCourse)).toEqual({})
  })
})

describe("getUnitColors", () => {
  it("maps unit ids to colors", () => {
    const map = getUnitColors(TEST_COURSE)
    expect(map[1]).toBe("#3b82f6")
    expect(map[2]).toBe("#8b5cf6")
  })

  it("returns empty map for no units", () => {
    const emptyCourse: CourseConfig = {
      id: "empty",
      name: "Empty",
      units: [],
      defaultSettings: { pagesPerDay: 20, studyDays: [1, 2, 3, 4, 5], startingChapterId: 1 },
    }
    expect(getUnitColors(emptyCourse)).toEqual({})
  })
})

describe("getUnitNames", () => {
  it("maps unit ids to names", () => {
    const map = getUnitNames(TEST_COURSE)
    expect(map[1]).toBe("Unit 1")
    expect(map[2]).toBe("Unit 2")
  })
})

describe("getUnitWeights", () => {
  it("maps unit ids to weights", () => {
    const map = getUnitWeights(TEST_COURSE)
    expect(map[1]).toBe(0.3)
    expect(map[2]).toBe(0.7)
  })

  it("defaults to 0 when weight is undefined", () => {
    const course: CourseConfig = {
      ...TEST_COURSE,
      units: [
        { id: 1, title: "Unit 1", color: "#3b82f6", chapters: [] },
      ],
    }
    const map = getUnitWeights(course)
    expect(map[1]).toBe(0)
  })
})

describe("computeTotalPages", () => {
  it("sums all chapter pages", () => {
    expect(computeTotalPages(TEST_COURSE)).toBe(400)
  })

  it("returns 0 for empty course", () => {
    const emptyCourse: CourseConfig = {
      id: "empty",
      name: "Empty",
      units: [],
      defaultSettings: { pagesPerDay: 20, studyDays: [1, 2, 3, 4, 5], startingChapterId: 1 },
    }
    expect(computeTotalPages(emptyCourse)).toBe(0)
  })

  it("returns 0 for units with no chapters", () => {
    const emptyCourse: CourseConfig = {
      id: "empty",
      name: "Empty",
      units: [{ id: 1, title: "U1", color: "#000", chapters: [] }],
      defaultSettings: { pagesPerDay: 20, studyDays: [1, 2, 3, 4, 5], startingChapterId: 1 },
    }
    expect(computeTotalPages(emptyCourse)).toBe(0)
  })
})
