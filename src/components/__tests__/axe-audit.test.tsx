import { describe, it, expect, vi } from "vitest"
import { render } from "@testing-library/react"
import { axe, configureAxe } from "vitest-axe"
import KeyboardShortcutsCheatsheet from "../KeyboardShortcutsCheatsheet"

// Configure axe-core to disable some noisy rules that don't apply to
// our test environment (color-contrast for jsdom color profiles is unreliable).
configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "landmark-unique": { enabled: false }, // single dialog in test
  },
})

// Mock personality layer
vi.mock("@/components/PersonalityProvider", () => ({
  usePersonality: () => ({
    label: (key: string) => key,
    toast: (key: string) => key,
  }),
}))

describe("axe accessibility audit (Phase 2.5)", () => {
  it("KeyboardShortcutsCheatsheet has no critical a11y violations", async () => {
    const { container } = render(
      <KeyboardShortcutsCheatsheet open={true} onClose={() => {}} />,
    )
    const results = await axe(container)
    // Allow minor/incomplete warnings (jsdom limitations)
    const critical = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    )
    expect(critical).toHaveLength(0)
  }, 15000)
})
