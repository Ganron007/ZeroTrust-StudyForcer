/**
 * PlanStore — single source of truth for all plan-related state.
 *
 * - **What it holds**: allPlans, activePlanIds, primaryActivePlanId
 * - **What it does NOT hold**: UI state (activeTab, modals, drawer, timer, etc.)
 * - **What it does NOT hold**: temp dailyLog (two-phase model — stays in React useState)
 *
 * Every mutation writes through to planStorage (→ SQLite / localStorage).
 * There is NO auto-save debounce — persistence is synchronous with the action.
 */

import { create } from "zustand"
import { planStorage, type StudyPlan } from "./plan-storage"

// ── Store type ──────────────────────────────────────────────────────────────

export interface PlanStore {
  // ── State ───────────────────────────────────────────────────────────────
  allPlans: StudyPlan[]
  activePlanIds: string[]
  primaryActivePlanId: string | null
  isLoading: boolean

  // ── Actions ─────────────────────────────────────────────────────────────
  /** Load all plans + active IDs from storage. Call once on boot. */
  loadPlans: () => Promise<void>

  /** Set active plan IDs (triggers persistence). */
  setActivePlanIds: (ids: string[]) => Promise<void>

  /** Set the primary active plan (not persisted — ephemeral UI choice). */
  setPrimaryActivePlanId: (id: string | null) => void

  /** Save (create or update) a plan and sync store state. */
  updatePlan: (plan: StudyPlan) => Promise<void>

  /** Delete a plan and clean up references. */
  deletePlan: (id: string) => Promise<void>

  /** Rename a plan. */
  renamePlan: (id: string, name: string) => Promise<void>
}

// ── Store implementation ────────────────────────────────────────────────────

export const usePlanStore = create<PlanStore>((set, get) => ({
  // ── Initial state ───────────────────────────────────────────────────────
  allPlans: [],
  activePlanIds: [],
  primaryActivePlanId: null,
  isLoading: true,

  // ── Actions ─────────────────────────────────────────────────────────────

  loadPlans: async () => {
    set({ isLoading: true })
    try {
      const all = await planStorage.getAll()
      const persistedActiveIds = await planStorage.getActiveIds()
      const activePlanIds = persistedActiveIds.filter((id) =>
        all.some((p) => p.id === id),
      )
      const primaryActivePlanId =
        activePlanIds.length > 0
          ? activePlanIds[0]
          : all.length > 0
            ? all[0].id
            : null

      set({
        allPlans: all,
        activePlanIds,
        primaryActivePlanId,
        isLoading: false,
      })
    } catch {
      set({ isLoading: false })
    }
  },

  setActivePlanIds: async (ids: string[]) => {
    await planStorage.setActiveIds(ids)
    const all = await planStorage.getAll()
    const validIds = ids.filter((id) => all.some((p) => p.id === id))
    const state = get()
    const primaryActivePlanId =
      state.primaryActivePlanId && validIds.includes(state.primaryActivePlanId)
        ? state.primaryActivePlanId
        : validIds.length > 0
          ? validIds[0]
          : all.length > 0
            ? all[0].id
            : null
    set({ allPlans: all, activePlanIds: validIds, primaryActivePlanId })
  },

  setPrimaryActivePlanId: (id) => set({ primaryActivePlanId: id }),

  updatePlan: async (plan) => {
    const saved = await planStorage.save(plan)
    const state = get()
    const allPlans = state.allPlans.map((p) =>
      p.id === saved.id ? saved : p,
    )
    set({ allPlans })
  },

  deletePlan: async (id) => {
    await planStorage.delete(id)
    const state = get()
    const allPlans = state.allPlans.filter((p) => p.id !== id)
    const activePlanIds = state.activePlanIds.filter((pid) => pid !== id)
    const primaryActivePlanId =
      state.primaryActivePlanId === id
        ? activePlanIds.length > 0
          ? activePlanIds[0]
          : allPlans.length > 0
            ? allPlans[0].id
            : null
        : state.primaryActivePlanId
    set({ allPlans, activePlanIds, primaryActivePlanId })
  },

  renamePlan: async (id, name) => {
    await planStorage.rename(id, name)
    const all = await planStorage.getAll()
    set({ allPlans: all })
  },
}))
