import { useMemo } from "react"
import { AlertTriangle, Activity } from "lucide-react"
import type { CourseConfig, CourseExamDomain } from "@/types/course"
import { usePersonality } from "./PersonalityProvider"

// D6 fix: named constant for the WEAK threshold. A domain is flagged as
// WEAK when its completion ratio / target weight ratio falls below this value.
// 0.8 = "you've completed less than 80% of where you should be by exam weight".
const WEAK_THRESHOLD = 0.8

interface UnitProgress {
  completed: number
  total: number
  name: string
  color: string
  unitId: number
}

interface DomainAnalyzerProps {
  course: CourseConfig
  unitProgress: Record<number, UnitProgress>
}

interface DomainResult {
  domain: CourseExamDomain
  completed: number
  total: number
  pctDone: number
  ratio: number
  isWeak: boolean
  color: string
}

function deriveDomains(course: CourseConfig, unitProgress: Record<number, UnitProgress>): DomainResult[] {
  const domains = course.examDomains
  if (!domains || domains.length === 0) return []

  return domains.map((d) => {
    const matchingUnits = course.units.filter((u) => u.domainId === d.id)
    let completed = 0
    let total = 0
    let color = "#6B7280"

    for (const u of matchingUnits) {
      const up = unitProgress[u.id]
      if (!up) continue
      completed += up.completed
      total += up.total
      color = up.color
    }

    const pctDone = total > 0 ? Math.round((completed / total) * 100) : 0
    const ratio = total > 0 ? completed / total : 0
    const targetRatio = d.weight / 100
    const isWeak = total > 0 && targetRatio > 0 && ratio / targetRatio < WEAK_THRESHOLD

    return { domain: d, completed, total, pctDone, ratio, isWeak, color }
  })
}

export default function DomainAnalyzer({ course, unitProgress }: DomainAnalyzerProps) {
  const { label } = usePersonality()

  const domains = useMemo(() => deriveDomains(course, unitProgress), [course, unitProgress])

  if (domains.length === 0) return null

  const weakDomains = domains.filter((d) => d.isWeak)
  const strongDomains = domains.filter((d) => !d.isWeak)

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-semibold text-foreground text-sm">{label("domainWeaknessAnalysis")}</h3>
      </div>

      {weakDomains.length > 0 && (
        <div className="mb-4 p-3 rounded-lg border border-red-500/20 bg-red-500/5">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-xs font-semibold text-red-600">{label("domainWeakness")}</span>
          </div>
          <p className="text-xs text-muted-foreground">{label("domainThreshold")}</p>
        </div>
      )}

      <div className="space-y-4">
        {weakDomains.concat(strongDomains).map((d) => {
          const ratio = d.ratio
          const targetRatio = d.domain.weight / 100
          const gap = Math.round((targetRatio - ratio) * 100)

          return (
            <div key={d.domain.id}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-xs font-medium text-foreground truncate">{d.domain.name}</span>
                  {d.isWeak ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 flex-shrink-0">
                      {label("domainWeak")}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 flex-shrink-0">
                      {label("domainStrong")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] text-muted-foreground">{label("domainReadinessWeight")}: {d.pctDone}%</span>
                  <span className="text-[10px] text-muted-foreground">{label("domainTargetWeight")}: {d.domain.weight}%</span>
                </div>
              </div>

              <div className="w-full h-2 bg-muted rounded-full overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(d.pctDone, 100)}%`,
                    backgroundColor: d.color,
                  }}
                />
                <div
                  className="absolute top-0 h-full border-r-2 border-dashed"
                  style={{
                    left: `${Math.min(targetRatio * 100, 100)}%`,
                    borderColor: d.isWeak ? "#EF4444" : "#22C55E",
                  }}
                  title={`${label("domainTargetWeight")}: ${d.domain.weight}%`}
                />
              </div>

              <div className="flex items-center justify-between mt-1">
                <p className="text-[10px] text-muted-foreground">
                  {/* E1 fix: toFixed(1) shows fractional partial-log progress
                      (e.g. "0.4/45" instead of misleading "0/45"). */}
                  {d.completed.toFixed(1)}/{d.total} pages
                </p>
                {d.isWeak && (
                  <p className="text-[10px] font-medium text-red-500">
                    {gap}% {label("behind")}
                  </p>
                )}
                {!d.isWeak && (
                  <p className="text-[10px] font-medium text-green-500">
                    {label("onTrack")}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
