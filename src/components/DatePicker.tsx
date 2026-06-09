"use client"

import { useState, useRef, useEffect, useLayoutEffect } from "react"
import { createPortal } from "react-dom"
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isBefore,
  parseISO,
} from "date-fns"
import { CalendarDays, X, ChevronLeft, ChevronRight } from "lucide-react"

interface DatePickerProps {
  value: string | undefined
  onChange: (date: string) => void
  placeholder?: string
  minDate?: string
  disabled?: boolean
}

export default function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  minDate,
  disabled,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  // A69: State-based "now" that re-computes at midnight so isToday stays correct
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime()
    const timer = setTimeout(() => setNow(new Date()), msUntilMidnight + 100)
    return () => clearTimeout(timer)
  }, [now])
  const [viewDate, setViewDate] = useState(() =>
    value ? parseISO(value + "T00:00:00") : new Date()
  )
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPopupPos({
        top: rect.bottom + 4,
        left: rect.left,
      })
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    let rafId = 0
    // A68: Throttle scroll/resize via requestAnimationFrame
    function updatePos() {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = 0
        if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect()
          setPopupPos({ top: rect.bottom + 4, left: rect.left })
        }
      })
    }
    window.addEventListener("resize", updatePos)
    window.addEventListener("scroll", updatePos, true)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener("resize", updatePos)
      window.removeEventListener("scroll", updatePos, true)
    }
  }, [open])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (
        ref.current && !ref.current.contains(target) &&
        popupRef.current && !popupRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick)
      return () => document.removeEventListener("mousedown", handleClick)
    }
  }, [open])

  const selectedDate = value ? parseISO(value + "T00:00:00") : undefined
  const min = minDate ? parseISO(minDate + "T00:00:00") : undefined

  // Build calendar grid
  const monthStart = startOfMonth(viewDate)
  const monthEnd = endOfMonth(monthStart)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)

  const weeks: Date[][] = []
  let day = calendarStart
  while (day <= calendarEnd) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(day)
      day = addDays(day, 1)
    }
    weeks.push(week)
  }

  const handleSelect = (date: Date) => {
    if (min && isBefore(date, min)) return
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    onChange(`${y}-${m}-${d}`)
    setOpen(false)
  }

  return (
    <>
      <div ref={ref} className="relative">
        <button
          type="button"
          ref={buttonRef}
          onClick={() => !disabled && setOpen((v) => !v)}
          disabled={disabled}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all text-left ${
            disabled ? "opacity-60 cursor-not-allowed" : "hover:border-primary/40"
          }`}
        >
          <CalendarDays className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className={selectedDate ? "text-foreground" : "text-muted-foreground"}>
            {selectedDate ? format(selectedDate, "MMM d, yyyy") : placeholder}
          </span>
          {selectedDate && !disabled && (
            <span
              className="ml-auto text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation()
                onChange("")
              }}
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
        </button>
      </div>

      {open && popupPos &&
        createPortal(
          <div
            ref={popupRef}
            className="fixed z-[100] w-[280px] rounded-xl border border-border bg-card shadow-lg p-3"
            style={{ top: popupPos.top, left: popupPos.left }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <button
                type="button"
                onClick={() => setViewDate(subMonths(viewDate, 1))}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-foreground">
                {format(viewDate, "MMMM yyyy")}
              </span>
              <button
                type="button"
                onClick={() => setViewDate(addMonths(viewDate, 1))}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <div
                  key={d}
                  className="h-7 flex items-center justify-center text-[11px] font-medium text-muted-foreground"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Days */}
            <div className="space-y-0.5">
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-0.5">
                  {week.map((date) => {
                    const inMonth = isSameMonth(date, viewDate)
                    const isSelected = selectedDate ? isSameDay(date, selectedDate) : false
                    const isDisabled = min ? isBefore(date, min) : false
                    const isToday = isSameDay(date, new Date())

                    return (
                      <button
                        key={date.toISOString()}
                        type="button"
                        disabled={isDisabled || !inMonth}
                        onClick={() => handleSelect(date)}
                        className={`
                          h-8 w-8 mx-auto rounded-md text-xs font-medium flex items-center justify-center transition-colors
                          ${isSelected
                            ? "bg-primary text-primary-foreground"
                            : isToday
                            ? "bg-accent text-accent-foreground border border-border"
                            : inMonth && !isDisabled
                            ? "text-foreground hover:bg-muted"
                            : "text-muted-foreground/30 cursor-default"
                          }
                          ${isDisabled ? "opacity-30 cursor-not-allowed" : ""}
                        `}
                      >
                        {format(date, "d")}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
