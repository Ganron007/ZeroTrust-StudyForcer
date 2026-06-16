import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { Component, type ReactNode } from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { ErrorBoundary } from "../ErrorBoundary"

type BoomProps = { shouldThrow?: boolean; message?: string; children?: ReactNode }
class Boom extends Component<BoomProps> {
  render() {
    if (this.props.shouldThrow) {
      throw new Error(this.props.message ?? "boom")
    }
    return this.props.children ?? <div data-testid="boom-ok">ok</div>
  }
}

class CustomBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) return <div data-testid="custom-fallback">custom</div>
    return this.props.children
  }
}

describe("ErrorBoundary", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let reloadSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    reloadSpy = vi.fn()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    })
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    reloadSpy.mockRestore()
  })

  it("renders children when no error is thrown", () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>,
    )
    expect(screen.getByTestId("boom-ok")).toBeInTheDocument()
    expect(screen.queryByTestId("error-boundary-fallback")).not.toBeInTheDocument()
  })

  it("renders default fallback when a child throws", () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={true} message="kaboom" />
      </ErrorBoundary>,
    )
    const fallback = screen.getByTestId("error-boundary-fallback")
    expect(fallback).toBeInTheDocument()
    expect(fallback).toHaveAttribute("role", "alert")
    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
    expect(screen.getByText("kaboom")).toBeInTheDocument()
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it("uses sectionLabel in the default fallback title", () => {
    render(
      <ErrorBoundary sectionLabel="Lab Dashboard">
        <Boom shouldThrow={true} />
      </ErrorBoundary>,
    )
    expect(screen.getByText("Lab Dashboard crashed")).toBeInTheDocument()
  })

  it("renders custom fallback prop when provided", () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">My custom UI</div>}>
        <Boom shouldThrow={true} />
      </ErrorBoundary>,
    )
    expect(screen.getByTestId("custom-fallback")).toBeInTheDocument()
    expect(screen.queryByTestId("error-boundary-fallback")).not.toBeInTheDocument()
  })

  it("calls window.location.reload when Reload app is clicked", () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={true} />
      </ErrorBoundary>,
    )
    fireEvent.click(screen.getByTestId("error-boundary-reload"))
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it("does not render Try again when onReset is not provided", () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={true} />
      </ErrorBoundary>,
    )
    expect(screen.queryByTestId("error-boundary-reset")).not.toBeInTheDocument()
  })

  it("renders Try again when onReset is provided", () => {
    const onReset = vi.fn()
    render(
      <ErrorBoundary onReset={onReset}>
        <Boom shouldThrow={true} />
      </ErrorBoundary>,
    )
    const resetBtn = screen.getByTestId("error-boundary-reset")
    expect(resetBtn).toBeInTheDocument()
    fireEvent.click(resetBtn)
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it("recovers and re-renders children after a reset", () => {
    const onReset = vi.fn()
    function Harness({ shouldThrow }: { shouldThrow: boolean }) {
      return (
        <ErrorBoundary onReset={onReset}>
          <Boom shouldThrow={shouldThrow} message="first crash" />
        </ErrorBoundary>
      )
    }
    const { rerender } = render(<Harness shouldThrow={true} />)
    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
    expect(screen.getByText("first crash")).toBeInTheDocument()

    rerender(<Harness shouldThrow={false} />)
    fireEvent.click(screen.getByTestId("error-boundary-reset"))

    expect(onReset).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId("error-boundary-fallback")).not.toBeInTheDocument()
    expect(screen.getByTestId("boom-ok")).toBeInTheDocument()
  })

  it("isolates one boundary from another (sibling boundaries)", () => {
    render(
      <div>
        <ErrorBoundary sectionLabel="Left">
          <Boom shouldThrow={true} />
        </ErrorBoundary>
        <ErrorBoundary sectionLabel="Right">
          <Boom shouldThrow={false} />
        </ErrorBoundary>
      </div>,
    )
    expect(screen.getByText("Left crashed")).toBeInTheDocument()
    expect(screen.getByTestId("boom-ok")).toBeInTheDocument()
  })

  it("supports nested boundaries — inner boundary catches first", () => {
    render(
      <ErrorBoundary sectionLabel="Outer">
        <CustomBoundary>
          <Boom shouldThrow={true} />
        </CustomBoundary>
      </ErrorBoundary>,
    )
    expect(screen.getByTestId("custom-fallback")).toBeInTheDocument()
    expect(screen.queryByText("Outer crashed")).not.toBeInTheDocument()
  })
})
