import { useEffect } from "react"
import { Keyboard, X } from "lucide-react"
import { usePersonality } from "./PersonalityProvider"
import { groupedShortcuts, type ShortcutCategory } from "@/lib/shortcuts"
import { useFocusTrap } from "@/hooks/useFocusTrap"

interface KeyboardShortcutsCheatsheetProps {
  open: boolean
  onClose: () => void
}

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: "Navigation",
  overlays: "Overlays",
  view: "View",
  help: "Help",
}

/**
 * Phase 2.5: Keyboard shortcuts cheatsheet.
 *
 * Modal triggered by `?` shortcut. Lists every app-wide shortcut in a
 * categorized table. WCAG-AA compliant:
 *  - role="dialog" + aria-modal="true" + aria-labelledby
 *  - focus trap on Tab/Shift+Tab (via useFocusTrap)
 *  - Esc closes the modal (via the focus trap's onEscape)
 *  - clicking the backdrop closes the modal
 *  - returns focus to the previously-focused element on close
 */
export default function KeyboardShortcutsCheatsheet({ open, onClose }: KeyboardShortcutsCheatsheetProps) {
  const { label } = usePersonality()
  const containerRef = useFocusTrap<HTMLDivElement>({
    active: open,
    onEscape: onClose,
  })

  // Also handle Esc on the window — the focus trap handles keydown on the
  // container, but a stray escape from outside the container should still
  // close the modal when it's the only open dialog.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [open, onClose])

  if (!open) return null

  const grouped = groupedShortcuts()
  const categories: ShortcutCategory[] = ["navigation", "overlays", "view"]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cheatsheet-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl p-6 max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-primary" />
            <h2 id="cheatsheet-title" className="text-lg font-bold text-foreground">
              {label("cheatsheetTitle")}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={label("close")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          {label("cheatsheetSubtitle")}
        </p>

        <div className="space-y-4">
          {categories.map((cat) => {
            const items = grouped[cat]
            if (items.length === 0) return null
            return (
              <div key={cat}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {CATEGORY_LABELS[cat]}
                </h3>
                <dl className="space-y-1.5">
                  {items.map((s) => (
                    <div
                      key={`${s.category}-${s.key}`}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <dt className="text-foreground flex-1">{s.description}</dt>
                      <dd>
                        <kbd className="font-mono text-xs px-2 py-0.5 rounded border border-border bg-muted text-foreground">
                          {s.key}
                        </kbd>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )
          })}
        </div>

        <p className="text-[10px] text-muted-foreground mt-4 text-center">
          {label("cheatsheetFooter")}
        </p>
      </div>
    </div>
  )
}
