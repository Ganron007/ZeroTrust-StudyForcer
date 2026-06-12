import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Phase 0.5.1 — Exam alert banner tests.
 *
 * Source-code tests because the banner pulls from usePlanStore/useCourse
 * which require extensive React+provider mocking. Verifying the
 * implementation pattern + module wiring catches regressions.
 */
const banner = readFileSync(
  resolve(__dirname, "../../components/ExamAlertBanner.tsx"),
  "utf8"
)

const appTsx = readFileSync(
  resolve(__dirname, "../../App.tsx"),
  "utf8"
)

describe("ExamAlertBanner: implementation", () => {
  it("component file exists and is a default export", () => {
    expect(banner).toMatch(/export default function ExamAlertBanner/)
  })

  it("computes daysLeft from plan.targetEndDate", () => {
    expect(banner).toMatch(/plan\.targetEndDate/)
  })

  it("surfaces only plans within 3 days", () => {
    expect(banner).toMatch(/days\s*<=\s*3/)
  })

  it("renders a top-level alert role for accessibility", () => {
    expect(banner).toMatch(/role="alert"/)
  })

  it("uses aria-live=polite for screen reader announcement", () => {
    expect(banner).toMatch(/aria-live="polite"/)
  })

  it("returns null when no imminent plans (no render = no DOM noise)", () => {
    expect(banner).toMatch(/imminent\.length\s*===\s*0/)
  })

  it("uses the personality layer for labels (not hardcoded text)", () => {
    expect(banner).toMatch(/label\(/)
    expect(banner).toMatch(/examToday/)
    expect(banner).toMatch(/examTomorrow/)
    expect(banner).toMatch(/examThisWeek/)
  })

  it("uses AlertTriangle icon for the most urgent state", () => {
    expect(banner).toMatch(/AlertTriangle/)
  })
})

describe("ExamAlertBanner: App.tsx wiring", () => {
  it("App.tsx imports ExamAlertBanner", () => {
    expect(appTsx).toMatch(/import\s+ExamAlertBanner\s+from\s+["'].*ExamAlertBanner["']/)
  })

  it("App.tsx renders ExamAlertBanner above the tablist", () => {
    // Find the position of the ExamAlertBanner render and the tablist
    const bannerMatch = appTsx.match(/<ExamAlertBanner\s*\/>/)
    const tablistMatch = appTsx.match(/role="tablist"/)
    expect(bannerMatch).toBeTruthy()
    expect(tablistMatch).toBeTruthy()
    if (bannerMatch && tablistMatch) {
      const bannerIdx = appTsx.indexOf(bannerMatch[0])
      const tablistIdx = appTsx.indexOf(tablistMatch[0])
      expect(bannerIdx).toBeLessThan(tablistIdx)
    }
  })
})
