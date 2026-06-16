import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PostmortemBanner } from "../PostmortemBanner"
import type { StudyPlan } from "@/lib/plan-storage"

const mocks = vi.hoisted(() => ({
  localToday: vi.fn().mockReturnValue("2026-04-15"),
  allPlans: [] as StudyPlan[],
  findPlansNeedingPostmortem: vi.fn().mockReturnValue([]),
  getPostmortem: vi.fn().mockReturnValue(null),
  savePostmortem: vi.fn().mockResolvedValue(undefined),
  deletePostmortem: vi.fn().mockResolvedValue(undefined),
  createEmptyPostmortem: vi.fn().mockReturnValue({
    planId: "p1",
    createdAt: "2026-04-15T00:00:00.000Z",
    updatedAt: "2026-04-15T00:00:00.000Z",
    timeline: "",
    rootCause: "",
    worked: "",
    didnt: "",
    actions: "",
  }),
  showToast: vi.fn(),
  label: vi.fn((k: string) => k),
  toast: vi.fn((k: string) => k),
  confirm: vi.fn().mockReturnValue(true),
}))

vi.mock("@/lib/date-utils", () => ({
  localToday: mocks.localToday,
}))

vi.mock("@/lib/postmortem", () => ({
  findPlansNeedingPostmortem: mocks.findPlansNeedingPostmortem,
  getPostmortem: mocks.getPostmortem,
  savePostmortem: mocks.savePostmortem,
  deletePostmortem: mocks.deletePostmortem,
  createEmptyPostmortem: mocks.createEmptyPostmortem,
}))

vi.mock("@/lib/plan-store", () => ({
  usePlanStore: (selector: (s: unknown) => unknown) =>
    selector({
      allPlans: mocks.allPlans,
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

function makePlan(overrides: Partial<StudyPlan> = {}): StudyPlan {
  return {
    id: "p1",
    courseId: "c1",
    name: "CISSP Plan",
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
    targetEndDate: "2026-04-10",
    ...overrides,
  } as StudyPlan
}

describe("PostmortemBanner", () => {
  beforeEach(() => {
    mocks.allPlans = []
    mocks.findPlansNeedingPostmortem.mockReturnValue([])
    mocks.getPostmortem.mockReturnValue(null)
    mocks.savePostmortem.mockClear()
    mocks.deletePostmortem.mockClear()
    mocks.showToast.mockClear()
    mocks.label.mockClear()
    Object.defineProperty(window, "confirm", { value: mocks.confirm, writable: true })
  })

  it("renders nothing when no plans need postmortem", () => {
    mocks.allPlans = [makePlan()]
    mocks.findPlansNeedingPostmortem.mockReturnValue([])
    const { container } = render(<PostmortemBanner />)
    expect(container.firstChild).toBeNull()
  })

  it("renders prompt when a plan needs postmortem", () => {
    mocks.allPlans = [makePlan()]
    mocks.findPlansNeedingPostmortem.mockReturnValue(["p1"])
    render(<PostmortemBanner />)
    expect(screen.getByTestId("postmortem-banner")).toBeInTheDocument()
    expect(screen.getByText("postmortemWrite")).toBeInTheDocument()
  })

  it("opens the editor when Write is clicked", () => {
    mocks.allPlans = [makePlan()]
    mocks.findPlansNeedingPostmortem.mockReturnValue(["p1"])
    render(<PostmortemBanner />)
    fireEvent.click(screen.getByText("postmortemWrite"))
    expect(screen.getByText("postmortemTitle")).toBeInTheDocument()
  })

  it("dismisses the banner when X is clicked", () => {
    mocks.allPlans = [makePlan()]
    mocks.findPlansNeedingPostmortem.mockReturnValue(["p1"])
    const { container } = render(<PostmortemBanner />)
    fireEvent.click(screen.getByTitle("postmortemDismiss"))
    expect(container.firstChild).toBeNull()
  })

  it("saves the postmortem from the editor", async () => {
    mocks.allPlans = [makePlan()]
    mocks.findPlansNeedingPostmortem.mockReturnValue(["p1"])
    render(<PostmortemBanner />)
    fireEvent.click(screen.getByText("postmortemWrite"))
    fireEvent.change(screen.getByPlaceholderText("postmortemTimelinePlaceholder"), {
      target: { value: "Timeline note" },
    })
    fireEvent.click(screen.getByText("postmortemSave"))
    await waitFor(() => expect(mocks.savePostmortem).toHaveBeenCalled())
    expect(mocks.showToast).toHaveBeenCalledWith("postmortemSaved", "complete")
  })

  it("deletes the postmortem when delete is confirmed", async () => {
    mocks.allPlans = [makePlan()]
    mocks.findPlansNeedingPostmortem.mockReturnValue(["p1"])
    render(<PostmortemBanner />)
    fireEvent.click(screen.getByText("postmortemWrite"))
    fireEvent.click(screen.getByText("postmortemDelete"))
    await waitFor(() => expect(mocks.deletePostmortem).toHaveBeenCalledWith("p1"))
  })
})
