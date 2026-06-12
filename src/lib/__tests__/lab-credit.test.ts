import { describe, it, expect } from "vitest"
import { findDomainMatches, buildCreditKey, parseCreditKey } from "../lab-credit"
import type { LabDefinition } from "../lab-sessions"
import type { CourseConfig } from "../../types/course"

/**
 * Phase 0.5.6: Lab → exam-domain credit tests.
 *
 * Matching is fuzzy: if the lab's focus overlaps any domain's name
 * (case-insensitive substring), we treat it as a match.
 */
const labDFIR: LabDefinition = {
  id: "test",
  name: "Test Lab",
  url: "https://example.com",
  focus: "DFIR",
  defaultCategory: "dfir",
}

const courseWithDFIR: CourseConfig = {
  id: "c1",
  name: "DFIR Cert",
  subtitle: "",
  edition: "1st",
  publisher: "Test",
  units: [],
  defaultSettings: { pagesPerDay: 20, studyDays: [1, 2, 3, 4, 5], startingChapterId: 1 },
  examDomains: [
    { id: "d1", name: "DFIR", weight: 25 },
    { id: "d2", name: "Threat Hunting", weight: 20 },
  ],
}

const courseWithoutDFIR: CourseConfig = {
  id: "c2",
  name: "Other Cert",
  subtitle: "",
  edition: "1st",
  publisher: "Test",
  units: [],
  defaultSettings: { pagesPerDay: 20, studyDays: [1, 2, 3, 4, 5], startingChapterId: 1 },
  examDomains: [
    { id: "d3", name: "Network Security", weight: 30 },
  ],
}

const courseNoDomains: CourseConfig = {
  id: "c3",
  name: "No Domains",
  subtitle: "",
  edition: "1st",
  publisher: "Test",
  units: [],
  defaultSettings: { pagesPerDay: 20, studyDays: [1, 2, 3, 4, 5], startingChapterId: 1 },
  // No examDomains
}

describe("findDomainMatches", () => {
  it("returns no matches when no courses have examDomains", () => {
    expect(findDomainMatches(labDFIR, [courseNoDomains])).toEqual([])
  })

  it("returns no matches when no domain matches the lab focus", () => {
    expect(findDomainMatches(labDFIR, [courseWithoutDFIR])).toEqual([])
  })

  it("returns matches when a domain name contains the lab focus", () => {
    const matches = findDomainMatches(labDFIR, [courseWithDFIR])
    expect(matches).toHaveLength(1)
    expect(matches[0].domainId).toBe("d1")
    expect(matches[0].courseId).toBe("c1")
  })

  it("returns no match for unrelated domains within the same course", () => {
    // courseWithDFIR has d1 (DFIR) and d2 (Threat Intel).
    // The DFIR lab should only match d1, not d2.
    const matches = findDomainMatches(labDFIR, [courseWithDFIR])
    expect(matches).toHaveLength(1)
    expect(matches[0].domainId).toBe("d1")
  })

  it("matches case-insensitively", () => {
    const labLower = { ...labDFIR, focus: "dfir" }
    const matches = findDomainMatches(labLower, [courseWithDFIR])
    expect(matches.length).toBeGreaterThan(0)
  })

  it("matches even when focus is a substring of domain name", () => {
    const labShort = { ...labDFIR, focus: "Threat" }
    const matches = findDomainMatches(labShort, [courseWithDFIR])
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0].domainId).toBe("d2")
  })

  it("returns multiple matches across multiple courses", () => {
    const courseWithDFIR2: CourseConfig = {
      ...courseWithDFIR,
      id: "c4",
      name: "DFIR Cert 2",
    }
    const matches = findDomainMatches(labDFIR, [courseWithDFIR, courseWithDFIR2])
    expect(matches).toHaveLength(2)
  })

  it("returns empty array for empty courses", () => {
    expect(findDomainMatches(labDFIR, [])).toEqual([])
  })
})

describe("buildCreditKey", () => {
  it("builds course:domain format", () => {
    expect(buildCreditKey("c1", "d1")).toBe("c1:d1")
  })
})

describe("parseCreditKey", () => {
  it("parses a valid key", () => {
    expect(parseCreditKey("c1:d1")).toEqual({ courseId: "c1", domainId: "d1" })
  })

  it("handles domain IDs with colons gracefully (splits on first colon)", () => {
    expect(parseCreditKey("c1:d1:subdomain")).toEqual({ courseId: "c1", domainId: "d1:subdomain" })
  })

  it("returns null for missing colon", () => {
    expect(parseCreditKey("invalid")).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(parseCreditKey("")).toBeNull()
  })

  it("roundtrips with buildCreditKey", () => {
    const key = buildCreditKey("course-123", "domain-456")
    expect(parseCreditKey(key)).toEqual({ courseId: "course-123", domainId: "domain-456" })
  })
})
