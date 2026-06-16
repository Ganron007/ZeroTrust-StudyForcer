import { useState, useCallback, useEffect } from "react"
import { showToast } from "@/components/NotificationToast"
import { formatStr } from "@/lib/personality"
import { now } from "@/lib/clock"
import { applyTempLog, clearTempLog, readTempLogs } from "@/lib/temp-log-storage"
import { usePlanStore } from "@/lib/plan-store"
import type { StudyPlan } from "@/lib/plan-storage"
import type { StudyDay } from "@/lib/cissp-data"
import type { LogGroup } from "@/components/LogDialog"

export type UseStudyLoggingOptions = {
  /** Active schedule used for validation. */
  schedule: StudyDay[]
  /** Callback that returns a short display label for a course id. */
  courseLabel: (id: string) => string
  /** Personality toast template function. */
  tToast: (key: string) => string
  /** Optional callback invoked after a successful Mark Done commit. */
  onAfterMarkDone?: () => void
}

export type UseStudyLoggingResult = {
  /** Temp React state: pending logs not yet committed via Mark Done. */
  dailyLog: Record<string, Record<string, { pagesRead: number }>>
  /** Gate that prevents Mark Done / Log / Skip before temp logs have loaded from storage. */
  tempLogsLoaded: boolean
  /** Currently open log dialog day. */
  logDialogDay: StudyDay | null
  /** Course groups for the currently open log dialog. */
  logDialogGroups: LogGroup[]
  /** Open the log dialog for a study day. */
  handleOpenLogDialog: (day: StudyDay, groups: LogGroup[]) => void
  /** Close the log dialog and clear its state. */
  handleCloseLogDialog: () => void
  /** Validate + apply a direct page log for one course on one date. */
  handleLogPlan: (date: string, courseId: string, pageValue: number) => void
  /** Apply a skip for one course on one date. */
  handleSkipPlan: (date: string, courseId: string) => void
  /** Save handler passed to LogDialog. */
  handleLogDialogSave: (date: string, logs: Array<{ courseId: string; pagesRead: number }>) => void
  /** Skip handler passed to LogDialog. */
  handleLogDialogSkip: (date: string, courseId: string) => void
  /** True when every course on the given date has a temp log or skip entry. */
  plansLoggedForDate: (date: string) => boolean
  /** Commit the pending temp log for a date to plan storage. */
  handleMarkDone: (date: string) => Promise<void>
}

/**
 * Owns the Log/Skip temp-state and Mark Done commit flow.
 *
 * Invariants preserved:
 * - Log/Skip are temp React state only; persistence is in localStorage for
 *   crash recovery until Mark Done clears it.
 * - Mark Done is the only commit point that writes to plan storage.
 * - `tempLogsLoaded` gates every operation that reads or writes temp state so
 *   a rapid click before mount cannot commit empty state or overwrite pending
 *   logs with stale storage.
 */
export function useStudyLogging({
  schedule,
  courseLabel,
  tToast,
  onAfterMarkDone,
}: UseStudyLoggingOptions): UseStudyLoggingResult {
  const [dailyLog, setDailyLog] = useState<Record<string, Record<string, { pagesRead: number }>>>({})
  const [tempLogsLoaded, setTempLogsLoaded] = useState(false)
  const [logDialogDay, setLogDialogDay] = useState<StudyDay | null>(null)
  const [logDialogGroups, setLogDialogGroups] = useState<LogGroup[]>([])

  const allPlans = usePlanStore((s) => s.allPlans)
  const activePlanIds = usePlanStore((s) => s.activePlanIds)
  const storeUpdatePlan = usePlanStore((s) => s.updatePlan)

  // P-2 (v2.5.0): Load temp logs from storage on mount.
  // The `tempLogsLoaded` flag gates every operation that reads or writes temp
  // state so a rapid click before mount cannot commit empty state or overwrite
  // pending logs with stale storage.
  useEffect(() => {
    let cancelled = false
    readTempLogs()
      .then((storedLogs) => {
        if (cancelled) return
        if (Object.keys(storedLogs).length > 0) {
          setDailyLog(storedLogs)
        }
      })
      .catch((e) => {
        if (cancelled) return
        console.error("[useStudyLogging] failed to load temp logs from storage:", e)
      })
      .finally(() => {
        if (!cancelled) setTempLogsLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleCloseLogDialog = useCallback(() => {
    setLogDialogDay(null)
    setLogDialogGroups([])
  }, [])

  const handleOpenLogDialog = useCallback((day: StudyDay, groups: LogGroup[]) => {
    setLogDialogDay(day)
    setLogDialogGroups(groups)
  }, [])

  const validateLogEntry = useCallback(
    (date: string, courseId: string, pageValue: number): boolean => {
      if (!Number.isFinite(pageValue) || !Number.isInteger(pageValue) || pageValue < 0) {
        console.error("[validateLogEntry] invalid pageValue:", pageValue)
        return false
      }
      const daySchedule = schedule.find((d) => d.date === date)
      if (!daySchedule) return false
      const planChapters = daySchedule.chapters.filter((ch) => ch.courseId === courseId)
      if (planChapters.length === 0) return false
      const firstCh = planChapters[0]
      const scheduleStart = firstCh.bookPageStart ?? firstCh.pagesStart
      if (pageValue < scheduleStart) {
        showToast(formatStr(tToast("pageBeforeRange"), { value: pageValue, start: scheduleStart }), "break")
        return false
      }
      return true
    },
    [schedule, tToast],
  )

  const applyTempLogLocal = useCallback(
    (date: string, courseId: string, pagesRead: number) => {
      setDailyLog((prev) => ({
        ...prev,
        [date]: { ...prev[date], [courseId]: { pagesRead } },
      }))
      applyTempLog(date, courseId, pagesRead).catch((e) => {
        console.error("[useStudyLogging] failed to persist to storage:", e)
      })
    },
    [],
  )

  const handleLogPlan = useCallback(
    // 1. Plan-level logging (before Mark Done)
    (date: string, courseId: string, pageValue: number) => {
      if (!tempLogsLoaded) {
        showToast(tToast("loadingLogs"), "info")
        return
      }
      if (!validateLogEntry(date, courseId, pageValue)) return
      const daySchedule = schedule.find((d) => d.date === date)
      if (!daySchedule) {
        console.error("[applyTempLog] missing daySchedule for date:", date)
        return
      }
      const planChapters = daySchedule.chapters.filter((ch) => ch.courseId === courseId)
      if (planChapters.length === 0) {
        console.error("[applyTempLog] no chapters for courseId:", courseId, "on date:", date)
        return
      }
      const firstCh = planChapters[0]
      const lastCh = planChapters[planChapters.length - 1]
      const scheduleStart = firstCh.bookPageStart ?? firstCh.pagesStart
      const scheduleEnd = lastCh.bookPageEnd ?? lastCh.pagesEnd
      const pagesRead = pageValue - scheduleStart

      applyTempLogLocal(date, courseId, pagesRead)

      if (pageValue > scheduleEnd) {
        showToast(formatStr(tToast("aheadOfSchedule"), { pages: pagesRead }), "info")
      } else {
        showToast(
          formatStr(tToast("savedLog"), {
            start: scheduleStart,
            end: scheduleEnd,
            value: pageValue,
            pages: pagesRead,
          }),
          "complete",
        )
      }
    },
    [tempLogsLoaded, validateLogEntry, schedule, applyTempLogLocal, tToast],
  )

  const handleSkipPlan = useCallback(
    (date: string, courseId: string) => {
      if (!tempLogsLoaded) {
        showToast(tToast("loadingLogs"), "info")
        return
      }
      setDailyLog((prev) => ({
        ...prev,
        [date]: { ...prev[date], [courseId]: { pagesRead: 0 } },
      }))
      applyTempLog(date, courseId, 0).catch((e) => {
        console.error("[handleSkipPlan] failed to persist to storage:", e)
        showToast(formatStr(tToast("tempLogClearFailed"), { date }), "break")
      })
      showToast(formatStr(tToast("skipped"), { label: courseLabel(courseId) }), "info")
    },
    [tempLogsLoaded, tToast, courseLabel],
  )

  const plansLoggedForDate = useCallback(
    (date: string): boolean => {
      const daySchedule = schedule.find((d) => d.date === date)
      if (!daySchedule || daySchedule.chapters.length === 0) return true
      const planIds = new Set<string>()
      for (const ch of daySchedule.chapters) {
        if (!ch.courseId) {
          console.error(`[plansLoggedForDate] chapter ${ch.chapterId} has no courseId on ${date}`)
          continue
        }
        planIds.add(ch.courseId)
      }
      if (planIds.size === 0) return true
      const dateLogs = dailyLog[date]
      if (!dateLogs) return false
      for (const planId of planIds) {
        if (!(planId in dateLogs)) return false
      }
      return true
    },
    [schedule, dailyLog],
  )

  const handleMarkDone = useCallback(
    async (date: string) => {
      if (!tempLogsLoaded) {
        showToast(tToast("loadingLogs"), "info")
        return
      }
      if (!plansLoggedForDate(date)) {
        showToast(tToast("logOrSkipFirst"), "info")
        return
      }

      const pendingLogs = dailyLog[date]
      if (!pendingLogs || Object.keys(pendingLogs).length === 0) {
        showToast(tToast("noPendingLog"), "info")
        return
      }

      let totalPages = 0
      const completedWrites: Array<{ planId: string; original: StudyPlan }> = []

      for (const [courseId, log] of Object.entries(pendingLogs)) {
        totalPages += log.pagesRead
        const plansForCourse = allPlans.filter(
          (p) => p.courseId === courseId && activePlanIds.includes(p.id),
        )
        if (plansForCourse.length === 0) continue

        for (const plan of plansForCourse) {
          const original = { ...plan, dailyLog: { ...plan.dailyLog } }
          const updated: StudyPlan = {
            ...plan,
            dailyLog: {
              ...plan.dailyLog,
              [date]: { pagesRead: log.pagesRead },
            },
            updatedAt: now(),
          }

          try {
            await storeUpdatePlan(updated)
            completedWrites.push({ planId: plan.id, original })
          } catch (e) {
            console.error(`Failed to persist Mark Done for plan ${plan.id}:`, e)
            for (const done of completedWrites) {
              try {
                await storeUpdatePlan(done.original)
              } catch (rollbackErr) {
                console.error(`[handleMarkDone] rollback also failed for plan ${done.planId}:`, rollbackErr)
                showToast(formatStr(tToast("failedToSave"), { label: courseLabel(done.planId) }), "break")
              }
            }
            showToast(formatStr(tToast("failedToSave"), { label: courseLabel(courseId) }), "break")
            return
          }
        }
      }

      setDailyLog((prev) => {
        const next = { ...prev }
        delete next[date]
        return next
      })

      try {
        await clearTempLog(date)
      } catch (e) {
        console.error("[handleMarkDone] failed to clear temp logs from storage:", e)
        showToast(formatStr(tToast("tempLogClearFailed"), { date }), "break")
      }

      showToast(
        formatStr(tToast("markDoneConfirm"), { pages: totalPages, date }),
        totalPages > 0 ? "complete" : "info",
      )

      onAfterMarkDone?.()
    },
    [tempLogsLoaded, plansLoggedForDate, dailyLog, allPlans, activePlanIds, storeUpdatePlan, tToast, courseLabel, onAfterMarkDone],
  )

  const handleLogDialogSave = useCallback(
    (date: string, logs: Array<{ courseId: string; pagesRead: number }>) => {
      let allValid = true
      for (const { courseId, pagesRead } of logs) {
        if (validateLogEntry(date, courseId, pagesRead)) {
          handleLogPlan(date, courseId, pagesRead)
        } else {
          allValid = false
        }
      }
      if (allValid) {
        handleCloseLogDialog()
      }
    },
    [validateLogEntry, handleLogPlan, handleCloseLogDialog],
  )

  const handleLogDialogSkip = useCallback(
    (date: string, courseId: string) => {
      handleSkipPlan(date, courseId)
      handleCloseLogDialog()
    },
    [handleSkipPlan, handleCloseLogDialog],
  )

  return {
    dailyLog,
    tempLogsLoaded,
    logDialogDay,
    logDialogGroups,
    handleOpenLogDialog,
    handleCloseLogDialog,
    handleLogPlan,
    handleSkipPlan,
    handleLogDialogSave,
    handleLogDialogSkip,
    plansLoggedForDate,
    handleMarkDone,
  }
}
