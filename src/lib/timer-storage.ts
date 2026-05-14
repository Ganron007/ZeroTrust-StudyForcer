/**
 * Timer storage for desktop app — persists timer state to file.
 */

import { invoke } from "@tauri-apps/api/core"
import { IS_TAURI } from "@/lib/is-tauri"

const WEB_TIMER_KEY = "web:timer"

export type TimerMode = "stopwatch" | "pomodoro" | "countdown"
export type TimerState = "idle" | "running" | "paused"

export interface TimerData {
  mode: TimerMode
  state: TimerState
  elapsedMs: number
  targetMs: number
  studyDurationMin: number
  breakDurationMin: number
  lastUpdated: string
  currentPhase: "study" | "break"
  phaseElapsedMs: number
  autoLog?: boolean
}

const DEFAULT_TIMER: TimerData = {
  mode: "stopwatch",
  state: "idle",
  elapsedMs: 0,
  targetMs: 8 * 60 * 60 * 1000, // 8 hours
  studyDurationMin: 50,
  breakDurationMin: 10,
  lastUpdated: new Date().toISOString(),
  currentPhase: "study",
  phaseElapsedMs: 0,
  autoLog: false,
}

export async function readTimerState(): Promise<TimerData> {
  try {
    const data = IS_TAURI
      ? await invoke<string>("read_timer_file")
      : localStorage.getItem(WEB_TIMER_KEY) ?? ""
    if (!data) return DEFAULT_TIMER
    const parsed = JSON.parse(data)
    if (!parsed || typeof parsed !== "object") return DEFAULT_TIMER
    return { ...DEFAULT_TIMER, ...parsed }
  } catch {
    return DEFAULT_TIMER
  }
}

export async function writeTimerState(timer: TimerData): Promise<void> {
  const content = JSON.stringify({ ...timer, lastUpdated: new Date().toISOString() }, null, 2)
  if (IS_TAURI) {
    await invoke("write_timer_file", { content })
    return
  }
  localStorage.setItem(WEB_TIMER_KEY, content)
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`
  }
  return `${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`
}

export function formatShortDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}