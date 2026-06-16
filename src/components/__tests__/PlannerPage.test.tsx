import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import PlannerPage from "../PlannerPage"
import type { CourseConfig } from "@/types/course"
import type { StudyPlan } from "@/lib/plan-storage"

const mocks = vi.hoisted(() => ({
  planStorageSave: vi.fn().mockResolvedValue(undefined),
  planStorageDelete: vi.fn().mockResolvedValue(undefined),
  getStateDelete: vi.fn().mockResolvedValue(undefined),
  downloadJson: vi.fn(),
  readJsonFile: vi.fn(),
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

vi.mock("@/lib/plan-storage", () => ({
  planStorage: {
    save: mocks.planStorageSave,
    delete: mocks.planStorageDelete,
  },
  defaultPlan: (courseId: string, overrides: any = {}, defaults: any = {}) => ({
    id: "new-plan",
    courseId,
    name: "New Plan",
    createdAt: "2026-06-15T00:00:00.000Z",
    updatedAt: "2026-06-15T00:00:00.000Z",
    startDate: "2026-06-15",
    pagesPerDay: defaults.pagesPerDay ?? 20,
    studyDays: defaults.studyDays ?? [1, 2, 3, 4, 5],
    startingChapterId: defaults.startingChapterId ?? 1,
    chapterStartOverrides: {},
    anchor: "pagesPerDay" as const,
    dailyLog: {},
    skippedDays: [],
    ...overrides,
  }),
}))

vi.mock("@/lib/plan-store", () => ({
  usePlanStore: {
    getState: () => ({
      deletePlan: mocks.getStateDelete,
    }),
  },
}))

vi.mock("@/lib/export-utils", () => ({
  downloadJson: mocks.downloadJson,
  readJsonFile: mocks.readJsonFile,
}))

vi.mock("@/components/NotificationToast", () => ({
  showToast: mocks.showToast,
}))

vi.mock("@/components/PersonalityProvider", () => ({
  usePersonality: () => mocks.personality,
  PersonalityProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

function makeCourse(id: string, name: string): CourseConfig {
  return {
    id,
    name,
    units: [
      {
        id: 1,
        title: "Unit 1",
        color: "#000",
        chapters: [
          { id: 1, title: "Ch 1", pages: 20 },
          { id: 2, title: "Ch 2", pages: 30 },
        ],
      },
    ],
    defaultSettings: { pagesPerDay: 20, studyDays: [1, 2, 3, 4, 5], startingChapterId: 1 },
  }
}

function makePlan(overrides: Partial<StudyPlan> = {}): StudyPlan {
  return {
    id: "p1",
    courseId: "c1",
    name: "Test Plan",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    startDate: "2026-06-01",
    pagesPerDay: 20,
    studyDays: [1, 2, 3, 4, 5],
    startingChapterId: 1,
    chapterStartOverrides: {},
    anchor: "pagesPerDay",
    dailyLog: {},
    skippedDays: [],
    ...overrides,
  }
}

function expandCourse(courseName: string) {
  const allButtons = screen.getAllByRole("button")
  const headerBtn = allButtons.find(
    (b) =>
      (b.textContent ?? "").includes(courseName) &&
      (b.textContent ?? "").includes("units"),
  )
  if (headerBtn) fireEvent.click(headerBtn)
}

beforeEach(() => {
  localStorage.clear()
  mocks.planStorageSave.mockReset().mockResolvedValue(undefined)
  mocks.planStorageDelete.mockReset().mockResolvedValue(undefined)
  mocks.getStateDelete.mockReset().mockResolvedValue(undefined)
  mocks.showToast.mockReset()
})

describe("PlannerPage", () => {
  it("renders with no courses", () => {
    render(
      <PlannerPage
        courses={[]}
        activeCourseId={null}
        activePlanIds={[]}
        allPlans={[]}
        onActivatePlan={vi.fn()}
        onBack={vi.fn()}
      />,
    )
    // Header should be present
    expect(screen.getByText("appTitle")).toBeInTheDocument()
  })

  it("renders courses and plans", () => {
    const c1 = makeCourse("c1", "CISSP")
    const plan = makePlan({ courseId: "c1", name: "My CISSP Plan" })
    render(
      <PlannerPage
        courses={[c1]}
        activeCourseId="c1"
        activePlanIds={["p1"]}
        allPlans={[plan]}
        onActivatePlan={vi.fn()}
        onBack={vi.fn()}
      />,
    )
    // Course name should appear (it's in the header for the course)
    expect(screen.getAllByText("CISSP").length).toBeGreaterThan(0)
    // The course header is a button — click it to expand and reveal the plan
    expandCourse("CISSP")
    // Now the plan should be visible
    expect(screen.getByText("My CISSP Plan")).toBeInTheDocument()
  })

  it("calls onBack when back button is clicked", () => {
    const onBack = vi.fn()
    render(
      <PlannerPage
        courses={[]}
        activeCourseId={null}
        activePlanIds={[]}
        allPlans={[]}
        onActivatePlan={vi.fn()}
        onBack={onBack}
      />,
    )
    fireEvent.click(screen.getByText("backToView"))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("calls onOpenCourseBuilder when new course button is clicked", () => {
    const onOpenCourseBuilder = vi.fn()
    render(
      <PlannerPage
        courses={[]}
        activeCourseId={null}
        activePlanIds={[]}
        allPlans={[]}
        onActivatePlan={vi.fn()}
        onBack={vi.fn()}
        onOpenCourseBuilder={onOpenCourseBuilder}
      />,
    )
    fireEvent.click(screen.getByText("buildCourse"))
    expect(onOpenCourseBuilder).toHaveBeenCalledTimes(1)
  })

  it("calls onActivatePlan when a plan's activate button is clicked", () => {
    const onActivatePlan = vi.fn()
    const c1 = makeCourse("c1", "CISSP")
    const plan = makePlan({ courseId: "c1" })
    render(
      <PlannerPage
        courses={[c1]}
        activeCourseId="c1"
        activePlanIds={[]}
        allPlans={[plan]}
        onActivatePlan={onActivatePlan}
        onBack={vi.fn()}
      />,
    )
    expandCourse("CISSP")
    // Now find the activate button — it has text "activate" (the personality
    // label key in our mock, since the plan is inactive)
    const activateBtn = screen.getByText("activate")
    fireEvent.click(activateBtn)
    expect(onActivatePlan).toHaveBeenCalledWith(plan)
  })

  it("opens edit form when a plan is clicked", () => {
    const c1 = makeCourse("c1", "CISSP")
    const plan = makePlan({ courseId: "c1" })
    render(
      <PlannerPage
        courses={[c1]}
        activeCourseId="c1"
        activePlanIds={["p1"]}
        allPlans={[plan]}
        onActivatePlan={vi.fn()}
        onBack={vi.fn()}
      />,
    )
    expandCourse("CISSP")
    // Click the edit button (Pencil icon, labeled "edit" in our mock)
    const allButtons = screen.getAllByRole("button")
    const editBtn = allButtons.find((b) => b.title === "edit")
    expect(editBtn).toBeDefined()
    fireEvent.click(editBtn!)
    // Edit form should appear with the plan's name pre-filled
    const nameInput = screen.getByDisplayValue("Test Plan") as HTMLInputElement
    expect(nameInput).toBeInTheDocument()
  })

  it("saves edit form when Save button is clicked", async () => {
    const onPlansChanged = vi.fn()
    const c1 = makeCourse("c1", "CISSP")
    const plan = makePlan({ courseId: "c1", name: "Old Name" })
    render(
      <PlannerPage
        courses={[c1]}
        activeCourseId="c1"
        activePlanIds={["p1"]}
        allPlans={[plan]}
        onActivatePlan={vi.fn()}
        onPlansChanged={onPlansChanged}
        onBack={vi.fn()}
      />,
    )
    expandCourse("CISSP")
    // Open edit
    const editButtons = screen.getAllByRole("button")
    const editBtn = editButtons.find((b) => b.title === "edit")
    fireEvent.click(editBtn!)
    // Change name
    const nameInput = screen.getByDisplayValue("Old Name") as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: "New Name" } })
    // Save
    await act(async () => {
      fireEvent.click(screen.getByText("saveChanges"))
    })
    await waitFor(() => {
      expect(mocks.planStorageSave).toHaveBeenCalled()
    })
    expect(mocks.planStorageSave.mock.calls[0][0].name).toBe("New Name")
    expect(onPlansChanged).toHaveBeenCalled()
  })

  it("deletes a plan after confirm", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)
    const c1 = makeCourse("c1", "CISSP")
    const plan = makePlan({ courseId: "c1" })
    render(
      <PlannerPage
        courses={[c1]}
        activeCourseId="c1"
        activePlanIds={["p1"]}
        allPlans={[plan]}
        onActivatePlan={vi.fn()}
        onBack={vi.fn()}
      />,
    )
    expandCourse("CISSP")
    const delBtn = screen.getAllByRole("button").find((b) => b.title === "delete")
    fireEvent.click(delBtn!)
    await waitFor(() => {
      expect(mocks.getStateDelete).toHaveBeenCalledWith("p1")
    })
    confirmSpy.mockRestore()
  })

  it("does not delete a plan when confirm returns false", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false)
    const c1 = makeCourse("c1", "CISSP")
    const plan = makePlan({ courseId: "c1" })
    render(
      <PlannerPage
        courses={[c1]}
        activeCourseId="c1"
        activePlanIds={["p1"]}
        allPlans={[plan]}
        onActivatePlan={vi.fn()}
        onBack={vi.fn()}
      />,
    )
    expandCourse("CISSP")
    const delBtn = screen.getAllByRole("button").find((b) => b.title === "delete")
    fireEvent.click(delBtn!)
    expect(mocks.getStateDelete).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it("opens create form when + New Plan is clicked", () => {
    const c1 = makeCourse("c1", "CISSP")
    render(
      <PlannerPage
        courses={[c1]}
        activeCourseId="c1"
        activePlanIds={[]}
        allPlans={[]}
        onActivatePlan={vi.fn()}
        onBack={vi.fn()}
      />,
    )
    expandCourse("CISSP")
    // The createFirstPlan button appears when course has no plans
    const allButtons = screen.getAllByRole("button")
    const addBtn = allButtons.find((b) => (b.textContent ?? "").includes("createFirstPlan"))
    expect(addBtn).toBeDefined()
    fireEvent.click(addBtn!)
    // The create form should appear (label is "newPlanSettings")
    expect(screen.getByText("newPlanSettings")).toBeInTheDocument()
  })

  it("expands and collapses a course card", () => {
    const c1 = makeCourse("c1", "CISSP")
    const plan = makePlan({ courseId: "c1" })
    render(
      <PlannerPage
        courses={[c1]}
        activeCourseId="c1"
        activePlanIds={["p1"]}
        allPlans={[plan]}
        onActivatePlan={vi.fn()}
        onBack={vi.fn()}
      />,
    )
    // Initially plan is hidden (course collapsed)
    expect(screen.queryByText("Test Plan")).not.toBeInTheDocument()
    // Click the course header to expand
    expandCourse("CISSP")
    expect(screen.getByText("Test Plan")).toBeInTheDocument()
    // Click again to collapse
    expandCourse("CISSP")
    expect(screen.queryByText("Test Plan")).not.toBeInTheDocument()
  })
})
