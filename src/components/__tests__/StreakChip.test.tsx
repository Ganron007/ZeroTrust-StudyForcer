import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import StreakChip from "../StreakChip"
import { usePlanStore } from "@/lib/plan-store"
import type { StudyPlan } from "@/lib/plan-storage"

// Mock personality layer so StreakChip can call usePersonality() without
// needing a real PersonalityProvider wrapper.
vi.mock("@/components/PersonalityProvider", () => ({
  usePersonality: () => ({
    label: (key: string) => {
      const map: Record<string, string> = {
        dayStreak: "day streak",
      }
      return map[key] ?? key
    },
  }),
}))

// jsdom provides localStorage automatically; clear before each test.
beforeEach(() => {
  localStorage.clear()
  // Reset the Zustand store by re-loading from storage
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

describe("StreakChip", () => {
  it("renders nothing when there are no plans", () => {
    const { container } = render(<StreakChip />)
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when no plan has any logs", () => {
    usePlanStore.setState({
      allPlans: [makePlan({ dailyLog: {} })],
      activePlanIds: ["p1"],
      primaryActivePlanId: "p1",
    })
    const { container } = render(<StreakChip />)
    expect(container.firstChild).toBeNull()
  })

  it("renders streak of 1 when only today is logged", () => {
    usePlanStore.setState({
      allPlans: [makePlan({ dailyLog: { "2026-04-01": { pagesRead: 20 } } })],
      activePlanIds: ["p1"],
      primaryActivePlanId: "p1",
    })
    render(<StreakChip today="2026-04-01" />)
    expect(screen.getByTestId("streak-chip")).toBeInTheDocument()
    expect(screen.getByTestId("streak-chip").textContent).toMatch(/^1$/)
  })

  it("renders streak of 3 for three consecutive days ending at today", () => {
    usePlanStore.setState({
      allPlans: [
        makePlan({
          dailyLog: {
            "2026-04-01": { pagesRead: 20 },
            "2026-03-31": { pagesRead: 15 },
            "2026-03-30": { pagesRead: 10 },
          },
        }),
      ],
      activePlanIds: ["p1"],
      primaryActivePlanId: "p1",
    })
    render(<StreakChip today="2026-04-01" />)
    expect(screen.getByTestId("streak-chip").textContent).toMatch(/^3$/)
  })

  it("skips today if not yet logged but counts from yesterday", () => {
    usePlanStore.setState({
      allPlans: [
        makePlan({
          dailyLog: {
            "2026-03-31": { pagesRead: 20 },
            "2026-03-30": { pagesRead: 15 },
          },
        }),
      ],
      activePlanIds: ["p1"],
      primaryActivePlanId: "p1",
    })
    // today is 2026-04-01 but no log — should still show 2 from 03-31 and 03-30
    render(<StreakChip today="2026-04-01" />)
    expect(screen.getByTestId("streak-chip").textContent).toMatch(/^2$/)
  })

  it("stops counting at first gap", () => {
    usePlanStore.setState({
      allPlans: [
        makePlan({
          dailyLog: {
            "2026-04-01": { pagesRead: 20 },
            // 2026-03-31 missing
            "2026-03-30": { pagesRead: 15 },
            "2026-03-29": { pagesRead: 10 },
          },
        }),
      ],
      activePlanIds: ["p1"],
      primaryActivePlanId: "p1",
    })
    render(<StreakChip today="2026-04-01" />)
    // Gap on 03-31 breaks the streak → only 1 (today)
    expect(screen.getByTestId("streak-chip").textContent).toMatch(/^1$/)
  })

  it("ignores plans that are not active", () => {
    usePlanStore.setState({
      allPlans: [
        makePlan({
          id: "inactive",
          dailyLog: { "2026-04-01": { pagesRead: 20 } },
        }),
        makePlan({
          id: "active",
          dailyLog: { "2026-03-31": { pagesRead: 15 } },
        }),
      ],
      activePlanIds: ["active"],
      primaryActivePlanId: "active",
    })
    render(<StreakChip today="2026-04-01" />)
    // Only the active plan counts; it logged 03-31, today (04-01) not logged
    expect(screen.getByTestId("streak-chip").textContent).toMatch(/^1$/)
  })

  it("ignores zero-page log entries", () => {
    usePlanStore.setState({
      allPlans: [
        makePlan({
          dailyLog: {
            "2026-04-01": { pagesRead: 0 },
            "2026-03-31": { pagesRead: 20 },
          },
        }),
      ],
      activePlanIds: ["p1"],
      primaryActivePlanId: "p1",
    })
    render(<StreakChip today="2026-04-01" />)
    // pagesRead=0 on 04-01 should NOT count as "logged"; start from yesterday
    expect(screen.getByTestId("streak-chip").textContent).toMatch(/^1$/)
  })

  it("aggregates across multiple active plans", () => {
    usePlanStore.setState({
      allPlans: [
        makePlan({
          id: "a",
          dailyLog: { "2026-04-01": { pagesRead: 20 } },
        }),
        makePlan({
          id: "b",
          dailyLog: { "2026-03-31": { pagesRead: 15 } },
        }),
      ],
      activePlanIds: ["a", "b"],
      primaryActivePlanId: "a",
    })
    render(<StreakChip today="2026-04-01" />)
    expect(screen.getByTestId("streak-chip").textContent).toMatch(/^2$/)
  })
})
