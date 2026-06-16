"use client"

import { useState, useMemo } from "react"
import { ChevronLeft, Plus, X, ArrowUp, ArrowDown, Save, Download, Sparkles, RotateCcw, Eye, EyeOff } from "lucide-react"
import { saveCourse } from "@/lib/course-storage"
import { showToast } from "@/components/NotificationToast"
import { usePersonality } from "./PersonalityProvider"
import { formatStr } from "@/lib/personality"
import type { CourseConfig, CourseUnit, CourseChapter } from "@/types/course"
import {
  validateId,
  getNextChapterId,
  getNextUnitId,
  applyChapterFieldChange,
  toggleStudyDay as toggleStudyDayPure,
  buildCourseConfig as buildCourseConfigPure,
  validateCourseConfig,
  RESERVED_IDS,
  type BuilderInput,
  type BuilderUnit,
  type BuilderChapter,
} from "@/lib/course-builder-helpers"

interface CourseBuilderProps {
  onBack: () => void
  onCourseSaved: () => void
  existingCourses?: { id: string; name: string }[]
}

const DAY_LABELS = [
  { dow: 0, short: "Su", label: "Sunday" },
  { dow: 1, short: "Mo", label: "Monday" },
  { dow: 2, short: "Tu", label: "Tuesday" },
  { dow: 3, short: "We", label: "Wednesday" },
  { dow: 4, short: "Th", label: "Thursday" },
  { dow: 5, short: "Fr", label: "Friday" },
  { dow: 6, short: "Sa", label: "Saturday" },
]

const COLOR_PRESETS = [
  "#2563EB", "#7C3AED", "#059669", "#D97706",
  "#DC2626", "#0891B2", "#65A30D", "#C2410C",
  "#4F46E5", "#BE185D", "#047857", "#B45309",
]

interface ChapterState {
  id: number
  title: string
  pages: number
  bookPageStart: number | undefined
}

interface UnitState {
  id: number
  title: string
  color: string
  chapters: ChapterState[]
}

export default function CourseBuilder({ onBack, onCourseSaved, existingCourses = [] }: CourseBuilderProps) {
  const { label, toast: tToast } = usePersonality()
  // ── Basic fields ──────────────────────────────────────────────────────
  const [courseId, setCourseId] = useState("")
  const [courseName, setCourseName] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [edition, setEdition] = useState("")
  const [publisher, setPublisher] = useState("")

  // ── Units ─────────────────────────────────────────────────────────────
  const [units, setUnits] = useState<UnitState[]>([{
    id: 1,
    title: "",
    color: COLOR_PRESETS[0],
    chapters: [],
  }])

  // ── Default settings ──────────────────────────────────────────────────
  const [studyDays, setStudyDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [defaultPagesPerDay, setDefaultPagesPerDay] = useState(20)
  const [defaultStartingChapter, setDefaultStartingChapter] = useState(1)

  // ── Exam info (optional) ──────────────────────────────────────────────
  const [showExam, setShowExam] = useState(false)
  const [examFormat, setExamFormat] = useState("")
  const [examDuration, setExamDuration] = useState("")
  const [examPassing, setExamPassing] = useState("")
  const [examDomains, setExamDomains] = useState("")
  const [examExperience, setExamExperience] = useState("")

  // ── Study estimate (optional) ─────────────────────────────────────────
  const [showEstimate, setShowEstimate] = useState(false)
  const [estMin, setEstMin] = useState(3)
  const [estMax, setEstMax] = useState(5)

  // ── JSON preview toggle ───────────────────────────────────────────────
  const [showPreview, setShowPreview] = useState(true)

  // ── Validation ────────────────────────────────────────────────────────
  // Note: validateId, getNextChapterId, etc. are imported from
  // @/lib/course-builder-helpers so they can be unit-tested in isolation.

  // ── Unit CRUD ──────────────────────────────────────────────────────────
  function addUnit() {
    const nextId = getNextUnitId(units)
    setUnits([...units, {
      id: nextId,
      title: "",
      color: COLOR_PRESETS[(nextId - 1) % COLOR_PRESETS.length],
      chapters: [],
    }])
  }

  function removeUnit(index: number) {
    if (units.length <= 1) {
      showToast(formatStr(tToast("courseValidation"), { error: "Cannot remove the last unit" }), "info")
      return
    }
    setUnits(units.filter((_, i) => i !== index))
  }

  function moveUnit(index: number, direction: -1 | 1) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= units.length) return
    const next = [...units]
    ;[next[index], next[newIndex]] = [next[newIndex], next[index]]
    setUnits(next)
  }

  function updateUnit(index: number, field: keyof UnitState, value: string) {
    setUnits(units.map((u, i) => i === index ? { ...u, [field]: value } : u))
  }

  // ── Chapter CRUD ───────────────────────────────────────────────────────
  function addChapter(unitIndex: number) {
    const nextId = getNextChapterId(units)
    setUnits(units.map((u, i): UnitState =>
      i === unitIndex
        ? { ...u, chapters: [...u.chapters, { id: nextId, title: "", pages: 1, bookPageStart: undefined }] }
        : u
    ))
  }

  function removeChapter(unitIndex: number, chapterIndex: number) {
    setUnits(units.map((u, i): UnitState =>
      i === unitIndex
        ? { ...u, chapters: u.chapters.filter((_, ci) => ci !== chapterIndex) }
        : u
    ))
  }

  function moveChapter(unitIndex: number, chapterIndex: number, direction: -1 | 1) {
    const newIndex = chapterIndex + direction
    if (newIndex < 0 || newIndex >= units[unitIndex].chapters.length) return
    setUnits(units.map((u, i): UnitState => {
      if (i !== unitIndex) return u
      const next = [...u.chapters]
      ;[next[chapterIndex], next[newIndex]] = [next[newIndex], next[chapterIndex]]
      return { ...u, chapters: next }
    }))
  }

  function updateChapter(unitIndex: number, chapterIndex: number, field: keyof ChapterState, value: string) {
    setUnits(units.map((u, i): UnitState => {
      if (i !== unitIndex) return u
      return {
        ...u,
        chapters: u.chapters.map((c, ci): ChapterState => {
          if (ci !== chapterIndex) return c
          return applyChapterFieldChange(c, field, value)
        }),
      }
    }))
  }

  // ── Study days ──────────────────────────────────────────────────────────
  function toggleStudyDay(dow: number) {
    setStudyDays(prev => toggleStudyDayPure(prev, dow))
  }

  // ── Build CourseConfig ──────────────────────────────────────────────────
  // Delegates to the pure helper for the actual construction so it can
  // be unit-tested in isolation. The wrapper exists only to assemble
  // the BuilderInput from component state.
  function buildCourseConfig(): CourseConfig {
    const input: BuilderInput = {
      courseId,
      courseName,
      subtitle,
      edition,
      publisher,
      units,
      studyDays,
      defaultPagesPerDay,
      defaultStartingChapter,
      exam: { examFormat, examDuration, examPassing, examDomains, examExperience },
      estimate: { estMin, estMax },
    }
    return buildCourseConfigPure(input)
  }

  // ── Validation ──────────────────────────────────────────────────────────
  // Delegates to the pure helper for the actual validation rules.
  function validate(config: CourseConfig): string[] {
    return validateCourseConfig(config)
  }

  // ── Save ────────────────────────────────────────────────────────────────
  // RESERVED_IDS is imported from @/lib/course-builder-helpers.

  async function handleSave() {
    const config = buildCourseConfig()
    const errors = validate(config)
    if (errors.length > 0) {
      showToast(formatStr(tToast("courseValidation"), { error: errors[0] }), "info")
      return
    }
    // Reject reserved seed IDs
    if (RESERVED_IDS.includes(config.id)) {
      showToast(formatStr(tToast("courseValidation"), { error: `"${config.id}" is a reserved course ID and cannot be overwritten` }), "break")
      return
    }
    // Warn before overwriting an existing course
    const existing = existingCourses.find((c) => c.id === config.id)
    if (existing && !confirm(`Replace existing course "${existing.name}"? This will not affect existing study plans.`)) {
      return
    }
    try {
      await saveCourse(config)
      showToast(formatStr(tToast("courseSaved"), { name: config.name }), "complete")
      onCourseSaved()
    } catch (e) {
      showToast(tToast("courseSaveFailed"), "break")
      console.error("Course save failed:", e)
    }
  }

  // Phase 2.6: Export the current builder state to a .json file.
  // Re-uses the same buildCourseConfig() as Save, so the exported file
  // is byte-identical to what would be saved. Validates first; if
  // there are errors, abort and show the first one.
  function handleExport() {
    const config = buildCourseConfig()
    const errors = validate(config)
    if (errors.length > 0) {
      showToast(formatStr(tToast("courseValidation"), { error: errors[0] }), "info")
      return
    }
    try {
      const json = JSON.stringify(config, null, 2)
      const blob = new Blob([json], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${config.id}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast(formatStr(tToast("courseExported"), { name: config.name }), "complete")
    } catch (e) {
      console.error("Course export failed:", e)
      showToast(tToast("courseSaveFailed"), "break")
    }
  }

  // ── Load example ────────────────────────────────────────────────────────
  function hasUnsavedChanges(): boolean {
    return courseId !== "" || courseName !== "" || units.some((u) => u.title !== "" || u.chapters.length > 0)
  }

  function loadExample() {
    if (hasUnsavedChanges() && !confirm("Load example? This will replace your current form data.")) {
      return
    }
    setCourseId("example-book")
    setCourseName("Example Study Book")
    setSubtitle("1st Edition")
    setPublisher("Example Press")
    setDefaultPagesPerDay(15)
    setStudyDays([1, 2, 3, 4, 5, 6])
    setUnits([
      {
        id: 1, title: "Part 1: Foundations", color: COLOR_PRESETS[0],
        chapters: [
          { id: 1, title: "Getting Started", pages: 20, bookPageStart: 1 },
          { id: 2, title: "Core Concepts", pages: 35, bookPageStart: 21 },
          { id: 3, title: "First Principles", pages: 28, bookPageStart: 56 },
        ],
      },
      {
        id: 2, title: "Part 2: Deep Dive", color: COLOR_PRESETS[1],
        chapters: [
          { id: 4, title: "Advanced Topics", pages: 42, bookPageStart: 84 },
          { id: 5, title: "Real World Cases", pages: 38, bookPageStart: 126 },
          { id: 6, title: "Common Pitfalls", pages: 25, bookPageStart: 164 },
        ],
      },
      {
        id: 3, title: "Part 3: Mastery", color: COLOR_PRESETS[2],
        chapters: [
          { id: 7, title: "Expert Techniques", pages: 45, bookPageStart: 189 },
          { id: 8, title: "Putting It All Together", pages: 30, bookPageStart: 234 },
        ],
      },
    ])
  }

  // ── Derived ─────────────────────────────────────────────────────────────
  const config = useMemo(() => buildCourseConfig(), [
    courseId, courseName, subtitle, edition, publisher,
    units, studyDays, defaultPagesPerDay, defaultStartingChapter,
    examFormat, examDuration, examPassing, examDomains, examExperience,
    estMin, estMax,
  ])

  const errors = useMemo(() => validate(config), [config])
  const totalChapters = units.reduce((s, u) => s + u.chapters.length, 0)
  const totalPages = config.totalPages ?? 0

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-sm shadow-sm">
        <div className="w-full px-4 py-3 flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {label("backToPlanner")}
          </button>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="font-bold text-foreground text-base">{label("courseBuilder")}</h1>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <button
              onClick={loadExample}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs font-medium hover:bg-muted transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {label("loadExample")}
            </button>
            <button
              onClick={() => setShowPreview(v => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs font-medium hover:bg-muted transition-all"
            >
              {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPreview ? label("hideJSON") : label("showJSON")}
            </button>
            {/* Phase 2.6: Course Builder Export — download the current
                builder state as a .json file without persisting to the
                library. Useful for sharing or backing up a draft. */}
            <button
              onClick={handleExport}
              data-testid="course-builder-export"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs font-medium hover:bg-muted transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              {label("exportCourseJson")}
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all"
            >
              <Save className="w-3.5 h-3.5" />
            {label("saveCourse")}
            </button>
          </div>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="flex-1 w-full px-4 py-6">
        <div className="max-w-6xl mx-auto flex gap-6">
          {/* ── LEFT COLUMN: Form ──────────────────────────────────── */}
          <div className={`flex-1 min-w-0 space-y-6 ${showPreview ? "lg:w-1/2" : "lg:max-w-3xl"}`}>
            {/* Course Basics */}
            <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-muted/30">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">{label("courseBasics")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{label("courseBasicsDesc")}</p>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Course ID <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={courseId}
                    onChange={(e) => setCourseId(validateId(e.target.value))}
                    placeholder="e.g. atomic-habits, cissp-10th-ed"
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">URL-safe slug. No spaces. Used internally by the app.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Display Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="e.g. Atomic Habits"
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">Subtitle</label>
                    <input
                      type="text"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      placeholder="e.g. 10th Edition"
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">Edition</label>
                    <input
                      type="text"
                      value={edition}
                      onChange={(e) => setEdition(e.target.value)}
                      placeholder="e.g. 10th Edition"
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Publisher</label>
                  <input
                    type="text"
                    value={publisher}
                    onChange={(e) => setPublisher(e.target.value)}
                    placeholder="e.g. Sybex / Wiley"
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
              </div>
            </section>

            {/* Units & Chapters */}
            <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Units &amp; Chapters</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Define your course structure.</p>
                </div>
                <button
                  onClick={addUnit}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Unit
                </button>
              </div>
              <div className="p-5 space-y-4">
                {units.map((unit, ui) => (
                  <div key={unit.id} className="rounded-xl border border-border bg-muted/20 overflow-hidden">
                    {/* Unit header */}
                    <div className="px-4 py-3 flex items-center gap-2 bg-card border-b border-border">
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          onClick={() => moveUnit(ui, -1)}
                          disabled={ui === 0}
                          className={`p-1 rounded hover:bg-muted transition-colors ${ui === 0 ? "text-muted-foreground/20 cursor-not-allowed" : "text-muted-foreground hover:text-foreground"}`}
                          title="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveUnit(ui, 1)}
                          disabled={ui === units.length - 1}
                          className={`p-1 rounded hover:bg-muted transition-colors ${ui === units.length - 1 ? "text-muted-foreground/20 cursor-not-allowed" : "text-muted-foreground hover:text-foreground"}`}
                          title="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="w-4 h-4 rounded-full flex-shrink-0 border-2 border-background shadow-sm" style={{ backgroundColor: unit.color }} />
                      <input
                        type="text"
                        value={unit.title}
                        onChange={(e) => updateUnit(ui, "title", e.target.value)}
                        placeholder="Unit name"
                        className="flex-1 min-w-0 px-2 py-1 text-sm font-semibold bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none transition-colors text-foreground"
                      />
                      <input
                        type="color"
                        value={unit.color}
                        onChange={(e) => updateUnit(ui, "color", e.target.value)}
                        className="w-7 h-7 p-0 border-0 rounded cursor-pointer flex-shrink-0"
                        title="Unit color"
                      />
                      <button
                        onClick={() => removeUnit(ui)}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Remove unit"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Chapters */}
                    <div className="px-4 py-3 space-y-2">
                      {unit.chapters.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">No chapters yet. Click + Add Chapter below.</p>
                      )}
                      {unit.chapters.map((ch, ci) => (
                        <div key={ch.id} className="flex items-center gap-2 bg-card rounded-lg border border-border px-3 py-2">
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button
                              onClick={() => moveChapter(ui, ci, -1)}
                              disabled={ci === 0}
                              className={`p-0.5 rounded hover:bg-muted text-muted-foreground ${ci === 0 ? "cursor-not-allowed opacity-30" : ""}`}
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => moveChapter(ui, ci, 1)}
                              disabled={ci === unit.chapters.length - 1}
                              className={`p-0.5 rounded hover:bg-muted text-muted-foreground ${ci === unit.chapters.length - 1 ? "cursor-not-allowed opacity-30" : ""}`}
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-xs font-mono text-muted-foreground w-6 text-right flex-shrink-0">{ch.id}</span>
                          <input
                            type="text"
                            value={ch.title}
                            onChange={(e) => updateChapter(ui, ci, "title", e.target.value)}
                            placeholder="Chapter title"
                            className="flex-1 min-w-0 px-2 py-1 text-sm bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none transition-colors text-foreground"
                          />
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <input
                              type="number"
                              min={1}
                              value={ch.pages}
                              onChange={(e) => updateChapter(ui, ci, "pages", e.target.value)}
                              className="w-14 px-1.5 py-1 text-sm text-right font-mono border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
                              title="Pages in this chapter"
                            />
                            <span className="text-xs text-muted-foreground">p</span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0" title="Actual book page number (optional)">
                            <span className="text-[10px] text-muted-foreground">bk</span>
                            <input
                              type="number"
                              min={1}
                              value={ch.bookPageStart ?? ""}
                              placeholder="—"
                              onChange={(e) => updateChapter(ui, ci, "bookPageStart", e.target.value)}
                              className="w-14 px-1.5 py-1 text-sm text-right font-mono border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
                            />
                          </div>
                          <button
                            onClick={() => removeChapter(ui, ci)}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addChapter(ui)}
                        className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 px-1 py-1 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Chapter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Default Settings */}
            <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-muted/30">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Default Settings</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Default values for new study plans</p>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">Pages per Day</label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={defaultPagesPerDay}
                      onChange={(e) => setDefaultPagesPerDay(Math.max(1, Number(e.target.value) || 20))}
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">Starting Chapter</label>
                    <input
                      type="number"
                      min={1}
                      value={defaultStartingChapter}
                      onChange={(e) => setDefaultStartingChapter(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Study Days</label>
                  <div className="flex gap-1 max-w-sm">
                    {DAY_LABELS.map(({ dow, short }) => {
                      const active = studyDays.includes(dow)
                      return (
                        <button
                          key={dow}
                          type="button"
                          onClick={() => toggleStudyDay(dow)}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                            active
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground border-border hover:border-primary/40"
                          }`}
                        >
                          {short}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Blue = study day. At least one must be selected.</p>
                </div>
              </div>
            </section>

            {/* Exam Info (Optional) */}
            <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <button
                onClick={() => setShowExam(v => !v)}
                className="w-full px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
              >
                <div>
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Exam Info</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Optional — for certification courses</p>
                </div>
                <svg className={`w-4 h-4 text-muted-foreground transition-transform ${showExam ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showExam && (
                <div className="p-5 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Format</label>
                      <input
                        type="text"
                        value={examFormat}
                        onChange={(e) => setExamFormat(e.target.value)}
                        placeholder="e.g. CAT — 100-150 questions"
                        className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Duration</label>
                      <input
                        type="text"
                        value={examDuration}
                        onChange={(e) => setExamDuration(e.target.value)}
                        placeholder="e.g. 3 hours"
                        className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Passing Score</label>
                      <input
                        type="text"
                        value={examPassing}
                        onChange={(e) => setExamPassing(e.target.value)}
                        placeholder="e.g. 700/1000"
                        className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Domains Label</label>
                      <input
                        type="text"
                        value={examDomains}
                        onChange={(e) => setExamDomains(e.target.value)}
                        placeholder="e.g. 8 CBK domains"
                        className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">Experience Requirement</label>
                    <input
                      type="text"
                      value={examExperience}
                      onChange={(e) => setExamExperience(e.target.value)}
                      placeholder="e.g. 5 years in 2+ domains"
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>
                </div>
              )}
            </section>

            {/* Study Estimate (Optional) */}
            <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <button
                onClick={() => setShowEstimate(v => !v)}
                className="w-full px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
              >
                <div>
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Study Estimate</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Optional — minutes per page range</p>
                </div>
                <svg className={`w-4 h-4 text-muted-foreground transition-transform ${showEstimate ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showEstimate && (
                <div className="p-5 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Min minutes/page</label>
                      <input
                        type="number"
                        min={1}
                        value={estMin}
                        onChange={(e) => setEstMin(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Max minutes/page</label>
                      <input
                        type="number"
                        min={1}
                        value={estMax}
                        onChange={(e) => setEstMax(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* ── RIGHT COLUMN: JSON Preview ──────────────────────────── */}
          {showPreview && (
            <div className="hidden lg:block w-96 flex-shrink-0 self-start lg:sticky lg:top-24">
              <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Generated JSON</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Live preview</p>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                    errors.length === 0
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }`}>
                    {errors.length === 0 ? "Valid" : `${errors.length} issue${errors.length > 1 ? "s" : ""}`}
                  </span>
                </div>
                <div className="p-0">
                  <pre className="max-h-[50vh] overflow-auto p-5 text-xs font-mono leading-relaxed text-foreground bg-muted/20">
                    {JSON.stringify(config, null, 2)}
                  </pre>
                </div>
                <div className="px-5 py-4 border-t border-border bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-mono">{totalPages} pages · {totalChapters} chapters · {units.length} units</span>
                  </div>
                  {errors.length > 0 && (
                    <div className="text-xs text-amber-600 dark:text-amber-400 space-y-0.5">
                      {errors.slice(0, 3).map((err, i) => (
                        <p key={i}>{err}</p>
                      ))}
                      {errors.length > 3 && <p>...and {errors.length - 3} more</p>}
                    </div>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={errors.length > 0}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    {label("saveCourseToLibrary")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile save button (visible on small screens) */}
        <div className="lg:hidden fixed bottom-4 right-4 z-40">
          <button
            onClick={handleSave}
            disabled={errors.length > 0}
            className="flex items-center gap-1.5 px-4 py-3 rounded-full bg-primary text-primary-foreground shadow-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            Save Course
          </button>
        </div>
      </div>
    </div>
  )
}
