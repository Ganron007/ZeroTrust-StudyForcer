"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Play, Pause, Square, Timer, Settings2 } from "lucide-react"
import { type TimerMode, type TimerState, type TimerData, readTimerState, writeTimerState, formatShortDuration } from "@/lib/timer-storage"
import { showToast } from "./NotificationToast"
import { usePersonality } from "./PersonalityProvider"
import { formatStr } from "@/lib/personality"

interface StudyTimerProps {
  onLogTime?: (minutes: number) => void
}

export default function StudyTimer({ onLogTime }: StudyTimerProps) {
  const { label, toast: tToast } = usePersonality()
  const [timer, setTimer] = useState<TimerData | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastWriteRef = useRef<number>(0)
  const timerRef = useRef<TimerData | null>(null)

  // Close settings on Escape
  useEffect(() => {
    if (!showSettings) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowSettings(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [showSettings])

  // Load timer on mount
  useEffect(() => {
    readTimerState().then(setTimer)
  }, [])

  // Keep ref in sync for unmount write
  useEffect(() => { timerRef.current = timer }, [timer])

  // Write final state on unmount (crash recovery)
  useEffect(() => {
    return () => {
      if (timerRef.current && timerRef.current.state === "running") {
        writeTimerState(timerRef.current)
      }
    }
  }, [])

  // Tick every second
  useEffect(() => {
    if (!timer || timer.state !== "running") {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setTimer((prev) => {
        if (!prev || prev.state !== "running") return prev

        const now = Date.now()
        const lastTick = new Date(prev.lastUpdated).getTime()
        const delta = now - lastTick

        let nextElapsed = prev.elapsedMs + delta
        let nextPhaseElapsed = prev.phaseElapsedMs + delta
        let nextPhase = prev.currentPhase
        let nextState: TimerState = prev.state

        // Pomodoro phase switching
        if (prev.mode === "pomodoro") {
          const studyMs = prev.studyDurationMin * 60 * 1000
          const breakMs = prev.breakDurationMin * 60 * 1000

          if (prev.currentPhase === "study" && nextPhaseElapsed >= studyMs) {
            nextPhase = "break"
            nextPhaseElapsed = 0
            showToast(formatStr(tToast("breakTime"), { minutes: prev.breakDurationMin }), "break")
            if (prev.autoLog && onLogTime) {
              onLogTime(prev.studyDurationMin)
            }
          } else if (prev.currentPhase === "break" && nextPhaseElapsed >= breakMs) {
            nextPhase = "study"
            nextPhaseElapsed = 0
            showToast(tToast("breakOver"), "info")
          }
        }

        // Countdown completion — also logs time
        if (prev.mode === "countdown" && nextElapsed >= prev.targetMs) {
          nextElapsed = prev.targetMs
          nextState = "idle"
          showToast(tToast("goalComplete"), "complete")
          if (onLogTime) {
            onLogTime(Math.floor(nextElapsed / 60000))
          }
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
        }

        const updated = {
          ...prev,
          elapsedMs: nextElapsed,
          phaseElapsedMs: nextPhaseElapsed,
          currentPhase: nextPhase,
          state: nextState,
          lastUpdated: new Date().toISOString(),
        }

        // Debounce writes to at most once per 10 seconds while running
        if (now - lastWriteRef.current >= 10000) {
          writeTimerState(updated)
          lastWriteRef.current = now
        }
        return updated
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- timer is accessed via functional setState inside interval; only state transition matters
  }, [timer?.state])

  const handleStart = useCallback(() => {
    setTimer((prev) => {
      if (!prev) return prev
      const updated = { ...prev, state: "running" as TimerState, lastUpdated: new Date().toISOString() }
      writeTimerState(updated)
      return updated
    })
  }, [])

  const handlePause = useCallback(() => {
    setTimer((prev) => {
      if (!prev) return prev
      const updated = { ...prev, state: "paused" as TimerState, lastUpdated: new Date().toISOString() }
      writeTimerState(updated)
      return updated
    })
  }, [])

  const handleStop = useCallback(() => {
    setTimer((prev) => {
      if (!prev) return prev
      const minutes = Math.floor(prev.elapsedMs / 60000)
      if (minutes > 0 && onLogTime) {
        onLogTime(minutes)
      }
      const updated: TimerData = {
        ...prev,
        state: "idle",
        elapsedMs: 0,
        phaseElapsedMs: 0,
        currentPhase: "study",
        lastUpdated: new Date().toISOString(),
      }
      writeTimerState(updated)
      return updated
    })
  }, [onLogTime])

  const handleModeChange = useCallback((mode: TimerMode) => {
    setTimer((prev) => {
      if (!prev) return prev
      const updated: TimerData = {
        ...prev,
        mode,
        state: "idle",
        elapsedMs: 0,
        phaseElapsedMs: 0,
        currentPhase: "study",
        targetMs: mode === "countdown" ? 8 * 60 * 60 * 1000 : prev.targetMs,
        lastUpdated: new Date().toISOString(),
      }
      writeTimerState(updated)
      return updated
    })
  }, [])

  const updateSettings = useCallback((key: keyof TimerData, value: number | boolean) => {
    setTimer((prev) => {
      if (!prev) return prev
      const updated = { ...prev, [key]: value }
      writeTimerState(updated)
      return updated
    })
  }, [])

  if (!timer) return null

  const progress = timer.mode === "countdown"
    ? Math.min(100, (timer.elapsedMs / timer.targetMs) * 100)
    : Math.min(100, (timer.elapsedMs / (8 * 60 * 60 * 1000)) * 100)

  const displayTime = timer.mode === "countdown"
    ? Math.max(0, timer.targetMs - timer.elapsedMs)
    : timer.elapsedMs

  return (
    <div className="relative">
      <div className="h-9 inline-flex items-center gap-2 bg-background rounded-lg pl-2 pr-1 border border-border">
        {/* Mode selector */}
        <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5">
          {(["stopwatch", "pomodoro", "countdown"] as TimerMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => handleModeChange(mode)}
              className={`px-2 h-6 rounded text-xs font-medium transition-all ${
                timer.mode === mode
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode === "stopwatch" ? label("stopwatch") : mode === "pomodoro" ? label("pomodoro") : label("countdown")}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Timer display */}
        <div className="flex items-center gap-2 min-w-[110px]">
          <Timer className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="flex flex-col">
            <span className="text-sm font-bold font-mono tabular-nums leading-none">
              {formatShortDuration(displayTime)}
            </span>
            {timer.mode === "pomodoro" && (
              <span className="text-[10px] text-muted-foreground leading-none mt-0.5">
                {timer.currentPhase === "study" ? label("studyPhase") : label("breakPhase")}
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden flex-shrink-0">
          <div
            className="h-full rounded-full bg-primary transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-0.5">
          {timer.state === "running" ? (
            <button
              onClick={handlePause}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted text-foreground transition-colors"
              title={label("pause")}
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleStart}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted text-emerald-500 transition-colors"
              title={label("start")}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>
          )}
          <button
            onClick={handleStop}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted text-destructive transition-colors"
            title={label("stopAndLog")}
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            aria-pressed={showSettings}
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
              showSettings
                ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                : "hover:bg-muted text-muted-foreground"
            }`}
            title={showSettings ? label("timerSettings") : label("timerSettings")}
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Settings popup */}
      {showSettings && (
        <>
          {/* Invisible backdrop — click outside closes */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowSettings(false)}
          />
          <div className="absolute top-full right-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-lg p-4 z-50">
          <h4 className="text-sm font-semibold mb-3">{label("timerSettings")}</h4>
          {timer.mode === "pomodoro" && (
            <>
              <div className="mb-3">
                <label className="text-xs text-muted-foreground block mb-1">{label("studyDuration")}</label>
                <input
                  type="number"
                  value={timer.studyDurationMin}
                  onChange={(e) => updateSettings("studyDurationMin", parseInt(e.target.value) || 50)}
                  className="w-full px-3 py-1.5 rounded-lg border border-input bg-background text-sm"
                  min={1}
                  max={120}
                />
              </div>
              <div className="mb-3">
                <label className="text-xs text-muted-foreground block mb-1">{label("breakDuration")}</label>
                <input
                  type="number"
                  value={timer.breakDurationMin}
                  onChange={(e) => updateSettings("breakDurationMin", parseInt(e.target.value) || 10)}
                  className="w-full px-3 py-1.5 rounded-lg border border-input bg-background text-sm"
                  min={1}
                  max={60}
                />
              </div>
            </>
          )}
          {timer.mode === "countdown" && (
            <div className="mb-3">
              <label className="text-xs text-muted-foreground block mb-1">{label("targetHours")}</label>
              <input
                type="number"
                value={timer.targetMs / (60 * 60 * 1000)}
                onChange={(e) => updateSettings("targetMs", (parseFloat(e.target.value) || 8) * 60 * 60 * 1000)}
                className="w-full px-3 py-1.5 rounded-lg border border-input bg-background text-sm"
                min={0.5}
                max={24}
                step={0.5}
              />
            </div>
          )}
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={timer.autoLog ?? false}
              onChange={(e) => updateSettings("autoLog", e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-xs text-muted-foreground">{label("autoLogPomodoro")}</span>
          </label>
          <button
            onClick={() => {
              handleModeChange(timer.mode)
              setShowSettings(false)
            }}
            className="w-full py-1.5 rounded-lg bg-muted text-xs font-medium hover:bg-muted/80 transition-colors"
          >
            {label("resetTimer")}
          </button>
        </div>
        </>
      )}
    </div>
  )
}