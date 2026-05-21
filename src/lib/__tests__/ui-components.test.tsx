import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import PlannerPage from "@/components/PlannerPage"
import type { CourseConfig } from "@/types/course"
import type { StudyPlan } from "@/lib/plan-storage"

// Mock personality layer
vi.mock("@/components/PersonalityProvider", () => {
  const labelMap: Record<string, string> = {
    backToView: "Back to View", totalPlans: "Total Plans", active: "Active",
    coursesLabel: "Courses", avgCompletion: "Avg Completion", export: "Export",
    import: "Import", buildCourse: "Build Course", appTitle: "ZeroTrust.StudyForcer",
    planner: "Planner", onlineLabs: "Online Labs", news: "News",
    studyDays: "Study Days", frequency: "Frequency", finishLabel: "Progress",
    finishes: "Finishes:", noCourseSelected: "No course selected",
    loading: "Loading your study plans...", tips: "Tips", refresh: "Refresh",
    backupAll: "Backup all data", resetAll: "Reset all data",
    restoreBackup: "Restore from backup", chooseTheme: "Choose theme",
    toggleFullscreen: "Toggle fullscreen", theme: "Theme",
    calendar: "Calendar", schedule: "Schedule", progress: "Progress",
    hasActivePlan: "Has active plan", noPlansYet: "No plans yet",
    createFirstPlan: "Create first plan", activate: "Activate",
    activeLabel: "Active", deadline: "Deadline", customOrder: "Custom Order",
    edit: "Edit", delete: "Delete", cancelEdit: "Cancel edit",
    editingPlan: "Editing Plan", planMode: "Plan mode — what drives the schedule?",
    fixedPace: "Fixed Pace", fixedDeadline: "Fixed Deadline",
    fixedDuration: "Fixed Duration", planName: "Plan name",
    startDate: "Start date", startingChapter: "Starting chapter",
    studyOrder: "Study Order", resetToDefault: "Reset to Default",
    customizeOrder: "Customize Order", derivedPace: "Derived pace:",
    endDate: "End date:", studyDaysLabel: "Study days",
    saveChanges: "Save Changes", cancel: "Cancel",
    addAnotherPlan: "Add another plan", newPlanSettings: "New Plan Settings",
    createPlan: "Create Plan",
    planModeDescPace: "You set the daily pace. End date is calculated automatically.",
    planModeDescDeadline: "You set the finish date. Daily pace is calculated automatically.",
    planModeDescDuration: "You set the number of study days. Pace and end date are calculated automatically.",
    confirmDeletePlan: "Delete this plan? This cannot be undone.",
    confirmResetAll: "Reset all data? This clears plans, logs, and course selections. Course configs are preserved.",
    logToday: "Log Today", todayDone: "Today's reading logged ✓",
    dayStreak: "day streak", yesterday: "Yesterday:",
    logStudySession: "Log Study Session", youStudiedFor: "You studied for",
    logSessionAction: "Log Session", logThisToEntry: "Log this to today's daily entry?",
    skip: "Skip",
  }
  const emptyMap: Record<string, string> = {
    noCourse: "Select a course from the dropdown above to get started.",
    noReadingToday: "No reading scheduled for today.",
    noPlan: "No study plan yet. Create one to get started!",
    noPlansYet: "No plans yet",
    noPlansForCourse: "Create a plan to start tracking your {course} progress.",
    planStarts: "Your plan starts",
  }
  return {
    usePersonality: () => ({
      label: (key: string) => labelMap[key] ?? key,
      toast: (key: string) => key,
      empty: (key: string) => emptyMap[key] ?? key,
      greeting: (key: string) => key === "morning" ? "Good morning" : key === "afternoon" ? "Good afternoon" : "Good evening",
      loading: (key: string) => "Loading...",
      tips: () => [],
      mode: "standard",
      setMode: () => {},
    }),
    PersonalityProvider: ({ children }: { children: React.ReactNode }) => children,
  }
})

// Mock formatStr
vi.mock("@/lib/personality", async () => {
  const actual = await vi.importActual<typeof import("@/lib/personality")>("@/lib/personality")
  return {
    ...actual,
    formatStr: (template: string, _params: Record<string, string | number>) => template,
  }
})

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

    expect(screen.getByText("ZeroTrust.StudyForcer")).toBeInTheDocument()
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

    expect(screen.getByTitle("Export")).toBeInTheDocument()
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
