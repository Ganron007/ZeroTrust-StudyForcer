import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import type { CourseConfig, Chapter } from "@/types/course"
import { flattenCourse, getUnitMap, getUnitColors, getUnitNames, getUnitWeights, computeTotalPages } from "@/types/course"
import { loadAllCourses, loadCourse, saveCourse, saveLogo, loadLogo, deleteCourse } from "@/lib/course-storage"
import { sanitizeSvg } from "@/lib/sanitize-svg"

interface CourseContextValue {
  courses: CourseConfig[]
  activeCourse: CourseConfig | null
  activeCourseId: string | null
  chapters: Chapter[]
  unitMap: Record<number, import("@/types/course").CourseUnit>
  unitColors: Record<number, string>
  unitNames: Record<number, string>
  unitWeights: Record<number, number>
  totalBookPages: number
  studyPages: number
  logoSvg: string | null
  isLoading: boolean
  switchCourse: (courseId: string | null) => Promise<void>
  refreshCourses: () => Promise<void>
  saveActiveCourse: (config: CourseConfig) => Promise<void>
  setCourseLogo: (courseId: string, svgContent: string) => Promise<void>
}

const CourseContext = createContext<CourseContextValue | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useCourse() {
  const ctx = useContext(CourseContext)
  if (!ctx) throw new Error("useCourse must be used within CourseProvider")
  return ctx
}

export function CourseProvider({ children }: { children: ReactNode }) {
  const [courses, setCourses] = useState<CourseConfig[]>([])
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null)
  const [activeCourse, setActiveCourse] = useState<CourseConfig | null>(null)
  const [logoSvg, setLogoSvg] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const derive = useCallback((config: CourseConfig | null) => {
    if (!config) {
      return {
        chapters: [] as Chapter[],
        unitMap: {} as Record<number, import("@/types/course").CourseUnit>,
        unitColors: {} as Record<number, string>,
        unitNames: {} as Record<number, string>,
        unitWeights: {} as Record<number, number>,
        totalBookPages: 0,
        studyPages: 0,
      }
    }
    return {
      chapters: flattenCourse(config),
      unitMap: getUnitMap(config),
      unitColors: getUnitColors(config),
      unitNames: getUnitNames(config),
      unitWeights: getUnitWeights(config),
      totalBookPages: config.totalPages ?? computeTotalPages(config),
      studyPages: config.studyPages ?? computeTotalPages(config),
    }
  }, [])

  const [derived, setDerived] = useState(() => derive(null))

  const loadLogoFor = useCallback(async (courseId: string) => {
    const svg = await loadLogo(courseId)
    setLogoSvg(svg ? sanitizeSvg(svg) : null)
  }, [])

  const init = useCallback(async () => {
    setIsLoading(true)
    let all = await loadAllCourses()

    // Remove stale combined-course from previous version
    try {
      await deleteCourse("combined-cissp-secai")
      all = await loadAllCourses()
    } catch {
      // ignore if already gone
    }

    // Remove old single OSCP+ course (replaced by 3 separate courses)
    try {
      await deleteCourse("oscp-pen-200")
      all = await loadAllCourses()
    } catch {
      // ignore if already gone
    }

    // Seed default courses if they don't exist yet
    const SEED_FILES = [
      { file: "/default-course.json", id: "cissp-10th-ed" },
      { file: "/secai-course.json", id: "comptia-secai-cy0-001" },
      { file: "/oscp-pdf-study-course.json", id: "oscp-pdf-study" },
      { file: "/oscp-official-lab-course.json", id: "oscp-official-lab" },
      { file: "/oscp-exam-prep-course.json", id: "oscp-exam-prep" },
    ]

    const existingIds = new Set(all.map((c) => c.id))
    const missing = SEED_FILES.filter((s) => !existingIds.has(s.id))

    if (missing.length > 0) {
      for (const seed of missing) {
        try {
          const res = await fetch(seed.file)
          const config: CourseConfig = await res.json()
          await saveCourse(config)
        } catch (e) {
          console.error("Failed to seed course", seed.id, e)
        }
      }
      all = await loadAllCourses()
    }

    const needsMigration = all.filter((c) =>
      SEED_FILES.some((s) => s.id === c.id) &&
      c.units.some((u) => u.chapters.some((ch) => ch.bookPageStart === undefined))
    )
    if (needsMigration.length > 0) {
      for (const course of needsMigration) {
        const seed = SEED_FILES.find((s) => s.id === course.id)
        if (!seed) continue
        try {
          const res = await fetch(seed.file)
          const config: CourseConfig = await res.json()
          await saveCourse(config)
        } catch (e) {
          console.error("Failed to migrate course", course.id, e)
        }
      }
      all = await loadAllCourses()
    }

    setCourses(all)

    // Active course is opt-in: only restore if a previously-chosen one is
    // still around. Don't auto-pick a default — the user explicitly picks
    // one via the course selector.
    const savedId = localStorage.getItem("activeCourseId")
    const targetId = savedId && all.find((c) => c.id === savedId) ? savedId : null

    if (targetId) {
      const cfg = all.find((c) => c.id === targetId) ?? null
      setActiveCourseId(targetId)
      setActiveCourse(cfg)
      setDerived(derive(cfg))
      if (cfg) await loadLogoFor(cfg.id)
    }

    setIsLoading(false)
  }, [derive, loadLogoFor])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- genuine one-shot init that loads external data
    init()
  }, [init])

  const switchCourse = useCallback(async (courseId: string | null) => {
    if (courseId === null) {
      setActiveCourseId(null)
      setActiveCourse(null)
      setDerived(derive(null))
      setLogoSvg(null)
      localStorage.removeItem("activeCourseId")
      return
    }
    const cfg = courses.find((c) => c.id === courseId) ?? (await loadCourse(courseId))
    if (cfg) {
      setActiveCourseId(cfg.id)
      setActiveCourse(cfg)
      setDerived(derive(cfg))
      localStorage.setItem("activeCourseId", cfg.id)
      await loadLogoFor(cfg.id)
    }
  }, [courses, derive, loadLogoFor])

  const refreshCourses = useCallback(async () => {
    const all = await loadAllCourses()
    setCourses(all)
    if (activeCourseId) {
      const cfg = all.find((c) => c.id === activeCourseId)
      if (cfg) {
        setActiveCourse(cfg)
        setDerived(derive(cfg))
      }
    }
  }, [activeCourseId, derive])

  const saveActiveCourse = useCallback(async (config: CourseConfig) => {
    await saveCourse(config)
    await refreshCourses()
    if (activeCourseId === config.id) {
      setActiveCourse(config)
      setDerived(derive(config))
    }
  }, [activeCourseId, refreshCourses, derive])

  const setCourseLogo = useCallback(async (courseId: string, svgContent: string) => {
    const cleaned = sanitizeSvg(svgContent)
    if (!cleaned) {
      throw new Error("Logo file is not a valid SVG.")
    }
    await saveLogo(courseId, cleaned)
    if (activeCourseId === courseId) {
      setLogoSvg(cleaned)
    }
    await refreshCourses()
  }, [activeCourseId, refreshCourses])

  return (
    <CourseContext.Provider
      value={{
        courses,
        activeCourse,
        activeCourseId,
        chapters: derived.chapters,
        unitMap: derived.unitMap,
        unitColors: derived.unitColors,
        unitNames: derived.unitNames,
        unitWeights: derived.unitWeights,
        totalBookPages: derived.totalBookPages,
        studyPages: derived.studyPages,
        logoSvg,
        isLoading,
        switchCourse,
        refreshCourses,
        saveActiveCourse,
        setCourseLogo,
      }}
    >
      {children}
    </CourseContext.Provider>
  )
}
