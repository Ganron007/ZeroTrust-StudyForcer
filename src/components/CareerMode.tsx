import { useState, useMemo } from "react"
import { Map, ChevronRight, CheckCircle, Circle, Clock } from "lucide-react"
import { usePersonality } from "./PersonalityProvider"
import certRoadmap from "@/data/cert-roadmap.json"

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

const LEVEL_ORDER = ["entry", "intermediate", "advanced", "expert"] as const

function sequenceForCategory(category: CertCategory): CertEntry[] {
  const orderedLevels = [...category.levels].sort((a, b) => {
    const ai = LEVEL_ORDER.indexOf(a.id as (typeof LEVEL_ORDER)[number])
    const bi = LEVEL_ORDER.indexOf(b.id as (typeof LEVEL_ORDER)[number])
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })

  const seq: CertEntry[] = []
  for (const lvl of orderedLevels) {
    for (const cert of lvl.certs) {
      seq.push(cert)
    }
  }
  return seq
}

export default function CareerMode() {
  const { label } = usePersonality()
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    ROADMAP.categories[0]?.id ?? null,
  )

  const certified = loadCertified()
  const selectedCategory = ROADMAP.categories.find((c) => c.id === selectedCategoryId)
  const sequence = useMemo(
    () => (selectedCategory ? sequenceForCategory(selectedCategory) : []),
    [selectedCategory],
  )

  const totalCost = useMemo(() => {
    if (!selectedCategory) return ""
    let low = 0
    let high = 0
    for (const c of sequence) {
      const m = c.cost.match(/\$([\d,]+)/g)
      if (m) {
        const nums = m.map((s) => parseInt(s.replace(/[$,]/g, ""), 10))
        if (nums.length === 1) low += nums[0]
        else {
          low += Math.min(...nums)
          high += Math.max(...nums)
        }
      }
    }
    if (low === 0) return ""
    return high > low ? `$${low.toLocaleString()}–$${high.toLocaleString()}` : `$${low.toLocaleString()}`
  }, [selectedCategory, sequence])

  const estimatedMonths = useMemo(() => {
    if (sequence.length === 0) return ""
    return `${sequence.length * 2}–${sequence.length * 4} months`
  }, [sequence])

  if (ROADMAP.categories.length === 0) return null

  return (
    <div className="border border-border rounded-xl bg-card/50 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Map className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">{label("careerModeTitle")}</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">{label("careerModeSubtitle")}</p>

      <div className="mb-4">
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
          {label("careerModePick")}
        </p>
        <div className="flex flex-wrap gap-2">
          {ROADMAP.categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                selectedCategoryId === cat.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/40"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {selectedCategory && sequence.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {label("careerModeSequence")}
            </p>
            {totalCost && (
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {label("careerModeEstimated")}: {estimatedMonths}
                </span>
                <span>·</span>
                <span>Total: {totalCost}</span>
              </div>
            )}
          </div>

          <ol className="space-y-2">
            {sequence.map((cert, idx) => {
              const isDone = certified.has(cert.id)
              // C1 fix: "next up" = first non-completed cert where ALL
              // previous certs in the sequence are completed. Previously used
              // `||` (any previous done = next up) which incorrectly flagged
              // multiple items as "Next" once 2+ adjacent certs were done.
              const isFirst =
                !isDone && sequence.slice(0, idx).every((c) => certified.has(c.id))

              return (
                <li
                  key={cert.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    isDone
                      ? "border-green-500/20 bg-green-500/5"
                      : isFirst
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex flex-col items-center flex-shrink-0">
                    {isDone ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Circle
                        className={`w-5 h-5 ${
                          isFirst ? "text-primary" : "text-muted-foreground/50"
                        }`}
                      />
                    )}
                    {idx < sequence.length - 1 && (
                      <ChevronRight
                        className="w-3 h-3 text-muted-foreground/40 mt-1 rotate-90"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {idx + 1}.
                      </span>
                      <span className="font-medium text-foreground text-sm truncate">
                        {cert.name}
                      </span>
                      {isDone && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500/20 text-green-600">
                          {label("careerModeCompleted")}
                        </span>
                      )}
                      {isFirst && !isDone && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                          {label("careerModeNext")}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {cert.provider} · {cert.cost}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </div>
  )
}
