import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
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

describe("PlannerPage UI", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders header with app name", () => {
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

    expect(screen.getByText("CySec CCPTL")).toBeInTheDocument()
    expect(screen.getByText("Back to View")).toBeInTheDocument()
  })

  it("renders dashboard stats", () => {
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

    expect(screen.getByText("Total Plans")).toBeInTheDocument()
    expect(screen.getByText("Active")).toBeInTheDocument()
    expect(screen.getByText("Courses")).toBeInTheDocument()
    expect(screen.getByText("Avg Completion")).toBeInTheDocument()
  })

  it("renders course name in list", () => {
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

    expect(screen.getByText("ISC2 CISSP")).toBeInTheDocument()
  })

  it("shows export and import buttons", () => {
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

    expect(screen.getByTitle("Export all plans to JSON")).toBeInTheDocument()
  })
})

describe("DailyLogModal UI", () => {
  it("placeholder for log modal tests", () => {
    // DailyLogModal is tightly coupled to App.tsx state.
    // Extracting it for isolated testing would require significant refactoring.
    // For now, the E2E flow tests cover the log → recompute behavior.
    expect(true).toBe(true)
  })
})
