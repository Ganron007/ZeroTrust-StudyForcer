"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { usePersonality } from "./PersonalityProvider"
import { usePlanStore } from "@/lib/plan-store"
import { useCourse } from "./CourseProvider"
import { computeTotalPages } from "@/types/course"
import { showToast } from "./NotificationToast"
import { formatStr } from "@/lib/personality"
import type { StudyPlan } from "@/lib/plan-storage"
import type { CourseConfig } from "@/types/course"
import certRoadmap from "@/data/cert-roadmap.json"
import GapAnalysis from "./GapAnalysis"
import CareerMode from "./CareerMode"
import ComplianceReport from "./ComplianceReport"
import ReportGenerator from "./ReportGenerator"
import {
  Shield, Target, Bug, Briefcase, Cpu,
  ChevronDown, ChevronRight, CheckCircle,
  Award,
} from "lucide-react"

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

type CertStatus = "not-started" | "planned" | "in-progress" | "completed"

interface CertResult {
  status: CertStatus
  progress: number
  totalPages: number
  pagesRead: number
}

const CATEGORY_ICONS: Record<string, typeof Shield> = {
  "blue-team": Shield,
  "red-team": Target,
  pentest: Bug,
  management: Briefcase,
  "ai-security": Cpu,
}

const ROADMAP = certRoadmap as CertRoadmapData

const STORAGE_KEY = "ztsf:certified-certs"

function loadCertified(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function saveCertified(certs: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(certs)))
}

function computeCertStatus(
  cert: CertEntry,
  courses: CourseConfig[],
  allPlans: StudyPlan[],
  activePlanIds: string[],
  certified: Set<string>,
): CertResult {
  if (certified.has(cert.id)) {
    return { status: "completed", progress: 1, totalPages: 0, pagesRead: 0 }
  }

  const matchingPlans = allPlans.filter((p) =>
    activePlanIds.includes(p.id) &&
    cert.courseIdPrefixes.some((prefix) => p.courseId.startsWith(prefix)),
  )

  if (matchingPlans.length === 0) {
    return { status: "not-started", progress: 0, totalPages: 0, pagesRead: 0 }
  }

  let totalPages = 0
  let pagesRead = 0
  let hasAnyLog = false
  // B2 fix: dedupe by courseId — 2 active plans for same CISSP cert shouldn't
  // double the course's total page count. pagesRead is also deduped by max
  // per (courseId, date) since the user can't physically read more pages
  // than what's logged once on a given day.
  const seenCourses = new Set<string>()
  const maxPagesByCourseDate = new Map<string, number>()

  for (const plan of matchingPlans) {
    const course = courses.find((c) => c.id === plan.courseId)
    if (course && !seenCourses.has(course.id)) {
      totalPages += computeTotalPages(course)
      seenCourses.add(course.id)
    }
    for (const [date, log] of Object.entries(plan.dailyLog)) {
      const key = `${plan.courseId}|${date}`
      const prev = maxPagesByCourseDate.get(key) ?? 0
      if (log.pagesRead > prev) maxPagesByCourseDate.set(key, log.pagesRead)
      hasAnyLog = true
    }
  }
  pagesRead = Array.from(maxPagesByCourseDate.values()).reduce((s, v) => s + v, 0)

  if (!hasAnyLog) {
    return { status: "planned", progress: 0, totalPages, pagesRead }
  }

  if (totalPages > 0 && pagesRead >= totalPages) {
    return { status: "completed", progress: 1, totalPages, pagesRead }
  }

  return {
    status: "in-progress",
    progress: totalPages > 0 ? Math.min(pagesRead / totalPages, 1) : 0,
    totalPages,
    pagesRead,
  }
}

function certStatusLabelKey(status: CertStatus): string {
  switch (status) {
    case "completed":
      return "certStatusCompleted"
    case "in-progress":
      return "certStatusInProgress"
    case "planned":
      return "certStatusPlanned"
    default:
      return "certStatusNotStarted"
  }
}

function statusBadgeClasses(status: CertStatus): string {
  switch (status) {
    case "completed":
      return "bg-green-500/20 text-green-400 border-green-500/30"
    case "in-progress":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
    case "planned":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

function statusBadge(
  status: CertStatus,
  label: (key: string) => string,
): { text: string; className: string } {
  return { text: label(certStatusLabelKey(status)), className: statusBadgeClasses(status) }
}

export default function CertPathView() {
  const { label, toast: tToast } = usePersonality()
  const { courses } = useCourse()
  const allPlans = usePlanStore((s) => s.allPlans)
  const activePlanIds = usePlanStore((s) => s.activePlanIds)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [certified, setCertified] = useState<Set<string>>(loadCertified)

  // E7 fix: cross-tab sync. If the user has the app open in two tabs
  // and toggles a cert in one, the other tab's `certified` state would
  // otherwise be stale until reload. The 'storage' event fires on
  // other tabs when localStorage changes.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "ztsf:certified-certs") setCertified(loadCertified())
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const toggleCategory = useCallback((categoryId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }, [])

  const toggleCertified = useCallback(
    (certId: string) => {
      // D2 fix: capture wasCertified BEFORE setState — the closure would
      // otherwise re-evaluate `certified` after React commits the new state
      // and silently flip the toast message. Read once, branch once.
      const wasCertified = certified.has(certId)
      setCertified((prev) => {
        const next = new Set(prev)
        if (wasCertified) next.delete(certId)
        else next.add(certId)
        saveCertified(next)
        return next
      })
      // D2 fix: route through personality layer instead of hard-coded English
      // so the 13 modes can customize the cert-toggle toast independently.
      if (wasCertified) {
        showToast(formatStr(tToast("certRemoved"), { id: certId }), "info")
      } else {
        showToast(formatStr(tToast("certMarked"), { id: certId }), "complete")
      }
    },
    [certified, tToast],
  )

  const categoryResults = useMemo(
    () =>
      ROADMAP.categories.map((category) => ({
        ...category,
        levels: category.levels.map((level) => ({
          ...level,
          certs: level.certs.map((cert) => ({
            ...cert,
            result: computeCertStatus(cert, courses, allPlans, activePlanIds, certified),
          })),
        })),
      })),
    [courses, allPlans, activePlanIds, certified],
  )

  const totalCertified = categoryResults.reduce(
    (sum, cat) =>
      sum +
      cat.levels.reduce(
        (levelSum, level) =>
          levelSum + level.certs.filter((c) => c.result.status === "completed").length,
        0,
      ),
    0,
  )
  const totalCerts = categoryResults.reduce(
    (sum, cat) => sum + cat.levels.reduce((levelSum, level) => levelSum + level.certs.length, 0),
    0,
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <Award className="w-7 h-7 text-primary" />
        <div>
          <h2 className="text-xl font-bold">{label("certPathTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {formatStr(label("certPathProgress"), { totalCertified: String(totalCertified), totalCerts: String(totalCerts) })}
          </p>
        </div>
      </div>

      <GapAnalysis />
      <CareerMode />
      <ComplianceReport />
      <ReportGenerator />

      {categoryResults.map((category) => {
        const Icon = CATEGORY_ICONS[category.id] ?? Award
        const isCollapsed = collapsed.has(category.id)
        const categoryCompleted = category.levels.reduce(
          (sum, level) => sum + level.certs.filter((c) => c.result.status === "completed").length,
          0,
        )
        const categoryTotal = category.levels.reduce((sum, level) => sum + level.certs.length, 0)

        return (
          <div
            key={category.id}
            className="border border-border rounded-xl overflow-hidden bg-card/50"
          >
            <button
              onClick={() => toggleCategory(category.id)}
              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-accent/30 transition-colors text-left"
            >
              <Icon className="w-5 h-5 shrink-0" style={{ color: category.color }} />
              <div className="flex-1">
                <span className="font-semibold text-foreground">{category.name}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{category.description}</p>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums mr-1">
                {categoryCompleted}/{categoryTotal}
              </span>
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {!isCollapsed && (
              <div className="px-5 pb-4 pt-1 space-y-4">
                {category.levels.map((level) => (
                  <div key={level.id}>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                      {level.name}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {level.certs.map((cert) => {
                        const badge = statusBadge(cert.result.status, label)
                        const isManuallyCertified = certified.has(cert.id)

                        return (
                          <div
                            key={cert.id}
                            className={`border rounded-xl p-4 transition-colors ${
                              cert.result.status === "completed"
                                ? "border-green-500/20 bg-green-500/5"
                                : "border-border bg-card"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="min-w-0">
                                <h4 className="font-semibold text-foreground truncate">
                                  {cert.name}
                                </h4>
                                <p className="text-xs text-muted-foreground truncate">
                                  {cert.fullName}
                                </p>
                              </div>
                              <span
                                className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border ${badge.className}`}
                              >
                                {badge.text}
                              </span>
                            </div>

                            <p className="text-xs text-muted-foreground/80 mb-2 line-clamp-2">
                              {cert.description}
                            </p>

                            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                              <span>{cert.provider}</span>
                              <span className="font-medium">{cert.cost}</span>
                            </div>

                            {cert.result.status === "in-progress" && (
                              <div className="space-y-1 mb-2">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>
                                    {formatStr(label("certPathPagesRead"), { pagesRead: String(cert.result.pagesRead), totalPages: String(cert.result.totalPages) })}
                                  </span>
                                  <span>{Math.round(cert.result.progress * 100)}%</span>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${Math.round(cert.result.progress * 100)}%`,
                                      backgroundColor: category.color,
                                    }}
                                  />
                                </div>
                              </div>
                            )}

                            {cert.result.status === "planned" && (
                              <p className="text-xs text-muted-foreground mb-2">
                                {label("certPathPlannedMessage")}
                              </p>
                            )}

                            {cert.result.status === "not-started" && cert.url && (
                              <a
                                href={cert.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline inline-block mb-2"
                              >
                                {label("certLearnMore")}
                              </a>
                            )}

                            {(cert.result.status === "in-progress" || cert.result.status === "planned") && (
                              <button
                                onClick={() => toggleCertified(cert.id)}
                                className="text-xs text-green-400 hover:text-green-300 transition-colors mt-1 inline-flex items-center gap-1"
                              >
                                <CheckCircle className="w-3 h-3" />
                                {label("certMarkAsCertified")}
                              </button>
                            )}

                            {isManuallyCertified && (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Award className="w-3 h-3 text-green-400" />
                                  {label("certManuallyCertified")}
                                </span>
                                <button
                                  onClick={() => toggleCertified(cert.id)}
                                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  {label("certUndo")}
                                </button>
                              </div>
                            )}

                            {(cert.result.status === "not-started" && cert.courseIdPrefixes.length > 0) && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatStr(label("certNoMatchingPlan"), { prefix: cert.courseIdPrefixes[0] })}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
