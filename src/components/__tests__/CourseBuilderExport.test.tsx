import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import CourseBuilder from "../CourseBuilder"

// Mock personality layer
vi.mock("@/components/PersonalityProvider", () => ({
  usePersonality: () => {
    const map: Record<string, string> = {
      backToView: "Back", buildCourse: "Build Course", export: "Export",
      exportCourseJson: "Export JSON", import: "Import", saveCourse: "Save",
      showJSON: "Show JSON", hideJSON: "Hide JSON", loadExample: "Load Example",
      courseSaved: "Saved {name}", courseSaveFailed: "Save failed",
      courseExported: "Exported {name}",
    }
    return {
      label: (key: string) => map[key] ?? key,
      toast: (key: string) => map[key] ?? key,
    }
  },
}))

// Mock course-storage (we only need saveCourse to be a spy)
vi.mock("@/lib/course-storage", () => ({
  saveCourse: vi.fn().mockResolvedValue(undefined),
}))

beforeEach(() => {
  // jsdom provides URL.createObjectURL
  if (!globalThis.URL.createObjectURL) {
    globalThis.URL.createObjectURL = vi.fn(() => "blob:test")
  }
  if (!globalThis.URL.revokeObjectURL) {
    globalThis.URL.revokeObjectURL = vi.fn()
  }
})

describe("CourseBuilder — Phase 2.6 export", () => {
  it("renders the Export JSON button", () => {
    render(
      <CourseBuilder
        onBack={vi.fn()}
        onCourseSaved={vi.fn()}
        existingCourses={[]}
      />,
    )
    expect(screen.getByTestId("course-builder-export")).toBeInTheDocument()
    expect(screen.getByTestId("course-builder-export").textContent).toMatch(/Export JSON/i)
  })

  it("does not export when form is empty (validation fails)", () => {
    const createElementSpy = vi.spyOn(document, "createElement")
    render(
      <CourseBuilder
        onBack={vi.fn()}
        onCourseSaved={vi.fn()}
        existingCourses={[]}
      />,
    )
    fireEvent.click(screen.getByTestId("course-builder-export"))
    // Should not have created an <a> for download since validation fails
    const anchorCalls = createElementSpy.mock.calls.filter((c) => c[0] === "a")
    expect(anchorCalls.length).toBe(0)
  })

  it("does not throw when export clicked on empty form (validation catches it)", () => {
    render(
      <CourseBuilder
        onBack={vi.fn()}
        onCourseSaved={vi.fn()}
        existingCourses={[]}
      />,
    )
    // Clicking the export button with empty form should not throw
    expect(() => fireEvent.click(screen.getByTestId("course-builder-export"))).not.toThrow()
  })
})
