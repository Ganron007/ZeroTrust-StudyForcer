import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import DatePicker from "@/components/DatePicker"

// Mock createPortal to render inline for testing
vi.mock("react-dom", async () => {
  const actual = await vi.importActual("react-dom")
  return {
    ...actual,
    createPortal: (children: React.ReactNode) => children,
  }
})

describe("DatePicker", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders with placeholder when no value", () => {
    render(<DatePicker value={undefined} onChange={() => {}} />)
    expect(screen.getByText("Pick a date")).toBeInTheDocument()
  })

  it("renders with formatted date when value provided", () => {
    render(<DatePicker value="2026-04-15" onChange={() => {}} />)
    expect(screen.getByText("Apr 15, 2026")).toBeInTheDocument()
  })

  it("opens calendar popup when clicked", async () => {
    render(<DatePicker value="2026-04-15" onChange={() => {}} />)
    
    const button = screen.getByRole("button")
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText("April 2026")).toBeInTheDocument()
    })
  })

  it("calls onChange when a date is selected", async () => {
    const handleChange = vi.fn()
    render(<DatePicker value="2026-04-15" onChange={handleChange} />)
    
    const button = screen.getByRole("button")
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText("April 2026")).toBeInTheDocument()
    })

    // Find enabled day buttons in the current month
    const dayButtons = screen.getAllByRole("button").filter(
      btn => btn.textContent && /^\d+$/.test(btn.textContent.trim()) && !btn.disabled
    )
    
    expect(dayButtons.length).toBeGreaterThan(0)
    fireEvent.click(dayButtons[0])
    expect(handleChange).toHaveBeenCalled()
  })

  it("closes popup when clicking outside", async () => {
    const { container } = render(<DatePicker value="2026-04-15" onChange={() => {}} />)
    
    const button = screen.getByRole("button")
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText("April 2026")).toBeInTheDocument()
    })

    // Click outside the picker and popup
    fireEvent.mouseDown(document.body)

    // Popup should close
    await waitFor(() => {
      expect(screen.queryByText("April 2026")).not.toBeInTheDocument()
    })
  })

  it("disables button when disabled prop is true", () => {
    render(<DatePicker value="2026-04-15" onChange={() => {}} disabled />)
    
    const button = screen.getByRole("button")
    expect(button).toBeDisabled()
  })

  it("navigates to previous month", async () => {
    render(<DatePicker value="2026-04-15" onChange={() => {}} />)
    
    const button = screen.getByRole("button")
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText("April 2026")).toBeInTheDocument()
    })

    // Find prev month button by looking for chevron-left icon
    const prevButton = screen.getAllByRole("button").find(
      btn => btn.querySelector("svg.lucide-chevron-left")
    )
    
    expect(prevButton).toBeDefined()
    fireEvent.click(prevButton!)

    // Should now show March 2026
    await waitFor(() => {
      expect(screen.getByText("March 2026")).toBeInTheDocument()
    })
  })

  it("navigates to next month", async () => {
    render(<DatePicker value="2026-04-15" onChange={() => {}} />)
    
    const button = screen.getByRole("button")
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText("April 2026")).toBeInTheDocument()
    })

    // Find next month button by looking for chevron-right icon
    const nextButton = screen.getAllByRole("button").find(
      btn => btn.querySelector("svg.lucide-chevron-right")
    )
    
    expect(nextButton).toBeDefined()
    fireEvent.click(nextButton!)

    // Should now show May 2026
    await waitFor(() => {
      expect(screen.getByText("May 2026")).toBeInTheDocument()
    })
  })

  it("respects minDate - disables dates before minDate", async () => {
    render(
      <DatePicker 
        value="2026-04-15" 
        onChange={() => {}} 
        minDate="2026-04-10"
      />
    )
    
    const button = screen.getByRole("button")
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText("April 2026")).toBeInTheDocument()
    })

    // Find day buttons
    const dayButtons = screen.getAllByRole("button").filter(
      btn => btn.textContent && /^\d+$/.test(btn.textContent.trim())
    )
    
    // Early days of month (1-9) should be disabled
    const earlyDay = dayButtons.find(btn => btn.textContent?.trim() === "5")
    expect(earlyDay).toBeDefined()
    expect(earlyDay!).toBeDisabled()
  })

  it("calls onChange with empty string when clear button clicked", async () => {
    const handleChange = vi.fn()
    const { container } = render(<DatePicker value="2026-04-15" onChange={handleChange} />)
    
    // Find the clear icon (X) inside the main button and click its parent span
    const xIcon = container.querySelector("svg.lucide-x")
    expect(xIcon).toBeInTheDocument()
    
    const clearSpan = xIcon!.parentElement
    expect(clearSpan).toBeInTheDocument()
    
    fireEvent.click(clearSpan!)
    expect(handleChange).toHaveBeenCalledWith("")
  })
})
