"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  readLabsStorage, writeLabsStorage, getLast14Days, getLast7Days,
  getStreak, getWeekMinutes, getCoverage14, getAtRiskCount,
  getDaysSince, getLabCategory, computeSmartScore,
  getTodayMinutes, getMonthMinutes, getDaysInCurrentMonth,
} from "@/lib/lab-session-storage"
import { localToday } from "@/lib/date-utils"
import { DEFAULT_EXTERNAL_LABS, type LabsStorage, type LabSession } from "@/lib/lab-sessions"
import type { LabCategory } from "@/lib/lab-data"
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/lab-data"
import {
  X, ExternalLink, Plus, ChevronLeft, ListFilter, CheckCircle2, AlertTriangle, LayoutGrid,
  Download, Upload,
} from "lucide-react"
import { downloadJson, downloadCsv, readJsonFile } from "@/lib/export-utils"
import { showToast } from "@/components/NotificationToast"
import { usePersonality } from "./PersonalityProvider"
import { formatStr } from "@/lib/personality"
import { now, nowDate } from "@/lib/clock"

type FilterMode = "all" | "queue" | "today" | "attention"

interface LabDashboardProps {
  onBack?: () => void
}

export default function LabDashboard({ onBack }: LabDashboardProps) {
  const { label } = usePersonality()
  const [data, setData] = useState<LabsStorage>({ labs: DEFAULT_EXTERNAL_LABS, sessions: [], categories: {} })
  const [filter, setFilter] = useState<FilterMode>("all")
  const [showLogDialog, setShowLogDialog] = useState(false)
  const [logLabId, setLogLabId] = useState("")
  const [logMinutes, setLogMinutes] = useState(120)
  const [logNote, setLogNote] = useState("")

  useEffect(() => {
    let cancelled = false
    readLabsStorage().then((d) => {
      if (!cancelled) setData(d)
    })
    return () => { cancelled = true }
  }, [])

  // A54: Write to disk first, then update state. If disk write fails,
  // state is unchanged and the user sees an error toast to retry.
  const save = useCallback(async (next: LabsStorage) => {
    try {
      await writeLabsStorage(next)
      setData(next)
    } catch (e) {
      console.error("[LabDashboard] save failed:", e)
      showToast("Failed to save lab data — please retry", "break")
    }
  }, [])

  // A53: Use a state-based today that re-computes at midnight
  const [today, setToday] = useState(() => localToday())
  useEffect(() => {
    const current = nowDate()
    const msUntilMidnight = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1).getTime() - current.getTime()
    const timer = setTimeout(() => setToday(localToday()), msUntilMidnight + 100)
    return () => clearTimeout(timer)
  }, [today])

  // ── Computed stats ───────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const streak = getStreak(data.sessions)
    const weekMinutes = getWeekMinutes(data.sessions)
    const coverage = getCoverage14(data.sessions)
    const atRisk = getAtRiskCount(data.sessions)
    const last7 = getLast7Days()
    const todayMinutes = getTodayMinutes(data.sessions)
    const monthMinutes = getMonthMinutes(data.sessions)
    const daysInMonth = getDaysInCurrentMonth()
    // C12: Derive daily goal from weeklyGoalHours (default 6h = 360min)
    const weeklyGoalHours = data.weeklyGoalHours ?? 6
    const dailyGoalMinutes = (weeklyGoalHours * 60) / 7
    const monthlyGoalMinutes = daysInMonth * dailyGoalMinutes

    const cadence = last7.map((date) => {
      const daySessions = data.sessions.filter((s) => s.date === date)
      const minutes = daySessions.reduce((s, d) => s + d.minutes, 0)
      // Levels based on 6h daily goal: 0 / <50% / <100% / ≥100%
      const level = minutes === 0 ? 0 : minutes < dailyGoalMinutes / 2 ? 1 : minutes < dailyGoalMinutes ? 2 : 3
      return { date, minutes, level }
    })

    return { streak, weekMinutes, coverage, atRisk, cadence, todayMinutes, monthMinutes, monthlyGoalMinutes, dailyGoalMinutes }
  }, [data])

  // ── Lab statuses ─────────────────────────────────────────────────────────────
  const labStatuses = useMemo(() => {
    const labLastSession = new Map<string, LabSession>()
    for (const s of data.sessions) {
      const existing = labLastSession.get(s.labId)
      if (!existing || s.date > existing.date) {
        labLastSession.set(s.labId, s)
      }
    }

    const labTotalMinutes = new Map<string, number>()
    for (const s of data.sessions) {
      labTotalMinutes.set(s.labId, (labTotalMinutes.get(s.labId) ?? 0) + s.minutes)
    }

    const doneToday = new Set(data.sessions.filter((s) => s.date === today).map((s) => s.labId))

    // C11: Use data.labs (includes custom labs) instead of hardcoded DEFAULT_EXTERNAL_LABS
    return data.labs.map((lab) => {
      const lastSession = labLastSession.get(lab.id)
      const daysSince = getDaysSince(lastSession?.date ?? null)
      const totalMinutes = labTotalMinutes.get(lab.id) ?? 0
      const isDoneToday = doneToday.has(lab.id)
      const needsAttention = daysSince === null || daysSince >= 14
      const { score: smartScore, factors: smartFactors } = computeSmartScore(lab.id, daysSince, totalMinutes, data.sessions)
      const focus = data.customFocus?.[lab.id] ?? lab.focus

      return {
        ...lab,
        focus,
        daysSince,
        totalMinutes,
        isDoneToday,
        needsAttention,
        priorityScore: daysSince === null ? 100 : Math.min(daysSince * 3, 100),
        smartScore,
        smartFactors,
        category: getLabCategory(data, lab.id),
      }
    }).sort((a, b) => b.smartScore - a.smartScore)
  }, [data, today])

  const filteredLabs = useMemo(() => {
    if (filter === "queue") return labStatuses.filter((l) => !l.isDoneToday && l.smartScore >= 40)
    if (filter === "today") return labStatuses.filter((l) => l.isDoneToday)
    if (filter === "attention") return labStatuses.filter((l) => l.needsAttention)
    return labStatuses
  }, [labStatuses, filter])

  const bestTarget = labStatuses.filter((l) => !l.isDoneToday).sort((a, b) => b.smartScore - a.smartScore)[0] ?? labStatuses[0]

  // ── Focus stats ──────────────────────────────────────────────────────────────
  const focusStats = useMemo(() => {
    const map: Record<string, { focus: string; category: LabCategory; touched14: number; total: number; minutes: number; uniqueLabs: Set<string> }> = {}
    for (const lab of labStatuses) {
      const cat = getLabCategory(data, lab.id)
      if (!map[lab.focus]) {
        map[lab.focus] = { focus: lab.focus, category: cat, touched14: 0, total: 0, minutes: 0, uniqueLabs: new Set() }
      }
      map[lab.focus].total++
    }
    const last14 = getLast14Days()
    for (const s of data.sessions) {
      if (!last14.includes(s.date)) continue
      const lab = labStatuses.find((l) => l.id === s.labId)
      if (!lab) continue
      if (!map[lab.focus]) continue
      map[lab.focus].uniqueLabs.add(lab.id)
      map[lab.focus].minutes += s.minutes
    }
    for (const key of Object.keys(map)) {
      map[key].touched14 = map[key].uniqueLabs.size
    }
    return Object.values(map)
  }, [data, labStatuses])

  // ── Recent activity ──────────────────────────────────────────────────────────
  const recentActivity = useMemo(() => {
    return [...data.sessions]
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8)
  }, [data])

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function openLog(labId: string, minutes: number = 30) {
    setLogLabId(labId)
    setLogMinutes(minutes)
    setLogNote("")
    setShowLogDialog(true)
  }

  function submitLog() {
    if (!logLabId) return
    // A53: Call localToday() at write time, not render time, to prevent
    // sessions logged after midnight from getting yesterday's date
    const session: LabSession = {
      labId: logLabId,
      date: localToday(),
      minutes: Math.max(1, logMinutes),
      note: logNote.trim() || undefined,
      createdAt: now(),
    }
    const next = { ...data, sessions: [...data.sessions, session] }
    save(next)
    setShowLogDialog(false)
  }

  const dayLabel = (date: string) => {
    const d = new Date(date + "T00:00:00")
    return d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2)
  }

  const dayNumber = (date: string) => {
    const d = new Date(date + "T00:00:00")
    return d.getDate()
  }

  const formatRelative = (days: number | null) => {
    if (days === null) return "Never used"
    if (days === 0) return "Today"
    if (days === 1) return "Yesterday"
    return `${days} days ago`
  }

  const formatDateRelative = (dateStr: string) => {
    const days = getDaysSince(dateStr)
    if (days === null) return dateStr
    if (days === 0) return "Today"
    if (days === 1) return "Yesterday"
    if (days < 7) return `${days} days ago`
    return dateStr
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6">
      {/* Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card/90 backdrop-blur-sm shadow-sm p-6 relative overflow-hidden">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors mb-3"
            >
              <ChevronLeft className="w-4 h-4" />
              {label("backToView")}
            </button>
          )}
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">{label("subscriptionRecovery")}</p>
          <h2 className="text-2xl font-bold text-foreground mb-2">{label("onlineLabsTitle")}</h2>
          <p className="text-sm text-muted-foreground max-w-lg mb-4">
            {label("trackLabs")}
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => openLog(bestTarget?.id ?? data.labs[0]?.id ?? "", 120)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              {label("logTodaysSession")}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/90 backdrop-blur-sm shadow-sm p-5 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label("monthlyGoal")}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-lg font-bold text-foreground">{Math.round(stats.monthMinutes / 60 * 10) / 10}h</p>
              <span className="text-xs text-muted-foreground">/ {Math.round(stats.monthlyGoalMinutes / 60)}h</span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden mt-2">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, (stats.monthMinutes / Math.max(1, stats.monthlyGoalMinutes)) * 100)}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border mt-3">
            <div>
              <p className="text-[10px] text-muted-foreground">{label("dateLabel")}</p>
              <p className="text-sm font-bold text-foreground">{today}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">{label("daily")}</p>
              <p className="text-sm font-bold text-foreground">{Math.round(stats.dailyGoalMinutes / 60)}h</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">{label("streak")}</p>
              <p className="text-sm font-bold text-foreground">{stats.streak} days</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Current streak</p>
          <p className="text-2xl font-bold text-foreground">{stats.streak}d</p>
          <p className="text-[10px] text-muted-foreground mt-1">Consecutive days with a session</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Today</p>
          <p className="text-2xl font-bold text-foreground">{Math.round(stats.todayMinutes / 60 * 10) / 10}h</p>
          <p className="text-[10px] text-muted-foreground mt-1">Goal: {Math.round(stats.dailyGoalMinutes / 60)}h</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Month</p>
          <p className="text-2xl font-bold text-foreground">{Math.round(stats.monthMinutes / 60 * 10) / 10}h</p>
          <p className="text-[10px] text-muted-foreground mt-1">Goal: {Math.round(stats.monthlyGoalMinutes / 60)}h</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">At-risk labs</p>
          <p className="text-2xl font-bold text-amber-500">{stats.atRisk}</p>
          <p className="text-[10px] text-muted-foreground mt-1">No activity in 14+ days</p>
        </div>
      </div>

      {/* Cadence — 7 days compact */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Consistency view</p>
            <h3 className="text-base font-bold text-foreground">Last 7 days</h3>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-muted/40" />0m</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary/20" />1-3h</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary/40" />3-6h</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary" />6h+</span>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {stats.cadence.map((day) => (
            <div
              key={day.date}
              className={`rounded-lg p-1.5 text-center flex flex-col justify-between min-h-[52px] ${
                day.level === 0 ? "bg-muted/40" :
                day.level === 1 ? "bg-primary/20" :
                day.level === 2 ? "bg-primary/40" :
                "bg-primary text-primary-foreground"
              }`}
              title={`${day.date}: ${day.minutes}m`}
            >
              <span className="text-[10px] uppercase tracking-wide">{dayLabel(day.date)}</span>
              <span className="text-xs font-bold">{dayNumber(day.date)}</span>
              <span className="text-[10px]">{day.minutes > 0 ? `${day.minutes}m` : "—"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Lab queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Usage dashboard</p>
              <h3 className="text-lg font-bold text-foreground">Your lab queue</h3>
            </div>
            <div className="flex gap-1">
              {([
                { id: "all" as const, label: "All", Icon: LayoutGrid },
                { id: "queue" as const, label: "Queue", Icon: ListFilter },
                { id: "today" as const, label: "Today", Icon: CheckCircle2 },
                { id: "attention" as const, label: "Attention", Icon: AlertTriangle },
              ]).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    filter === id
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  const rows = [
                    ["Date", "Lab", "Minutes", "Note"],
                    ...data.sessions.map((s) => {
                      const lab = DEFAULT_EXTERNAL_LABS.find((l) => l.id === s.labId)
                      return [s.date, lab?.name ?? s.labId, String(s.minutes), s.note ?? ""]
                    }),
                  ]
                  downloadCsv(`lab-sessions-${localToday()}.csv`, rows)
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Export sessions to CSV"
              >
                <Download className="w-3 h-3" />
                <span className="hidden sm:inline">CSV</span>
              </button>
              <button
                onClick={() => downloadJson(`lab-data-${localToday()}.json`, data)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Export all lab data to JSON"
              >
                <Download className="w-3 h-3" />
                <span className="hidden sm:inline">JSON</span>
              </button>
              <label className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                <Upload className="w-3 h-3" />
                <span className="hidden sm:inline">Import</span>
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    try {
                      const imported = await readJsonFile(file) as LabsStorage
                      if (!imported.sessions || !Array.isArray(imported.sessions)) {
                        showToast("Invalid lab data file", "info")
                        return
                      }
                      // C13: save writes to disk first, then updates state
                      // C14: log the error so it's not silently swallowed
                      await writeLabsStorage(imported)
                      setData(imported)
                      showToast(`Imported ${imported.sessions.length} sessions`, "info")
                    } catch (e) {
                      console.error("[LabDashboard] Import failed:", e)
                      showToast("Failed to import lab data", "info")
                    }
                    e.target.value = ""
                  }}
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredLabs.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
                <p className="text-sm font-semibold text-muted-foreground mb-1">
                  {filter === "queue" ? "Queue is empty" :
                   filter === "today" ? "No sessions logged today" :
                   filter === "attention" ? "No labs need attention" :
                   "No labs to show"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {filter === "queue" ? "All labs are either done today or have a low priority score." :
                   filter === "today" ? "Log a session to see it here." :
                   filter === "attention" ? "All labs have been used within the last 14 days." :
                   ""}
                </p>
              </div>
            )}
            {filteredLabs.map((lab) => (
              <div
                key={lab.id}
                className={`rounded-xl border p-4 space-y-3 transition-all hover:shadow-md hover:-translate-y-0.5 ${
                  lab.needsAttention ? "border-amber-500/40 bg-amber-500/5" :
                  lab.isDoneToday ? "border-primary/40 bg-primary/5" :
                  "border-border bg-card hover:border-primary/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex gap-1.5 mb-1 flex-wrap">
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{
                          backgroundColor: `${CATEGORY_COLORS[lab.category]}20`,
                          color: CATEGORY_COLORS[lab.category],
                        }}
                      >
                        {CATEGORY_LABELS[lab.category]}
                      </span>
                      {lab.isDoneToday && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 font-semibold">
                          Done today
                        </span>
                      )}
                      {lab.needsAttention && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-semibold">
                          Needs attention
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-foreground truncate">{lab.name}</h4>
                    <input
                      type="text"
                      value={lab.focus}
                      onChange={(e) => {
                        const next = { ...data, customFocus: { ...data.customFocus, [lab.id]: e.target.value } }
                        save(next)
                      }}
                      className="text-[10px] bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none text-muted-foreground w-full mt-0.5"
                      placeholder="Focus area"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground flex-shrink-0">{lab.smartScore}</span>
                </div>

                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${lab.smartScore}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatRelative(lab.daysSince)}</span>
                  <span>{lab.totalMinutes}m total</span>
                </div>

                <div className="flex gap-1.5">
                  {[120, 240, 360].map((m) => (
                    <button
                      key={m}
                      onClick={() => openLog(lab.id, m)}
                      className="flex-1 py-1.5 rounded-md bg-muted text-foreground text-[10px] font-semibold hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      {m / 60}h
                    </button>
                  ))}
                  <a
                    href={lab.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1.5 rounded-md bg-muted text-primary text-xs font-semibold hover:bg-primary/10 transition-colors flex items-center"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Recommended target */}
          {bestTarget && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Best next move</p>
              <h3 className="text-lg font-bold text-foreground mb-2">Recommended target</h3>
              <div className={`rounded-xl p-4 space-y-3 ${bestTarget.needsAttention ? "bg-amber-500/5 border border-amber-500/20" : "bg-primary/5 border border-primary/20"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{
                        backgroundColor: `${CATEGORY_COLORS[bestTarget.category]}20`,
                        color: CATEGORY_COLORS[bestTarget.category],
                      }}
                    >
                      {CATEGORY_LABELS[bestTarget.category]}
                    </span>
                    {bestTarget.needsAttention && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-semibold">
                        Priority
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground" title="Smart priority score (0-100)">
                    Score {bestTarget.smartScore}
                  </span>
                </div>
                <h4 className="text-base font-bold text-foreground">{bestTarget.name}</h4>
                <p className="text-xs text-muted-foreground">
                  {bestTarget.daysSince === null
                    ? "Never used. Start with a short session today."
                    : bestTarget.daysSince >= 14
                    ? `Idle for ${bestTarget.daysSince} days. Re-engage to protect subscription value.`
                    : `Last used ${bestTarget.daysSince} days ago. Keep the rhythm going.`}
                </p>
                {bestTarget.smartFactors && (
                  <div className="rounded-lg bg-background/60 border border-border/50 p-2.5 space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Score breakdown</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                      <span className="text-[10px] text-muted-foreground">Base recency</span>
                      <span className="text-[10px] font-semibold text-foreground text-right">{bestTarget.smartFactors.base}</span>
                      {bestTarget.smartFactors.atRiskBonus > 0 && (
                        <>
                          <span className="text-[10px] text-amber-600">At-risk bonus</span>
                          <span className="text-[10px] font-semibold text-amber-600 text-right">+{bestTarget.smartFactors.atRiskBonus}</span>
                        </>
                      )}
                      {bestTarget.smartFactors.unexploredBonus > 0 && (
                        <>
                          <span className="text-[10px] text-primary">Unexplored bonus</span>
                          <span className="text-[10px] font-semibold text-primary text-right">+{bestTarget.smartFactors.unexploredBonus}</span>
                        </>
                      )}
                      {bestTarget.smartFactors.categoryGapBonus > 0 && (
                        <>
                          <span className="text-[10px] text-blue-500">Category gap</span>
                          <span className="text-[10px] font-semibold text-blue-500 text-right">+{bestTarget.smartFactors.categoryGapBonus}</span>
                        </>
                      )}
                      {bestTarget.smartFactors.recentUsePenalty > 0 && (
                        <>
                          <span className="text-[10px] text-red-400">Recent use</span>
                          <span className="text-[10px] font-semibold text-red-400 text-right">-{bestTarget.smartFactors.recentUsePenalty}</span>
                        </>
                      )}
                    </div>
                    <div className="border-t border-border/50 pt-1 mt-1 flex justify-between">
                      <span className="text-[10px] font-bold text-foreground">Final</span>
                      <span className="text-[10px] font-bold text-foreground">{bestTarget.smartFactors.final}</span>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => openLog(bestTarget.id, 120)}
                    className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                  >
                    Log session
                  </button>
                  <a
                    href={bestTarget.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded-lg bg-muted text-primary text-xs font-semibold hover:bg-primary/10 transition-colors flex items-center"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Focus coverage */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Focus coverage</p>
            <h3 className="text-base font-bold text-foreground mb-3">By category</h3>
            <div className="space-y-2.5">
              {focusStats.map((f) => {
                const pct = Math.round((f.touched14 / Math.max(1, f.total)) * 100)
                return (
                  <div key={f.focus}>
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-xs font-semibold text-foreground">{f.focus}</span>
                      <span className="text-[10px] text-muted-foreground">{f.touched14}/{f.total} labs</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Activity log */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Recent work</p>
            <h3 className="text-lg font-bold text-foreground mb-3">Activity log</h3>
            <div className="space-y-2">
              {recentActivity.length === 0 && (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
                  <p className="text-xs text-muted-foreground">No sessions logged yet.</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Log your first session to start tracking.</p>
                </div>
              )}
              {recentActivity.map((session) => {
                const lab = DEFAULT_EXTERNAL_LABS.find((l) => l.id === session.labId)
                const cat = lab ? getLabCategory(data, lab.id) : "purple"
                return (
                  <div key={session.createdAt} className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/20 p-2.5">
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground truncate">{lab?.name ?? session.labId}</p>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatDateRelative(session.date)}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {session.minutes}m session
                      </p>
                      {session.note && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 italic truncate">"{session.note}"</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Log Dialog */}
      {showLogDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Log progress</p>
                <h3 className="text-lg font-bold text-foreground">Add a session</h3>
              </div>
              <button
                onClick={() => setShowLogDialog(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Lab</label>
              <select
                value={logLabId}
                onChange={(e) => setLogLabId(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {DEFAULT_EXTERNAL_LABS.map((lab) => (
                  <option key={lab.id} value={lab.id}>{lab.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Quick duration</label>
              <div className="flex gap-2">
                {[120, 240, 360].map((m) => (
                  <button
                    key={m}
                    onClick={() => setLogMinutes(m)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      logMinutes === m
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m / 60}h
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Minutes</label>
              <input
                type="number"
                min={1}
                step={5}
                value={logMinutes}
                onChange={(e) => setLogMinutes(Math.max(1, Number(e.target.value) || 1))}
                className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Note (optional)</label>
              <textarea
                rows={3}
                value={logNote}
                onChange={(e) => setLogNote(e.target.value)}
                placeholder="What did you work on?"
                className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowLogDialog(false)}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitLog}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Save session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
