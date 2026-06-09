/**
 * Phase 2.5: Centralized keyboard shortcuts catalog.
 *
 * Single source of truth for all app-wide keyboard shortcuts. The
 * Cheatsheet modal reads from this list; the App.tsx keydown handler
 * dispatches to the registered handlers; users can re-bind (future work)
 * by editing the keys here.
 */

export type ShortcutCategory =
  | "navigation"
  | "overlays"
  | "view"
  | "help"

export interface Shortcut {
  /** Display label, e.g. "1" or "Cmd+K" */
  key: string
  /** What it does, e.g. "Switch to Calendar tab" */
  description: string
  /** Category for grouping in the cheatsheet */
  category: ShortcutCategory
  /** Optional platform-specific override (e.g. Cmd on Mac, Ctrl on Windows) */
  platform?: "mac" | "windows" | "all"
}

export const SHORTCUTS: Shortcut[] = [
  // Navigation
  { key: "1", description: "Switch to Calendar tab", category: "navigation" },
  { key: "2", description: "Switch to Schedule List tab", category: "navigation" },
  { key: "3", description: "Switch to Progress tab", category: "navigation" },
  { key: "4", description: "Switch to Cert Path tab", category: "navigation" },

  // Overlays
  { key: "P", description: "Open Planner (Plan Config)", category: "overlays" },
  { key: "L", description: "Open Online Labs", category: "overlays" },
  { key: "N", description: "Toggle Security News", category: "overlays" },
  { key: "T", description: "Open Theme picker", category: "overlays" },

  // View
  { key: "F", description: "Toggle fullscreen", category: "view" },
  { key: "R", description: "Refresh plans", category: "view" },
  { key: "?", description: "Show keyboard shortcuts (this dialog)", category: "view" },
  { key: "Escape", description: "Close any open modal or popover", category: "view" },

  // Help (future)
  // { key: "Cmd+K", description: "Quick search", category: "help", platform: "mac" },
  // { key: "Ctrl+K", description: "Quick search", category: "help", platform: "windows" },
]

/** Group shortcuts by category for the cheatsheet modal. */
export function groupedShortcuts(): Record<ShortcutCategory, Shortcut[]> {
  const out: Record<ShortcutCategory, Shortcut[]> = {
    navigation: [],
    overlays: [],
    view: [],
    help: [],
  }
  for (const s of SHORTCUTS) {
    out[s.category].push(s)
  }
  return out
}
