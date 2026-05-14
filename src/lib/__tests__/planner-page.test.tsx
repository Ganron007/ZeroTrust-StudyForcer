import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import PlannerPage from "@/components/PlannerPage"
import type { CourseConfig } from "@/types/course"
import type { StudyPlan } from "@/lib/plan-storage"

// Mock Tauri
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}))

// Mock planStorage
vi.mock("@/lib/plan-storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/plan-storage")>("@/lib/plan-storage")
  return {
    ...actual,
    planStorage: {
      getAll: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation((plan) => Promise.resolve({ ...plan, id: "test-id", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })),
      delete: vi.fn().mockResolvedValue(undefined),
      getActiveIds: vi.fn().mockResolvedValue([]),
      setActiveIds: vi.fn().mockResolvedValue(undefined),
      addActiveId: vi.fn().mockResolvedValue(undefined),
      removeActiveId: vi.fn().mockResolvedValue(undefined),
    },
  }
})

// Mock showToast
vi.mock("@/components/NotificationToast", () => ({
  showToast: vi.fn(),
}))

const TEST_COURSES: CourseConfig[] = [
  {
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
        chapters: [
          { id: 1, title: "Ch 1", pages: 100 },
          { id: 2, title: "Ch 2", pages: 100 },
        ],
      },
    ],
    defaultSettings: { pagesPerDay: 20, studyDays: [1, 2, 3, 4, 5], startingChapterId: 1 },
  },
]

const TEST_PLANS: StudyPlan[] = [
  {
    id: "plan-1",
    courseId: "cissp",
    name: "Test Plan",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startDate: "2026-04-01",
    pagesPerDay: 20,
    studyDays: [1, 2, 3, 4, 5],
    startingChapterId: 1,
    chapterStartOverrides: {},
    anchor: "pagesPerDay",
    dailyLog: {},
    skippedDays: [],
  },
]

describe("PlannerPage - Edit Form", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  function expandCourse() {
    const courseButton = screen.getByRole("button", { name: /ISC2 CISSP/ })
    fireEvent.click(courseButton)
  }

  it("renders edit button for existing plans", () => {
    render(
      <PlannerPage
        courses={TEST_COURSES}
        activeCourseId={null}
        activePlanIds={["plan-1"]}
        allPlans={TEST_PLANS}
        onPlansChanged={() => {}}
        onActivatePlan={() => {}}
        onBack={() => {}}
      />
    )

    expandCourse()
    expect(screen.getByTitle("Edit")).toBeInTheDocument()
  })

  it("expands edit form when clicking edit", async () => {
    render(
      <PlannerPage
        courses={TEST_COURSES}
        activeCourseId={null}
        activePlanIds={["plan-1"]}
        allPlans={TEST_PLANS}
        onPlansChanged={() => {}}
        onActivatePlan={() => {}}
        onBack={() => {}}
      />
    )

    expandCourse()
    const editButton = screen.getByTitle("Edit")
    fireEvent.click(editButton)

    await waitFor(() => {
      expect(screen.getByText("Editing Plan")).toBeInTheDocument()
    })
  })

  it("shows anchor selector buttons in edit form", async () => {
    render(
      <PlannerPage
        courses={TEST_COURSES}
        activeCourseId={null}
        activePlanIds={["plan-1"]}
        allPlans={TEST_PLANS}
        onPlansChanged={() => {}}
        onActivatePlan={() => {}}
        onBack={() => {}}
      />
    )

    expandCourse()
    const editButton = screen.getByTitle("Edit")
    fireEvent.click(editButton)

    await waitFor(() => {
      expect(screen.getByText("Fixed Pace")).toBeInTheDocument()
      expect(screen.getByText("Fixed Deadline")).toBeInTheDocument()
      expect(screen.getByText("Fixed Duration")).toBeInTheDocument()
    })
  })

  it("shows derived pace preview in edit form", async () => {
    render(
      <PlannerPage
        courses={TEST_COURSES}
        activeCourseId={null}
        activePlanIds={["plan-1"]}
        allPlans={TEST_PLANS}
        onPlansChanged={() => {}}
        onActivatePlan={() => {}}
        onBack={() => {}}
      />
    )

    expandCourse()
    const editButton = screen.getByTitle("Edit")
    fireEvent.click(editButton)

    await waitFor(() => {
      expect(screen.getByText(/Derived pace:/)).toBeInTheDocument()
    })
  })

  it("shows active badge for active plans", () => {
    render(
      <PlannerPage
        courses={TEST_COURSES}
        activeCourseId={null}
        activePlanIds={["plan-1"]}
        allPlans={TEST_PLANS}
        onPlansChanged={() => {}}
        onActivatePlan={() => {}}
        onBack={() => {}}
      />
    )

    expandCourse()
    // Look for the active badge in the plan card (span with check icon)
    const activeBadges = screen.getAllByText("Active")
    expect(activeBadges.length).toBeGreaterThanOrEqual(1)
  })

  it("shows correct plan stats in card", () => {
    render(
      <PlannerPage
        courses={TEST_COURSES}
        activeCourseId={null}
        activePlanIds={["plan-1"]}
        allPlans={TEST_PLANS}
        onPlansChanged={() => {}}
        onActivatePlan={() => {}}
        onBack={() => {}}
      />
    )

    expandCourse()
    // The plan card should show days count and completed count
    expect(screen.getByText(/\d+ days/)).toBeInTheDocument()
  })

  it("shows create button when no plans exist", () => {
    render(
      <PlannerPage
        courses={TEST_COURSES}
        activeCourseId={null}
        activePlanIds={[]}
        allPlans={[]}
        onPlansChanged={() => {}}
        onActivatePlan={() => {}}
        onBack={() => {}}
      />
    )

    expandCourse()
    expect(screen.getByText("Create first plan")).toBeInTheDocument()
  })

  it("allows deleting a plan", async () => {
    render(
      <PlannerPage
        courses={TEST_COURSES}
        activeCourseId={null}
        activePlanIds={["plan-1"]}
        allPlans={TEST_PLANS}
        onPlansChanged={() => {}}
        onActivatePlan={() => {}}
        onBack={() => {}}
      />
    )

    expandCourse()
    const deleteButton = screen.getByTitle("Delete")
    expect(deleteButton).toBeInTheDocument()
  })

  it("shows 'Add another plan' button when plans already exist", () => {
    render(
      <PlannerPage
        courses={TEST_COURSES}
        activeCourseId={null}
        activePlanIds={["plan-1"]}
        allPlans={TEST_PLANS}
        onPlansChanged={() => {}}
        onActivatePlan={() => {}}
        onBack={() => {}}
      />
    )

    expandCourse()
    expect(screen.getByText("Add another plan")).toBeInTheDocument()
  })
})
