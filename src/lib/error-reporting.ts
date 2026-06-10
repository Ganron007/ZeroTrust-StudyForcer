/**
 * Unified error reporting — X4 fix.
 *
 * Centralizes error logging so every catch block in the app reports
 * errors the same way: prefix-tagged console.error with context,
 * plus a placeholder for future telemetry/UI integration.
 *
 * Usage:
 *   try { ... } catch (e) { reportError("labs.save", e) }
 *   try { ... } catch (e) { reportError("news.fetch", e, { feedUrl, attempt: 2 }) }
 *
 * Replaces the ad-hoc mix of: empty `catch {}`, `console.warn`, `console.error`,
 * `throw new Error(...)`, and `showToast(...)` scattered across the codebase.
 */

export type ErrorContext = string

export interface ReportErrorOptions {
  /** Additional structured context (URL, retry count, user action, etc.) */
  context?: Record<string, unknown>
  /** If true, also surface as a user-facing toast. Default: false. */
  surface?: boolean
  /** Log level. Default: 'error'. */
  level?: "error" | "warn"
}

/**
 * Report an error from a catch block. Always logs to console; can optionally
 * surface to the user via toast.
 */
export function reportError(
  where: ErrorContext,
  err: unknown,
  opts: ReportErrorOptions = {},
): void {
  const { context, surface = false, level = "error" } = opts
  const message = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack : undefined

  const prefix = `[ztsf] ${where}:`
  const ctxStr = context ? ` ${JSON.stringify(context)}` : ""

  if (level === "warn") {
    console.warn(`${prefix} ${message}${ctxStr}`, stack ?? err)
  } else {
    console.error(`${prefix} ${message}${ctxStr}`, stack ?? err)
  }

  // Future: send to telemetry, error reporting service, etc.
  // Future: if surface && showToast is available, call it.
  // For now, no-op since the toast hook requires React context.
  if (surface && typeof window !== "undefined") {
    // Best-effort: dispatch a custom event the toast system can listen for.
    window.dispatchEvent(
      new CustomEvent("ztsf:error", {
        detail: { where, message, context },
      }),
    )
  }
}
