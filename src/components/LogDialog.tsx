"use client"

import { useState } from "react"
import { type StudyDay } from "@/lib/cissp-data"
import { X, BookOpen, SkipForward } from "lucide-react"
import { usePersonality } from "./PersonalityProvider"

export interface LogGroup {
  label: string
  courseId: string
  totalPages: number
}

interface LogDialogProps {
  day: StudyDay
  groups: LogGroup[]
  onSave: (date: string, logs: Array<{ courseId: string; pagesRead: number }>) => void
  onSkip: (date: string, courseId: string) => void
  onClose: () => void
}

export default function LogDialog({ day, groups, onSave, onSkip, onClose }: LogDialogProps) {
  const { label } = usePersonality()
  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const g of groups) {
      init[g.courseId] = ""
    }
    return init
  })

  const hasAnyInput = groups.some((g) => {
    const val = inputs[g.courseId]
    return val !== undefined && val.trim() !== ""
  })

  const handleSave = () => {
    const logs: Array<{ courseId: string; pagesRead: number }> = []
    for (const g of groups) {
      const val = inputs[g.courseId]
      if (val !== undefined && val.trim() !== "") {
        const pagesRead = Number(val)
        if (isNaN(pagesRead)) continue
        logs.push({ courseId: g.courseId, pagesRead })
      }
    }
    onSave(day.date, logs)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-bold text-foreground text-sm">
              {label("log")} {label("day")} {day.dayNumber}
            </h2>
            <p className="text-xs text-muted-foreground">
              {new Date(day.date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label={label("close")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {label("noPlansForDay")}
            </p>
          )}
          {groups.map((g) => (
            <div
              key={g.courseId}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30"
            >
              <span className="text-xs font-bold text-foreground uppercase tracking-wider flex-shrink-0 min-w-[4rem]">
                {g.label}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={g.totalPages * 3}
                placeholder={`${g.totalPages}p`}
                value={inputs[g.courseId] ?? ""}
                onChange={(e) =>
                  setInputs((prev) => ({
                    ...prev,
                    [g.courseId]: e.target.value.replace(/\D/g, ""),
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && hasAnyInput) {
                    handleSave()
                  }
                }}
                className="w-20 px-2 py-1.5 rounded-md border border-border bg-background text-sm text-foreground text-center font-mono"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {label("pages")}
              </span>
              <button
                onClick={() => onSkip(day.date, g.courseId)}
                className="ml-auto px-2 py-1 rounded-lg text-xs font-medium border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-all flex items-center gap-1"
              >
                <SkipForward className="w-3 h-3" />
                {label("skip")}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          >
            {label("cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={!hasAnyInput}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5
              ${hasAnyInput
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
              }`}
          >
            <BookOpen className="w-4 h-4" />
            {label("saveLog")}
          </button>
        </div>
      </div>
    </div>
  )
}
