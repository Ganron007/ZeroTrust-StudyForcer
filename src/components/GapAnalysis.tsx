import { Activity, AlertTriangle, CheckCircle, Layers } from "lucide-react"
import { usePersonality } from "./PersonalityProvider"
import { usePlanStore } from "@/lib/plan-store"
import { useCourse } from "./CourseProvider"
import certRoadmap from "@/data/cert-roadmap.json"
import type { StudyPlan } from "@/lib/plan-storage"
import type { CourseConfig } from "@/types/course"

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

const STORAGE_KEY = "ztsf:certified-certs"

function loadCertified(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function statusForCert(
  cert: CertEntry,
  courses: CourseConfig[],
  allPlans: StudyPlan[],
  activePlanIds: string[],
  certified: Set<string>,
): "completed" | "in-progress" | "planned" | "none" {
  if (certified.has(cert.id)) return "completed"

  const matchingPlans = allPlans.filter(
    (p) =>
      activePlanIds.includes(p.id) &&
      cert.courseIdPrefixes.some((prefix) => p.courseId.startsWith(prefix)),
  )
  if (matchingPlans.length === 0) return "none"

  const hasAnyLog = matchingPlans.some(
    (p) => Object.values(p.dailyLog).some((l) => l.pagesRead > 0),
  )
  return hasAnyLog ? "in-progress" : "planned"
}

interface CategoryCoverage {
  id: string
  name: string
  color: string
  completed: number
  inProgress: number
  planned: number
  total: number
  pct: number
  status: "missing" | "light" | "strong"
}

export default function GapAnalysis() {
  const { label } = usePersonality()
  const { courses } = useCourse()
  const allPlans = usePlanStore((s) => s.allPlans)
  const activePlanIds = usePlanStore((s) => s.activePlanIds)

  const coverage: CategoryCoverage[] = (() => {
    const certified = loadCertified()
    return ROADMAP.categories.map((cat) => {
      let completed = 0
      let inProgress = 0
      let planned = 0
      const total = cat.levels.reduce((s, lvl) => s + lvl.certs.length, 0)
      for (const lvl of cat.levels) {
        for (const cert of lvl.certs) {
          const status = statusForCert(cert, courses, allPlans, activePlanIds, certified)
          if (status === "completed") completed++
          else if (status === "in-progress") inProgress++
          else if (status === "planned") planned++
        }
      }
      const pct = total > 0 ? completed / total : 0
      let status: CategoryCoverage["status"] = "missing"
      if (completed >= 3 || pct >= 0.15) status = "strong"
      else if (completed > 0 || inProgress > 0 || planned > 0) status = "light"
      return {
        id: cat.id,
        name: cat.name,
        color: cat.color,
        completed,
        inProgress,
        planned,
        total,
        pct,
        status,
      }
    })
  })()

  const anyCerts = coverage.some((c) => c.completed + c.inProgress + c.planned > 0)
  const missing = coverage.filter((c) => c.status === "missing")
  const light = coverage.filter((c) => c.status === "light")
  const strong = coverage.filter((c) => c.status === "strong")

  return (
    <div className="border border-border rounded-xl bg-card/50 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Layers className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">{label("gapAnalysisTitle")}</h2>
      </div>

      {!anyCerts && (
        <div className="p-4 rounded-lg border border-border bg-background/50 text-sm text-muted-foreground">
          {label("gapAnalysisEmpty")}
        </div>
      )}

      {anyCerts && (
        <>
          {missing.length > 0 && (
            <div className="mb-4 p-3 rounded-lg border border-red-500/20 bg-red-500/5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                  {label("gapAnalysisMissing")}
                </span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                {missing.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="font-medium text-foreground">{c.name}</span>
                    <span>— 0 / {c.total}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {light.length > 0 && (
            <div className="mb-4 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
                  {label("gapAnalysisWeak")}
                </span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                {light.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="font-medium text-foreground">{c.name}</span>
                    <span>— {c.completed} / {c.total}</span>
                    {c.inProgress > 0 && <span>(+{c.inProgress} in progress)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {strong.length > 0 && (
            <div className="p-3 rounded-lg border border-green-500/20 bg-green-500/5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">
                  {label("gapAnalysisStrong")}
                </span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                {strong.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="font-medium text-foreground">{c.name}</span>
                    <span>— {c.completed} / {c.total}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
