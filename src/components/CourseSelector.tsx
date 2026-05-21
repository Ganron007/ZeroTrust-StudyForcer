import { useEffect, useRef, useState } from "react"
import type { CourseConfig } from "@/types/course"
import { Check, ChevronDown, ExternalLink } from "lucide-react"
import { usePersonality } from "./PersonalityProvider"

interface CourseSelectorProps {
  courses: CourseConfig[]
  activeCourseId: string | null
  selectedCourseIds: Set<string>
  /** Pass null to clear the active/editing course entirely. */
  onActiveChange: (courseId: string | null) => void
  onSelectedChange: (next: Set<string>) => void
  onOpenPlanner?: (courseId: string) => void
}

export default function CourseSelector({
  courses,
  activeCourseId,
  selectedCourseIds,
  onActiveChange,
  onSelectedChange,
  onOpenPlanner,
}: CourseSelectorProps) {
  const { label } = usePersonality()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // A61: Use composedPath() for reliable outside-click detection instead of
  // the fragile insideClickRef pattern which can race in test environments.
  useEffect(() => {
    if (!open) return
    function onDocPointerDown(e: PointerEvent) {
      if (!containerRef.current) return
      const path = e.composedPath()
      if (!path.includes(containerRef.current)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onDocPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const selectedCount = selectedCourseIds.size
  const triggerLabel = `${label("courseSelector")} (${selectedCount})`

  function toggleChecked(courseId: string) {
    const next = new Set(selectedCourseIds)
    if (next.has(courseId)) {
      next.delete(courseId)
      // Unchecking the editing course also clears the editing target.
      if (courseId === activeCourseId) onActiveChange(null)
    } else {
      next.add(courseId)
    }
    onSelectedChange(next)
  }

  function selectAll() {
    const allIds = new Set(courses.map((c) => c.id))
    onSelectedChange(allIds)
    // A60: If no active course, auto-promote the first one so stats bar isn't blank
    if (activeCourseId === null && courses.length > 0) {
      onActiveChange(courses[0].id)
    }
  }

  function clearAll() {
    onActiveChange(null)
    onSelectedChange(new Set())
  }

  function setActive(courseId: string) {
    onActiveChange(courseId)
    // Ensure newly-active course is also in the selected set.
    if (!selectedCourseIds.has(courseId)) {
      const next = new Set(selectedCourseIds)
      next.add(courseId)
      onSelectedChange(next)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="h-9 inline-flex items-center gap-2 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition-all min-w-[12rem]"
      >
        <span className="truncate flex-1 text-left">
          {triggerLabel}
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="listbox"
          /* The document listener uses composedPath() — no ref trick needed */
          className="absolute left-0 top-full mt-1 z-50 w-72 bg-card border border-border rounded-lg shadow-xl p-1"
        >
          <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {label("coursesLabel")}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {/* C9: Show empty state when courses list is empty */}
            {courses.length === 0 && (
              <div className="px-3 py-4 text-center">
                <p className="text-xs text-muted-foreground">{label("noCoursesAvailable")}</p>
              </div>
            )}
            {courses.map((c) => {
              const isActive = c.id === activeCourseId
              const isChecked = selectedCourseIds.has(c.id)
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${
                    isActive ? "bg-primary/10" : "hover:bg-muted/60"
                  }`}
                >
                  <button
                    type="button"
                    aria-label={isChecked ? label("uncheckCourse") : label("checkCourse")}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleChecked(c.id)
                    }}
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                      isChecked
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border bg-background hover:border-primary/50"
                    }`}
                  >
                    {isChecked && <Check className="w-3 h-3" strokeWidth={3} />}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActive(c.id)
                    }}
                    className="flex-1 text-left text-sm text-foreground truncate cursor-pointer"
                    title={isActive ? label("currentlyViewing") : label("clickToView")}
                  >
                    {c.name}
                  </button>
                  {onOpenPlanner && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenPlanner(c.id)
                        setOpen(false)
                      }}
                      className="text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary font-semibold flex-shrink-0 transition-colors"
                      title={label("openInPlanner")}
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      {label("planConfig")}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          <div className="border-t border-border mt-1 pt-1 px-1 flex items-center justify-between">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                selectAll()
              }}
              className="text-xs text-primary hover:underline px-2 py-1"
            >
              {label("selectAll")}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                clearAll()
              }}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
            >
              {label("clearAll")}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground px-2 py-1.5 leading-snug">
            {label("selectorInstructions")}
          </p>
        </div>
      )}
    </div>
  )
}
