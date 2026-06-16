import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import LabDashboard from "../LabDashboard"
import {
  DEFAULT_EXTERNAL_LABS,
  type LabsStorage,
  type LabSession,
} from "@/lib/lab-sessions"
import { localToday } from "@/lib/date-utils"

const mocks = vi.hoisted(() => ({
  readLabsStorage: vi.fn(),
  writeLabsStorage: vi.fn().mockResolvedValue(undefined),
  findDomainMatches: vi.fn().mockReturnValue([]),
  showToast: vi.fn(),
  downloadJson: vi.fn(),
  downloadCsv: vi.fn(),
  readJsonFile: vi.fn(),
  personality: {
    mode: "standard" as const,
    setMode: vi.fn(),
    label: (k: string) => k,
    toast: (k: string) => k,
    empty: (k: string) => k,
    greeting: (k: string) => k,
    loading: (k: string) => k,
    tips: () => ["tip"],
  },
}))

vi.mock("@/lib/lab-session-storage", () => ({
  readLabsStorage: mocks.readLabsStorage,
  writeLabsStorage: mocks.writeLabsStorage,
  getLast14Days: () => {
    const out: string[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date("2026-06-15")
      d.setDate(d.getDate() - i)
      out.push(d.toISOString().slice(0, 10))
    }
    return out
  },
  getLast7Days: () => {
    const out: string[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date("2026-06-15")
      d.setDate(d.getDate() - i)
      out.push(d.toISOString().slice(0, 10))
    }
    return out
  },
  getStreak: (sessions: LabSession[]) => {
    // Return 3 if there's a session today
    return sessions.some((s) => s.date === "2026-06-15") ? 3 : 0
  },
  getWeekMinutes: (sessions: LabSession[]) =>
    sessions
      .filter((s) => {
        const d = new Date(s.date)
        const today = new Date("2026-06-15")
        const diff = (today.getTime() - d.getTime()) / 86400000
        return diff >= 0 && diff < 7
      })
      .reduce((sum, s) => sum + s.minutes, 0),
  getCoverage14: () => 50,
  getAtRiskCount: () => 0,
  getDaysSince: (dateStr: string | null) => {
    if (!dateStr) return null
    const d = new Date(dateStr)
    const today = new Date("2026-06-15")
    return Math.floor((today.getTime() - d.getTime()) / 86400000)
  },
  getLabCategory: () => "blue" as const,
  computeSmartScore: (id: string, daysSince: number | null, totalMinutes: number) => ({
    score: daysSince === null ? 90 : Math.min(daysSince * 5, 100),
    factors: {
      base: 30,
      atRiskBonus: 0,
      unexploredBonus: 0,
      categoryGapBonus: 0,
      recentUsePenalty: 0,
      final: 30,
    },
  }),
  getTodayMinutes: (sessions: LabSession[]) =>
    sessions
      .filter((s) => s.date === "2026-06-15")
      .reduce((sum, s) => sum + s.minutes, 0),
  getMonthMinutes: (sessions: LabSession[]) =>
    sessions.reduce((sum, s) => sum + s.minutes, 0),
  getDaysInCurrentMonth: () => 30,
}))

vi.mock("@/lib/lab-credit", () => ({
  findDomainMatches: mocks.findDomainMatches,
}))

vi.mock("@/lib/export-utils", () => ({
  downloadJson: mocks.downloadJson,
  downloadCsv: mocks.downloadCsv,
  readJsonFile: mocks.readJsonFile,
}))

vi.mock("@/components/NotificationToast", () => ({
  showToast: mocks.showToast,
}))

vi.mock("@/components/PersonalityProvider", () => ({
  usePersonality: () => mocks.personality,
  PersonalityProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/LabCreditPrompt", () => ({
  LabCreditPrompt: ({ onDismiss }: { onDismiss: () => void }) => (
    <div data-testid="lab-credit-prompt">
      <button onClick={onDismiss} data-testid="lab-credit-dismiss">Dismiss</button>
    </div>
  ),
}))

function makeSession(overrides: Partial<LabSession> = {}): LabSession {
  return {
    labId: DEFAULT_EXTERNAL_LABS[0].id,
    date: "2026-06-15",
    minutes: 120,
    createdAt: "2026-06-15T12:00:00.000Z",
    ...overrides,
  }
}

function makeStorage(overrides: Partial<LabsStorage> = {}): LabsStorage {
  return {
    labs: DEFAULT_EXTERNAL_LABS,
    sessions: [],
    categories: {},
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
  mocks.readLabsStorage.mockReset()
  mocks.writeLabsStorage.mockReset().mockResolvedValue(undefined)
  mocks.showToast.mockReset()
  mocks.downloadJson.mockReset()
  mocks.downloadCsv.mockReset()
  mocks.readJsonFile.mockReset()
  mocks.findDomainMatches.mockReset().mockReturnValue([])
})

describe("LabDashboard", () => {
  it("renders with empty data", async () => {
    mocks.readLabsStorage.mockResolvedValue(makeStorage())
    render(<LabDashboard />)
    await waitFor(() => {
      expect(mocks.readLabsStorage).toHaveBeenCalled()
    })
    // The hero section "Online Labs" should be visible
    expect(screen.getByText("onlineLabsTitle")).toBeInTheDocument()
  })

  it("renders with populated data and shows sessions", async () => {
    const sessions = [
      makeSession({ labId: DEFAULT_EXTERNAL_LABS[0].id, minutes: 120, date: "2026-06-15", createdAt: "2026-06-15T12:00:00.000Z" }),
      makeSession({ labId: DEFAULT_EXTERNAL_LABS[1].id, minutes: 240, date: "2026-06-14", createdAt: "2026-06-14T12:00:00.000Z" }),
    ]
    mocks.readLabsStorage.mockResolvedValue(makeStorage({ sessions }))
    render(<LabDashboard />)
    await waitFor(() => {
      expect(screen.getByText("At-risk labs")).toBeInTheDocument()
    })
    // Activity log should show both sessions
    expect(screen.getByText("Recent work")).toBeInTheDocument()
  })

  it("opens log dialog when 'Log today\\'s session' is clicked", async () => {
    mocks.readLabsStorage.mockResolvedValue(makeStorage())
    render(<LabDashboard />)
    await waitFor(() => {
      expect(screen.getByText("logTodaysSession")).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText("logTodaysSession"))
    // Dialog should appear
    expect(screen.getByText("Add a session")).toBeInTheDocument()
    expect(screen.getByText("Save session")).toBeInTheDocument()
  })

  it("switches filter modes", async () => {
    mocks.readLabsStorage.mockResolvedValue(makeStorage())
    render(<LabDashboard />)
    await waitFor(() => {
      expect(screen.getByText("Your lab queue")).toBeInTheDocument()
    })
    // Click the "Queue" filter button
    const queueBtn = screen.getByText("Queue")
    fireEvent.click(queueBtn)
    // The filter changes; the button should reflect the new state via className
    // We just verify no crash and the queue button is still there
    expect(queueBtn).toBeInTheDocument()
  })

  it("calls writeLabsStorage and updates state on submit", async () => {
    mocks.readLabsStorage.mockResolvedValue(makeStorage())
    render(<LabDashboard />)
    await waitFor(() => {
      expect(screen.getByText("logTodaysSession")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("logTodaysSession"))
    await waitFor(() => {
      expect(screen.getByText("Save session")).toBeInTheDocument()
    })

    // Click Save
    await act(async () => {
      fireEvent.click(screen.getByText("Save session"))
    })

    await waitFor(() => {
      expect(mocks.writeLabsStorage).toHaveBeenCalled()
    })

    // Verify the saved data includes the new session
    const savedData = mocks.writeLabsStorage.mock.calls[0][0] as LabsStorage
    expect(savedData.sessions).toHaveLength(1)
    expect(savedData.sessions[0].minutes).toBe(120)
  })

  it("shows error toast when writeLabsStorage fails", async () => {
    mocks.readLabsStorage.mockResolvedValue(makeStorage())
    mocks.writeLabsStorage.mockRejectedValueOnce(new Error("disk full"))
    render(<LabDashboard />)
    await waitFor(() => {
      expect(screen.getByText("logTodaysSession")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("logTodaysSession"))
    await waitFor(() => {
      expect(screen.getByText("Save session")).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText("Save session"))
    })

    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.stringContaining("Failed to save"),
        "break",
      )
    })
  })

  it("shows lab credit prompt after submit when domain matches found", async () => {
    mocks.readLabsStorage.mockResolvedValue(makeStorage())
    mocks.findDomainMatches.mockReturnValue([
      { domainId: "d1", domainName: "Domain 1", score: 90 },
    ])

    render(<LabDashboard />)
    await waitFor(() => {
      expect(screen.getByText("logTodaysSession")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("logTodaysSession"))
    await waitFor(() => {
      expect(screen.getByText("Save session")).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText("Save session"))
    })

    // Wait for the setTimeout(50ms) in submitLog to fire
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })

    await waitFor(() => {
      expect(screen.getByTestId("lab-credit-prompt")).toBeInTheDocument()
    })
  })

  it("does NOT show lab credit prompt when no domain matches", async () => {
    mocks.readLabsStorage.mockResolvedValue(makeStorage())
    mocks.findDomainMatches.mockReturnValue([])

    render(<LabDashboard />)
    await waitFor(() => {
      expect(screen.getByText("logTodaysSession")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("logTodaysSession"))
    await waitFor(() => {
      expect(screen.getByText("Save session")).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText("Save session"))
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })

    expect(screen.queryByTestId("lab-credit-prompt")).not.toBeInTheDocument()
  })

  it("exports JSON when JSON button clicked", async () => {
    mocks.readLabsStorage.mockResolvedValue(makeStorage())
    render(<LabDashboard />)
    await waitFor(() => {
      expect(screen.getByText("JSON")).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText("JSON"))
    expect(mocks.downloadJson).toHaveBeenCalled()
  })

  it("exports CSV when CSV button clicked", async () => {
    mocks.readLabsStorage.mockResolvedValue(
      makeStorage({
        sessions: [makeSession()],
      }),
    )
    render(<LabDashboard />)
    await waitFor(() => {
      expect(screen.getByText("CSV")).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText("CSV"))
    expect(mocks.downloadCsv).toHaveBeenCalled()
  })

  it("renders onBack button when onBack prop is provided", async () => {
    mocks.readLabsStorage.mockResolvedValue(makeStorage())
    const onBack = vi.fn()
    render(<LabDashboard onBack={onBack} />)
    await waitFor(() => {
      expect(screen.getByText("backToView")).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText("backToView"))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("shows empty state for activity log when no sessions", async () => {
    mocks.readLabsStorage.mockResolvedValue(makeStorage())
    render(<LabDashboard />)
    await waitFor(() => {
      expect(screen.getByText("Activity log")).toBeInTheDocument()
    })
    expect(screen.getByText("No sessions logged yet.")).toBeInTheDocument()
  })

  it("shows queue empty state when all labs are done today", async () => {
    // All labs marked done today → queue is empty
    const sessions = DEFAULT_EXTERNAL_LABS.map((lab, i) =>
      makeSession({ labId: lab.id, date: "2026-06-15", createdAt: `2026-06-15T1${i}:00:00.000Z` }),
    )
    mocks.readLabsStorage.mockResolvedValue(makeStorage({ sessions }))
    render(<LabDashboard />)
    await waitFor(() => {
      expect(screen.getByText("Your lab queue")).toBeInTheDocument()
    })
    // Click queue filter
    fireEvent.click(screen.getByText("Queue"))
    // Queue is empty because all labs are done today AND their smartScore
    // is low (since they were used recently). With our mock returning score 90
    // for never-used, we need to ensure no labs match the "not done today"
    // criterion. After clicking, if no labs remain, the empty state shows.
    await waitFor(() => {
      expect(screen.getByText("Queue is empty")).toBeInTheDocument()
    }, { timeout: 2000 })
  })
})
