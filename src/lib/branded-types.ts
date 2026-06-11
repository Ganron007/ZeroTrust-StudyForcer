/**
 * Branded domain types — Phase 3.3
 *
 * Prevents passing a CourseId where a PlanId is expected, etc.
 * TypeScript's structural typing means plain strings are interchangeable;
 * these branded types make the type system catch that mistake at compile time.
 *
 * Zero runtime cost: branded types erase at compile time.
 *
 * Usage:
 *   import type { PlanId, CourseId, ISODate } from "@/lib/branded-types"
 *
 *   function getPlan(id: PlanId) { ... }  // won't accept CourseId
 *
 *   // To create:
 *   const planId = "abc" as PlanId
 *   const courseId = "course-1" as CourseId
 *   const date = "2026-06-10" as ISODate
 *
 * The `as` cast is the "trusted boundary" — at parse points (storage
 * reads, URL params), validate the string matches the expected format
 * before casting.
 */

declare const __brand: unique symbol

export type PlanId = string & { readonly [__brand]: "PlanId" }
export type CourseId = string & { readonly [__brand]: "CourseId" }
export type ISODate = string & { readonly [__brand]: "ISODate" }
export type ISOTimestamp = string & { readonly [__brand]: "ISOTimestamp" }

/**
 * Validators for each branded type. Use at trust boundaries (storage
 * reads, URL params, import files) to verify the string before casting.
 */
export function asPlanId(s: string): PlanId | null {
  // Plan IDs: crypto.randomUUID() or our fallback base36 format
  if (s.length === 0) return null
  return s as PlanId
}

export function asCourseId(s: string): CourseId | null {
  // Course IDs: kebab-case strings like "cissp", "oscp", etc.
  if (s.length === 0) return null
  return s as CourseId
}

export function asISODate(s: string): ISODate | null {
  // YYYY-MM-DD format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  // Validate it's a real date
  const d = new Date(s + "T00:00:00")
  if (isNaN(d.getTime())) return null
  return s as ISODate
}

export function asISOTimestamp(s: string): ISOTimestamp | null {
  // ISO 8601 timestamp
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return s as ISOTimestamp
}

/**
 * Unsafe casts. Only use when you've already validated the input.
 * Prefer the `as*` functions above.
 */
export const unsafe = {
  asPlanId: (s: string): PlanId => s as PlanId,
  asCourseId: (s: string): CourseId => s as CourseId,
  asISODate: (s: string): ISODate => s as ISODate,
  asISOTimestamp: (s: string): ISOTimestamp => s as ISOTimestamp,
} as const
