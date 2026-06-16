import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import AppHeader, { type AppHeaderActions } from "../AppHeader"
import type { CourseConfig } from "@/types/course"

const mocks = vi.hoisted(() => ({
  theme: "light" as const,
  setTheme: vi.fn(),
  mode: "standard" as const,
  setMode: vi.fn(),
  opsec: false,
  setOpsec: vi.fn(),
  label: vi.fn((k: string) => k),
  toast: vi.fn((k: string) => k),
  actions: {
    showTip: vi.fn(),
    switchCourse: vi.fn(),
    setSelectedCourseIds: vi.fn(),
    openPlanner: vi.fn(),
    openOnlineLabs: vi.fn(),
    toggleNews: vi.fn(),
    logTime: vi.fn(),
    toggleThemePicker: vi.fn(),
    closeThemePicker: vi.fn(),
    toggleModePicker: vi.fn(),
    closeModePicker: vi.fn(),
    toggleNotificationSettings: vi.fn(),
    closeNotificationSettings: vi.fn(),
    toggleFullscreen: vi.fn(),
    refresh: vi.fn(),
    backup: vi.fn(),
    reset: vi.fn(),
    restore: vi.fn(),
  } as AppHeaderActions,
}))

vi.mock("./ThemeProvider", () => ({
  useTheme: () => ({ theme: mocks.theme, setTheme: mocks.setTheme }),
  THEME_OPTIONS: [
    { id: "light", label: "Light", swatch: "#fff" },
    { id: "dark", label: "Dark", swatch: "#000" },
  ],
}))

vi.mock("@/components/PersonalityProvider", () => ({
  usePersonality: () => ({
    label: mocks.label,
    toast: mocks.toast,
    mode: mocks.mode,
    setMode: mocks.setMode,
  }),
}))

vi.mock("@/hooks/useOpsec", () => ({
  useOpsec: () => ({ opsec: mocks.opsec, setOpsec: mocks.setOpsec }),
}))

vi.mock("@/lib/personality", () => ({
  MODE_OPTIONS: [
    { id: "standard", label: "Standard", icon: "📋", tagline: "Default" },
    { id: "opsec", label: "OPSEC", icon: "🕶️", tagline: "Discreet" },
  ],
  formatStr: (template: string, values: Record<string, string>) =>
    template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? ""),
}))

vi.mock("@/components/StreakChip", () => ({
  default: ({ className }: { className?: string }) => <div data-testid="streak-chip" className={className}>Streak</div>,
}))

vi.mock("@/components/CourseSelector", () => ({
  default: () => <div data-testid="course-selector">CourseSelector</div>,
}))

vi.mock("@/components/StudyTimer", () => ({
  default: ({ onLogTime }: { onLogTime: (m: number) => void }) => (
    <button data-testid="study-timer" onClick={() => onLogTime(25)}>Timer</button>
  ),
}))

vi.mock("@/components/WallClock", () => ({
  default: () => <div data-testid="wall-clock">Clock</div>,
}))

vi.mock("@/components/NotificationSettingsPanel", () => ({
  default: () => <div data-testid="notification-panel">Notifications</div>,
}))

vi.mock("@/components/Popover", () => ({
  Popover: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="popover">{children}</div> : null,
}))

function makeCourse(overrides: Partial<CourseConfig> = {}): CourseConfig {
  return {
    id: "c1",
    name: "CISSP",
    units: [],
    ...overrides,
  } as CourseConfig
}

function renderHeader(props: Partial<Parameters<typeof AppHeader>[0]> = {}) {
  return render(
    <AppHeader
      safeLogoSvg={null}
      courses={[makeCourse()]}
      activeCourseId="c1"
      selectedCourseIds={new Set(["c1"])}
      isNewsOpen={false}
      isFullscreen={false}
      refreshing={false}
      showThemePicker={false}
      showModePicker={false}
      showNotificationSettings={false}
      themePopoverRef={{ current: null }}
      modePopoverRef={{ current: null }}
      notifPopoverRef={{ current: null }}
      actions={mocks.actions}
      {...props}
    />,
  )
}

describe("AppHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = "2.7.1"
  })

  it("renders the app title and version", () => {
    renderHeader()
    expect(screen.getByText("ZeroTrust.StudyForcer")).toBeInTheDocument()
    expect(screen.getByText("v2.7.1")).toBeInTheDocument()
  })

  it("renders streak chip, wall clock, and study timer", () => {
    renderHeader()
    expect(screen.getByTestId("streak-chip")).toBeInTheDocument()
    expect(screen.getByTestId("wall-clock")).toBeInTheDocument()
    expect(screen.getByTestId("study-timer")).toBeInTheDocument()
  })

  it("shows CourseSelector when more than one course exists", () => {
    renderHeader({
      courses: [makeCourse(), makeCourse({ id: "c2", name: "OSCP" })],
    })
    expect(screen.getByTestId("course-selector")).toBeInTheDocument()
  })

  it("opens planner when planner button is clicked", () => {
    renderHeader()
    fireEvent.click(screen.getByText("planner"))
    expect(mocks.actions.openPlanner).toHaveBeenCalledWith("c1")
  })

  it("opens online labs when labs button is clicked", () => {
    renderHeader()
    fireEvent.click(screen.getByText("onlineLabs"))
    expect(mocks.actions.openOnlineLabs).toHaveBeenCalled()
  })

  it("toggles news when news button is clicked", () => {
    renderHeader()
    fireEvent.click(screen.getByText("news"))
    expect(mocks.actions.toggleNews).toHaveBeenCalled()
  })

  it("shows the theme picker popover when showThemePicker is true", () => {
    renderHeader({ showThemePicker: true })
    expect(screen.getByTestId("popover")).toBeInTheDocument()
  })

  it("shows the mode picker popover when showModePicker is true", () => {
    renderHeader({ showModePicker: true })
    expect(screen.getByTestId("popover")).toBeInTheDocument()
  })

  it("shows the notification panel when showNotificationSettings is true", () => {
    renderHeader({ showNotificationSettings: true })
    expect(screen.getByTestId("notification-panel")).toBeInTheDocument()
  })

  it("toggles fullscreen when fullscreen button is clicked", () => {
    renderHeader()
    fireEvent.click(screen.getByLabelText("toggleFullscreen"))
    expect(mocks.actions.toggleFullscreen).toHaveBeenCalled()
  })

  it("triggers refresh when refresh button is clicked", () => {
    renderHeader()
    fireEvent.click(screen.getByLabelText("refresh"))
    expect(mocks.actions.refresh).toHaveBeenCalled()
  })

  it("triggers backup when backup button is clicked", () => {
    renderHeader()
    fireEvent.click(screen.getByTitle("backupAll"))
    expect(mocks.actions.backup).toHaveBeenCalled()
  })

  it("toggles OPSEC mode when OPSEC button is clicked", () => {
    renderHeader()
    fireEvent.click(screen.getByLabelText("opsecToggle"))
    expect(mocks.setOpsec).toHaveBeenCalledWith(true)
  })

  it("passes logTime through StudyTimer", () => {
    renderHeader()
    fireEvent.click(screen.getByTestId("study-timer"))
    expect(mocks.actions.logTime).toHaveBeenCalledWith(25)
  })
})
