import { useState, useEffect } from "react"
import { FlaskConical, TrendingUp } from "lucide-react"
import { readLabsStorage } from "@/lib/lab-session-storage"
import { getTodayMinutes, getStreak, getAtRiskCount } from "@/lib/lab-session-storage"
import { usePersonality } from "./PersonalityProvider"

interface SidebarLabsStatusProps {
  onOpenLabs: () => void
}

export default function SidebarLabsStatus({ onOpenLabs }: SidebarLabsStatusProps) {
  const { label, loading } = usePersonality()
  const [todayMinutes, setTodayMinutes] = useState(0)
  const [streak, setStreak] = useState(0)
  const [atRisk, setAtRisk] = useState(0)
  const [loaded, setLoaded] = useState(false)

  // A62/C19: Reload on every render (or at least on focus/visibility changes)
  // to ensure the sidebar stays in sync with LabDashboard edits. Use a
  // cancellation flag to avoid state updates after unmount.
  useEffect(() => {
    let cancelled = false
    readLabsStorage().then((data) => {
      if (cancelled) return
      setTodayMinutes(getTodayMinutes(data.sessions))
      setStreak(getStreak(data.sessions))
      setAtRisk(getAtRiskCount(data.sessions))
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [])

  // Also refresh when the window regains focus (user returns from LabDashboard)
  useEffect(() => {
    function onFocus() {
      readLabsStorage().then((data) => {
        setTodayMinutes(getTodayMinutes(data.sessions))
        setStreak(getStreak(data.sessions))
        setAtRisk(getAtRiskCount(data.sessions))
      })
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [])

  return (
    <div className="mb-5 p-4 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2 mb-3">
        <FlaskConical className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">{label("onlineLabsTitle")}</p>
      </div>
      {!loaded ? (
        <p className="text-xs text-muted-foreground">{loading("labs")}</p>
      ) : todayMinutes === 0 && streak === 0 && atRisk === 0 ? (
        <p className="text-xs text-muted-foreground">{label("noLabActivity")}</p>
      ) : (
        <div className="space-y-1.5 mb-3">
          {todayMinutes > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{label("today")}</span>
              <span className="font-medium text-foreground">{todayMinutes} min</span>
            </div>
          )}
          {streak > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{label("streak")}</span>
              <span className="font-medium text-foreground">{streak} day{streak > 1 ? "s" : ""}</span>
            </div>
          )}
          {atRisk > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{label("atRisk")}</span>
              <span className="font-medium text-amber-600 dark:text-amber-400">{atRisk} lab{atRisk > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      )}
      {loaded && (
        <button
          onClick={onOpenLabs}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-all"
        >
          <TrendingUp className="w-3 h-3" />
          {label("openLabDashboard")}
        </button>
      )}
    </div>
  )
}
