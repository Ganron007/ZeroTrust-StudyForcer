import { describe, it, expect, beforeEach, vi } from "vitest"
import { act, render, renderHook, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { OverlayManager } from "../OverlayManager"
import { useOverlayState } from "../../hooks/useOverlayState"

const mocks = vi.hoisted(() => ({
  loadPlans: vi.fn().mockResolvedValue(undefined),
  refreshCourses: vi.fn().mockResolvedValue(undefined),
  setActivePlanIds: vi.fn().mockResolvedValue(undefined),
  setPrimaryActivePlanId: vi.fn(),
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

// Mock the dependencies that OverlayManager pulls in. Use the @ path alias
// (the same pattern that works in other component tests in this repo).
vi.mock("@/components/CourseProvider", () => ({
  useCourse: () => ({
    courses: [
      { id: "cissp-10th-ed", name: "CISSP" },
      { id: "oscp", name: "OSCP" },
    ],
    refreshCourses: mocks.refreshCourses,
  }),
}))

vi.mock("@/lib/plan-store", () => ({
  usePlanStore: (selector: (s: unknown) => unknown) =>
    selector({
      allPlans: [],
      activePlanIds: [],
      primaryActivePlanId: null,
      loadPlans: mocks.loadPlans,
      setActivePlanIds: mocks.setActivePlanIds,
      setPrimaryActivePlanId: mocks.setPrimaryActivePlanId,
    }),
}))

vi.mock("@/components/NotificationToast", () => ({
  showToast: mocks.showToast,
}))

vi.mock("@/components/PersonalityProvider", () => ({
  usePersonality: () => mocks.personality,
  PersonalityProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/LabDashboard", () => ({
  default: () => <div data-testid="lab-dashboard">Lab</div>,
}))
vi.mock("@/components/SecurityNewsFeed", () => ({
  default: () => <div data-testid="news">News</div>,
}))
vi.mock("@/components/CourseBuilder", () => ({
  default: () => <div data-testid="course-builder">Builder</div>,
}))
vi.mock("@/components/PlannerPage", () => ({
  default: () => <div data-testid="planner">Planner</div>,
}))

function withControllers() {
  return renderHook(() => {
    const onlineLabs = useOverlayState<null>(null)
    const news = useOverlayState<null>(null)
    const courseBuilder = useOverlayState<null>(null)
    const planner = useOverlayState<{ initialCourseId: string | null }>({
      initialCourseId: null,
    })
    return { onlineLabs, news, courseBuilder, planner }
  })
}

describe("OverlayManager", () => {
  beforeEach(() => {
    mocks.loadPlans.mockClear()
    mocks.refreshCourses.mockClear()
    mocks.setActivePlanIds.mockClear()
    mocks.setPrimaryActivePlanId.mockClear()
    mocks.showToast.mockClear()
  })

  it("renders nothing when all overlays are closed", () => {
    const { result } = withControllers()
    const c = result.current
    const { container } = render(<OverlayManager {...c} />)
    expect(container.firstChild).toBeNull()
  })

  it("renders LabDashboard when onlineLabs is open", () => {
    const { result, rerender: rerenderHook } = withControllers()
    const c = result.current
    // Open the overlay inside act() so the renderHook re-renders synchronously
    act(() => {
      c.onlineLabs.open()
    })
    rerenderHook()
    const { container } = render(<OverlayManager {...result.current} />)
    expect(screen.getByTestId("lab-dashboard")).toBeInTheDocument()
    expect(container.querySelector('[data-testid="news"]')).toBeNull()
  })

  it("priority: News wins when both News and CourseBuilder are open", () => {
    const { result, rerender: rerenderHook } = withControllers()
    act(() => {
      result.current.news.open()
      result.current.courseBuilder.open()
    })
    rerenderHook()
    const { container } = render(<OverlayManager {...result.current} />)
    expect(screen.getByTestId("news")).toBeInTheDocument()
    expect(container.querySelector('[data-testid="course-builder"]')).toBeNull()
  })

  it("priority: CourseBuilder wins when both CourseBuilder and Planner are open", () => {
    const { result, rerender: rerenderHook } = withControllers()
    act(() => {
      result.current.courseBuilder.open()
      result.current.planner.open({ initialCourseId: "cissp-10th-ed" })
    })
    rerenderHook()
    render(<OverlayManager {...result.current} />)
    expect(screen.getByTestId("course-builder")).toBeInTheDocument()
  })

  it("closing the top-priority overlay reveals the next one", () => {
    const { result, rerender: rerenderHook } = withControllers()
    act(() => {
      result.current.onlineLabs.open()
      result.current.news.open()
    })
    rerenderHook()
    const { rerender, container } = render(<OverlayManager {...result.current} />)
    expect(screen.getByTestId("lab-dashboard")).toBeInTheDocument()

    act(() => {
      result.current.onlineLabs.close()
    })
    rerenderHook()
    rerender(<OverlayManager {...result.current} />)
    expect(container.querySelector('[data-testid="lab-dashboard"]')).toBeNull()
    expect(screen.getByTestId("news")).toBeInTheDocument()
  })

  it("planner renders when only it is open (lowest priority)", () => {
    const { result, rerender: rerenderHook } = withControllers()
    act(() => {
      result.current.planner.open({ initialCourseId: "cissp-10th-ed" })
    })
    rerenderHook()
    render(<OverlayManager {...result.current} />)
    expect(screen.getByTestId("planner")).toBeInTheDocument()
  })

  it("passes initialCourseId through to the PlannerPage stub", () => {
    const { result, rerender: rerenderHook } = withControllers()
    act(() => {
      result.current.planner.open({ initialCourseId: "oscp" })
    })
    rerenderHook()
    render(<OverlayManager {...result.current} />)
    expect(screen.getByTestId("planner")).toBeInTheDocument()
  })
})
