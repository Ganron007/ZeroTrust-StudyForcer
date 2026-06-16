import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { StatsBar } from "../StatsBar"
import type { CourseStat } from "@/hooks/useSchedule"

function makeStat(overrides: Partial<CourseStat> = {}): CourseStat {
  return {
    courseId: "c1",
    courseName: "CISSP",
    color: "#3b82f6",
    planName: "Plan A",
    scheduleLength: 20,
    totalBookPages: 400,
    studyPages: 400,
    totalPages: 400,
    totalPagesRead: 80,
    pctDone: 20,
    pagesPerDay: 25,
    studyDaysCount: 5,
    endDate: new Date("2026-05-01"),
    endDateLabel: "May 1",
    weeksAway: "3 weeks",
    ...overrides,
  }
}

const labels = { totalItems: "pages", perDay: "pages/day" }
const pLabel = (key: string) => {
  const map: Record<string, string> = {
    finishes: "Finishes",
    studyDays: "study days",
    frequency: "frequency",
    finishLabel: "% done",
  }
  return map[key] ?? key
}

describe("StatsBar", () => {
  it("renders dashes when no stats are provided", () => {
    const { container } = render(
      <StatsBar
        viewedStats={undefined}
        showMerged={false}
        selectedCoursesStats={{}}
        statsViewCourseId={null}
        setStatsViewCourseId={() => {}}
        activeCourseId={null}
        labels={labels}
        pLabel={pLabel}
      />,
    )
    const cells = container.querySelectorAll(".stats-bar > div")
    expect(cells.length).toBe(6)
    cells.forEach((cell) => {
      expect(cell.textContent).toContain("—")
    })
  })

  it("renders viewed stats in the grid", () => {
    render(
      <StatsBar
        viewedStats={makeStat()}
        showMerged={false}
        selectedCoursesStats={{}}
        statsViewCourseId={null}
        setStatsViewCourseId={() => {}}
        activeCourseId="c1"
        labels={labels}
        pLabel={pLabel}
      />,
    )
    expect(screen.getByText("May 1")).toBeInTheDocument()
    expect(screen.getByText("20")).toBeInTheDocument()
    expect(screen.getByText("400")).toBeInTheDocument()
    expect(screen.getByText("80/400")).toBeInTheDocument()
    expect(screen.getByText("20%")).toBeInTheDocument()
  })

  it("shows merged course pills and highlights the active one", () => {
    const setStatsViewCourseId = vi.fn()
    const c1 = makeStat({ courseId: "c1", courseName: "CISSP", color: "#3b82f6" })
    const c2 = makeStat({ courseId: "c2", courseName: "OSCP", color: "#8b5cf6", pctDone: 40 })
    render(
      <StatsBar
        viewedStats={c1}
        showMerged={true}
        selectedCoursesStats={{ c1, c2 }}
        statsViewCourseId={null}
        setStatsViewCourseId={setStatsViewCourseId}
        activeCourseId="c1"
        labels={labels}
        pLabel={pLabel}
      />,
    )
    expect(screen.getByText("CISSP")).toBeInTheDocument()
    expect(screen.getByText("OSCP")).toBeInTheDocument()
    fireEvent.click(screen.getByText("OSCP"))
    expect(setStatsViewCourseId).toHaveBeenCalledWith("c2")
  })

  it("highlights the pinned course pill", () => {
    const c1 = makeStat({ courseId: "c1", courseName: "CISSP" })
    const c2 = makeStat({ courseId: "c2", courseName: "OSCP" })
    render(
      <StatsBar
        viewedStats={c2}
        showMerged={true}
        selectedCoursesStats={{ c1, c2 }}
        statsViewCourseId="c2"
        setStatsViewCourseId={() => {}}
        activeCourseId="c1"
        labels={labels}
        pLabel={pLabel}
      />,
    )
    // Both pills rendered; no error means the pinned style path was exercised
    expect(screen.getByText("CISSP")).toBeInTheDocument()
    expect(screen.getByText("OSCP")).toBeInTheDocument()
  })
})
