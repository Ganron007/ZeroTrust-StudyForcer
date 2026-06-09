import { describe, it, expect } from "vitest"
import { readFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Regression tests for the v2.4.11 skip-link visibility bug.
 *
 * The bug: Phase 2.5 CSS rules (skip-link, focus-visible, sr-only,
 * reduced-motion) were added to src/index.css, but the app imports
 * src/globals.css (via main.tsx). The CSS was never bundled into the
 * production build, so the skip-link text "Skip to main content" was
 * visible at the top of the page.
 *
 * These tests are source-code tests because:
 *  1. jsdom doesn't compute layout — it can't tell us if text is "visible"
 *  2. The bug is in which CSS file gets imported, not the CSS content
 *  3. These tests run in <10ms and catch the bug class early
 */
describe("CSS: entry point is globals.css (not index.css)", () => {
  const mainTsx = readFileSync(
    resolve(__dirname, "../../main.tsx"),
    "utf8"
  )

  it("src/main.tsx imports globals.css", () => {
    expect(mainTsx).toMatch(/import\s+['"]\.\/globals\.css['"]/)
  })

  it("src/main.tsx does not import index.css (dead file)", () => {
    expect(mainTsx).not.toMatch(/import\s+['"]\.\/index\.css['"]/)
  })
})

describe("CSS: index.css is not silently used", () => {
  it("src/index.css does not exist (was the wrong file in v2.4.10)", () => {
    const indexCssPath = resolve(__dirname, "../../index.css")
    expect(existsSync(indexCssPath)).toBe(false)
  })
})

describe("CSS: Phase 2.5 rules are in globals.css", () => {
  const css = readFileSync(
    resolve(__dirname, "../../globals.css"),
    "utf8"
  )


  it(".skip-link uses transform: translateY(-150%) to hide by default", () => {
    const skipLinkMatch = css.match(/\.skip-link\s*\{([^}]+)\}/)
    expect(skipLinkMatch).toBeTruthy()
    const rule = skipLinkMatch![1]

    // Must use transform to hide, not top: -100px
    expect(rule).toMatch(/transform:\s*translateY\(-?\d+%\)/)
    expect(rule).not.toMatch(/top:\s*-\d+px/)
  })

  it(".skip-link becomes visible on focus via transform reset", () => {
    const focusMatch = css.match(/\.skip-link:focus[^{]*\{([^}]+)\}/)
    expect(focusMatch).toBeTruthy()
    const rule = focusMatch![1]

    expect(rule).toMatch(/transform:\s*translateY\(0\)/)
  })

  it(".skip-link has a focus outline for keyboard visibility", () => {
    const focusMatch = css.match(/\.skip-link:focus[^{]*\{([^}]+)\}/)
    expect(focusMatch).toBeTruthy()
    const rule = focusMatch![1]

    expect(rule).toMatch(/outline:/)
  })

  it(":focus-visible ring is defined for keyboard navigation", () => {
    expect(css).toMatch(/:focus-visible\s*\{/)
  })

  it(".sr-only uses clip+overflow to hide content", () => {
    const srOnlyMatch = css.match(/\.sr-only\s*\{([^}]+)\}/)
    expect(srOnlyMatch).toBeTruthy()
    const rule = srOnlyMatch![1]

    expect(rule).toMatch(/overflow:\s*hidden/)
    expect(rule).toMatch(/clip:/)
  })

  it("prefers-reduced-motion media query is defined", () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
  })
})

