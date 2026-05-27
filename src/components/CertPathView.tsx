"use client"

import { useState, useMemo, useCallback } from "react"
import { usePersonality } from "./PersonalityProvider"
import { usePlanStore } from "@/lib/plan-store"
import { useCourse } from "./CourseProvider"
import { computeTotalPages } from "@/types/course"
import { showToast } from "./NotificationToast"
import type { StudyPlan } from "@/lib/plan-storage"
import type { CourseConfig } from "@/types/course"
import certRoadmap from "@/data/cert-roadmap.json"
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

  for (const plan of matchingPlans) {
    const course = courses.find((c) => c.id === plan.courseId)
    if (course) {
      totalPages += computeTotalPages(course)
    }
    for (const log of Object.values(plan.dailyLog)) {
      pagesRead += log.pagesRead
      hasAnyLog = true
    }
  }

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

function statusBadge(
  status: CertStatus,
): { text: string; className: string } {
  switch (status) {
    case "completed":
      return { text: "Certified", className: "bg-green-500/20 text-green-400 border-green-500/30" }
    case "in-progress":
      return { text: "In Progress", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" }
    case "planned":
      return { text: "Planned", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" }
    default:
      return { text: "Not Started", className: "bg-muted text-muted-foreground border-border" }
  }
}

export default function CertPathView() {
  const { label } = usePersonality()
  const { courses } = useCourse()
  const allPlans = usePlanStore((s) => s.allPlans)
  const activePlanIds = usePlanStore((s) => s.activePlanIds)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [certified, setCertified] = useState<Set<string>>(loadCertified)

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
      setCertified((prev) => {
        const next = new Set(prev)
        if (next.has(certId)) next.delete(certId)
        else next.add(certId)
        saveCertified(next)
        return next
      })
      if (certified.has(certId)) {
        showToast(`Removed ${certId} from certified certs`, "info")
      } else {
        showToast(`Marked ${certId} as certified!`, "complete")
      }
    },
    [certified],
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
          <h2 className="text-xl font-bold">Certification Roadmap</h2>
          <p className="text-sm text-muted-foreground">
            {totalCertified} of {totalCerts} certifications attained
          </p>
        </div>
      </div>

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
                        const badge = statusBadge(cert.result.status)
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
                                    {cert.result.pagesRead} / {cert.result.totalPages} pages
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
                                Study plan created — start logging to track progress
                              </p>
                            )}

                            {cert.result.status === "not-started" && cert.url && (
                              <a
                                href={cert.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline inline-block mb-2"
                              >
                                Learn more
                              </a>
                            )}

                            {(cert.result.status === "in-progress" || cert.result.status === "planned") && (
                              <button
                                onClick={() => toggleCertified(cert.id)}
                                className="text-xs text-green-400 hover:text-green-300 transition-colors mt-1 inline-flex items-center gap-1"
                              >
                                <CheckCircle className="w-3 h-3" />
                                Mark as Certified
                              </button>
                            )}

                            {isManuallyCertified && (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Award className="w-3 h-3 text-green-400" />
                                  Manually certified
                                </span>
                                <button
                                  onClick={() => toggleCertified(cert.id)}
                                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  Undo
                                </button>
                              </div>
                            )}

                            {(cert.result.status === "not-started" && cert.courseIdPrefixes.length > 0) && (
                              <p className="text-xs text-muted-foreground mt-1">
                                No matching study plan. Create a course with id starting with "{cert.courseIdPrefixes[0]}-..."
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
