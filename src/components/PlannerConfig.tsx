"use client"

import { useState, useRef } from "react"
import {
  resolveBookPage, getChapterPageRanges,
} from "@/lib/cissp-data"
import { useCourse } from "@/components/CourseProvider"
import type { CourseConfig } from "@/types/course"
import { getTrackingLabels } from "@/types/course"
import {
  CalendarDays, BookOpen, ChevronDown, ChevronUp,
  RotateCcw, BookMarked, CheckCircle2, Save,
  Clock, Calendar, Upload, Download, ImagePlus, GraduationCap,
} from "lucide-react"
import DatePicker from "./DatePicker"

const DAY_LABELS = [
  { dow: 0, short: "Su", label: "Sunday" },
  { dow: 1, short: "Mo", label: "Monday" },
  { dow: 2, short: "Tu", label: "Tuesday" },
  { dow: 3, short: "We", label: "Wednesday" },
  { dow: 4, short: "Th", label: "Thursday" },
  { dow: 5, short: "Fr", label: "Friday" },
  { dow: 6, short: "Sa", label: "Saturday" },
]

interface PlannerConfigProps {
  startDate: string
  pagesPerDay: number
  chapterStartOverrides: Record<number, number>
  studyDays: number[]
  startingChapterId: number
  targetEndDate?: string
  targetDayCount?: number
  anchor: import("@/lib/plan-storage").Anchor
  planName: string
  lastSaved: string | null
  onStartDateChange: (date: string) => void
  onPagesPerDayChange: (pages: number) => void
  onChapterStartChange: (chapterId: number, startPage: number) => void
  onStudyDaysChange: (days: number[]) => void
  onStartingChapterChange: (chapterId: number) => void
  onTargetEndDateChange?: (date: string | undefined) => void
  onTargetDayCountChange?: (count: number | undefined) => void
  onAnchorChange?: (anchor: import("@/lib/plan-storage").Anchor) => void
  onReset: () => void
  onSave: () => void
}

function AccordionSection({
  id, open, onToggle, icon, iconColor, label, summary, children,
}: {
  id: string
  open: boolean
  onToggle: () => void
  icon: React.ReactNode
  iconColor: string
  label: string
  summary: string
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-border/60 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors text-left"
        aria-expanded={open}
        aria-controls={`acc-${id}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${iconColor}`}>
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-none">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{summary}</p>
          </div>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      </button>
      {open && (
        <div id={`acc-${id}`} className="px-4 pb-4 bg-muted/10">
          {children}
        </div>
      )}
    </div>
  )
}

export default function PlannerConfig({
  startDate, pagesPerDay, chapterStartOverrides, studyDays, startingChapterId,
  targetEndDate, targetDayCount, anchor,
  planName, lastSaved,
  onStartDateChange, onPagesPerDayChange, onChapterStartChange,
  onStudyDaysChange, onStartingChapterChange, onTargetEndDateChange,
  onTargetDayCountChange, onAnchorChange, onReset, onSave,
}: PlannerConfigProps) {
  const {
    activeCourse, chapters, totalBookPages, unitColors, unitNames,
    refreshCourses, saveActiveCourse, setCourseLogo,
  } = useCourse()

  const labels = getTrackingLabels(activeCourse?.trackingMode)

  const [open, setOpen] = useState<Record<string, boolean>>({
    startDate: true, pagesPerDay: false,
    studyDays: false, startingChapter: false, chapterPages: false,
    course: false, logo: false, anchor: false,
  })

  const toggle = (key: string) =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }))

  const [expandedUnits, setExpandedUnits] = useState<Record<number, boolean>>({})
  const toggleUnit = (unit: number) =>
    setExpandedUnits((prev) => ({ ...prev, [unit]: !prev[unit] }))

  const units = activeCourse ? Array.from(new Set(chapters.map((c) => c.unitId))) : []

  const [bookPageInput, setBookPageInput] = useState("")

  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSave = () => {
    onSave()
    setSaved(true)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 2500)
  }

  const PAGE_PRESETS = [10, 20, 30, 50, 75]

  const ranges = getChapterPageRanges(chapters)

  // ── Course Import / Export ──
  const handleImport = async () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const parsed = JSON.parse(text) as CourseConfig
        if (!parsed || typeof parsed !== "object" || typeof parsed.id !== "string" || typeof parsed.name !== "string") {
          throw new Error("Missing required fields (id, name).")
        }
        await saveActiveCourse(parsed)
        await refreshCourses()
        alert(`Imported "${parsed.name}" successfully!`)
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Invalid course JSON file."
        alert(`Import failed: ${msg}`)
      }
    }
    input.click()
  }

  const handleExport = async () => {
    if (!activeCourse) return
    const json = JSON.stringify(activeCourse, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${activeCourse.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Logo Upload ──
  const handleLogoUpload = async () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".svg"
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file || !activeCourse) return
      const text = await file.text()
      try {
        await setCourseLogo(activeCourse.id, text)
        alert("Logo updated!")
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to set logo."
        alert(msg)
      }
    }
    input.click()
  }

  if (!activeCourse) {
    return <div className="p-4 text-sm text-muted-foreground">No course loaded.</div>
  }

  return (
    <div className="flex flex-col">
      {/* Top: plan name + Save/Reset */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/60">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{planName}</p>
          {lastSaved && (
            <p className="text-xs text-muted-foreground/60 mt-0.5 leading-none">saved {lastSaved}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-muted/60"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
          <button
            onClick={handleSave}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 ${
              saved
                ? "bg-green-500/10 border-green-500/40 text-green-600 dark:text-green-400"
                : "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
            }`}
          >
            {saved
              ? <><CheckCircle2 className="w-3.5 h-3.5" />Saved</>
              : <><Save className="w-3.5 h-3.5" />Save</>}
          </button>
        </div>
      </div>

      {/* Course Management */}
      <AccordionSection
        id="course"
        open={open.course}
        onToggle={() => toggle("course")}
        icon={<GraduationCap className="w-3.5 h-3.5 text-rose-500" />}
        iconColor="bg-rose-500/10"
        label="Course Config"
        summary={activeCourse.name}
      >
        <div className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground">
            ID: <span className="font-mono text-foreground">{activeCourse.id}</span>
            {activeCourse.edition && <> &middot; {activeCourse.edition}</>}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleImport}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-background text-xs font-medium hover:bg-muted transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              Import JSON
            </button>
            <button
              onClick={handleExport}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-background text-xs font-medium hover:bg-muted transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Export JSON
            </button>
          </div>
        </div>
      </AccordionSection>

      {/* Logo */}
      <AccordionSection
        id="logo"
        open={open.logo}
        onToggle={() => toggle("logo")}
        icon={<ImagePlus className="w-3.5 h-3.5 text-pink-500" />}
        iconColor="bg-pink-500/10"
        label="Course Logo"
        summary="Upload custom SVG"
      >
        <div className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground">
            Upload an SVG logo for this course. It will appear in the header and loading screen.
          </p>
          <button
            onClick={handleLogoUpload}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-background text-xs font-medium hover:bg-muted transition-all"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            Choose SVG file
          </button>
        </div>
      </AccordionSection>

      {/* Start Date */}
      <AccordionSection
        id="startDate"
        open={open.startDate}
        onToggle={() => toggle("startDate")}
        icon={<CalendarDays className="w-3.5 h-3.5 text-blue-500" />}
        iconColor="bg-blue-500/10"
        label="Start Date"
        summary={startDate}
      >
        <div className="space-y-2 pt-2">
          <DatePicker
            value={startDate}
            onChange={(v) => onStartDateChange(v || "")}
          />
          <p className="text-xs text-muted-foreground">
            Schedule is generated forward from this date.
          </p>
        </div>
      </AccordionSection>

      {/* Plan Mode */}
      <AccordionSection
        id="anchor"
        open={open.anchor}
        onToggle={() => toggle("anchor")}
        icon={<CalendarDays className="w-3.5 h-3.5 text-rose-500" />}
        iconColor="bg-rose-500/10"
        label="Plan Anchor"
        summary={anchor === "pagesPerDay" ? "Pace driven" : "Deadline driven"}
      >
        <div className="space-y-3 pt-2">
          <div className="flex gap-1.5">
            {([
              { key: "fixedPace", label: "Fixed Pace", value: "pagesPerDay" as const },
              { key: "fixedDeadline", label: "Fixed Deadline", value: "endDate" as const },
              { key: "fixedDuration", label: "Fixed Duration", value: "endDate" as const },
            ]).map((preset) => {
              const isActive =
                (preset.key === "fixedPace" && anchor === "pagesPerDay") ||
                (preset.key !== "fixedPace" && anchor === "endDate" &&
                  ((preset.key === "fixedDeadline" && !targetDayCount) ||
                   (preset.key === "fixedDuration" && !!targetDayCount)))
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => {
                    onAnchorChange?.(preset.value)
                    if (preset.key === "fixedPace") {
                      onTargetDayCountChange?.(undefined)
                    } else if (preset.key === "fixedDeadline") {
                      onTargetDayCountChange?.(undefined)
                    }
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {anchor === "pagesPerDay" && "You control the daily pace. End date is calculated automatically."}
            {anchor === "endDate" && !targetDayCount && "Set a finish date. Daily pace is calculated automatically."}
            {anchor === "endDate" && !!targetDayCount && "Set how many study days you want. Pace and end date are calculated automatically."}
          </p>

          {anchor === "endDate" && !targetDayCount && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground block">Target end date</label>
              <DatePicker
                value={targetEndDate}
                onChange={(v) => onTargetEndDateChange?.(v || undefined)}
                minDate={startDate}
              />
              {targetEndDate && (
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                  {(() => {
                    const s = new Date(startDate)
                    const e = new Date(targetEndDate)
                    if (e < s) {
                      return <p className="text-xs text-red-500">End date must be after start date.</p>
                    }
                    let studyDayCount = 0
                    const curr = new Date(s)
                    while (curr <= e) {
                      if (studyDays.includes(curr.getDay())) studyDayCount++
                      curr.setDate(curr.getDate() + 1)
                    }
                    const remainingPages = totalBookPages - chapters.slice(0, startingChapterId - 1).reduce((sum, c) => sum + c.pages, 0)
                      + (chapterStartOverrides[startingChapterId] ? chapterStartOverrides[startingChapterId] - 1 : 0)
                    const suggested = Math.max(1, Math.ceil(remainingPages / Math.max(1, studyDayCount)))
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Study days in range</span>
                          <span className="text-xs font-bold text-foreground">{studyDayCount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Remaining</span>
                          <span className="text-xs font-bold text-foreground">{remainingPages}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Auto pace</span>
                          <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{suggested} / day</span>
                        </div>
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
          )}

          {anchor === "endDate" && !!targetDayCount && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground block">Target study days</label>
              <input
                type="number"
                min={1}
                max={365}
                value={targetDayCount ?? ""}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10)
                  onTargetDayCountChange?.(isNaN(val) ? undefined : val)
                }}
                className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
              {targetDayCount && targetDayCount > 0 && (
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                  {(() => {
                    const remainingPages = totalBookPages - chapters.slice(0, startingChapterId - 1).reduce((sum, c) => sum + c.pages, 0)
                      + (chapterStartOverrides[startingChapterId] ? chapterStartOverrides[startingChapterId] - 1 : 0)
                    const suggested = Math.max(1, Math.ceil(remainingPages / targetDayCount))
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Remaining</span>
                          <span className="text-xs font-bold text-foreground">{remainingPages}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Auto pace</span>
                          <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{suggested} / day</span>
                        </div>
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </AccordionSection>

      {/* Pages per Day */}
      <AccordionSection
        id="pagesPerDay"
        open={open.pagesPerDay}
        onToggle={() => toggle("pagesPerDay")}
        icon={<BookOpen className="w-3.5 h-3.5 text-amber-500" />}
        iconColor="bg-amber-500/10"
        label={`${labels.itemsCapital} per Day`}
        summary={`${pagesPerDay} ${labels.items} / day`}
      >
        <div className="space-y-3 pt-2">
          {anchor === "endDate" && (
            <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">Auto</span>
              <span className="text-xs text-muted-foreground">
                Calculated from deadline. Adjusting this will switch to pace-driven mode.
              </span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={pagesPerDay}
              onChange={(e) => onPagesPerDayChange(Number(e.target.value))}
              className={`flex-1 accent-primary h-1.5 cursor-pointer ${anchor === "endDate" ? "opacity-60" : ""}`}
            />
            <input
              type="number"
              min={1}
              max={100}
              value={pagesPerDay}
              onChange={(e) =>
                onPagesPerDayChange(Math.min(100, Math.max(1, Number(e.target.value) || 1)))
              }
              className={`w-14 px-1.5 py-1.5 border border-border rounded-lg bg-background text-primary text-center text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all ${anchor === "endDate" ? "opacity-60" : ""}`}
            />
          </div>
          <div className="flex gap-1.5">
            {PAGE_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPagesPerDayChange(p)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  pagesPerDay === p
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                } ${targetEndDate ? "opacity-60" : ""}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </AccordionSection>

      {/* Study Days */}
      <AccordionSection
        id="studyDays"
        open={open.studyDays}
        onToggle={() => toggle("studyDays")}
        icon={<Calendar className="w-3.5 h-3.5 text-violet-500" />}
        iconColor="bg-violet-500/10"
        label="Study Days"
        summary={`${studyDays.length} day${studyDays.length !== 1 ? "s" : ""} / week`}
      >
        <div className="space-y-3 pt-2">
          <div className="flex gap-1">
            {DAY_LABELS.map(({ dow, short, label }) => {
              const active = studyDays.includes(dow)
              const isWeekend = dow === 0 || dow === 6
              return (
                <button
                  key={dow}
                  type="button"
                  title={label}
                  aria-label={`${active ? "Remove" : "Add"} ${label}`}
                  onClick={() => {
                    const next = active
                      ? studyDays.filter((d) => d !== dow)
                      : [...studyDays, dow].sort()
                    if (next.length > 0) onStudyDaysChange(next)
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all select-none ${
                    active
                      ? isWeekend
                        ? "bg-violet-500 text-white border-violet-500"
                        : "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {short}
                </button>
              )
            })}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{studyDays.length}d/wk selected</span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => onStudyDaysChange([1, 2, 3, 4, 5])}
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Weekdays
              </button>
              <button
                type="button"
                onClick={() => onStudyDaysChange([0, 1, 2, 3, 4, 5, 6])}
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Every day
              </button>
            </div>
          </div>
        </div>
      </AccordionSection>

      {/* Starting Chapter */}
      <AccordionSection
        id="startingChapter"
        open={open.startingChapter}
        onToggle={() => toggle("startingChapter")}
        icon={<BookMarked className="w-3.5 h-3.5 text-teal-500" />}
        iconColor="bg-teal-500/10"
        label="Starting Chapter"
        summary={`Chapter ${startingChapterId}`}
      >
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-7 gap-1">
            {chapters.map((ch) => {
              const isSkipped = ch.id < startingChapterId
              const isActive = ch.id === startingChapterId
              const color = unitColors[ch.unitId]
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => onStartingChapterChange(ch.id)}
                  title={`Ch. ${ch.id}: ${ch.title}`}
                  aria-label={`Start from Chapter ${ch.id}`}
                  className={`h-9 rounded-md text-xs font-bold border transition-all flex items-center justify-center ${
                    isSkipped
                      ? "opacity-40 bg-muted border-border"
                      : isActive
                      ? "text-white border-transparent ring-2 ring-offset-1 ring-offset-card scale-105"
                      : "bg-background border-border hover:border-primary/40 text-foreground"
                  }`}
                  style={
                    isActive
                      ? { backgroundColor: color }
                      : isSkipped
                      ? {}
                      : { borderColor: `${color}50` }
                  }
                >
                  {isSkipped ? <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" /> : ch.id}
                </button>
              )
            })}
          </div>

          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-xs font-semibold text-foreground mb-1">Jump to book page</p>
            <p className="text-xs text-muted-foreground mb-2">
              Type the page number from your book — the app will find the right chapter.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={totalBookPages}
                placeholder="e.g. 347"
                value={bookPageInput}
                onChange={(e) => setBookPageInput(e.target.value)}
                onBlur={() => {
                  const num = parseInt(bookPageInput, 10)
                  if (!isNaN(num) && num >= 1) {
                    const resolved = resolveBookPage(num, chapters)
                    if (resolved) {
                      onStartingChapterChange(resolved.chapterId)
                      onChapterStartChange(resolved.chapterId, resolved.pageWithinChapter)
                    }
                  }
                  setBookPageInput("")
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const num = parseInt(bookPageInput, 10)
                    if (!isNaN(num) && num >= 1) {
                      const resolved = resolveBookPage(num, chapters)
                      if (resolved) {
                        onStartingChapterChange(resolved.chapterId)
                        onChapterStartChange(resolved.chapterId, resolved.pageWithinChapter)
                      }
                    }
                    setBookPageInput("")
                    ;(e.target as HTMLInputElement).blur()
                  }
                }}
                className="flex-1 px-3 py-2 border border-border rounded-lg bg-muted/20 text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">of {totalBookPages}</span>
            </div>

            {(() => {
              const inputNum = parseInt(bookPageInput, 10)
              const preview = bookPageInput !== "" && !isNaN(inputNum) ? resolveBookPage(inputNum, chapters) : null
              const previewChapter = preview ? chapters.find((c) => c.id === preview.chapterId) : null
              if (!preview || !previewChapter) return null
              return (
                <div className="mt-2 flex items-center gap-2 rounded-md bg-primary/5 border border-primary/20 px-2.5 py-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: unitColors[previewChapter.unitId] }} />
                  <p className="text-xs text-foreground">
                    <span className="font-semibold">Ch.{previewChapter.id}</span> &mdash; {previewChapter.title}
                  </p>
                  <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap font-mono">p.{preview.pageWithinChapter}/{previewChapter.pages}</span>
                </div>
              )
            })()}
          </div>

          {(() => {
            const ch = chapters.find((c) => c.id === startingChapterId)!
            const chRange = ranges.find((r) => r.id === startingChapterId)!
            if (!ch || !chRange) return null
            const currentPageStart = chapterStartOverrides[ch.id] ?? 1
            const currentBookPage = chRange.bookStart + currentPageStart - 1
            const overallPct = Math.round((currentBookPage - 1) / totalBookPages * 100)
            const skippedCount = startingChapterId - 1
            return (
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Book page</span>
                  <span className="text-xs font-bold text-foreground">{currentBookPage} <span className="text-muted-foreground font-normal">/ {totalBookPages}</span></span>
                </div>
                <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${overallPct}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Ch.{ch.id}: {ch.title}</span>
                  <span className="text-xs font-semibold text-primary">{overallPct}% done</span>
                </div>
                {skippedCount > 0 && (
                  <p className="text-xs text-teal-600 dark:text-teal-400">{skippedCount} chapter{skippedCount !== 1 ? "s" : ""} skipped</p>
                )}
              </div>
            )
          })()}

          {(startingChapterId > 1 || (chapterStartOverrides[startingChapterId] ?? 1) > 1) && (
            <button
              type="button"
              onClick={() => { onStartingChapterChange(1); onChapterStartChange(1, 1); setBookPageInput("") }}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Reset to page 1 (start of book)
            </button>
          )}
        </div>
      </AccordionSection>

      {/* Chapter Starting Page */}
      <AccordionSection
        id="chapterPages"
        open={open.chapterPages}
        onToggle={() => toggle("chapterPages")}
        icon={<Clock className="w-3.5 h-3.5 text-emerald-500" />}
        iconColor="bg-emerald-500/10"
        label="Chapter Starting Page"
        summary="Set per-chapter start pages"
      >
        <div className="pt-2">
          <p className="text-xs text-muted-foreground mb-3">
            Mid-chapter? Expand a unit and set exactly where you left off.
          </p>
          <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
            {units.map((unitId) => {
              const unitChapters = chapters.filter((c) => c.unitId === unitId)
              const isExpanded = expandedUnits[unitId] ?? false
              const color = unitColors[unitId]
              const allSkipped = unitChapters.every((c) => c.id < startingChapterId)
              const hasOverrides = unitChapters.some(
                (c) => c.id >= startingChapterId && (chapterStartOverrides[c.id] ?? 1) > 1
              )
              return (
                <div key={unitId}>
                  <button
                    type="button"
                    onClick={() => toggleUnit(unitId)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors text-left ${allSkipped ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-xs font-semibold text-foreground">U{unitId}</span>
                      <span className="text-xs text-muted-foreground truncate">{unitNames[unitId]}</span>
                      {allSkipped && <span className="text-xs text-teal-600 dark:text-teal-400 flex-shrink-0">done</span>}
                      {!allSkipped && hasOverrides && <span className="text-xs text-amber-600 dark:text-amber-400 flex-shrink-0">modified</span>}
                    </div>
                    {isExpanded
                      ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                  </button>

                  {isExpanded && (
                    <div className="bg-muted/20 divide-y divide-border/50">
                      {unitChapters.map((chapter) => {
                        const isChapterSkipped = chapter.id < startingChapterId
                        const currentStart = isChapterSkipped ? chapter.pages : (chapterStartOverrides[chapter.id] ?? 1)
                        const isModified = !isChapterSkipped && currentStart > 1
                        const pctRead = Math.round(((currentStart - 1) / chapter.pages) * 100)
                        return (
                          <div key={chapter.id} className={`px-3 py-2.5 ${isChapterSkipped ? "opacity-40" : ""}`}>
                            <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-foreground">Ch.{chapter.id}</span>
                                  <span className="text-xs text-muted-foreground truncate">{chapter.title}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all"
                                      style={{ backgroundColor: color, width: isChapterSkipped ? "100%" : `${pctRead}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted-foreground tabular-nums w-8 text-right flex-shrink-0">
                                    {isChapterSkipped ? "done" : `${pctRead}%`}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col items-center gap-0.5 w-14 flex-shrink-0">
                                <span className="text-xs text-muted-foreground/60 leading-none">pg</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={chapter.pages}
                                  value={isChapterSkipped ? chapter.pages : currentStart}
                                  disabled={isChapterSkipped}
                                  onChange={(e) => {
                                    if (isChapterSkipped) return
                                    const val = Math.min(chapter.pages, Math.max(1, Number(e.target.value) || 1))
                                    onChapterStartChange(chapter.id, val)
                                  }}
                                  className={`w-14 px-1 py-1.5 border rounded-md text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background transition-all ${
                                    isChapterSkipped
                                      ? "cursor-not-allowed bg-muted border-border text-muted-foreground"
                                      : isModified
                                      ? "border-amber-400 text-amber-600 dark:text-amber-400"
                                      : "border-border text-foreground"
                                  }`}
                                />
                                <span className="text-xs text-muted-foreground/40 leading-none">/{chapter.pages}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </AccordionSection>
    </div>
  )
}
