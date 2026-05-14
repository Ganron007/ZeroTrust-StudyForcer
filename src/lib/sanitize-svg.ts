/**
 * Minimal allow-list SVG sanitizer.
 *
 * Course logos are user-provided files that we render via dangerouslySetInnerHTML.
 * Without sanitization, a malicious SVG can execute scripts (via <script>, event
 * handlers like onload=, javascript: URLs, or <foreignObject> + <iframe>). We
 * walk the parsed DOM and strip anything that isn't on the allow-list.
 *
 * Returns the cleaned SVG string, or null if the input isn't a parseable
 * single-root <svg> document.
 */

const ALLOWED_TAGS = new Set([
  "svg", "g", "defs", "title", "desc",
  "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "text", "tspan",
  "linearGradient", "radialGradient", "stop",
  "clipPath", "mask", "pattern",
  "use", "symbol",
])

// Attributes safe to keep across all SVG elements.
const ALLOWED_ATTRS = new Set([
  "id", "class", "style",
  "width", "height", "viewBox", "preserveAspectRatio",
  "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry",
  "d", "points", "transform",
  "fill", "fill-opacity", "fill-rule",
  "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "stroke-dasharray", "stroke-dashoffset", "stroke-opacity", "stroke-miterlimit",
  "opacity", "color",
  "offset", "stop-color", "stop-opacity",
  "gradientUnits", "gradientTransform", "spreadMethod",
  "clip-path", "clip-rule", "mask",
  "patternUnits", "patternTransform",
  "text-anchor", "font-family", "font-size", "font-weight", "font-style",
  "dx", "dy", "rotate", "lengthAdjust", "textLength",
  "xmlns", "version",
  "aria-label", "aria-labelledby", "aria-hidden", "aria-describedby",
  "role",
])

const URL_ATTRS = new Set(["href", "xlink:href"])

function isSafeUrl(value: string): boolean {
  const trimmed = value.trim().toLowerCase()
  // Allow same-document fragment refs (e.g. url(#grad1)).
  if (trimmed.startsWith("#")) return true
  // Reject any explicit scheme — no http/https/data/javascript/file/etc.
  return !/^[a-z][a-z0-9+.-]*:/.test(trimmed)
}

function cleanElement(el: Element): void {
  const tag = el.tagName.toLowerCase()
  if (!ALLOWED_TAGS.has(tag)) {
    el.remove()
    return
  }

  // Strip disallowed attributes (event handlers, javascript: URLs, etc.).
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase()
    if (URL_ATTRS.has(name)) {
      if (!isSafeUrl(attr.value)) {
        el.removeAttribute(attr.name)
      }
      continue
    }
    if (!ALLOWED_ATTRS.has(name)) {
      el.removeAttribute(attr.name)
    }
  }

  // Reject any style value that smells like an external URL.
  const style = el.getAttribute("style")
  if (style && /url\s*\(\s*(?!#)/i.test(style)) {
    el.removeAttribute("style")
  }

  // Recurse into children (snapshot first; cleaning may remove nodes).
  for (const child of Array.from(el.children)) {
    cleanElement(child)
  }
}

export function sanitizeSvg(input: string): string | null {
  if (!input || typeof input !== "string") return null
  const trimmed = input.trim()
  if (!trimmed) return null

  let doc: Document
  try {
    doc = new DOMParser().parseFromString(trimmed, "image/svg+xml")
  } catch {
    return null
  }

  if (doc.querySelector("parsererror")) return null

  const svg = doc.documentElement
  if (!svg || svg.tagName.toLowerCase() !== "svg") return null

  cleanElement(svg)
  return new XMLSerializer().serializeToString(svg)
}
