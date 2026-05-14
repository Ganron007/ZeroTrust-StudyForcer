import { useState, useEffect } from "react"
import { FlaskConical, TrendingUp } from "lucide-react"
import { readLabsStorage } from "@/lib/lab-session-storage"
import { getTodayMinutes, getStreak, getAtRiskCount } from "@/lib/lab-session-storage"

interface SidebarLabsStatusProps {
  onOpenLabs: () => void
}

export default function SidebarLabsStatus({ onOpenLabs }: SidebarLabsStatusProps) {
  const [todayMinutes, setTodayMinutes] = useState(0)
  const [streak, setStreak] = useState(0)
  const [atRisk, setAtRisk] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    readLabsStorage().then((data) => {
      setTodayMinutes(getTodayMinutes(data.sessions))
      setStreak(getStreak(data.sessions))
      setAtRisk(getAtRiskCount(data.sessions))
      setLoaded(true)
    })
  }, [])

  return (
    <div className="mb-5 p-4 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2 mb-3">
        <FlaskConical className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">Online Labs</p>
      </div>
      {!loaded ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : todayMinutes === 0 && streak === 0 && atRisk === 0 ? (
        <p className="text-xs text-muted-foreground">No lab activity yet</p>
      ) : (
        <div className="space-y-1.5 mb-3">
          {todayMinutes > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Today</span>
              <span className="font-medium text-foreground">{todayMinutes} min</span>
            </div>
          )}
          {streak > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Streak</span>
              <span className="font-medium text-foreground">{streak} day{streak > 1 ? "s" : ""}</span>
            </div>
          )}
          {atRisk > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">At risk</span>
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
          Open Lab Dashboard
        </button>
      )}
    </div>
  )
}
