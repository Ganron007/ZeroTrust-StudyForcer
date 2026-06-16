"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertOctagon, RefreshCw, RotateCcw } from "lucide-react"

type ErrorBoundaryProps = {
  children: ReactNode
  /**
   * Optional custom fallback UI. When omitted, the boundary renders its
   * built-in destructive-themed card with reload / try-again actions.
   */
  fallback?: ReactNode
  /**
   * Optional label shown in the default fallback. Helps users identify
   * which area of the app crashed (e.g. "Schedule", "Lab Dashboard").
   */
  sectionLabel?: string
  /**
   * Optional callback fired after the user clicks "Try again". Use this
   * to close an overlay or reset upstream state. The boundary also
   * clears its internal error state, allowing children to re-render.
   */
  onReset?: () => void
}

type ErrorBoundaryState = {
  hasError: boolean
  error: Error | null
}

/**
 * C (ROADMAP): Error boundary primitive.
 *
 * React 19 still requires class components to implement error boundaries.
 * Wrap any major route / overlay / tab panel in an `<ErrorBoundary>` so a
 * single crashing subtree does not take down the entire app. The boundary
 * logs the error to `console.error` and shows a destructive-themed card
 * with the error message and two recovery actions:
 *   - Try again (only when `onReset` is provided) — clears the boundary
 *     state and calls the parent's reset hook. Use it for overlays that
 *     should close on reset, or for sub-views that can re-mount cleanly.
 *   - Reload app — calls `window.location.reload()` as a last resort.
 *
 * Pass a `fallback` ReactNode to fully customize the UI; pass a
 * `sectionLabel` to contextualize the built-in fallback (e.g. "Lab
 * Dashboard"). Error details are shown in a collapsed `<pre>` block so
 * non-technical users see a clean message by default.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary]", this.props.sectionLabel ?? "uncaught", error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback !== undefined) return this.props.fallback

    const section = this.props.sectionLabel
    return (
      <div
        role="alert"
        aria-live="assertive"
        data-testid="error-boundary-fallback"
        className="min-h-[200px] flex items-center justify-center p-6"
      >
        <div className="max-w-md w-full rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <div className="flex justify-center mb-3">
            <AlertOctagon className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            {section ? `${section} crashed` : "Something went wrong"}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            This part of the app hit an unexpected error. The rest of the app should still be usable.
          </p>
          {this.state.error && (
            <details className="text-left mb-4 text-xs bg-background rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-muted-foreground font-medium">
                Error details
              </summary>
              <pre className="mt-2 whitespace-pre-wrap break-words text-foreground">
                {this.state.error.message}
              </pre>
            </details>
          )}
          <div className="flex gap-3 justify-center flex-wrap">
            {this.props.onReset && (
              <button
                type="button"
                onClick={this.handleReset}
                data-testid="error-boundary-reset"
                className="px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-muted inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Try again
              </button>
            )}
            <button
              type="button"
              onClick={this.handleReload}
              data-testid="error-boundary-reload"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reload app
            </button>
          </div>
        </div>
      </div>
    )
  }
}
