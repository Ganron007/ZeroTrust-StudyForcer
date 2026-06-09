import { invoke } from "@tauri-apps/api/core"
import type { CourseConfig } from "@/types/course"
import { IS_TAURI } from "./is-tauri"

function isCourseConfig(value: unknown): value is CourseConfig {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  if (typeof v.id !== "string" || typeof v.name !== "string") return false
  if (!Array.isArray(v.units) || v.units.length === 0) return false
  // Validate each unit has chapters with unique IDs
  const seenChapterIds = new Set<number>()
  for (const unit of v.units) {
    if (!unit || typeof unit !== "object") return false
    const u = unit as Record<string, unknown>
    if (typeof u.id !== "number" || !Array.isArray(u.chapters)) return false
    for (const ch of u.chapters) {
      if (!ch || typeof ch !== "object") return false
      const c = ch as Record<string, unknown>
      if (typeof c.id !== "number") return false
      if (seenChapterIds.has(c.id)) return false // A56: reject duplicate chapter IDs
      seenChapterIds.add(c.id)
    }
  }
  if (v.defaultSettings === null || typeof v.defaultSettings !== "object") return false
  return true
}

// ── Browser localStorage fallback ──────────────────────────────────────────
// Used when running outside Tauri (e.g. `npm run dev` opened in a browser).

const WEB_INDEX_KEY = "web:courses:index"
const webCourseKey = (id: string) => `web:course:${id}`
const webLogoKey = (id: string) => `web:logo:${id}`

function webGetCourseIds(): string[] {
  try {
    const raw = localStorage.getItem(WEB_INDEX_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : []
  } catch {
    return []
  }
}

function webSetCourseIds(ids: string[]): void {
  localStorage.setItem(WEB_INDEX_KEY, JSON.stringify(ids))
}

function webLoadAllCourses(): CourseConfig[] {
  const ids = webGetCourseIds()
  const out: CourseConfig[] = []
  for (const id of ids) {
    try {
      const raw = localStorage.getItem(webCourseKey(id))
      if (!raw) continue
      const parsed = JSON.parse(raw)
      if (isCourseConfig(parsed)) out.push(parsed)
    } catch {
      // skip corrupt entry
    }
  }
  return out
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function loadAllCourses(): Promise<CourseConfig[]> {
  if (IS_TAURI) {
    const raw = await invoke<unknown[]>("list_course_configs")
    return Array.isArray(raw) ? raw.filter(isCourseConfig) : []
  }
  return webLoadAllCourses()
}

export async function loadCourse(courseId: string): Promise<CourseConfig | null> {
  if (IS_TAURI) {
    try {
      const json = await invoke<string>("read_course_config", { courseId })
      const parsed = JSON.parse(json)
      return isCourseConfig(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  try {
    const raw = localStorage.getItem(webCourseKey(courseId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return isCourseConfig(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function saveCourse(config: CourseConfig): Promise<void> {
  if (IS_TAURI) {
    await invoke("write_course_config", {
      courseId: config.id,
      content: JSON.stringify(config, null, 2),
    })
    return
  }
  localStorage.setItem(webCourseKey(config.id), JSON.stringify(config))
  // Always update index to prevent desync (A34)
  const ids = webGetCourseIds()
  if (!ids.includes(config.id)) {
    ids.push(config.id)
    webSetCourseIds(ids)
  }
}

export async function deleteCourse(courseId: string): Promise<void> {
  if (IS_TAURI) {
    await invoke("delete_course_config", { courseId })
    return
  }
  // S1: Atomic web delete — read index, remove course + logo, write index in one pass
  const ids = webGetCourseIds()
  const filtered = ids.filter((id) => id !== courseId)
  localStorage.removeItem(webCourseKey(courseId))
  localStorage.removeItem(webLogoKey(courseId))
  webSetCourseIds(filtered)
}

export async function importCourse(filePath: string): Promise<string> {
  if (!IS_TAURI) {
    throw new Error("Course import from file path is only available in the desktop app.")
  }
  return await invoke("import_course_config", { filePath })
}

export async function exportCourse(courseId: string, destPath: string): Promise<void> {
  if (!IS_TAURI) {
    throw new Error("Course export to file path is only available in the desktop app.")
  }
  await invoke("export_course_config", { courseId, destPath })
}

export async function saveLogo(courseId: string, svgContent: string): Promise<void> {
  if (!svgContent || svgContent.trim().length === 0) {
    console.warn("[course-storage] Attempted to save empty SVG for course", courseId)
    return
  }
  if (IS_TAURI) {
    await invoke("save_logo_file", { courseId, content: svgContent })
    return
  }
  localStorage.setItem(webLogoKey(courseId), svgContent)
}

export async function loadLogo(courseId: string): Promise<string | null> {
  if (IS_TAURI) {
    try {
      return await invoke<string>("read_logo_file", { courseId })
    } catch {
      return null
    }
  }
  return localStorage.getItem(webLogoKey(courseId))
}

export async function listCourseIds(): Promise<string[]> {
  if (IS_TAURI) {
    return await invoke("list_course_ids")
  }
  return webGetCourseIds()
}

// S3: Runtime-validated default course ID
export const DEFAULT_COURSE_ID = "cissp-10th-ed"

export function validateDefaultCourse(): Promise<boolean> {
  return loadCourse(DEFAULT_COURSE_ID).then((c) => c !== null)
}
