import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Popover } from "../Popover"

describe("Popover", () => {
  it("returns null when closed", () => {
    const { container } = render(
      <Popover open={false} onClose={() => {}}>Content</Popover>,
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders children when open", () => {
    render(
      <Popover open={true} onClose={() => {}}>Hello Popover</Popover>,
    )
    expect(screen.getByText("Hello Popover")).toBeInTheDocument()
  })

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn()
    render(
      <Popover open={true} onClose={onClose}>Content</Popover>,
    )
    fireEvent.keyDown(window, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn()
    const { container } = render(
      <Popover open={true} onClose={onClose}>Content</Popover>,
    )
    const backdrop = container.querySelector("div[class='fixed inset-0']")
    expect(backdrop).not.toBeNull()
    fireEvent.click(backdrop!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("does not close when popover content is clicked", () => {
    const onClose = vi.fn()
    render(
      <Popover open={true} onClose={onClose}>Content</Popover>,
    )
    fireEvent.click(screen.getByText("Content"))
    expect(onClose).not.toHaveBeenCalled()
  })

  it("applies role and aria-label", () => {
    render(
      <Popover open={true} onClose={() => {}} role="menu" ariaLabel="Test Menu">Content</Popover>,
    )
    const popover = screen.getByRole("menu")
    expect(popover).toHaveAttribute("aria-label", "Test Menu")
  })

  it("focuses the first focusable element when opened", () => {
    render(
      <Popover open={true} onClose={() => {}}>
        <button>First</button>
        <button>Second</button>
      </Popover>,
    )
    expect(screen.getByText("First")).toHaveFocus()
  })
})
