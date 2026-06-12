import { describe, it, expect, beforeEach } from "vitest"

// Declare the Vite-injected global for the test environment
declare const __APP_VERSION__: string | undefined
;(globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = "test-2.5.0"

import { buildAuditReport, reportToMarkdown } from "../audit-report"
import type { StudyPlan } from "../plan-storage"
import type { CourseConfig } from "../../types/course"

/**
 * Phase 0.5.3: Compliance-style audit report tests.
 *
 * The Compliance Report was originally shipped in v2.4.7 (Phase 1.6).
 * Phase 0.5.3 verifies it covers the spec from the Phase 0.5 roadmap:
 * Markdown + hours logged, coverage by exam domain, exam-readiness
 * score, gaps. Frame copy as a SOC-2 report.
 */
function mockPlan(overrides: Partial<StudyPlan> = {}): StudyPlan {
  return {
    id: "p1",
    courseId: "cissp",
    name: "Test Plan",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
    startDate: "2026-01-01",
    pagesPerDay: 20,
    studyDays: [1, 2, 3, 4, 5],
    startingChapterId: 1,
    chapterStartOverrides: {},
    anchor: "pagesPerDay",
    dailyLog: {
      "2026-06-01": { pagesRead: 20 },
      "2026-06-02": { pagesRead: 20 },
      "2026-06-03": { pagesRead: 20 },
    },
    skippedDays: [],
    ...overrides,
  }
}

const mockCourse: CourseConfig = {
  id: "cissp",
  name: "CISSP",
  subtitle: "",
  edition: "8th",
  publisher: "Sybex",
  totalPages: 1000,
  units: [
    { id: 1, title: "Domain 1", color: "#000", chapters: [{ id: 1, title: "Ch 1", pages: 100 }] },
  ],
  defaultSettings: { pagesPerDay: 20, studyDays: [1, 2, 3, 4, 5], startingChapterId: 1 },
  studyEstimate: { minutesPerPage: [2, 4] },
}

describe("buildAuditReport", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("returns a complete report object", () => {
    const report = buildAuditReport([mockCourse], [mockPlan()], ["p1"])
    expect(report).toBeDefined()
    expect(report.generatedAt).toBeTruthy()
    expect(Array.isArray(report.coverage)).toBe(true)
    expect(Array.isArray(report.domainCoverage)).toBe(true)
    expect(Array.isArray(report.gaps)).toBe(true)
    expect(Array.isArray(report.activePlans)).toBe(true)
  })

  it("calculates total study hours from dailyLog pagesRead", () => {
    const report = buildAuditReport([mockCourse], [mockPlan()], ["p1"])
    expect(report.studyHours).toBeGreaterThan(0)
  })

  it("calculates readiness score", () => {
    const report = buildAuditReport([mockCourse], [mockPlan()], ["p1"])
    expect(report.readinessScore).toBeGreaterThanOrEqual(0)
    expect(report.readinessScore).toBeLessThanOrEqual(100)
  })

  it("calculates coverage percentage from cert roadmap", () => {
    const report = buildAuditReport([mockCourse], [mockPlan()], ["p1"])
    expect(report.coverage.length).toBeGreaterThan(0)
    for (const c of report.coverage) {
      expect(c.name).toBeTruthy()
      expect(c.pct).toBeGreaterThanOrEqual(0)
      expect(c.pct).toBeLessThanOrEqual(100)
    }
  })

  it("includes the plan in activePlans when active", () => {
    const report = buildAuditReport([mockCourse], [mockPlan()], ["p1"])
    expect(report.activePlans.length).toBe(1)
    expect(report.activePlans[0].course).toBe("CISSP")
  })

  it("excludes inactive plans", () => {
    const report = buildAuditReport([mockCourse], [mockPlan()], [])  // empty activePlanIds
    expect(report.activePlans.length).toBe(0)
  })

  it("handles plans with no logs gracefully", () => {
    const plan = mockPlan({ dailyLog: {} })
    const report = buildAuditReport([mockCourse], [plan], ["p1"])
    expect(report.studyHours).toBe(0)
    expect(report.totalPagesRead).toBe(0)
  })

  it("includes gaps list (categories with no certs touched)", () => {
    const report = buildAuditReport([mockCourse], [mockPlan()], ["p1"])
    expect(Array.isArray(report.gaps)).toBe(true)
  })
})

describe("reportToMarkdown", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("returns a non-empty markdown string", () => {
    const report = buildAuditReport([mockCourse], [mockPlan()], ["p1"])
    const md = reportToMarkdown(report)
    expect(typeof md).toBe("string")
    expect(md.length).toBeGreaterThan(0)
  })

  it("includes the SOC-2-style framing (executive summary, etc.)", () => {
    const report = buildAuditReport([mockCourse], [mockPlan()], ["p1"])
    const md = reportToMarkdown(report)
    // Should have at least one markdown heading
    expect(md).toMatch(/^#\s/m)
  })

  it("includes the plan's course name in the output", () => {
    const report = buildAuditReport([mockCourse], [mockPlan()], ["p1"])
    const md = reportToMarkdown(report)
    expect(md).toContain("CISSP")
  })

  it("handles empty plan list gracefully", () => {
    const report = buildAuditReport([mockCourse], [], [])
    const md = reportToMarkdown(report)
    expect(typeof md).toBe("string")
    expect(md.length).toBeGreaterThan(0)
  })
})
