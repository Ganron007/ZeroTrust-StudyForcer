import { useState, useMemo, useCallback } from "react"
import { FileText, Download, FileSpreadsheet, Printer } from "lucide-react"
import { usePersonality } from "./PersonalityProvider"
import { usePlanStore } from "@/lib/plan-store"
import { useCourse } from "./CourseProvider"
import { buildAuditReport } from "@/lib/audit-report"
import { downloadCsv, downloadJson } from "@/lib/export-utils"
import { showToast } from "./NotificationToast"
import { formatStr } from "@/lib/personality"

interface ReportGeneratorProps {
  className?: string
}

/**
 * Phase 2.1: PDF / CSV report export.
 *
 * Provides three export modes:
 *  - CSV: per-plan summary (course, plan, pages read, total, %, deadline)
 *  - JSON: full audit-report payload (same data shape as the markdown export)
 *  - PDF: opens a print-friendly HTML view; the user uses the browser's
 *    "Save as PDF" action from the print dialog. Works in Tauri WebView2
 *    AND in any browser — zero PDF dependencies.
 */
export default function ReportGenerator({ className = "" }: ReportGeneratorProps) {
  const { label } = usePersonality()
  const { courses } = useCourse()
  const allPlans = usePlanStore((s) => s.allPlans)
  const activePlanIds = usePlanStore((s) => s.activePlanIds)
  const [generating, setGenerating] = useState<"csv" | "json" | "pdf" | null>(null)

  const report = useMemo(
    () => buildAuditReport(courses, allPlans, activePlanIds),
    [courses, allPlans, activePlanIds],
  )

  const today = report.generatedAt

  const handleCsv = useCallback(() => {
    setGenerating("csv")
    try {
      const rows: string[][] = []
      rows.push(["Course", "Plan", "Pages Read", "Total Pages", "Progress %", "Deadline"])
      for (const p of report.activePlans) {
        rows.push([
          p.course,
          p.plan,
          String(p.pagesRead),
          String(p.totalPages),
          String(Math.round(p.pct * 100)),
          p.deadline ?? "open-ended",
        ])
      }
      // Add a second section: domain coverage (if any)
      if (report.domainCoverage.length > 0) {
        rows.push([])
        rows.push(["Domain Coverage"])
        rows.push(["Domain", "Exam Weight %", "Your Progress %"])
        for (const d of report.domainCoverage) {
          rows.push([d.domain, String(d.weight), String(d.pctDone)])
        }
      }
      // Add category coverage
      rows.push([])
      rows.push(["Category Coverage"])
      rows.push(["Category", "Completed", "Total", "%"])
      for (const c of report.coverage) {
        rows.push([c.name, String(c.completed), String(c.total), String(Math.round(c.pct * 100))])
      }
      downloadCsv(`study-report-${today}.csv`, rows)
      showToast(label("reportExportSuccess"), "complete")
    } catch (e) {
      console.error("CSV export failed:", e)
      showToast(label("reportExportFailed"), "break")
    } finally {
      setGenerating(null)
    }
  }, [report, today, label])

  const handleJson = useCallback(() => {
    setGenerating("json")
    try {
      downloadJson(`study-report-${today}.json`, report)
      showToast(label("reportExportSuccess"), "complete")
    } catch (e) {
      console.error("JSON export failed:", e)
      showToast(label("reportExportFailed"), "break")
    } finally {
      setGenerating(null)
    }
  }, [report, today, label])

  const handlePdf = useCallback(() => {
    setGenerating("pdf")
    try {
      openPrintWindow(report)
      showToast(label("reportPrintOpened"), "info")
    } catch (e) {
      console.error("Print view failed:", e)
      showToast(label("reportExportFailed"), "break")
    } finally {
      setGenerating(null)
    }
  }, [report, label])

  return (
    <div className={`border border-border rounded-xl bg-card/50 p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        <FileText className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">{label("reportTitle")}</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">{label("reportSubtitle")}</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          onClick={handleCsv}
          disabled={generating !== null}
          data-testid="report-csv"
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          {generating === "csv" ? "..." : label("reportExportCsv")}
        </button>
        <button
          onClick={handleJson}
          disabled={generating !== null}
          data-testid="report-json"
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-3.5 h-3.5" />
          {generating === "json" ? "..." : label("reportExportJson")}
        </button>
        <button
          onClick={handlePdf}
          disabled={generating !== null}
          data-testid="report-pdf"
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Printer className="w-3.5 h-3.5" />
          {generating === "pdf" ? "..." : label("reportExportPdf")}
        </button>
      </div>
    </div>
  )
}

/**
 * Open a print-friendly HTML view of the audit report in a new window.
 * The user can use their browser's "Save as PDF" action to export.
 */
function openPrintWindow(report: ReturnType<typeof buildAuditReport>): void {
  if (typeof window === "undefined") return
  const win = window.open("", "_blank", "width=900,height=1200")
  if (!win) {
    throw new Error("Popup blocked — allow popups to export PDF")
  }
  const css = `
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
           color: #111; max-width: 800px; margin: 32px auto; padding: 0 24px; line-height: 1.5; }
    h1 { font-size: 28px; margin-bottom: 4px; }
    h2 { font-size: 18px; margin-top: 32px; border-bottom: 2px solid #ddd; padding-bottom: 4px; }
    .meta { color: #666; font-size: 12px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
    th { background: #f5f5f5; font-weight: 600; }
    .stat { display: inline-block; padding: 8px 14px; border: 1px solid #ddd;
            border-radius: 6px; margin: 4px 8px 4px 0; font-size: 13px; }
    .stat .v { font-size: 20px; font-weight: 700; display: block; }
    .gaps li { margin-bottom: 4px; }
    @media print {
      body { margin: 0; padding: 0; }
      .no-print { display: none; }
      h1 { margin-top: 0; }
    }
  `
  const sections: string[] = []
  sections.push(`<h1>ZeroTrust.StudyForcer — Study Report</h1>`)
  sections.push(
    `<div class="meta">Generated: ${report.generatedAt} · App Version: ${formatVersion()} · For employer-funded study budgets</div>`,
  )

  sections.push(`<h2>Executive Summary</h2>`)
  sections.push(
    `<span class="stat"><span class="v">${report.studyHours} h</span>Study hours logged</span>`,
  )
  sections.push(
    `<span class="stat"><span class="v">${report.totalPagesRead.toLocaleString()} / ${report.totalPlannedPages.toLocaleString()}</span>Pages read</span>`,
  )
  sections.push(
    `<span class="stat"><span class="v">${report.certsCompleted} / ${report.certsTotal}</span>Certifications (${report.certsInProgress} in progress)</span>`,
  )
  sections.push(
    `<span class="stat"><span class="v">${report.readinessScore}/100</span>Readiness score</span>`,
  )
  sections.push(`<div style="clear:both"></div>`)

  if (report.activePlans.length > 0) {
    sections.push(`<h2>Active Study Plans</h2>`)
    sections.push(
      `<table><thead><tr><th>Course</th><th>Plan</th><th>Pages Read</th><th>Progress</th><th>Deadline</th></tr></thead><tbody>`,
    )
    for (const p of report.activePlans) {
      sections.push(
        `<tr><td>${escapeHtml(p.course)}</td><td>${escapeHtml(p.plan)}</td><td>${p.pagesRead} / ${p.totalPages}</td><td>${Math.round(p.pct * 100)}%</td><td>${escapeHtml(p.deadline ?? "open-ended")}</td></tr>`,
      )
    }
    sections.push(`</tbody></table>`)
  }

  if (report.coverage.length > 0) {
    sections.push(`<h2>Certification Coverage</h2>`)
    sections.push(
      `<table><thead><tr><th>Category</th><th>Completed</th><th>Total</th><th>%</th></tr></thead><tbody>`,
    )
    for (const c of report.coverage) {
      sections.push(
        `<tr><td>${escapeHtml(c.name)}</td><td>${c.completed}</td><td>${c.total}</td><td>${Math.round(c.pct * 100)}%</td></tr>`,
      )
    }
    sections.push(`</tbody></table>`)
  }

  if (report.domainCoverage.length > 0) {
    sections.push(`<h2>Domain Coverage</h2>`)
    sections.push(
      `<table><thead><tr><th>Domain</th><th>Exam Weight</th><th>Your Progress</th></tr></thead><tbody>`,
    )
    for (const d of report.domainCoverage) {
      sections.push(
        `<tr><td>${escapeHtml(d.domain)}</td><td>${d.weight}%</td><td>${d.pctDone}%</td></tr>`,
      )
    }
    sections.push(`</tbody></table>`)
  }

  if (report.gaps.length > 0) {
    sections.push(`<h2>Gaps Identified</h2>`)
    sections.push(`<p>Categories with <strong>zero</strong> coverage:</p><ul class="gaps">`)
    for (const g of report.gaps) {
      sections.push(`<li><strong>${escapeHtml(g)}</strong></li>`)
    }
    sections.push(`</ul>`)
  } else {
    sections.push(
      `<h2>Gaps Identified</h2><p>No major gaps. Every category has at least one in-progress or completed cert.</p>`,
    )
  }

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>ZTSF Study Report ${report.generatedAt}</title><style>${css}</style></head><body>${sections.join("\n")}<script>setTimeout(()=>window.print(),500)</script></body></html>`

  win.document.open()
  win.document.write(html)
  win.document.close()
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;"
      case "<": return "&lt;"
      case ">": return "&gt;"
      case '"': return "&quot;"
      case "'": return "&#39;"
      default: return c
    }
  })
}

function formatVersion(): string {
  if (typeof __APP_VERSION__ !== "undefined") return __APP_VERSION__
  return "unknown"
}
