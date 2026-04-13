import { storage } from '../../utils/storage'
import { getNextDay } from '../../utils/progressTracker'
import {
  normalizeWorkoutLogEntry,
  normalizeRemoteDate,
  buildWorkoutLogPayload,
  upsertWorkoutLogToSupabase,
  syncProgressToSupabase,
  triggerAutoDriveBackup,
  CLOUD_SYNC_ENABLED,
  getBodyweightKey,
  isValidProgress
} from '../helpers'
import { createWorkoutLogId } from '../../utils/workoutLogIdentity'
import { supabase } from '../../lib/supabaseClient'
import { enqueueMutation } from '../../utils/syncQueue'

export const createWorkoutSlice = (set, get) => ({
  currentPhaseId: 'phase_1',
  currentWeek: 1,
  currentDayIndex: 0,
  completedDays: [],
  bodyweightLogs: [],
  activeCustomTemplate: null,
  exerciseGoals: [],
  milestoneToastQueue: [],

  updateTodayWorkout: async (workoutData, metadata = {}) => {
    const { completedDays } = get()
    const todayStr = new Date().toISOString().split('T')[0]
    const targetPhaseId = metadata.phaseId
    const targetWeek = Number.isFinite(Number(metadata.week)) ? Number(metadata.week) : null
    const targetDayIndex = Number.isFinite(Number(metadata.dayIndex)) ? Number(metadata.dayIndex) : null

    const existingIndex = completedDays.findIndex((day) => {
      if (!day?.date?.startsWith(todayStr)) return false

      if (targetPhaseId && targetWeek !== null && targetDayIndex !== null) {
        return day.phaseId === targetPhaseId
          && Number(day.week) === targetWeek
          && Number(day.dayIndex) === targetDayIndex
      }

      return true
    })
    
    if (existingIndex === -1) return

    const existingDay = normalizeWorkoutLogEntry(completedDays[existingIndex], { ensureId: true })
    const updatedAt = normalizeRemoteDate(new Date().toISOString())

    const prExercises = Array.isArray(metadata.prExercises)
      ? metadata.prExercises
      : (existingDay.prExercises || existingDay.pr_exercises || [])
    const durationMinutes = Number.isFinite(metadata.durationMinutes)
      ? metadata.durationMinutes
      : (existingDay.durationMinutes || existingDay.duration_minutes || null)
    const sessionNotes = metadata.sessionNotes ?? existingDay.sessionNotes ?? existingDay.session_notes ?? ''
    const workoutLabel = metadata.workoutLabel || existingDay.label || existingDay.workout_name || 'Workout'

    const updatedDay = normalizeWorkoutLogEntry({
      ...existingDay,
      label: workoutLabel,
      workout_name: workoutLabel,
      exercises: workoutData,
      sessionNotes,
      session_notes: sessionNotes,
      durationMinutes,
      duration_minutes: durationMinutes,
      prExercises,
      pr_exercises: prExercises,
      updated_at: updatedAt,
      deleted_at: null,
    }, { ensureId: true })

    const newCompletedDays = [...completedDays]
    newCompletedDays[existingIndex] = updatedDay

    storage.saveCompletedDays(newCompletedDays)
    set({ completedDays: newCompletedDays })

    if (!CLOUD_SYNC_ENABLED) {
      set({ syncStatus: 'saved' })
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      set({ syncStatus: 'syncing' })
      const logPayload = buildWorkoutLogPayload(session.user.id, updatedDay)
      const sync = await upsertWorkoutLogToSupabase(logPayload)
      set({ syncStatus: sync.offline ? 'offline' : (sync.error ? 'error' : 'saved') })
    }
  },

  completeWorkout: async (workoutData, metadata = {}) => {
    const { currentPhaseId, currentWeek, currentDayIndex, completedDays, program } = get()
    const currentDay = get().getCurrentDay()

    if (!currentDay || currentDay.isRest) {
      console.warn('Cannot complete a rest day')
      return
    }

    const workoutLabel = metadata.workoutLabel || currentDay.label
    const nowIso = normalizeRemoteDate(new Date().toISOString())

    const completedDay = normalizeWorkoutLogEntry({
      id: createWorkoutLogId(),
      date: nowIso,
      phaseId: currentPhaseId,
      week: currentWeek,
      dayIndex: currentDayIndex,
      label: workoutLabel,
      workout_name: workoutLabel,
      exercises: workoutData,
      sessionNotes: metadata.sessionNotes || '',
      session_notes: metadata.sessionNotes || '',
      durationMinutes: Number.isFinite(metadata.durationMinutes) ? metadata.durationMinutes : null,
      duration_minutes: Number.isFinite(metadata.durationMinutes) ? metadata.durationMinutes : null,
      prExercises: Array.isArray(metadata.prExercises) ? metadata.prExercises : [],
      pr_exercises: Array.isArray(metadata.prExercises) ? metadata.prExercises : [],
      updated_at: nowIso,
      deleted_at: null,
    }, { ensureId: true })

    const newCompletedDays = [...completedDays, completedDay]
    storage.saveCompletedDays(newCompletedDays)

    const next = getNextDay(program, currentPhaseId, currentWeek, currentDayIndex)

    const nextProgress = next
      ? {
          currentPhaseId: next.phaseId,
          currentWeek: next.week,
          currentDayIndex: next.dayIndex,
        }
      : null

    if (nextProgress) {
      storage.saveProgress(nextProgress)
      set({ ...nextProgress, completedDays: newCompletedDays })
    } else {
      set({ completedDays: newCompletedDays })
    }

    triggerAutoDriveBackup()

    if (!CLOUD_SYNC_ENABLED) {
      set({ syncStatus: 'saved' })
      if (metadata.clearScheduledForCurrentDay !== false) {
        get().clearScheduledExercisesForDay(currentPhaseId, currentWeek, currentDayIndex)
      }
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      set({ syncStatus: 'syncing' })

      const logPayload = buildWorkoutLogPayload(session.user.id, completedDay)
      const workoutSync = await upsertWorkoutLogToSupabase(logPayload)

      const state = get()
      const progressForSync = nextProgress || {
        currentPhaseId,
        currentWeek,
        currentDayIndex,
      }

      const progressSync = await syncProgressToSupabase(session.user.id, progressForSync, state.programStart, {
        weightUnit: state.weightUnit,
        restTimerDefault: state.restTimerDefault,
        dismissedAlerts: state.dismissedAlerts,
      })

      const isOffline = Boolean(workoutSync.offline || progressSync.offline)
      const hasError = Boolean(workoutSync.error || progressSync.error)
      set({ syncStatus: isOffline ? 'offline' : (hasError ? 'error' : 'saved') })
    }

    if (metadata.clearScheduledForCurrentDay !== false) {
      get().clearScheduledExercisesForDay(currentPhaseId, currentWeek, currentDayIndex)
    }
  },

  skipDay: async () => {
    const { currentPhaseId, currentWeek, currentDayIndex, program } = get()

    const next = getNextDay(program, currentPhaseId, currentWeek, currentDayIndex)
    if (!next) {
      return
    }

    const newProgress = {
      currentPhaseId: next.phaseId,
      currentWeek: next.week,
      currentDayIndex: next.dayIndex,
    }

    storage.saveProgress(newProgress)
    set(newProgress)

    if (!CLOUD_SYNC_ENABLED) {
      set({ syncStatus: 'saved' })
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      set({ syncStatus: 'syncing' })
      const state = get()
      const res = await syncProgressToSupabase(session.user.id, newProgress, state.programStart, {
        weightUnit: state.weightUnit,
        restTimerDefault: state.restTimerDefault,
        dismissedAlerts: state.dismissedAlerts,
      })
      set({ syncStatus: res.offline ? 'offline' : (res.error ? 'error' : 'saved') })
    }
  },

  jumpToDay: async (phaseId, week, dayIndex) => {
    const { program } = get()
    const newProgress = {
      currentPhaseId: phaseId,
      currentWeek: week,
      currentDayIndex: dayIndex,
    }
    
    if (!isValidProgress(program, newProgress)) {
      return
    }

    storage.saveProgress(newProgress)
    set(newProgress)

    if (!CLOUD_SYNC_ENABLED) {
      set({ syncStatus: 'saved' })
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      set({ syncStatus: 'syncing' })
      const state = get()
      const res = await syncProgressToSupabase(session.user.id, newProgress, state.programStart, {
        weightUnit: state.weightUnit,
        restTimerDefault: state.restTimerDefault,
        dismissedAlerts: state.dismissedAlerts,
      })
      set({ syncStatus: res.offline ? 'offline' : (res.error ? 'error' : 'saved') })
    }
  },

  loadCustomWorkoutTemplate: (templateData) => {
    set({ activeCustomTemplate: templateData })
  },

  clearCustomWorkoutTemplate: () => {
    set({ activeCustomTemplate: null })
  },

  getCompletedWorkouts: () => get().completedDays,

  deleteCompletedWorkout: (index) => {
    const { completedDays } = get()
    const updated = completedDays.filter((_, i) => i !== index)
    storage.saveCompletedDays(updated)
    set({ completedDays: updated })
  },

  logBodyweight: async (weight) => {
    const { bodyweightLogs } = get()
    const today = new Date().toISOString()
    const todaySimple = today.split('T')[0]
    
    const existingIndex = bodyweightLogs.findIndex(log => log.date.startsWith(todaySimple))
    
    let updated = [...bodyweightLogs]
    if (existingIndex >= 0) {
      updated[existingIndex].weight = weight
    } else {
      updated.push({ date: today, weight })
    }

    updated.sort((a, b) => new Date(a.date) - new Date(b.date))
    storage.saveBodyweightLogs(updated)
    set({ bodyweightLogs: updated })

    if (!CLOUD_SYNC_ENABLED) {
      set({ syncStatus: 'saved' })
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const payload = {
        user_id: session.user.id,
        date: todaySimple,
        weight: Number(weight)
      }
      
      if (!navigator.onLine) {
        enqueueMutation('bodyweight_logs', 'delete', null, { user_id: session.user.id, date: todaySimple })
        enqueueMutation('bodyweight_logs', 'insert', payload)
      } else {
        await supabase.from('bodyweight_logs').delete().match({ user_id: session.user.id, date: todaySimple })
        const { error } = await supabase.from('bodyweight_logs').insert(payload)
        if (error) {
          enqueueMutation('bodyweight_logs', 'delete', null, { user_id: session.user.id, date: todaySimple })
          enqueueMutation('bodyweight_logs', 'insert', payload)
        }
      }
    }
  },

  removeBodyweightLog: async (index) => {
    const { bodyweightLogs } = get()
    const target = bodyweightLogs[index]
    if (!target) return

    const updated = bodyweightLogs.filter((_, i) => i !== index)
    storage.saveBodyweightLogs(updated)
    set({ bodyweightLogs: updated })

    if (!CLOUD_SYNC_ENABLED) {
      set({ syncStatus: 'saved' })
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const dateSimple = target.date.split('T')[0]
      const matchCriteria = { user_id: session.user.id, date: dateSimple }

      if (!navigator.onLine) {
        enqueueMutation('bodyweight_logs', 'delete', null, matchCriteria)
      } else {
        const { error } = await supabase.from('bodyweight_logs').delete().match(matchCriteria)
        if (error) {
          enqueueMutation('bodyweight_logs', 'delete', null, matchCriteria)
        }
      }
    }
  },

  upsertExerciseGoal: (goalInput = {}) => {
    const state = get()
    const exerciseName = String(goalInput.exerciseName || '').trim()
    if (!exerciseName) return null

    const type = goalInput.type === 'e1rm' ? 'e1rm' : 'top_set'
    const targetWeight = Number(goalInput.targetWeight)
    if (!Number.isFinite(targetWeight) || targetWeight <= 0) return null

    const targetReps = type === 'top_set'
      ? Math.max(1, Number.isFinite(Number(goalInput.targetReps)) ? Number(goalInput.targetReps) : 1)
      : null

    const nowIso = new Date().toISOString()
    const nextGoal = {
      id: goalInput.id || `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      exerciseName,
      type,
      targetWeight,
      targetReps,
      notes: String(goalInput.notes || '').trim(),
      createdAt: goalInput.createdAt || nowIso,
      updatedAt: nowIso,
    }

    const existingIndex = state.exerciseGoals.findIndex((item) => item.id === nextGoal.id)
    const updatedGoals = [...state.exerciseGoals]
    if (existingIndex >= 0) {
      updatedGoals[existingIndex] = {
        ...updatedGoals[existingIndex],
        ...nextGoal,
      }
    } else {
      updatedGoals.unshift(nextGoal)
    }

    storage.saveExerciseGoals(updatedGoals)
    set({ exerciseGoals: updatedGoals, syncStatus: 'saved' })
    return nextGoal.id
  },

  removeExerciseGoal: (goalId) => {
    if (!goalId) return false
    const state = get()
    const updatedGoals = state.exerciseGoals.filter((goal) => goal.id !== goalId)
    if (updatedGoals.length === state.exerciseGoals.length) return false

    storage.saveExerciseGoals(updatedGoals)
    set({ exerciseGoals: updatedGoals, syncStatus: 'saved' })
    return true
  },

  enqueueMilestoneToasts: (badgeIds) => {
    const incoming = Array.isArray(badgeIds) ? badgeIds : []
    if (incoming.length === 0) return

    const existing = get().milestoneToastQueue
    const merged = [...existing]

    incoming.forEach((badgeId) => {
      if (!merged.includes(badgeId)) {
        merged.push(badgeId)
      }
    })

    set({ milestoneToastQueue: merged })
  },

  shiftMilestoneToast: () => {
    const queue = get().milestoneToastQueue
    if (!queue.length) return
    set({ milestoneToastQueue: queue.slice(1) })
  },

  clearMilestoneToasts: () => {
    set({ milestoneToastQueue: [] })
  },
})
