import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LabCreditPrompt } from "../LabCreditPrompt"
import type { LabDefinition, LabSession } from "@/lib/lab-sessions"

const mocks = vi.hoisted(() => ({
  findDomainMatches: vi.fn().mockReturnValue([]),
  buildCreditKey: vi.fn().mockImplementation((c: string, d: string) => `${c}:${d}`),
  showToast: vi.fn(),
  label: vi.fn((k: string) => k),
  toast: vi.fn((k: string) => k),
  courses: [{ id: "c1", name: "CISSP", examDomains: [{ id: "d1", name: "Security Operations" }] }],
}))

vi.mock("@/components/CourseProvider", () => ({
  useCourse: () => ({ courses: mocks.courses }),
}))

vi.mock("@/lib/lab-credit", () => ({
  findDomainMatches: mocks.findDomainMatches,
  buildCreditKey: mocks.buildCreditKey,
}))

vi.mock("@/components/PersonalityProvider", () => ({
  usePersonality: () => ({
    label: mocks.label,
    toast: mocks.toast,
  }),
}))

vi.mock("@/components/NotificationToast", () => ({
  showToast: mocks.showToast,
}))

function makeLab(): LabDefinition {
  return {
    id: "lab1",
    name: "Wireshark Basics",
    focus: "Security Operations",
    category: "Networking",
    defaultMinutes: 60,
  }
}

function makeSession(): LabSession {
  return {
    id: "s1",
    labId: "lab1",
    date: "2026-04-15",
    minutes: 45,
  }
}

describe("LabCreditPrompt", () => {
  beforeEach(() => {
    mocks.findDomainMatches.mockReturnValue([])
    mocks.showToast.mockClear()
    mocks.label.mockClear()
  })

  it("renders nothing when session is null", () => {
    const { container } = render(
      <LabCreditPrompt session={null} lab={makeLab()} onAccept={() => {}} onDismiss={() => {}} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when lab is null", () => {
    const { container } = render(
      <LabCreditPrompt session={makeSession()} lab={null} onAccept={() => {}} onDismiss={() => {}} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when there are no domain matches", () => {
    const { container } = render(
      <LabCreditPrompt session={makeSession()} lab={makeLab()} onAccept={() => {}} onDismiss={() => {}} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders matches and calls onAccept when one is clicked", () => {
    const onAccept = vi.fn()
    mocks.findDomainMatches.mockReturnValue([
      { courseId: "c1", courseName: "CISSP", domainId: "d1", domainName: "Security Operations", reason: "" },
    ])
    render(
      <LabCreditPrompt session={makeSession()} lab={makeLab()} onAccept={onAccept} onDismiss={() => {}} />,
    )
    expect(screen.getByText("Security Operations")).toBeInTheDocument()
    expect(screen.getByText("CISSP")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Security Operations"))
    expect(onAccept).toHaveBeenCalledWith("c1:d1")
  })

  it("calls onDismiss and shows toast when No is clicked", () => {
    const onDismiss = vi.fn()
    mocks.findDomainMatches.mockReturnValue([
      { courseId: "c1", courseName: "CISSP", domainId: "d1", domainName: "Security Operations", reason: "" },
    ])
    render(
      <LabCreditPrompt session={makeSession()} lab={makeLab()} onAccept={() => {}} onDismiss={onDismiss} />,
    )
    fireEvent.click(screen.getByText("labCreditNo"))
    expect(onDismiss).toHaveBeenCalled()
    expect(mocks.showToast).toHaveBeenCalledWith("labCreditDismissed", "info")
  })
})
