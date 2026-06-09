import { useState } from "react"
import { FileText, Download, Calendar, Award, BookOpen, AlertTriangle } from "lucide-react"
import { usePersonality } from "./PersonalityProvider"
import { usePlanStore } from "@/lib/plan-store"
import { useCourse } from "./CourseProvider"
import { showToast } from "./NotificationToast"
import { buildAuditReport, reportToMarkdown } from "@/lib/audit-report"

export default function ComplianceReport() {
  const { label } = usePersonality()
  const { courses } = useCourse()
  const allPlans = usePlanStore((s) => s.allPlans)
  const activePlanIds = usePlanStore((s) => s.activePlanIds)
  const [generating, setGenerating] = useState(false)

  // C3 fix: don't memoize — buildAuditReport reads localStorage (certified
  // certs) which can change in sibling CertPathView. Re-running on every
  // render is cheap (5 categories × 68 certs is trivial) and ensures the
  // report always reflects current state.
  const report = buildAuditReport(courses, allPlans, activePlanIds)

  const handleExport = async () => {
    setGenerating(true)
    try {
      const md = reportToMarkdown(report)
      // C4 fix: window.showSaveFilePicker is now typed via vite-env.d.ts.
      // No need for `as unknown as` escape hatch.
      if (typeof window !== "undefined" && window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: `compliance-report-${report.generatedAt}.md`,
            types: [
              {
                description: "Markdown",
                accept: { "text/markdown": [".md"] },
              },
            ],
          })
          const writable = await handle.createWritable()
          await writable.write(md)
          await writable.close()
          // C5 fix: use a dedicated toast template so the personality
          // layer can customize the success message independently.
          showToast(label("complianceExportSuccess"), "complete")
        } catch (err) {
          if ((err as { name?: string }).name === "AbortError") return
          fallbackDownload(md, report.generatedAt)
        }
      } else {
        fallbackDownload(md, report.generatedAt)
      }
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="border border-border rounded-xl bg-card/50 p-5">
      <div className="flex items-center gap-2 mb-1">
        <FileText className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">{label("complianceTitle")}</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">{label("complianceSubtitle")}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat icon={Calendar} label={label("complianceHours")} value={`${report.studyHours}h`} color="text-blue-500" bg="bg-blue-500/10" />
        <Stat
          icon={BookOpen}
          label={label("complianceDomains")}
          value={`${report.coverage.filter((c) => c.completed > 0).length}/${report.coverage.length}`}
          color="text-emerald-500"
          bg="bg-emerald-500/10"
        />
        <Stat
          icon={Award}
          label={label("complianceCerts")}
          value={`${report.certsCompleted}/${report.certsTotal}`}
          color="text-amber-500"
          bg="bg-amber-500/10"
        />
        <Stat
          icon={AlertTriangle}
          label={label("complianceGaps")}
          value={`${report.gaps.length}`}
          color={report.gaps.length > 0 ? "text-red-500" : "text-green-500"}
          bg={report.gaps.length > 0 ? "bg-red-500/10" : "bg-green-500/10"}
        />
      </div>

      <div className="flex items-center justify-between p-4 rounded-lg border border-primary/20 bg-primary/5">
        <div>
          <p className="text-sm font-medium text-foreground">
            {label("complianceReadiness")}: <span className="text-primary font-bold">{report.readinessScore}/100</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {label("complianceGenerated")}: {report.generatedAt}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={generating}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          {generating ? "..." : label("complianceExport")}
        </button>
      </div>
    </div>
  )
}

interface StatProps {
  icon: typeof Calendar
  label: string
  value: string
  color: string
  bg: string
}

function Stat({ icon: Icon, label, value, color, bg }: StatProps) {
  return (
    <div className="p-3 rounded-lg border border-border bg-card">
      <div className={`w-7 h-7 rounded-md flex items-center justify-center mb-1.5 ${bg}`}>
        <Icon className={`w-3.5 h-3.5 ${color}`} />
      </div>
      <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  )
}

function fallbackDownload(content: string, date: string) {
  const blob = new Blob([content], { type: "text/markdown" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `compliance-report-${date}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
