import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import ReportGenerator from "../ReportGenerator"
import { usePlanStore } from "@/lib/plan-store"
import type { StudyPlan } from "@/lib/plan-storage"

// Mock personality — provide both usePersonality and PersonalityProvider
// (Provider is used by App.tsx; here we just need the hook to return a value)
vi.mock("@/components/PersonalityProvider", () => {
  const map: Record<string, string> = {
    reportTitle: "Report Generator",
    reportSubtitle: "Export",
    reportExportCsv: "Export CSV",
    reportExportJson: "Export JSON",
    reportExportPdf: "Print / Save PDF",
    reportExportSuccess: "Exported",
    reportExportFailed: "Failed",
    reportPrintOpened: "Print view opened",
  }
  const make = () => ({
    label: (key: string) => map[key] ?? key,
    toast: (key: string) => map[key] ?? key,
    empty: (key: string) => map[key] ?? key,
    greeting: (_h: number) => "Hello",
    loading: (key: string) => map[key] ?? key,
    tips: () => [],
  })
  return {
    usePersonality: make,
    PersonalityProvider: ({ children }: { children: React.ReactNode }) => children,
  }
})

// Mock NotificationToast
vi.mock("@/components/NotificationToast", () => ({
  showToast: vi.fn(),
}))

// Mock CourseProvider — same shape as the production one
vi.mock("@/components/CourseProvider", () => {
  return {
    useCourse: () => ({
      courses: [],
      activeCourse: null,
      activeCourseId: null,
      setActiveCourseId: vi.fn(),
      unitWeights: {},
    }),
    CourseProvider: ({ children }: { children: React.ReactNode }) => children,
  }
})

// Mock export-utils
vi.mock("@/lib/export-utils", () => ({
  downloadCsv: vi.fn(),
  downloadJson: vi.fn(),
}))

// Mock window.open
const mockOpen = vi.fn()
beforeEach(() => {
  mockOpen.mockReset()
  globalThis.window.open = mockOpen as unknown as typeof window.open
  // Reset store
  usePlanStore.setState({
    allPlans: [],
    activePlanIds: [],
    primaryActivePlanId: null,
    isLoading: false,
  })
})

function makePlan(overrides: Partial<StudyPlan>): StudyPlan {
  return {
    id: "p1",
    courseId: "c1",
    name: "Test Plan",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    startDate: "2026-01-01",
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

describe("ReportGenerator (Phase 2.1)", () => {
  it("renders all 3 export buttons", () => {
    render(<ReportGenerator />)
    expect(screen.getByTestId("report-csv")).toBeInTheDocument()
    expect(screen.getByTestId("report-json")).toBeInTheDocument()
    expect(screen.getByTestId("report-pdf")).toBeInTheDocument()
  })

  it("renders nothing dangerous when no plans exist (just shows buttons)", () => {
    render(<ReportGenerator />)
    expect(screen.getByTestId("report-csv")).toBeInTheDocument()
  })

  it("CSV button calls downloadCsv", async () => {
    const { downloadCsv } = await import("@/lib/export-utils")
    usePlanStore.setState({
      allPlans: [makePlan({ id: "p1", name: "My Plan" })],
      activePlanIds: ["p1"],
      primaryActivePlanId: "p1",
    })
    render(<ReportGenerator />)
    fireEvent.click(screen.getByTestId("report-csv"))
    expect(downloadCsv).toHaveBeenCalledTimes(1)
    const args = vi.mocked(downloadCsv).mock.calls[0]
    expect(args[0]).toMatch(/^study-report-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(args[1]).toBeInstanceOf(Array)
    const rows = args[1] as string[][]
    expect(rows[0][0]).toBe("Course")
    expect(rows[0][1]).toBe("Plan")
  })

  it("JSON button calls downloadJson", async () => {
    const { downloadJson } = await import("@/lib/export-utils")
    usePlanStore.setState({
      allPlans: [makePlan({})],
      activePlanIds: ["p1"],
      primaryActivePlanId: "p1",
    })
    render(<ReportGenerator />)
    fireEvent.click(screen.getByTestId("report-json"))
    expect(downloadJson).toHaveBeenCalledTimes(1)
    const args = vi.mocked(downloadJson).mock.calls[0]
    expect(args[0]).toMatch(/^study-report-\d{4}-\d{2}-\d{2}\.json$/)
    expect(args[1]).toBeInstanceOf(Object)
  })

  it("PDF button opens a new window", () => {
    render(<ReportGenerator />)
    fireEvent.click(screen.getByTestId("report-pdf"))
    expect(mockOpen).toHaveBeenCalledTimes(1)
  })

  it("PDF button is robust when window.open is blocked", () => {
    mockOpen.mockImplementation(() => null)
    render(<ReportGenerator />)
    // Should not throw — just log
    expect(() => fireEvent.click(screen.getByTestId("report-pdf"))).not.toThrow()
  })
})
