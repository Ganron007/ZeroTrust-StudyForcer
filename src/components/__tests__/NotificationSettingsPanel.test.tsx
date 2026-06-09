import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import NotificationSettingsPanel from "../NotificationSettingsPanel"

// Mock personality
vi.mock("@/components/PersonalityProvider", () => {
  const map: Record<string, string> = {
    notificationTitle: "Daily Notifications",
    notificationSubtitle: "Get reminders",
    notificationEnable: "Enable",
    notificationTime: "Time",
    notificationLabsAlert: "Labs alert",
    notificationBrowserModeHint: "Browser mode",
    notificationPermissionDenied: "Denied",
    notificationEnabled: "Enabled",
    notificationDisabled: "Disabled",
  }
  return {
    usePersonality: () => ({
      label: (key: string) => map[key] ?? key,
      toast: (key: string) => map[key] ?? key,
    }),
  }
})

vi.mock("@/components/NotificationToast", () => ({
  showToast: vi.fn(),
}))

vi.mock("@/lib/notifications", async () => {
  const actual = await vi.importActual<typeof import("@/lib/notifications")>("@/lib/notifications")
  return {
    ...actual,
    isNativeAvailable: () => false,
    requestPermission: vi.fn().mockResolvedValue(false),
  }
})

beforeEach(() => {
  localStorage.clear()
})

describe("NotificationSettingsPanel (Phase 2.2)", () => {
  it("renders the title and subtitle", () => {
    render(<NotificationSettingsPanel />)
    expect(screen.getByText("Daily Notifications")).toBeInTheDocument()
    expect(screen.getByText("Get reminders")).toBeInTheDocument()
  })

  it("shows browser-mode hint when not in Tauri", () => {
    render(<NotificationSettingsPanel />)
    expect(screen.getByText("Browser mode")).toBeInTheDocument()
  })

  it("renders the toggle, time input, and labs toggle", () => {
    render(<NotificationSettingsPanel />)
    expect(screen.getByTestId("notification-toggle")).toBeInTheDocument()
    expect(screen.getByTestId("notification-time")).toBeInTheDocument()
    expect(screen.getByTestId("notification-labs-toggle")).toBeInTheDocument()
  })

  it("disables controls when in browser mode", () => {
    render(<NotificationSettingsPanel />)
    expect(screen.getByTestId("notification-toggle")).toBeDisabled()
    expect(screen.getByTestId("notification-time")).toBeDisabled()
  })

  it("loads existing settings from localStorage on mount", () => {
    localStorage.setItem(
      "ztsf:notification-settings",
      JSON.stringify({ enabled: true, dailyTime: "07:30", labsAlert: false }),
    )
    render(<NotificationSettingsPanel />)
    const timeInput = screen.getByTestId("notification-time") as HTMLInputElement
    expect(timeInput.value).toBe("07:30")
  })
})
