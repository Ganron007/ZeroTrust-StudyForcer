import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { SprintBanner } from "../SprintBanner"
import type { StudyPlan } from "@/lib/plan-storage"
import type { SprintOverlay } from "@/lib/sprint"

const mocks = vi.hoisted(() => ({
  localToday: vi.fn().mockReturnValue("2026-04-15"),
  updatePlan: vi.fn().mockResolvedValue(undefined),
  showToast: vi.fn(),
  label: vi.fn((k: string) => k),
  toast: vi.fn((k: string) => k),
}))

vi.mock("@/lib/date-utils", () => ({
  localToday: mocks.localToday,
}))

vi.mock("@/lib/plan-store", () => ({
  usePlanStore: (selector: (s: unknown) => unknown) =>
    selector({
      allPlans: mocks.allPlans,
      activePlanIds: mocks.activePlanIds,
      updatePlan: mocks.updatePlan,
    }),
}))

vi.mock("@/components/PersonalityProvider", () => ({
  usePersonality: () => ({
    label: mocks.label,
    toast: mocks.toast,
  }),
}))

vi.mock("@/components/NotificationToast", () => ({
  showToast: mocks.showToast,
}))

function makePlan(overrides: Partial<StudyPlan> & { sprint?: SprintOverlay } = {}): StudyPlan {
  return {
    id: "p1",
    courseId: "c1",
    name: "Test Plan",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    startDate: "2026-04-01",
    pagesPerDay: 20,
    studyDays: [1, 2, 3, 4, 5],
    startingChapterId: 1,
    chapterStartOverrides: {},
    anchor: "pagesPerDay",
    dailyLog: {},
    skippedDays: [],
    ...overrides,
  } as StudyPlan
}

describe("SprintBanner", () => {
  beforeEach(() => {
    mocks.allPlans = []
    mocks.activePlanIds = []
    mocks.updatePlan.mockClear()
    mocks.showToast.mockClear()
    mocks.label.mockClear()
  })

  it("renders nothing when there are no active sprints", () => {
    mocks.allPlans = [makePlan()]
    mocks.activePlanIds = ["p1"]
    const { container } = render(<SprintBanner />)
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when sprint is not active", () => {
    mocks.allPlans = [
      makePlan({
        sprint: { startDate: "2026-04-01", days: 5, paceBoost: 50 },
      }),
    ]
    mocks.activePlanIds = ["p1"]
    const { container } = render(<SprintBanner />)
    expect(container.firstChild).toBeNull()
  })

  it("renders a single active sprint with cancel button", () => {
    mocks.allPlans = [
      makePlan({
        name: "CISSP Plan",
        sprint: { startDate: "2026-04-14", days: 5, paceBoost: 50 },
      }),
    ]
    mocks.activePlanIds = ["p1"]
    render(<SprintBanner />)
    expect(screen.getByTestId("sprint-banner")).toBeInTheDocument()
    expect(screen.getByTitle("sprintCancel")).toBeInTheDocument()
  })

  it("renders multiple active sprints without individual cancel", () => {
    mocks.allPlans = [
      makePlan({
        id: "p1",
        name: "CISSP Plan",
        sprint: { startDate: "2026-04-14", days: 5, paceBoost: 50 },
      }),
      makePlan({
        id: "p2",
        name: "OSCP Plan",
        sprint: { startDate: "2026-04-14", days: 5, paceBoost: 30 },
      }),
    ]
    mocks.activePlanIds = ["p1", "p2"]
    render(<SprintBanner />)
    expect(screen.getByTestId("sprint-banner")).toBeInTheDocument()
    expect(screen.queryByTitle("sprintCancel")).toBeNull()
  })

  it("cancels the sprint when the X button is clicked", async () => {
    mocks.allPlans = [
      makePlan({
        name: "CISSP Plan",
        sprint: { startDate: "2026-04-14", days: 5, paceBoost: 50 },
      }),
    ]
    mocks.activePlanIds = ["p1"]
    render(<SprintBanner />)
    fireEvent.click(screen.getByTitle("sprintCancel"))
    await waitFor(() => expect(mocks.updatePlan).toHaveBeenCalled())
    const updated = mocks.updatePlan.mock.calls[0][0]
    expect(updated.sprint).toBeUndefined()
    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith("sprintCancelled", "info"),
    )
  })

  it("ignores inactive plans", () => {
    mocks.allPlans = [
      makePlan({
        id: "p1",
        name: "Active Plan",
        sprint: { startDate: "2026-04-14", days: 5, paceBoost: 50 },
      }),
      makePlan({
        id: "p2",
        name: "Inactive Plan",
        sprint: { startDate: "2026-04-14", days: 5, paceBoost: 30 },
      }),
    ]
    mocks.activePlanIds = ["p1"]
    render(<SprintBanner />)
    expect(screen.getByTestId("sprint-banner")).toBeInTheDocument()
    expect(screen.getByTitle("sprintCancel")).toBeInTheDocument()
  })
})
