import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  dayLabel,
  dayNumber,
  formatRelative,
  formatDateRelative,
} from "../lab-dashboard-helpers"

describe("lab-dashboard-helpers", () => {
  describe("dayLabel", () => {
    it("returns short weekday for a known date", () => {
      // 2026-06-15 is a Monday → "Mo"
      expect(dayLabel("2026-06-15")).toBe("Mo")
    })
    it("returns short weekday for Sunday", () => {
      // 2026-06-14 is a Sunday → "Su"
      expect(dayLabel("2026-06-14")).toBe("Su")
    })
    it("returns short weekday for Saturday", () => {
      // 2026-06-20 is a Saturday → "Sa"
      expect(dayLabel("2026-06-20")).toBe("Sa")
    })
  })

  describe("dayNumber", () => {
    it("returns day-of-month for a known date", () => {
      expect(dayNumber("2026-06-15")).toBe(15)
    })
    it("returns 1 for first day of month", () => {
      expect(dayNumber("2026-01-01")).toBe(1)
    })
    it("returns 31 for last day of month", () => {
      expect(dayNumber("2026-01-31")).toBe(31)
    })
  })

  describe("formatRelative", () => {
    it("returns 'Never used' for null", () => {
      expect(formatRelative(null)).toBe("Never used")
    })
    it("returns 'Today' for 0", () => {
      expect(formatRelative(0)).toBe("Today")
    })
    it("returns 'Yesterday' for 1", () => {
      expect(formatRelative(1)).toBe("Yesterday")
    })
    it("returns 'N days ago' for N > 1", () => {
      expect(formatRelative(5)).toBe("5 days ago")
      expect(formatRelative(30)).toBe("30 days ago")
    })
  })

  describe("formatDateRelative", () => {
    beforeEach(() => {
      vi.useFakeTimers()
      // Fix "now" to 2026-06-15 12:00 UTC
      vi.setSystemTime(new Date("2026-06-15T12:00:00Z"))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it("returns 'Today' for the current date", () => {
      expect(formatDateRelative("2026-06-15")).toBe("Today")
    })
    it("returns 'Yesterday' for 1 day ago", () => {
      expect(formatDateRelative("2026-06-14")).toBe("Yesterday")
    })
    it("returns 'N days ago' for 2-6 days ago", () => {
      expect(formatDateRelative("2026-06-13")).toBe("2 days ago")
      expect(formatDateRelative("2026-06-09")).toBe("6 days ago")
    })
    it("returns the date string unchanged for 7+ days ago", () => {
      expect(formatDateRelative("2026-06-08")).toBe("2026-06-08")
      expect(formatDateRelative("2026-01-15")).toBe("2026-01-15")
    })
    it("returns the date string when getDaysSince returns null", () => {
      // Empty string → getDaysSince returns null
      expect(formatDateRelative("")).toBe("")
    })
  })
})
