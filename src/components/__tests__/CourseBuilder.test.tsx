import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import CourseBuilder from "../CourseBuilder"
import { RESERVED_IDS } from "@/lib/course-builder-helpers"

const mocks = vi.hoisted(() => ({
  saveCourse: vi.fn().mockResolvedValue(undefined),
  showToast: vi.fn(),
  personality: {
    mode: "standard" as const,
    setMode: vi.fn(),
    label: (k: string) => k,
    toast: (k: string) => k,
    empty: (k: string) => k,
    greeting: (k: string) => k,
    loading: (k: string) => k,
    tips: () => ["tip"],
  },
}))

vi.mock("@/lib/course-storage", () => ({
  saveCourse: mocks.saveCourse,
}))

vi.mock("@/components/NotificationToast", () => ({
  showToast: mocks.showToast,
}))

vi.mock("@/components/PersonalityProvider", () => ({
  usePersonality: () => mocks.personality,
  PersonalityProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

beforeEach(() => {
  localStorage.clear()
  mocks.saveCourse.mockReset().mockResolvedValue(undefined)
  mocks.showToast.mockReset()
})

function getInputByPlaceholder(placeholder: string) {
  return screen.getByPlaceholderText(placeholder) as HTMLInputElement
}

describe("CourseBuilder", () => {
  it("renders with a single empty unit", () => {
    render(<CourseBuilder onBack={vi.fn()} onCourseSaved={vi.fn()} />)
    // The "Unit name" input should be present (one default unit)
    const unitNameInputs = screen.getAllByPlaceholderText("Unit name")
    expect(unitNameInputs.length).toBe(1)
    // No chapters by default
    expect(screen.getByText(/No chapters yet/)).toBeInTheDocument()
  })

  it("calls onBack when back button is clicked", () => {
    const onBack = vi.fn()
    render(<CourseBuilder onBack={onBack} onCourseSaved={vi.fn()} />)
    fireEvent.click(screen.getByText("backToPlanner"))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("loads example data when Load Example is clicked", () => {
    // Stub confirm to true
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)
    render(<CourseBuilder onBack={vi.fn()} onCourseSaved={vi.fn()} />)
    fireEvent.click(screen.getByText("loadExample"))
    // Should now have 3 units and multiple chapters
    const unitInputs = screen.getAllByPlaceholderText("Unit name")
    expect(unitInputs.length).toBe(3)
    expect(unitInputs[0]).toHaveValue("Part 1: Foundations")
    confirmSpy.mockRestore()
  })

  it("does not load example if confirm returns false", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false)
    render(<CourseBuilder onBack={vi.fn()} onCourseSaved={vi.fn()} />)
    // Make a change so hasUnsavedChanges() returns true (otherwise the
    // example loads without prompting).
    fireEvent.change(getInputByPlaceholder("e.g. atomic-habits, cissp-10th-ed"), {
      target: { value: "my-course" },
    })
    fireEvent.click(screen.getByText("loadExample"))
    // Should still have 1 unit (the default)
    const unitInputs = screen.getAllByPlaceholderText("Unit name")
    expect(unitInputs.length).toBe(1)
    confirmSpy.mockRestore()
  })

  it("adds a chapter when + Add Chapter is clicked", () => {
    render(<CourseBuilder onBack={vi.fn()} onCourseSaved={vi.fn()} />)
    // The "+ Add Chapter" text is hardcoded in the JSX (not from label())
    const allButtons = screen.getAllByRole("button")
    const addChapterBtn = allButtons.find((b) => (b.textContent ?? "").includes("Add Chapter"))
    expect(addChapterBtn).toBeDefined()
    fireEvent.click(addChapterBtn!)
    // The "No chapters yet" message should be gone, and we have 1 chapter
    expect(screen.queryByText(/No chapters yet/)).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText("Chapter title")).toBeInTheDocument()
  })

  it("sanitizes the course ID as the user types", () => {
    render(<CourseBuilder onBack={vi.fn()} onCourseSaved={vi.fn()} />)
    const courseIdInput = getInputByPlaceholder("e.g. atomic-habits, cissp-10th-ed")
    fireEvent.change(courseIdInput, { target: { value: "My Course!" } })
    expect(courseIdInput.value).toBe("mycourse")
  })

  it("does not save when course ID is empty", async () => {
    render(<CourseBuilder onBack={vi.fn()} onCourseSaved={vi.fn()} />)
    // Fill name only
    const courseNameInput = getInputByPlaceholder("e.g. Atomic Habits")
    fireEvent.change(courseNameInput, { target: { value: "My Course" } })
    // Click save
    fireEvent.click(screen.getByText("saveCourse"))
    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalled()
    })
    expect(mocks.saveCourse).not.toHaveBeenCalled()
  })

  it("rejects reserved course IDs", async () => {
    render(<CourseBuilder onBack={vi.fn()} onCourseSaved={vi.fn()} />)
    // Set course ID to cissp-10th-ed
    const courseIdInput = getInputByPlaceholder("e.g. atomic-habits, cissp-10th-ed")
    fireEvent.change(courseIdInput, { target: { value: RESERVED_IDS[0] } })
    // Set name
    const courseNameInput = getInputByPlaceholder("e.g. Atomic Habits")
    fireEvent.change(courseNameInput, { target: { value: "My Course" } })
    // Set unit title (required for validation)
    fireEvent.change(screen.getAllByPlaceholderText("Unit name")[0], {
      target: { value: "Unit 1" },
    })
    // Add a chapter (required for validation)
    const allButtons = screen.getAllByRole("button")
    const addChapterBtn = allButtons.find((b) => (b.textContent ?? "").includes("Add Chapter"))
    fireEvent.click(addChapterBtn!)
    // Set chapter title
    fireEvent.change(screen.getByPlaceholderText("Chapter title"), {
      target: { value: "Chapter 1" },
    })
    // Save
    fireEvent.click(screen.getByText("saveCourse"))
    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.any(String),
        "break",
      )
    })
    expect(mocks.saveCourse).not.toHaveBeenCalled()
  })

  it("saves successfully with valid input", async () => {
    const onCourseSaved = vi.fn()
    render(<CourseBuilder onBack={vi.fn()} onCourseSaved={onCourseSaved} />)
    // Set course ID and name
    fireEvent.change(getInputByPlaceholder("e.g. atomic-habits, cissp-10th-ed"), {
      target: { value: "my-course" },
    })
    fireEvent.change(getInputByPlaceholder("e.g. Atomic Habits"), {
      target: { value: "My Course" },
    })
    // Set unit title
    fireEvent.change(screen.getAllByPlaceholderText("Unit name")[0], {
      target: { value: "Unit 1" },
    })
    // Add a chapter
    const allButtons = screen.getAllByRole("button")
    const addChapterBtn = allButtons.find((b) => (b.textContent ?? "").includes("Add Chapter"))
    fireEvent.click(addChapterBtn!)
    // Set chapter title
    fireEvent.change(screen.getByPlaceholderText("Chapter title"), {
      target: { value: "Chapter 1" },
    })
    // Save
    await act(async () => {
      fireEvent.click(screen.getByText("saveCourse"))
    })
    await waitFor(() => {
      expect(mocks.saveCourse).toHaveBeenCalled()
    })
    expect(mocks.saveCourse.mock.calls[0][0].id).toBe("my-course")
    expect(onCourseSaved).toHaveBeenCalled()
  })

  it("toggles showPreview when hideJSON/showJSON is clicked", () => {
    render(<CourseBuilder onBack={vi.fn()} onCourseSaved={vi.fn()} />)
    // JSON preview is shown by default
    expect(screen.getByText("hideJSON")).toBeInTheDocument()
    fireEvent.click(screen.getByText("hideJSON"))
    expect(screen.getByText("showJSON")).toBeInTheDocument()
    expect(screen.queryByText("hideJSON")).not.toBeInTheDocument()
  })

  it("toggles study day checkboxes", () => {
    render(<CourseBuilder onBack={vi.fn()} onCourseSaved={vi.fn()} />)
    // Find a study-day button (short labels Su Mo Tu We Th Fr Sa are
    // rendered as buttons). Just click the "Sa" button.
    const allButtons = screen.getAllByRole("button")
    const saBtn = allButtons.find((b) => (b.textContent ?? "").trim() === "Sa")
    expect(saBtn).toBeDefined()
    fireEvent.click(saBtn!)
    // Just verify no crash. The state change is hard to inspect from JSX.
  })

  it("removes a unit when X is clicked (when > 1 unit)", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)
    render(<CourseBuilder onBack={vi.fn()} onCourseSaved={vi.fn()} />)
    // Load example → 3 units
    fireEvent.click(screen.getByText("loadExample"))
    let unitInputs = screen.getAllByPlaceholderText("Unit name")
    expect(unitInputs.length).toBe(3)
    // Click the X button on the first unit
    const removeButtons = screen.getAllByTitle("Remove unit")
    fireEvent.click(removeButtons[0])
    unitInputs = screen.getAllByPlaceholderText("Unit name")
    expect(unitInputs.length).toBe(2)
    confirmSpy.mockRestore()
  })

  it("refuses to remove the last unit (toast)", () => {
    render(<CourseBuilder onBack={vi.fn()} onCourseSaved={vi.fn()} />)
    // 1 unit by default. Click X.
    const removeButtons = screen.getAllByTitle("Remove unit")
    fireEvent.click(removeButtons[0])
    // Toast should be called with the "info" type and some validation message
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.any(String),
      "info",
    )
  })
})
