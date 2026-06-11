import { useState, useEffect } from "react"
import { Clock } from "lucide-react"
import { nowDate } from "@/lib/clock"

function formatTime(d: Date): { time: string; period: string } {
  const h24 = d.getHours()
  const period = h24 >= 12 ? "PM" : "AM"
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const h = String(h12).padStart(2, "0")
  const m = String(d.getMinutes()).padStart(2, "0")
  const s = String(d.getSeconds()).padStart(2, "0")
  return { time: `${h}:${m}:${s}`, period }
}

export default function WallClock() {
  const [now, setNow] = useState<Date>(() => nowDate())

  useEffect(() => {
    const id = setInterval(() => setNow(nowDate()), 1000)
    return () => clearInterval(id)
  }, [])

  const { time, period } = formatTime(now)

  return (
    <div
      className="h-9 inline-flex items-center gap-2 bg-background rounded-lg px-3 border border-border"
      title={now.toString()}
    >
      <Clock className="w-4 h-4 text-primary flex-shrink-0" />
      <span className="text-sm font-bold font-mono tabular-nums leading-none">
        {time}
        <span className="ml-1 text-[10px] text-muted-foreground font-medium">{period}</span>
      </span>
    </div>
  )
}
