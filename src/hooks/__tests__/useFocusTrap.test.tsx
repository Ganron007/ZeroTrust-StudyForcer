import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useState } from "react"
import { useFocusTrap } from "../useFocusTrap"

// Mock personality layer
vi.mock("@/components/PersonalityProvider", () => ({
  usePersonality: () => ({
    label: (key: string) => key,
    toast: (key: string) => key,
  }),
}))

interface TestPopoverProps {
  onClose: () => void
  escapeOnClose?: boolean
}

function TestPopover({ onClose, escapeOnClose = true }: TestPopoverProps) {
  const ref = useFocusTrap<HTMLDivElement>({
    active: true,
    onEscape: escapeOnClose ? onClose : undefined,
  })
  return (
    <div ref={ref} role="dialog" aria-label="Test dialog">
      <button>First</button>
      <button>Second</button>
      <input type="text" placeholder="Text input" />
      <button>Last</button>
    </div>
  )
}

beforeEach(() => {
  document.body.innerHTML = ""
  // Start with no focus
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
})

describe("useFocusTrap (Phase 2.5)", () => {
  it("moves focus to the first focusable element on mount", async () => {
    render(<TestPopover onClose={() => {}} />)
    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe("First")
    })
  })

  it("Tab from last element wraps to first", async () => {
    render(<TestPopover onClose={() => {}} />)
    const last = screen.getByText("Last")
    last.focus()
    expect(document.activeElement?.textContent).toBe("Last")
    fireEvent.keyDown(last, { key: "Tab" })
    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe("First")
    })
  })

  it("Shift+Tab from first element wraps to last", async () => {
    render(<TestPopover onClose={() => {}} />)
    const first = screen.getByText("First")
    first.focus()
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true })
    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe("Last")
    })
  })

  it("Esc triggers onEscape callback", async () => {
    const onClose = vi.fn()
    const { container } = render(<TestPopover onClose={onClose} />)
    const dialog = container.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog).not.toBeNull()
    fireEvent.keyDown(dialog, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("does not fire onEscape when no callback provided", async () => {
    render(<TestPopover onClose={() => {}} escapeOnClose={false} />)
    // Should not throw
    expect(() => fireEvent.keyDown(document.body, { key: "Escape" })).not.toThrow()
  })

  it("returns focus to the previously-focused element on unmount", async () => {
    const trigger = document.createElement("button")
    trigger.textContent = "Trigger"
    document.body.appendChild(trigger)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    const { unmount } = render(<TestPopover onClose={() => {}} />)
    // First focusable inside is "First"
    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe("First")
    })
    unmount()
    // Focus returns to trigger
    expect(document.activeElement).toBe(trigger)
  })
})
