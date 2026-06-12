import type { LabDefinition } from "./lab-sessions"
import type { CourseConfig } from "../types/course"

/**
 * Phase 0.5.6: Lab → exam-domain credit.
 *
 * When a lab session's lab covers a topic that matches a course's
 * exam domain, the user can credit the lab minutes to that domain.
 * Off by default — the user must opt in.
 *
 * This module provides the matching logic. The UI prompt is in
 * LabDashboard.tsx.
 */

export interface DomainMatch {
  courseId: string
  courseName: string
  domainId: string
  domainName: string
  /** Human-readable explanation of why we matched. */
  reason: string
}

/**
 * Find exam domains that match a lab. Match is fuzzy — if the
 * lab's focus overlaps any domain's name (case-insensitive substring),
 * we treat it as a match.
 */
export function findDomainMatches(
  lab: LabDefinition,
  courses: CourseConfig[],
): DomainMatch[] {
  const matches: DomainMatch[] = []
  const focusLower = lab.focus.toLowerCase()

  for (const course of courses) {
    if (!course.examDomains) continue
    for (const domain of course.examDomains) {
      const nameLower = domain.name.toLowerCase()
      // Check if the lab's focus appears in the domain name
      // (or vice versa for short focuses)
      if (focusLower.includes(nameLower) || nameLower.includes(focusLower)) {
        matches.push({
          courseId: course.id,
          courseName: course.name,
          domainId: domain.id,
          domainName: domain.name,
          reason: `Lab focus "${lab.focus}" matches domain "${domain.name}"`,
        })
      }
    }
  }
  return matches
}

/**
 * Build the credit key for a session, matching the format used
 * in LabSession.creditedTo.
 */
export function buildCreditKey(courseId: string, domainId: string): string {
  return `${courseId}:${domainId}`
}

/**
 * Parse a credit key back into its parts. Returns null if invalid.
 */
export function parseCreditKey(key: string): { courseId: string; domainId: string } | null {
  const idx = key.indexOf(":")
  if (idx === -1) return null
  return { courseId: key.substring(0, idx), domainId: key.substring(idx + 1) }
}
