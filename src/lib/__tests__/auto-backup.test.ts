import { describe, it, expect, beforeEach } from "vitest"
import { runAutoBackup, readBackup, LOCALSTORAGE_BACKUP_PREFIX } from "../auto-backup"
import { planStorage, type StudyPlan } from "../plan-storage"

beforeEach(async () => {
  localStorage.clear()
  // Reset the in-memory webCache in database.ts by clearing all plans.
  await planStorage.clearAll()
})

async function seedPlan(plan: StudyPlan) {
  await planStorage.save(plan)
}

function makePlan(overrides: Partial<StudyPlan>): StudyPlan {
  return {
    id: "p1",
    courseId: "c1",
    name: "Test Plan",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    startDate: "2026-01-01",
    pagesPerDay: 20,
    studyDays: [1, 2, 3, 4, 5],
    startingChapterId: 1,
    chapterStartOverrides: {},
    anchor: "pagesPerDay",
    dailyLog: {},
    skippedDays: [],
    ...overrides,
  }
}

function backupIndex(): string[] {
  const raw = localStorage.getItem("ztsf:backup-index")
  return raw ? (JSON.parse(raw) as string[]) : []
}

describe("auto-backup (web/localStorage mode)", () => {
  it("writes a backup file with the current date as filename", async () => {
    await seedPlan(makePlan({}))
    const { wrote } = await runAutoBackup()
    expect(wrote).toBe(true)
    const index = backupIndex()
    expect(index.length).toBe(1)
    expect(index[0]).toMatch(/^\d{4}-\d{2}-\d{2}\.json$/)
  })

  it("backup content is valid JSON containing the plan", async () => {
    await seedPlan(
      makePlan({
        id: "test-plan-1",
        name: "My CISSP",
        dailyLog: { "2026-04-01": { pagesRead: 20 } },
      }),
    )
    await runAutoBackup()
    const filename = backupIndex()[0]
    const payload = await readBackup(filename)
    expect(payload).not.toBeNull()
    expect(payload!.plans["test-plan-1"].name).toBe("My CISSP")
    expect(payload!.plans["test-plan-1"].dailyLog["2026-04-01"].pagesRead).toBe(20)
  })

  it("is idempotent: running twice on the same day does not duplicate", async () => {
    await seedPlan(makePlan({}))
    const r1 = await runAutoBackup()
    const r2 = await runAutoBackup()
    expect(r1.wrote).toBe(true)
    expect(backupIndex().length).toBe(1)
    // Second run: backup file already exists → still reports wrote=true
    // (semantically "a backup is in place for today") but no new file.
    expect(r2.wrote).toBe(true)
    expect(backupIndex().length).toBe(1)
  })

  it("preserves activePlanIds in the backup", async () => {
    await seedPlan(makePlan({ id: "p1" }))
    await planStorage.setActiveIds(["p1"])
    // The store caches active IDs; read them back through the storage API
    const { wrote } = await runAutoBackup()
    expect(wrote).toBe(true)
    const filename = backupIndex()[0]
    const payload = await readBackup(filename)
    expect(payload!.activePlanIds).toContain("p1")
  })
})

describe("auto-backup prune", () => {
  it("keeps at most 10 backups, removes oldest", async () => {
    // Insert 12 fake backups with different dates — but since we can't
    // bypass the date generator from outside, we instead directly seed
    // localStorage with 12 files and call the prune path implicitly
    // by triggering more than 10 backup cycles.
    // Easier: seed 12 localStorage keys directly with different dates.
    const dates: string[] = []
    for (let i = 0; i < 12; i++) {
      const d = `2026-01-${String(i + 1).padStart(2, "0")}`
      localStorage.setItem(LOCALSTORAGE_BACKUP_PREFIX + d + ".json", `{"date":"${d}"}`)
      dates.push(d)
    }
    localStorage.setItem(
      "ztsf:backup-index",
      JSON.stringify(dates.map((d) => d + ".json").sort((a, b) => b.localeCompare(a))),
    )
    expect(backupIndex().length).toBe(12)

    // Trigger a new backup — prune should fire and reduce to 10.
    await seedPlan(makePlan({}))
    await runAutoBackup()

    const after = backupIndex()
    expect(after.length).toBe(10)
  })
})
