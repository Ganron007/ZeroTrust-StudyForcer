import { describe, it, expect } from "vitest"
import { sanitizeSvg } from "../sanitize-svg"

describe("sanitizeSvg", () => {
  it("returns null for empty input", () => {
    expect(sanitizeSvg("")).toBeNull()
    expect(sanitizeSvg("   ")).toBeNull()
  })

  it("returns null for non-string input", () => {
    expect(sanitizeSvg(null as unknown as string)).toBeNull()
    expect(sanitizeSvg(undefined as unknown as string)).toBeNull()
  })

  it("returns a simple valid SVG unchanged", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>'
    const result = sanitizeSvg(svg)
    expect(result).toContain("circle")
    expect(result).toContain('cx="50"')
    expect(result).not.toContain("script")
  })

  it("strips <script> tags", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script><rect width="100" height="100"/></svg>'
    const result = sanitizeSvg(svg)
    expect(result).not.toContain("script")
    expect(result).toContain("rect")
  })

  it("strips event handler attributes", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="100" height="100" onclick="evil()"/></svg>'
    const result = sanitizeSvg(svg)
    expect(result).not.toContain("onload")
    expect(result).not.toContain("onclick")
    expect(result).toContain("rect")
  })

  it("strips javascript: URLs in href", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><text>click</text></a></svg>'
    const result = sanitizeSvg(svg)
    // E4 fix: assert the sanitizer returned a non-null result and the
    // dangerous URL was stripped. The previous `if (result)` guard let
    // the test silently pass if the function returned null.
    expect(result).not.toBeNull()
    expect(result).not.toContain("javascript")
  })

  it("allows same-document fragment URLs", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><use href="#icon"/></svg>'
    const result = sanitizeSvg(svg)
    expect(result).toContain('#icon"')
  })

  it("strips style values with external URL references", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect style="background: url(http://evil.com/hack.svg)"/></svg>'
    const result = sanitizeSvg(svg)
    // E4 fix: assert non-null + that the dangerous URL was stripped.
    expect(result).not.toBeNull()
    expect(result).not.toContain("url(")
    expect(result).not.toContain("http://evil.com")
  })

  it("allows safe style values", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill: red; stroke: blue"/></svg>'
    const result = sanitizeSvg(svg)
    expect(result).toContain("fill: red")
  })

  it("strips unknown elements", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><iframe src="https://evil.com"/></foreignObject><rect width="100" height="100"/></svg>'
    const result = sanitizeSvg(svg)
    expect(result).not.toContain("foreignObject")
    expect(result).not.toContain("iframe")
    expect(result).toContain("rect")
  })

  it("strips unknown attributes from allowed elements", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect data-evil="true" width="100" height="100"/></svg>'
    const result = sanitizeSvg(svg)
    expect(result).not.toContain("data-evil")
    expect(result).toContain('width="100"')
  })

  it("returns null for non-SVG documents", () => {
    expect(sanitizeSvg("<html><body>not svg</body></html>")).toBeNull()
  })

  it("returns null for malformed XML", () => {
    expect(sanitizeSvg("<svg><unclosed")).toBeNull()
  })

  it("preserves well-formed SVG with gradient definitions", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="red"/><stop offset="100%" stop-color="blue"/></linearGradient></defs><rect fill="url(#g1)" width="100" height="100"/></svg>'
    const result = sanitizeSvg(svg)
    expect(result).toContain("linearGradient")
    expect(result).toContain("stop")
    expect(result).toContain("url(#g1)")
  })

  it("does not mutate the input string", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script><rect width="100"/></svg>'
    const before = svg
    sanitizeSvg(svg)
    expect(svg).toBe(before)
  })
})
