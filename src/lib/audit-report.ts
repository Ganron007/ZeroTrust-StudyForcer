import certRoadmap from "@/data/cert-roadmap.json"
import type { StudyPlan } from "@/lib/plan-storage"
import type { CourseConfig } from "@/types/course"
import { computeTotalPages } from "@/types/course"
import { getOrderedChapters } from "@/lib/cissp-data"
import { localToday } from "./date-utils"

interface CertEntry {
  id: string
  name: string
  fullName: string
  provider: string
  cost: string
  courseIdPrefixes: string[]
  description: string
  url?: string
}

interface CertLevel {
  id: string
  name: string
  certs: CertEntry[]
}

interface CertCategory {
  id: string
  name: string
  description: string
  color: string
  icon: string
  levels: CertLevel[]
}

interface CertRoadmapData {
  version: number
  categories: CertCategory[]
}

const ROADMAP = certRoadmap as CertRoadmapData

function loadCertified(): Set<string> {
  try {
    const raw = localStorage.getItem("ztsf:certified-certs")
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function averageMinutesPerPage(courses: CourseConfig[], plan: StudyPlan): number {
  const course = courses.find((c) => c.id === plan.courseId)
  // D5 fix: return 0 when no studyEstimate — the magic constant 4 was
  // silently used for OSCP, SecAI+, and any custom course without it.
  // Better to estimate 0 than to fabricate a number that looks authoritative.
  if (!course || !course.studyEstimate) return 0
  return (course.studyEstimate.minutesPerPage[0] + course.studyEstimate.minutesPerPage[1]) / 2
}

export interface AuditReport {
  generatedAt: string
  studyHours: number
  totalPagesRead: number
  totalPlannedPages: number
  certsCompleted: number
  certsInProgress: number
  certsTotal: number
  readinessScore: number
  coverage: Array<{
    id: string
    name: string
    pct: number
    completed: number
    total: number
  }>
  gaps: string[]
  domainCoverage: Array<{
    domain: string
    weight: number
    pctDone: number
  }>
  activePlans: Array<{
    course: string
    plan: string
    pagesRead: number
    totalPages: number
    pct: number
    deadline: string | null
  }>
}

export function buildAuditReport(
  courses: CourseConfig[],
  allPlans: StudyPlan[],
  activePlanIds: string[],
): AuditReport {
  const today = localToday()
  const certified = loadCertified()

  let totalPagesRead = 0
  let totalMinutes = 0
  let totalPlannedPages = 0
  const activePlansData: AuditReport["activePlans"] = []
  const domainMap: Record<string, { weight: number; pagesRead: number; totalPages: number }> = {}

  // B1 fix: dedupe pagesRead across plans sharing the same (courseId, date).
  // If 2 active plans for CISSP both log 30 pages on 2026-04-01, the user
  // physically read 30 pages that day — not 60. Take the max per (course, date).
  // Map key: `${courseId}|${date}`
  const maxPagesByCourseDate = new Map<string, number>()

  // Per-course aggregated log: { [courseId]: { date: pagesRead } }
  const seenCourses = new Set<string>()

  for (const plan of allPlans) {
    if (!activePlanIds.includes(plan.id)) continue
    const course = courses.find((c) => c.id === plan.courseId)
    if (!course) continue

    const chapters = getOrderedChapters(course, plan.unitOrder)
    const totalPlanPages = chapters.reduce((s, c) => s + c.pages, 0)
    const total = computeTotalPages(course)
    const loggedDays = Object.values(plan.dailyLog)
    const pagesRead = loggedDays.reduce((s, l) => s + l.pagesRead, 0)
    const avgMin = averageMinutesPerPage(courses, plan)
    totalMinutes += pagesRead * avgMin
    totalPagesRead += pagesRead

    // B1 fix: only count course total ONCE across plans
    if (!seenCourses.has(course.id)) {
      totalPlannedPages += total
      seenCourses.add(course.id)
    }

    // Track max pages per (courseId, date) for accurate deduped totals
    for (const [date, log] of Object.entries(plan.dailyLog)) {
      const key = `${course.id}|${date}`
      const prev = maxPagesByCourseDate.get(key) ?? 0
      if (log.pagesRead > prev) maxPagesByCourseDate.set(key, log.pagesRead)
    }

    activePlansData.push({
      course: course.name,
      plan: plan.name,
      pagesRead,
      totalPages: total,
      pct: total > 0 ? Math.min(1, pagesRead / total) : 0,
      deadline: plan.targetEndDate ?? null,
    })

    // Domain accumulation is moved out of the plan loop below so it
    // dedupes per course (not per plan). See "B1 fix (domain)" comment.
  }

  // B1 fix (domain): for each course, aggregate ALL its active plans into
  // a single set of pagesRead per (course, date) before computing per-domain
  // progress. Without this, 2 active plans for the same course would each
  // add their full chapter pages to domainMap.totalPages, double-counting.
  const processedCourses = new Set<string>()
  for (const plan of allPlans) {
    if (!activePlanIds.includes(plan.id)) continue
    const course = courses.find((c) => c.id === plan.courseId)
    if (!course) continue
    if (processedCourses.has(course.id)) continue
    processedCourses.add(course.id)

    if (!course.examDomains) continue
    const chapters = getOrderedChapters(course, plan.unitOrder)
    const totalPlanPages = chapters.reduce((s, c) => s + c.pages, 0)

    // Aggregate deduped pagesRead for THIS course across all its active plans
    const coursePagesRead = new Map<string, number>() // date → max pages
    for (const p of allPlans) {
      if (p.courseId !== course.id) continue
      if (!activePlanIds.includes(p.id)) continue
      for (const [date, log] of Object.entries(p.dailyLog)) {
        const prev = coursePagesRead.get(date) ?? 0
        if (log.pagesRead > prev) coursePagesRead.set(date, log.pagesRead)
      }
    }
    const courseTotalPages = Array.from(coursePagesRead.values()).reduce((s, v) => s + v, 0)

    for (const d of course.examDomains) {
      if (!domainMap[d.id]) {
        domainMap[d.id] = { weight: d.weight, pagesRead: 0, totalPages: 0 }
      }
    }
    for (const u of course.units) {
      if (u.domainId && domainMap[u.domainId]) {
        const chPages = chapters
          .filter((c) => c.unitId === u.id)
          .reduce((s, c) => s + c.pages, 0)
        const domainRead = totalPlanPages > 0
          ? courseTotalPages * (chPages / totalPlanPages)
          : 0
        domainMap[u.domainId].pagesRead += domainRead
        domainMap[u.domainId].totalPages += chPages
      }
    }
  }

  // B1 fix: dedupe totalPagesRead by taking per-(course,date) max.
  // If 2 active plans for CISSP both log 30 pages on 2026-04-01, the user
  // physically read 30 pages that day — not 60.
  const rawSumPages = totalPagesRead
  totalPagesRead = Array.from(maxPagesByCourseDate.values()).reduce((s, v) => s + v, 0)
  // Scale study minutes proportionally to deduped page count
  if (rawSumPages > 0 && totalPagesRead !== rawSumPages) {
    totalMinutes = Math.round(totalMinutes * (totalPagesRead / rawSumPages))
  }

  const domainCoverage: AuditReport["domainCoverage"] = []
  for (const dId in domainMap) {
    const d = domainMap[dId]
    const matchingCourse = courses.find((c) =>
      c.examDomains?.some((ed) => ed.id === dId),
    )
    if (!matchingCourse) continue
    const domain = matchingCourse.examDomains?.find((ed) => ed.id === dId)
    if (!domain) continue
    domainCoverage.push({
      domain: domain.name,
      weight: domain.weight,
      pctDone: d.totalPages > 0 ? Math.round((d.pagesRead / d.totalPages) * 100) : 0,
    })
  }

  let certsCompleted = 0
  let certsInProgress = 0
  const certsTotal = ROADMAP.categories.reduce(
    (s, c) => s + c.levels.reduce((ls, l) => ls + l.certs.length, 0),
    0,
  )
  const coverage: AuditReport["coverage"] = []
  const gaps: string[] = []

  for (const cat of ROADMAP.categories) {
    let catCompleted = 0
    let catInProgress = 0
    const catTotal = cat.levels.reduce((s, l) => s + l.certs.length, 0)
    for (const lvl of cat.levels) {
      for (const cert of lvl.certs) {
        if (certified.has(cert.id)) {
          certsCompleted++
          catCompleted++
          continue
        }
        const matching = allPlans.filter(
          (p) =>
            activePlanIds.includes(p.id) &&
            cert.courseIdPrefixes.some((prefix) => p.courseId.startsWith(prefix)),
        )
        const hasLogs = matching.some((p) =>
          Object.values(p.dailyLog).some((l) => l.pagesRead > 0),
        )
        if (hasLogs) {
          certsInProgress++
          catInProgress++
        }
      }
    }
    coverage.push({
      id: cat.id,
      name: cat.name,
      pct: catTotal > 0 ? catCompleted / catTotal : 0,
      completed: catCompleted,
      total: catTotal,
    })
    if (catCompleted === 0 && catInProgress === 0) {
      gaps.push(cat.name)
    }
  }

  const completionRatio = totalPlannedPages > 0 ? totalPagesRead / totalPlannedPages : 0
  const certRatio = certsTotal > 0 ? certsCompleted / certsTotal : 0
  const readinessScore = Math.round((completionRatio * 0.5 + certRatio * 0.5) * 100)

  return {
    generatedAt: today,
    studyHours: Math.round((totalMinutes / 60) * 10) / 10,
    totalPagesRead,
    totalPlannedPages,
    certsCompleted,
    certsInProgress,
    certsTotal,
    readinessScore,
    coverage,
    gaps,
    domainCoverage,
    activePlans: activePlansData,
  }
}

export function reportToMarkdown(report: AuditReport): string {
  const lines: string[] = []
  lines.push(`# ZeroTrust.StudyForcer — Compliance Report`)
  lines.push(``)
  lines.push(`**Generated:** ${report.generatedAt}`)
  // E3 fix: use injected __APP_VERSION__ from vite.config.ts so version
  // never drifts from the canonical source of truth (package.json).
  // Fallback to "unknown" if undefined (e.g., when called from a test
  // environment without Vite's define replacement).
  lines.push(`**App Version:** ${__APP_VERSION__ ?? "unknown"}`)
  lines.push(``)
  lines.push(`---`)
  lines.push(``)
  lines.push(`## Executive Summary`)
  lines.push(``)
  lines.push(`| Metric | Value |`)
  lines.push(`|---|---|`)
  lines.push(`| Study hours logged | ${report.studyHours} h |`)
  lines.push(`| Pages read | ${report.totalPagesRead.toLocaleString()} / ${report.totalPlannedPages.toLocaleString()} |`)
  lines.push(`| Certifications | ${report.certsCompleted} of ${report.certsTotal} (${report.certsInProgress} in progress) |`)
  lines.push(`| Readiness score | **${report.readinessScore}/100** |`)
  lines.push(`| Gaps identified | ${report.gaps.length} |`)
  lines.push(``)
  lines.push(`---`)
  lines.push(``)
  lines.push(`## Active Study Plans`)
  lines.push(``)
  if (report.activePlans.length === 0) {
    lines.push(`*No active plans.*`)
  } else {
    lines.push(`| Course | Plan | Pages Read | Progress | Deadline |`)
    lines.push(`|---|---|---|---|---|`)
    for (const p of report.activePlans) {
      lines.push(
        `| ${p.course} | ${p.plan} | ${p.pagesRead} / ${p.totalPages} | ${Math.round(p.pct * 100)}% | ${p.deadline ?? "open-ended"} |`,
      )
    }
  }
  lines.push(``)
  lines.push(`---`)
  lines.push(``)
  lines.push(`## Certification Coverage`)
  lines.push(``)
  lines.push(`| Category | Completed | Total | % |`)
  lines.push(`|---|---|---|---|`)
  for (const c of report.coverage) {
    lines.push(`| ${c.name} | ${c.completed} | ${c.total} | ${Math.round(c.pct * 100)}% |`)
  }
  lines.push(``)
  lines.push(`---`)
  lines.push(``)
  lines.push(`## Gaps Identified`)
  lines.push(``)
  if (report.gaps.length === 0) {
    lines.push(`No major gaps. Every category has at least one in-progress or completed cert.`)
  } else {
    lines.push(`Categories with **zero** coverage:`)
    lines.push(``)
    for (const g of report.gaps) {
      lines.push(`- **${g}**`)
    }
  }
  lines.push(``)
  lines.push(`---`)
  lines.push(``)
  // B3 fix: render the domainCoverage data that was previously orphaned.
  // This shows per-domain study progress vs. exam weight for each course
  // that has examDomains defined (e.g., CISSP's 8 CBK domains).
  if (report.domainCoverage.length > 0) {
    lines.push(`## Domain Coverage`)
    lines.push(``)
    lines.push(`Per-exam-domain study progress for courses with structured domain data.`)
    lines.push(``)
    lines.push(`| Domain | Exam Weight | Your Progress |`)
    lines.push(`|---|---|---|`)
    for (const d of report.domainCoverage) {
      lines.push(`| ${d.domain} | ${d.weight}% | ${d.pctDone}% |`)
    }
    lines.push(``)
    lines.push(`---`)
    lines.push(``)
  }
  // E3 fix: use injected __APP_VERSION__ from vite.config.ts
  lines.push(`*Generated by ZeroTrust.StudyForcer v${__APP_VERSION__ ?? "unknown"} — for employer-funded study budgets.*`)
  return lines.join("\n")
}
