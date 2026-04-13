import { storage } from '../../utils/storage'
import {
  syncProgressToSupabase,
  CLOUD_SYNC_ENABLED,
  BUILT_IN_PROGRAM_ID,
  buildProgramLibrary,
  getDefaultProgressForProgram
} from '../helpers'
import { supabase } from '../../lib/supabaseClient'
import { clearSyncQueue } from '../../utils/syncQueue'
import defaultProgram from '../../data/program.json'
import { enqueueMutation } from '../../utils/syncQueue'

export const createUserSlice = (set, get) => ({
  programStart: null,
  weightUnit: 'kg',
  restTimerDefault: 120,
  restTimerVibration: true,
  dismissedAlerts: [],

  setProgramStart: async (date) => {
    storage.saveProgramStart(date)
    set({ programStart: date })

    if (!CLOUD_SYNC_ENABLED) {
      set({ syncStatus: 'saved' })
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const state = get()
      set({ syncStatus: 'syncing' })
      const res = await syncProgressToSupabase(session.user.id, {
        currentPhaseId: state.currentPhaseId,
        currentWeek: state.currentWeek,
        currentDayIndex: state.currentDayIndex,
      }, date, {
        weightUnit: state.weightUnit,
        restTimerDefault: state.restTimerDefault,
        dismissedAlerts: state.dismissedAlerts,
      })
      set({ syncStatus: res.offline ? 'offline' : (res.error ? 'error' : 'saved') })
    }
  },

  setWeightUnit: async (unit) => {
    const normalized = unit === 'lbs' ? 'lbs' : 'kg'
    storage.saveWeightUnit(normalized)
    set({ weightUnit: normalized })

    if (!CLOUD_SYNC_ENABLED) {
      set({ syncStatus: 'saved' })
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const state = get()
      set({ syncStatus: 'syncing' })
      const res = await syncProgressToSupabase(session.user.id, {
        currentPhaseId: state.currentPhaseId,
        currentWeek: state.currentWeek,
        currentDayIndex: state.currentDayIndex,
      }, state.programStart, {
        weightUnit: normalized,
        restTimerDefault: state.restTimerDefault,
        dismissedAlerts: state.dismissedAlerts,
      })
      set({ syncStatus: res.offline ? 'offline' : (res.error ? 'error' : 'saved') })
    }
  },

  setRestTimerDefault: async (seconds) => {
    const normalized = Number.isFinite(Number(seconds))
      ? Math.min(600, Math.max(30, Number(seconds)))
      : 120
    storage.saveRestTimerDefault(normalized)
    set({ restTimerDefault: normalized })

    if (!CLOUD_SYNC_ENABLED) {
      set({ syncStatus: 'saved' })
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const state = get()
      set({ syncStatus: 'syncing' })
      const res = await syncProgressToSupabase(session.user.id, {
        currentPhaseId: state.currentPhaseId,
        currentWeek: state.currentWeek,
        currentDayIndex: state.currentDayIndex,
      }, state.programStart, {
        weightUnit: state.weightUnit,
        restTimerDefault: normalized,
        dismissedAlerts: state.dismissedAlerts,
      })
      set({ syncStatus: res.offline ? 'offline' : (res.error ? 'error' : 'saved') })
    }
  },

  setRestTimerVibration: (enabled) => {
    const normalized = Boolean(enabled)
    storage.saveRestTimerVibration(normalized)
    set({ restTimerVibration: normalized })
  },

  dismissTrainingAlert: async (alertId) => {
    if (!alertId) return
    const state = get()
    if (state.dismissedAlerts.includes(alertId)) return

    const nextDismissedAlerts = [...state.dismissedAlerts, alertId]
    storage.saveDismissedAlerts(nextDismissedAlerts)
    set({ dismissedAlerts: nextDismissedAlerts })

    if (!CLOUD_SYNC_ENABLED) {
      set({ syncStatus: 'saved' })
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      set({ syncStatus: 'syncing' })
      const res = await syncProgressToSupabase(session.user.id, {
        currentPhaseId: state.currentPhaseId,
        currentWeek: state.currentWeek,
        currentDayIndex: state.currentDayIndex,
      }, state.programStart, {
        weightUnit: state.weightUnit,
        restTimerDefault: state.restTimerDefault,
        dismissedAlerts: nextDismissedAlerts,
      })
      set({ syncStatus: res.offline ? 'offline' : (res.error ? 'error' : 'saved') })
    }
  },

  clearDismissedAlerts: async () => {
    storage.saveDismissedAlerts([])
    const state = get()
    set({ dismissedAlerts: [] })

    if (!CLOUD_SYNC_ENABLED) {
      set({ syncStatus: 'saved' })
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      set({ syncStatus: 'syncing' })
      const res = await syncProgressToSupabase(session.user.id, {
        currentPhaseId: state.currentPhaseId,
        currentWeek: state.currentWeek,
        currentDayIndex: state.currentDayIndex,
      }, state.programStart, {
        weightUnit: state.weightUnit,
        restTimerDefault: state.restTimerDefault,
        dismissedAlerts: [],
      })
      set({ syncStatus: res.offline ? 'offline' : (res.error ? 'error' : 'saved') })
    }
  },

  exportData: () => storage.exportData(),

  importData: (data) => {
    storage.importData(data)
    get().initializeStore()
  },

  resetProgram: async () => {
    clearSyncQueue()
    storage.clearAll()
    const baseLibrary = buildProgramLibrary([])
    const baseProgress = getDefaultProgressForProgram(defaultProgram)
    set({
      program: defaultProgram,
      programLibrary: baseLibrary,
      activeProgramId: BUILT_IN_PROGRAM_ID,
      currentPhaseId: baseProgress.currentPhaseId,
      currentWeek: baseProgress.currentWeek,
      currentDayIndex: baseProgress.currentDayIndex,
      programStart: null,
      completedDays: [],
      bodyweightLogs: [],
      activeCustomTemplate: null,
      planDisplayName: 'Dina Workout plan',
      weightUnit: 'kg',
      restTimerDefault: 120,
      restTimerVibration: true,
      scheduledExercises: [],
      dismissedAlerts: [],
      exerciseGoals: [],
      programCustomizations: {},
      milestoneToastQueue: [],
      syncStatus: 'saved',
    })

    if (!CLOUD_SYNC_ENABLED) {
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const resetTables = [
        'user_progress',
        'workout_logs',
        'bodyweight_logs',
        'program_customizations',
      ]

      if (!navigator.onLine) {
        resetTables.forEach((table) => {
          enqueueMutation(table, 'delete', null, { user_id: session.user.id })
        })
        set({ syncStatus: 'offline' })
        return
      }

      set({ syncStatus: 'syncing' })
      let queuedFallback = false

      for (const table of resetTables) {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('user_id', session.user.id)

        if (error) {
          enqueueMutation(table, 'delete', null, { user_id: session.user.id })
          queuedFallback = true
        }
      }

      set({ syncStatus: queuedFallback ? 'error' : 'saved' })
    }
  },
})
