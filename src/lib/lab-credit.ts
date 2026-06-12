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
 *
 * v2.6.0 audit fix: rejects empty strings on either side (an empty
 * focus or empty domain name would otherwise match every lab/domain
 * because "".includes("") is true). Also requires the matching
 * substring to be at least 3 characters to avoid spurious matches
 * on short common words like "AI" or "OS".
 */
export function findDomainMatches(
  lab: LabDefinition,
  courses: CourseConfig[],
): DomainMatch[] {
  const matches: DomainMatch[] = []
  const focusLower = lab.focus.toLowerCase().trim()
  // Reject empty focus — every domain would "match" otherwise.
  if (focusLower.length < 3) return matches

  for (const course of courses) {
    if (!course.examDomains) continue
    for (const domain of course.examDomains) {
      const nameLower = domain.name.toLowerCase().trim()
      // Reject empty domain name — every lab would "match" otherwise.
      if (nameLower.length < 3) continue

      // Require the matching substring to be at least 3 chars to
      // avoid spurious matches on short common words like "AI" or "OS".
      const minMatchLen = 3
      const focusMatch = focusLower.length >= minMatchLen
        && focusLower.includes(nameLower)
        && nameLower.length >= minMatchLen
      const nameMatch = nameLower.length >= minMatchLen
        && nameLower.includes(focusLower)
        && focusLower.length >= minMatchLen

      if (focusMatch || nameMatch) {
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
 * v2.6.0 audit fix: also rejects empty parts (e.g. ":domain" or "course:").
 */
export function parseCreditKey(key: string): { courseId: string; domainId: string } | null {
  if (!key) return null
  const idx = key.indexOf(":")
  if (idx === -1) return null
  const courseId = key.substring(0, idx)
  const domainId = key.substring(idx + 1)
  if (!courseId || !domainId) return null
  return { courseId, domainId }
}
