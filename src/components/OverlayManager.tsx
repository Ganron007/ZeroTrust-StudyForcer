"use client"

import { useCallback } from "react"
import { usePersonality } from "./PersonalityProvider"
import { usePlanStore } from "../lib/plan-store"
import { useCourse } from "./CourseProvider"
import { showToast } from "./NotificationToast"
import { formatStr } from "../lib/personality"
import LabDashboard from "./LabDashboard"
import SecurityNewsFeed from "./SecurityNewsFeed"
import CourseBuilder from "./CourseBuilder"
import PlannerPage from "./PlannerPage"
import { ErrorBoundary } from "./ErrorBoundary"
import type { StudyPlan } from "../lib/plan-storage"
import type { CourseConfig } from "../types/course"
import type { OverlayController } from "../hooks/useOverlayState"

/**
 * Centralized overlay manager.
 *
 * Replaces the 5 early-returns from App.tsx:
 *   if (isOnlineLabsOpen) return <LabDashboard .../>
 *   if (isNewsOpen)       return <SecurityNewsFeed .../>
 *   if (isCourseBuilderOpen) return <CourseBuilder .../>
 *   if (isPlannerOpen)    return <PlannerPage .../>
 *
 * Each overlay state is an `OverlayController<T>` from `useOverlayState`.
 * The manager renders one full-page overlay at a time (priority order:
 * Labs > News > CourseBuilder > Planner). When the highest-priority
 * overlay is closed, the next one renders.
 *
 * Priority is by z-stack / full-screen nature: a full-page modal takes
 * over the entire viewport, so it should be the only thing rendered.
 * This component doesn't render anything if all overlays are closed.
 */

type PlannerArgs = { initialCourseId: string | null }

export type OverlayManagerProps = {
  onlineLabs: OverlayController<null>
  news: OverlayController<null>
  courseBuilder: OverlayController<null>
  planner: OverlayController<PlannerArgs>
}

export function OverlayManager({
  onlineLabs,
  news,
  courseBuilder,
  planner,
}: OverlayManagerProps) {
  const { toast } = usePersonality()
  const { courses, activeCourseId, refreshCourses } = useCourse()
  const allPlans = usePlanStore((s) => s.allPlans)
  const activePlanIds = usePlanStore((s) => s.activePlanIds)
  const loadPlans = usePlanStore((s) => s.loadPlans)
  const storeSetActivePlanIds = usePlanStore((s) => s.setActivePlanIds)
  const storeSetPrimaryActivePlanId = usePlanStore((s) => s.setPrimaryActivePlanId)

  // Planner handlers
  const onActivatePlan = useCallback(
    async (plan: StudyPlan) => {
      const curr = activePlanIds
      const isActive = curr.includes(plan.id)
      if (isActive) {
        await storeSetActivePlanIds(curr.filter((id) => id !== plan.id))
      } else {
        const next = [...curr, plan.id]
        await storeSetActivePlanIds(next)
        if (plan.courseId === activeCourseId) {
          storeSetPrimaryActivePlanId(plan.id)
        }
      }
    },
    [activePlanIds, activeCourseId, storeSetActivePlanIds, storeSetPrimaryActivePlanId],
  )

  const onPlansChanged = useCallback(async () => {
    await loadPlans()
    showToast(toast("planSaved"), "info")
  }, [loadPlans, toast])

  // CourseBuilder handlers
  const onCourseSaved = useCallback(async () => {
    courseBuilder.close()
    await refreshCourses()
    await loadPlans()
  }, [courseBuilder, refreshCourses, loadPlans])

  // Priority: Labs > News > CourseBuilder > Planner
  if (onlineLabs.isOpen) {
    return (
      <ErrorBoundary sectionLabel="Lab dashboard" onReset={onlineLabs.close}>
        <LabDashboard onBack={onlineLabs.close} />
      </ErrorBoundary>
    )
  }

  if (news.isOpen) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <ErrorBoundary sectionLabel="Security news" onReset={news.close}>
          <SecurityNewsFeed onClose={news.close} />
        </ErrorBoundary>
      </div>
    )
  }

  if (courseBuilder.isOpen) {
    return (
      <ErrorBoundary sectionLabel="Course builder" onReset={courseBuilder.close}>
        <CourseBuilder
          onBack={courseBuilder.close}
          onCourseSaved={onCourseSaved}
          existingCourses={courses.map((c) => ({ id: c.id, name: c.name }))}
        />
      </ErrorBoundary>
    )
  }

  if (planner.isOpen) {
    return (
      <ErrorBoundary sectionLabel="Planner" onReset={planner.close}>
        <PlannerPage
          courses={courses}
          activeCourseId={activeCourseId}
          activePlanIds={activePlanIds}
          allPlans={allPlans}
          initialCourseId={planner.state.initialCourseId}
          onActivatePlan={onActivatePlan}
          onPlansChanged={onPlansChanged}
          onBack={planner.close}
          onOpenCourseBuilder={courseBuilder.open}
        />
      </ErrorBoundary>
    )
  }

  return null
}
