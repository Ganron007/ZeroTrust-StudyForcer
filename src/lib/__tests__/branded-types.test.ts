import { describe, it, expect } from "vitest"

import {
  asPlanId,
  asCourseId,
  asISODate,
  asISOTimestamp,
  unsafe,
  type PlanId,
  type CourseId,
  type ISODate,
} from "../branded-types"

describe("branded-types: validators accept correct formats", () => {
  it("asPlanId accepts non-empty strings", () => {
    expect(asPlanId("abc123")).toBe("abc123")
    expect(asPlanId("550e8400-e29b-41d4-a716-446655440000")).toBeTruthy()
  })

  it("asPlanId rejects empty strings", () => {
    expect(asPlanId("")).toBeNull()
  })

  it("asCourseId accepts non-empty strings", () => {
    expect(asCourseId("cissp")).toBe("cissp")
    expect(asCourseId("oscp-pdf-study")).toBe("oscp-pdf-study")
  })

  it("asCourseId rejects empty strings", () => {
    expect(asCourseId("")).toBeNull()
  })

  it("asISODate accepts YYYY-MM-DD format with valid dates", () => {
    expect(asISODate("2026-06-10")).toBe("2026-06-10")
    expect(asISODate("2024-12-31")).toBe("2024-12-31")
    expect(asISODate("2000-01-01")).toBe("2000-01-01")
  })

  it("asISODate rejects malformed strings", () => {
    expect(asISODate("2026/06/10")).toBeNull()  // wrong separator
    expect(asISODate("2026-6-10")).toBeNull()    // missing zero-pad
    expect(asISODate("not a date")).toBeNull()
    expect(asISODate("")).toBeNull()
  })

  it("asISOTimestamp accepts ISO 8601 format", () => {
    expect(asISOTimestamp("2026-06-10T12:00:00Z")).toBe("2026-06-10T12:00:00Z")
    expect(asISOTimestamp("2026-06-10T12:00:00.000Z")).toBe("2026-06-10T12:00:00.000Z")
  })

  it("asISOTimestamp rejects malformed strings", () => {
    expect(asISOTimestamp("2026-06-10")).toBeNull()  // missing time
    expect(asISOTimestamp("not a timestamp")).toBeNull()
    expect(asISOTimestamp("")).toBeNull()
  })
})

describe("branded-types: unsafe casts work but skip validation", () => {
  it("unsafe.asPlanId casts without validation", () => {
    // No validation — this is the "I already validated this" escape hatch
    const id = unsafe.asPlanId("anything")
    expect(id).toBe("anything")
  })
})

describe("branded-types: type system prevents mixing (compile-time test)", () => {
  // This test verifies the types exist and can be used.
  // The actual type safety is enforced at compile time — if you can
  // compile this file, the types work.
  it("branded types are distinct string types", () => {
    const planId: PlanId = "p1" as PlanId
    const courseId: CourseId = "c1" as CourseId
    const date: ISODate = "2026-06-10" as ISODate

    // Runtime: all are strings
    expect(typeof planId).toBe("string")
    expect(typeof courseId).toBe("string")
    expect(typeof date).toBe("string")

    // Runtime values
    expect(planId).toBe("p1")
    expect(courseId).toBe("c1")
    expect(date).toBe("2026-06-10")
  })
})
