import { useMemo } from "react"
import { BookOpen } from "lucide-react"
import { type StudyDay } from "@/lib/cissp-data"
import type { CourseConfig } from "@/types/course"
import type { LogGroup } from "./LogDialog"
import { usePersonality } from "./PersonalityProvider"
import { formatStr } from "@/lib/personality"
import { localToday } from "@/lib/date-utils"
import { nowDate } from "@/lib/clock"

interface DailyBriefingProps {
  schedule: StudyDay[]
  dailyLog: Record<string, Record<string, { pagesRead: number }>>
  activeCourse: CourseConfig | null
  completedDays: Set<string>
  onLogToday: (day: StudyDay, groups: LogGroup[]) => void
  yesterdayTotal: number
}

function getGreeting(): string {
  const hour = nowDate().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
}

export default function DailyBriefing({ schedule, dailyLog, activeCourse, completedDays, onLogToday, yesterdayTotal }: DailyBriefingProps) {
  const { label, empty, greeting } = usePersonality()
  const today = localToday()

  const todayDay = useMemo(() => schedule.find(d => d.date === today), [schedule, today])

  const streak = useMemo(() => {
    let count = 0
    const d = nowDate()
    for (let i = 0; i < 365; i++) {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, "0")
      const day = String(d.getDate()).padStart(2, "0")
      if (completedDays.has(`${y}-${m}-${day}`)) {
        count++
        d.setDate(d.getDate() - 1)
      } else break
    }
    return count
  }, [completedDays])

  const isTodayDone = useMemo(
    () => todayDay ? Object.keys(dailyLog[today] ?? {}).length > 0 : false,
    [todayDay, dailyLog, today],
  )

  const firstStudyDate = useMemo(
    () => schedule.length > 0 ? new Date(schedule[0].date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : null,
    [schedule],
  )

  return (
    <div className="mb-5 p-4 rounded-xl bg-card border border-border">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-bold text-foreground">{greeting(nowDate().getHours() < 12 ? "morning" : nowDate().getHours() < 17 ? "afternoon" : "evening")}!</p>
          <p className="text-sm text-muted-foreground">{formatDate(nowDate())}</p>
        </div>
        {streak > 0 && (
          <div className="text-right">
            <p className="text-xl font-bold text-primary">{streak}<span className="text-sm font-normal text-muted-foreground"> {label("dayStreak")}</span></p>
          </div>
        )}
      </div>

      {!activeCourse ? (
        <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border">
          <p className="text-sm text-muted-foreground">{empty("noCourse")}</p>
        </div>
      ) : !todayDay ? (
        <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border">
          <p className="text-sm text-muted-foreground">
            {firstStudyDate
              ? formatStr(empty("noReadingToday"), { date: firstStudyDate })
              : empty("noPlan")}
          </p>
        </div>
      ) : !isTodayDone ? (
        <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
          <p className="text-sm font-semibold text-foreground mb-2">
            Today — {activeCourse.name}
          </p>
          <div className="space-y-1 mb-2">
            {todayDay.chapters.map((ch, i) => (
              <p key={i} className="text-sm text-muted-foreground">
                {ch.unitName} — {ch.chapterTitle}
                <span className="text-xs ml-1">(p.{ch.bookPageStart ?? ch.pagesStart}–{ch.bookPageEnd ?? ch.pagesEnd})</span>
              </p>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mb-3">{todayDay.totalPages} pages</p>
          <button
            onClick={() => {
              const groups = (todayDay.groups ?? [{ label: "Plan", dayNumber: todayDay.dayNumber, totalPages: todayDay.totalPages, chapters: todayDay.chapters }]).map(g => ({
                label: g.label,
                courseId: g.chapters[0]?.courseId ?? "",
                totalPages: g.totalPages,
              }))
              onLogToday(todayDay, groups)
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all"
          >
            <BookOpen className="w-4 h-4" />
            {label("logToday")}
          </button>
        </div>
      ) : (
        <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <p className="text-sm text-green-600 dark:text-green-400 font-medium">{label("todayDone")}</p>
        </div>
      )}

      {yesterdayTotal > 0 && (
        <p className="text-xs text-muted-foreground mt-3">
          {label("yesterday")} {yesterdayTotal} {yesterdayTotal !== 1 ? label("pages") : label("page")} {label("read")}
        </p>
      )}
    </div>
  )
}
