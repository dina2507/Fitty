import { storage } from '../../utils/storage'
import {
  CLOUD_SYNC_ENABLED,
  cloudSyncPromise,
  setCloudSyncPromise,
  fetchProgressFromSupabase,
  fetchWorkoutLogsFromSupabase,
  fetchBodyweightLogsFromSupabase,
  fetchProgramCustomizationsFromSupabase,
  hasPendingMutation,
  hasPendingDeleteAll,
  isValidProgress,
  compareProgressPosition,
  getPendingWorkoutOverlays,
  mergeCompletedDays,
  mergeBodyweightLogs,
  mergeProgramCustomizations,
  getDefaultProgressForProgram,
  buildProgramLibrary,
  normalizeLocalWorkoutLogs
} from '../helpers'
import { supabase } from '../../lib/supabaseClient'
import { getSyncQueue } from '../../utils/syncQueue'
import { getNextDay } from '../../utils/progressTracker'
import defaultProgram from '../../data/program.json'

export const createSyncSlice = (set, get) => ({
  syncStatus: 'saved',

  recomputeSyncStatus: ({ cleared = false, remoteOk = true } = {}) => {
    if (!CLOUD_SYNC_ENABLED) {
      set({ syncStatus: 'saved' })
      return
    }

    const pending = getSyncQueue().length

    if (!navigator.onLine) {
      set({ syncStatus: 'offline' })
      return
    }

    if (!remoteOk) {
      set({ syncStatus: 'error' })
      return
    }

    if (cleared && pending === 0) {
      set({ syncStatus: 'saved' })
    } else if (pending > 0) {
      set({ syncStatus: 'error' })
    } else {
      set({ syncStatus: 'saved' })
    }
  },

  syncFromCloud: async ({ setSyncing = true } = {}) => {
    if (!CLOUD_SYNC_ENABLED) {
      set({ syncStatus: 'saved' })
      return { ok: true, offline: false, disabled: true }
    }

    if (cloudSyncPromise) {
      return cloudSyncPromise
    }

    const promise = (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        set({ syncStatus: 'offline' })
        return { ok: false, offline: true }
      }

      if (setSyncing) {
        set({ syncStatus: 'syncing' })
      }

      const state = get()
      const activeProgram = state.program

      const [remoteProgress, remoteWorkouts, remoteBodyweight, remoteCustomizations] = await Promise.all([
        fetchProgressFromSupabase(session.user.id),
        fetchWorkoutLogsFromSupabase(session.user.id),
        fetchBodyweightLogsFromSupabase(session.user.id),
        fetchProgramCustomizationsFromSupabase(session.user.id),
      ])

      const activeRemoteWorkouts = Array.isArray(remoteWorkouts)
        ? remoteWorkouts.filter((day) => !day?.deletedAt)
        : remoteWorkouts

      const pendingQueue = getSyncQueue()
      const hasPendingProgressWrites = hasPendingMutation(pendingQueue, 'user_progress')
      const hasPendingWorkoutWrites = hasPendingMutation(pendingQueue, 'workout_logs')
      const hasPendingBodyweightWrites = hasPendingMutation(pendingQueue, 'bodyweight_logs')
      const hasPendingCustomizationWrites = hasPendingMutation(pendingQueue, 'program_customizations')

      const hasPendingProgressDeleteAll = hasPendingDeleteAll(pendingQueue, 'user_progress', session.user.id)
      const hasPendingWorkoutDeleteAll = hasPendingDeleteAll(pendingQueue, 'workout_logs', session.user.id)
      const hasPendingBodyweightDeleteAll = hasPendingDeleteAll(pendingQueue, 'bodyweight_logs', session.user.id)
      const hasPendingCustomizationDeleteAll = hasPendingDeleteAll(pendingQueue, 'program_customizations', session.user.id)

      const statePatch = {}
      let hasRemoteError = false

      if (remoteProgress) {
        const cloudProgress = {
          currentPhaseId: remoteProgress.current_phase_id,
          currentWeek: remoteProgress.current_week,
          currentDayIndex: remoteProgress.current_day_index,
        }

        const localProgress = storage.getProgress() || {
          currentPhaseId: state.currentPhaseId,
          currentWeek: state.currentWeek,
          currentDayIndex: state.currentDayIndex,
        }

        if (isValidProgress(activeProgram, cloudProgress)) {
          const cmp = compareProgressPosition(cloudProgress, localProgress, activeProgram)
          const shouldApplyProgress = hasPendingProgressDeleteAll
            ? false
            : (hasPendingProgressWrites ? cmp >= 0 : true)

          if (shouldApplyProgress) {
            storage.saveProgress(cloudProgress)
            statePatch.currentPhaseId = cloudProgress.currentPhaseId
            statePatch.currentWeek = cloudProgress.currentWeek
            statePatch.currentDayIndex = cloudProgress.currentDayIndex
          }
        }

        if (!hasPendingProgressWrites && !hasPendingProgressDeleteAll) {
          const remoteProgramStart = remoteProgress.program_start || null
          storage.saveProgramStart(remoteProgramStart || '')
          statePatch.programStart = remoteProgramStart

          const remoteWeightUnit = remoteProgress.weight_unit === 'lbs' ? 'lbs' : 'kg'
          storage.saveWeightUnit(remoteWeightUnit)
          statePatch.weightUnit = remoteWeightUnit

          const parsedRestTimer = Number(remoteProgress.rest_timer_default)
          const normalizedRestTimer = Number.isFinite(parsedRestTimer) ? parsedRestTimer : 120
          storage.saveRestTimerDefault(normalizedRestTimer)
          statePatch.restTimerDefault = normalizedRestTimer

          const normalizedDismissedAlerts = Array.isArray(remoteProgress.dismissed_alerts)
            ? remoteProgress.dismissed_alerts
            : []
          storage.saveDismissedAlerts(normalizedDismissedAlerts)
          statePatch.dismissedAlerts = normalizedDismissedAlerts
        }
      } else if (!hasPendingProgressWrites && !hasPendingProgressDeleteAll && activeRemoteWorkouts && activeRemoteWorkouts.length > 0) {
        const lastWorkout = activeRemoteWorkouts[activeRemoteWorkouts.length - 1]
        if (lastWorkout.phaseId) {
          const nextDay = getNextDay(activeProgram, lastWorkout.phaseId, lastWorkout.week, lastWorkout.dayIndex)
          if (nextDay && isValidProgress(activeProgram, { currentPhaseId: nextDay.phaseId, currentWeek: nextDay.week, currentDayIndex: nextDay.dayIndex })) {
            const cloudProgress = {
              currentPhaseId: nextDay.phaseId,
              currentWeek: nextDay.week,
              currentDayIndex: nextDay.dayIndex,
            }
            storage.saveProgress(cloudProgress)
            statePatch.currentPhaseId = cloudProgress.currentPhaseId
            statePatch.currentWeek = cloudProgress.currentWeek
            statePatch.currentDayIndex = cloudProgress.currentDayIndex
          }
        }
      }

      if (remoteWorkouts === null) {
        hasRemoteError = true
      } else {
        const localCompletedDays = get().completedDays
        const pendingWorkoutOverlays = hasPendingWorkoutWrites
          ? getPendingWorkoutOverlays(pendingQueue)
          : []

        const localWorkoutBaseline = pendingWorkoutOverlays.length > 0
          ? mergeCompletedDays(localCompletedDays, pendingWorkoutOverlays, { preferLocal: true }).items
          : localCompletedDays

        if (!hasPendingWorkoutDeleteAll) {
          const nextCompletedDays = hasPendingWorkoutWrites
            ? mergeCompletedDays(localWorkoutBaseline, remoteWorkouts, { preferLocal: true }).items
            : (Array.isArray(remoteWorkouts)
              ? remoteWorkouts.filter((day) => !day?.deletedAt)
              : [])

          if (JSON.stringify(nextCompletedDays) !== JSON.stringify(localCompletedDays)) {
            storage.saveCompletedDays(nextCompletedDays)
            statePatch.completedDays = nextCompletedDays
          }
        }
      }
      
      if (remoteBodyweight === null) {
        hasRemoteError = true
      } else if (remoteBodyweight !== undefined) {
        const localBodyweightLogs = get().bodyweightLogs

        if (!hasPendingBodyweightDeleteAll) {
          const nextBodyweightLogs = hasPendingBodyweightWrites
            ? mergeBodyweightLogs(localBodyweightLogs, remoteBodyweight).items
            : remoteBodyweight

          if (JSON.stringify(nextBodyweightLogs) !== JSON.stringify(localBodyweightLogs)) {
            storage.saveBodyweightLogs(nextBodyweightLogs)
            statePatch.bodyweightLogs = nextBodyweightLogs
          }
        }
      }

      if (remoteCustomizations === null) {
        hasRemoteError = true
      } else if (remoteCustomizations !== undefined) {
        const localCustomizations = get().programCustomizations || {}

        if (!hasPendingCustomizationDeleteAll) {
          const nextCustomizations = hasPendingCustomizationWrites
            ? mergeProgramCustomizations(localCustomizations, remoteCustomizations || {}).items
            : (remoteCustomizations || {})

          if (JSON.stringify(nextCustomizations) !== JSON.stringify(localCustomizations)) {
            storage.saveProgramCustomizations(nextCustomizations)
            statePatch.programCustomizations = nextCustomizations
          }
        }
      }

      const shouldApplyCloudResetDefaults = !hasPendingProgressWrites
        && !hasPendingProgressDeleteAll
        && !remoteProgress
        && Array.isArray(activeRemoteWorkouts)
        && activeRemoteWorkouts.length === 0
        && Array.isArray(remoteBodyweight)
        && remoteBodyweight.length === 0
        && remoteCustomizations
        && Object.keys(remoteCustomizations).length === 0

      if (shouldApplyCloudResetDefaults) {
        const fallbackProgress = getDefaultProgressForProgram(activeProgram)
        storage.saveProgress(fallbackProgress)
        storage.saveProgramStart('')
        storage.saveWeightUnit('kg')
        storage.saveRestTimerDefault(120)
        storage.saveDismissedAlerts([])

        statePatch.currentPhaseId = fallbackProgress.currentPhaseId
        statePatch.currentWeek = fallbackProgress.currentWeek
        statePatch.currentDayIndex = fallbackProgress.currentDayIndex
        statePatch.programStart = null
        statePatch.weightUnit = 'kg'
        statePatch.restTimerDefault = 120
        statePatch.dismissedAlerts = []
      }

      if (Object.keys(statePatch).length > 0) {
        set(statePatch)
      }

      set({ syncStatus: hasRemoteError ? 'error' : 'saved' })
      const result = {
        ok: !hasRemoteError,
        offline: false,
        pulledWorkouts: Array.isArray(activeRemoteWorkouts) ? activeRemoteWorkouts.length : 0,
      }
      return result
    })().catch((err) => {
      console.error('Failed to sync from Supabase:', err)
      set({ syncStatus: navigator.onLine ? 'error' : 'offline' })
      return { ok: false, offline: !navigator.onLine, error: err }
    }).finally(() => {
      setCloudSyncPromise(null)
    })

    setCloudSyncPromise(promise)
    return promise
  },

  initializeStore: async () => {
    const savedImportedPrograms = storage.getImportedPrograms()
    const savedActiveProgramId = storage.getActiveProgramId()
    const programLibrary = buildProgramLibrary(savedImportedPrograms)
    const activeProgramEntry = programLibrary.find((entry) => entry.id === savedActiveProgramId) || programLibrary[0]
    const activeProgram = activeProgramEntry?.program || defaultProgram

    const savedStart = storage.getProgramStart()
    const savedProgress = storage.getProgress()
    const savedCompletedDays = storage.getCompletedDays()
    const savedBodyweight = storage.getBodyweightLogs()
    const savedPlanDisplayName = storage.getPlanDisplayName()
    const savedCustomizations = storage.getProgramCustomizations()
    const savedScheduledExercises = storage.getScheduledExercises()
    const savedWeightUnit = storage.getWeightUnit()
    const savedRestTimerDefault = storage.getRestTimerDefault()
    const savedRestTimerVibration = storage.getRestTimerVibration()
    const savedDismissedAlerts = storage.getDismissedAlerts()
    const savedExerciseGoals = storage.getExerciseGoals()

    set({
      program: activeProgram,
      programLibrary,
      activeProgramId: activeProgramEntry.id,
    })

    if (savedStart) {
      set({ programStart: savedStart })
    }

    if (isValidProgress(activeProgram, savedProgress)) {
      set({
        currentPhaseId: savedProgress.currentPhaseId,
        currentWeek: savedProgress.currentWeek,
        currentDayIndex: savedProgress.currentDayIndex,
      })
    } else {
      const fallbackProgress = getDefaultProgressForProgram(activeProgram)
      set(fallbackProgress)
    }

    if (savedCompletedDays) {
      const migratedCompletedDays = normalizeLocalWorkoutLogs(savedCompletedDays)
      if (migratedCompletedDays.changed) {
        storage.saveCompletedDays(migratedCompletedDays.items)
      }
      set({ completedDays: migratedCompletedDays.items })
    }
    
    if (savedBodyweight) {
      set({ bodyweightLogs: savedBodyweight })
    }

    set({ planDisplayName: savedPlanDisplayName || activeProgramEntry.name || 'Dina Workout plan' })
    
    if (savedCustomizations) {
      set({ programCustomizations: savedCustomizations })
    }

    if (savedScheduledExercises) {
      set({ scheduledExercises: savedScheduledExercises })
    }

    if (Array.isArray(savedExerciseGoals)) {
      set({ exerciseGoals: savedExerciseGoals })
    }

    set({
      weightUnit: savedWeightUnit,
      restTimerDefault: savedRestTimerDefault,
      restTimerVibration: savedRestTimerVibration,
      dismissedAlerts: savedDismissedAlerts,
    })

    try {
      await get().syncFromCloud({ setSyncing: true })
    } catch (err) {
      console.error('initializeStore: cloud sync failed, continuing with local data', err)
      set({ syncStatus: navigator.onLine ? 'error' : 'offline' })
    }
  },
})
