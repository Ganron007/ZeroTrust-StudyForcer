import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import KeyboardShortcutsCheatsheet from "../KeyboardShortcutsCheatsheet"
import { SHORTCUTS } from "@/lib/shortcuts"

// Mock personality layer
vi.mock("@/components/PersonalityProvider", () => ({
  usePersonality: () => {
    const map: Record<string, string> = {
      cheatsheetTitle: "Keyboard Shortcuts",
      cheatsheetSubtitle: "Press these anywhere to navigate the app faster.",
      cheatsheetFooter: "Press ? anytime to reopen this dialog",
      close: "Close",
    }
    return {
      label: (key: string) => map[key] ?? key,
      toast: (key: string) => map[key] ?? key,
    }
  },
}))

describe("KeyboardShortcutsCheatsheet (Phase 2.5)", () => {
  it("renders nothing when closed", () => {
    const onClose = vi.fn()
    render(<KeyboardShortcutsCheatsheet open={false} onClose={onClose} />)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("renders the dialog with all shortcuts when open", () => {
    const onClose = vi.fn()
    render(<KeyboardShortcutsCheatsheet open={true} onClose={onClose} />)
    const dialog = screen.getByRole("dialog")
    expect(dialog).toBeInTheDocument()
    // Title rendered
    expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument()
    // All shortcuts have description text
    for (const s of SHORTCUTS) {
      expect(screen.getByText(s.description)).toBeInTheDocument()
    }
  })

  it("has the correct ARIA attributes", () => {
    const onClose = vi.fn()
    render(<KeyboardShortcutsCheatsheet open={true} onClose={onClose} />)
    const dialog = screen.getByRole("dialog")
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    expect(dialog.getAttribute("aria-labelledby")).toBe("cheatsheet-title")
  })

  it("calls onClose when X button is clicked", () => {
    const onClose = vi.fn()
    render(<KeyboardShortcutsCheatsheet open={true} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText("Close"))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn()
    const { container } = render(
      <KeyboardShortcutsCheatsheet open={true} onClose={onClose} />,
    )
    // The backdrop is the parent of the dialog (the fixed inset-0 div)
    const backdrop = container.querySelector(".fixed.inset-0") as HTMLElement
    expect(backdrop).not.toBeNull()
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("does NOT close when dialog content is clicked (stopPropagation)", () => {
    const onClose = vi.fn()
    const { container } = render(
      <KeyboardShortcutsCheatsheet open={true} onClose={onClose} />,
    )
    const dialog = screen.getByRole("dialog")
    fireEvent.click(dialog)
    expect(onClose).not.toHaveBeenCalled()
  })

  it("calls onClose when Esc is pressed", () => {
    const onClose = vi.fn()
    render(<KeyboardShortcutsCheatsheet open={true} onClose={onClose} />)
    fireEvent.keyDown(window, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("groups shortcuts by category", () => {
    const onClose = vi.fn()
    render(<KeyboardShortcutsCheatsheet open={true} onClose={onClose} />)
    // Each category has a label as h3
    const headings = screen.getAllByRole("heading", { level: 3 })
    const labels = headings.map((h) => h.textContent)
    expect(labels).toContain("Navigation")
    expect(labels).toContain("Overlays")
    expect(labels).toContain("View")
  })
})
