import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("../is-tauri", () => ({ IS_TAURI: false }))

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(window, "localStorage", { value: localStorageMock })

import {
  loadAllCourses,
  loadCourse,
  saveCourse,
  deleteCourse,
  saveLogo,
  loadLogo,
  listCourseIds,
} from "../course-storage"
import type { CourseConfig } from "@/types/course"

const makeCourse = (id: string, overrides?: Partial<CourseConfig>): CourseConfig => ({
  id,
  name: "Test Course",
  units: [
    {
      id: 1,
      title: "Unit 1",
      color: "#3b82f6",
      chapters: [
        { id: 1, title: "Ch 1", pages: 10 },
        { id: 2, title: "Ch 2", pages: 10 },
      ],
    },
  ],
  defaultSettings: {
    pagesPerDay: 10,
    studyDays: [1, 2, 3, 4, 5],
  },
  trackingMode: "pages",
  ...overrides,
})

describe("course-storage (web/localStorage mode)", () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it("loadAllCourses returns empty on first call", async () => {
    const courses = await loadAllCourses()
    expect(courses).toEqual([])
  })

  it("saveCourse then loadAllCourses round-trips", async () => {
    const course = makeCourse("test-course-1")
    await saveCourse(course)
    const courses = await loadAllCourses()
    expect(courses).toHaveLength(1)
    expect(courses[0].id).toBe("test-course-1")
  })

  it("loadCourse returns a saved course by id", async () => {
    const course = makeCourse("test-course-2")
    await saveCourse(course)
    const loaded = await loadCourse("test-course-2")
    expect(loaded).not.toBeNull()
    expect(loaded!.id).toBe("test-course-2")
  })

  it("loadCourse returns null for missing course", async () => {
    const loaded = await loadCourse("nonexistent")
    expect(loaded).toBeNull()
  })

  it("deleteCourse removes a course from the index", async () => {
    const course = makeCourse("test-course-3")
    await saveCourse(course)
    const before = await loadAllCourses()
    expect(before).toHaveLength(1)
    await deleteCourse("test-course-3")
    const after = await loadAllCourses()
    expect(after).toHaveLength(0)
  })

  it("saveLogo then loadLogo round-trips", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>'
    await saveLogo("test-course-4", svg)
    const loaded = await loadLogo("test-course-4")
    expect(loaded).toBe(svg)
  })

  it("loadLogo returns null for course without logo", async () => {
    const loaded = await loadLogo("test-course-5")
    expect(loaded).toBeNull()
  })

  it("saveLogo does nothing for empty SVG content", async () => {
    await saveLogo("test-course-6", "")
    const loaded = await loadLogo("test-course-6")
    expect(loaded).toBeNull()
  })

  it("listCourseIds returns saved course ids", async () => {
    const c1 = makeCourse("course-a")
    const c2 = makeCourse("course-b")
    await saveCourse(c1)
    await saveCourse(c2)
    const ids = await listCourseIds()
    expect(ids.sort()).toEqual(["course-a", "course-b"])
  })

  it("listCourseIds returns empty on first call", async () => {
    const ids = await listCourseIds()
    expect(ids).toEqual([])
  })
})
