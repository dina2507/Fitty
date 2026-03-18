import { create } from 'zustand'
import { storage } from '../utils/storage'
import { getNextDay } from '../utils/progressTracker'
import { supabase } from '../lib/supabaseClient'
import { enqueueMutation } from '../utils/syncQueue'
import program from '../data/program.json'

function isValidProgress(data, progress) {
  if (!progress) {
    return false
  }

  const phase = data.phases.find((item) => item.id === progress.currentPhaseId)
  if (!phase) {
    return false
  }

  const week = phase.weeks[progress.currentWeek - 1]
  if (!week) {
    return false
  }

  return Boolean(week.days[progress.currentDayIndex])
}

// Helper: upsert user_progress to Supabase
async function syncProgressToSupabase(userId, progress, programStart, settings = {}) {
  try {
    const payload = {
      user_id: userId,
      current_phase_id: progress.currentPhaseId,
      current_week: progress.currentWeek,
      current_day_index: progress.currentDayIndex,
      program_start: programStart || null,
      weight_unit: settings.weightUnit || 'kg',
      rest_timer_default: Number.isFinite(settings.restTimerDefault)
        ? Math.max(30, settings.restTimerDefault)
        : 120,
      dismissed_alerts: Array.isArray(settings.dismissedAlerts) ? settings.dismissedAlerts : [],
      updated_at: new Date().toISOString(),
    }

    if (!navigator.onLine) {
      enqueueMutation('user_progress', 'upsert', payload)
      return { offline: true }
    }

    const { error } = await supabase
      .from('user_progress')
      .upsert(payload, { onConflict: 'user_id' })

    if (error) {
      console.warn('Network error, queueing progress sync:', error)
      enqueueMutation('user_progress', 'upsert', payload)
      return { offline: true }
    }
    
    return { ok: true }
  } catch (err) {
    console.error('Supabase sync error:', err)
    return { error: err }
  }
}

// Helper: fetch user_progress from Supabase
async function fetchProgressFromSupabase(userId) {
  try {
    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows
    return data
  } catch (err) {
    console.error('Supabase fetch error:', err)
    return null
  }
}

export const useWorkoutStore = create((set, get) => ({
  // Program data
  program: program,

  // Current position
  currentPhaseId: 'phase_1',
  currentWeek: 1,
  currentDayIndex: 0,

  // User data
  programStart: null,
  completedDays: [],
  bodyweightLogs: [],
  weightUnit: 'kg',
  restTimerDefault: 120,
  restTimerVibration: true,
  dismissedAlerts: [],
  programCustomizations: {}, // Map of { [originalExerciseId]: overriddenExerciseObject }
  isSaved: true,

  milestoneToastQueue: [],
  
  // Custom Template Mode
  activeCustomTemplate: null, // Holds the currently running custom template

  // Sync status: 'saved' | 'syncing' | 'offline' | 'error'
  syncStatus: 'saved',

  // Initialize store from localStorage, then Supabase if authenticated
  initializeStore: async () => {
    const savedStart = storage.getProgramStart()
    const savedProgress = storage.getProgress()
    const savedCompletedDays = storage.getCompletedDays()
    const savedBodyweight = storage.getBodyweightLogs()
    const savedCustomizations = storage.getProgramCustomizations()
    const savedWeightUnit = storage.getWeightUnit()
    const savedRestTimerDefault = storage.getRestTimerDefault()
    const savedRestTimerVibration = storage.getRestTimerVibration()
    const savedDismissedAlerts = storage.getDismissedAlerts()

    // Load from localStorage first (fast)
    if (savedStart) {
      set({ programStart: savedStart })
    }

    if (isValidProgress(program, savedProgress)) {
      set({
        currentPhaseId: savedProgress.currentPhaseId,
        currentWeek: savedProgress.currentWeek,
        currentDayIndex: savedProgress.currentDayIndex,
      })
    } else {
      storage.saveProgress({
        currentPhaseId: 'phase_1',
        currentWeek: 1,
        currentDayIndex: 0,
      })
    }

    if (savedCompletedDays) {
      set({ completedDays: savedCompletedDays })
    }
    
    if (savedBodyweight) {
      set({ bodyweightLogs: savedBodyweight })
    }
    
    if (savedCustomizations) {
      set({ programCustomizations: savedCustomizations })
    }

    set({
      weightUnit: savedWeightUnit,
      restTimerDefault: savedRestTimerDefault,
      restTimerVibration: savedRestTimerVibration,
      dismissedAlerts: savedDismissedAlerts,
    })

    // Then try to fetch from Supabase
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        set({ syncStatus: 'offline' })
        return
      }

      set({ syncStatus: 'syncing' })
      const remoteProgress = await fetchProgressFromSupabase(session.user.id)

      if (remoteProgress) {
        const cloudProgress = {
          currentPhaseId: remoteProgress.current_phase_id,
          currentWeek: remoteProgress.current_week,
          currentDayIndex: remoteProgress.current_day_index,
        }

        if (isValidProgress(program, cloudProgress)) {
          storage.saveProgress(cloudProgress)
          set(cloudProgress)
        }

        if (remoteProgress.program_start) {
          const startDate = remoteProgress.program_start
          storage.saveProgramStart(startDate)
          set({ programStart: startDate })
        }

        if (remoteProgress.weight_unit) {
          storage.saveWeightUnit(remoteProgress.weight_unit)
          set({ weightUnit: remoteProgress.weight_unit })
        }

        if (Number.isFinite(remoteProgress.rest_timer_default)) {
          storage.saveRestTimerDefault(remoteProgress.rest_timer_default)
          set({ restTimerDefault: remoteProgress.rest_timer_default })
        }

        if (Array.isArray(remoteProgress.dismissed_alerts)) {
          storage.saveDismissedAlerts(remoteProgress.dismissed_alerts)
          set({ dismissedAlerts: remoteProgress.dismissed_alerts })
        }
      }

      set({ syncStatus: 'saved' })
    } catch (err) {
      console.error('Failed to sync from Supabase:', err)
      set({ syncStatus: 'offline' })
    }
  },

  // Set program start date (first launch)
  setProgramStart: async (date) => {
    storage.saveProgramStart(date)
    set({ programStart: date })

    // Sync to Supabase
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

  // Get current day data (applies customizations)
  getCurrentDay: () => {
    const { program, currentPhaseId, currentWeek, currentDayIndex, programCustomizations } = get()
    const phase = program.phases.find(p => p.id === currentPhaseId)
    if (!phase) return null
    const week = phase.weeks[currentWeek - 1]
    if (!week) return null
    
    const day = week.days[currentDayIndex]
    if (!day) return null

    // Apply customizations on the fly
    if (day.exercises && Object.keys(programCustomizations).length > 0) {
      return {
        ...day,
        exercises: day.exercises.map(ex => {
          if (programCustomizations[ex.id]) {
            // Inherit the swapped exercise, but retain the original ID for future swaps/saves
            return {
              ...programCustomizations[ex.id],
              id: ex.id,
              isCustomized: true
            }
          }
          return ex
        })
      }
    }

    return day
  },

  // Get current phase data
  getCurrentPhase: () => {
    const { program, currentPhaseId } = get()
    return program.phases.find(p => p.id === currentPhaseId)
  },

  // Update a workout already completed today
  updateTodayWorkout: async (workoutData, metadata = {}) => {
    const { completedDays } = get()
    const todayStr = new Date().toISOString().split('T')[0]
    const existingIndex = completedDays.findIndex(d => d.date.startsWith(todayStr))
    
    if (existingIndex === -1) return

    const prExercises = Array.isArray(metadata.prExercises)
      ? metadata.prExercises
      : (completedDays[existingIndex].prExercises || completedDays[existingIndex].pr_exercises || [])
    const durationMinutes = Number.isFinite(metadata.durationMinutes)
      ? metadata.durationMinutes
      : (completedDays[existingIndex].durationMinutes || completedDays[existingIndex].duration_minutes || null)
    const sessionNotes = metadata.sessionNotes ?? completedDays[existingIndex].sessionNotes ?? completedDays[existingIndex].session_notes ?? ''

    const updatedDay = {
      ...completedDays[existingIndex],
      exercises: workoutData,
      sessionNotes,
      session_notes: sessionNotes,
      durationMinutes,
      duration_minutes: durationMinutes,
      prExercises,
      pr_exercises: prExercises,
    }

    const newCompletedDays = [...completedDays]
    newCompletedDays[existingIndex] = updatedDay

    storage.saveCompletedDays(newCompletedDays)
    set({ completedDays: newCompletedDays })

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      set({ syncStatus: 'syncing' })
      const logPayload = {
        user_id: session.user.id,
        date: updatedDay.date,
        workout_name: updatedDay.label,
        exercises: updatedDay.exercises,
        notes: updatedDay.sessionNotes || null,
        duration_minutes: updatedDay.durationMinutes,
        pr_exercises: updatedDay.prExercises || [],
        week: updatedDay.week,
        phase_id: updatedDay.phaseId
      }
      
      const { error } = await supabase
        .from('workout_logs')
        .update({
          exercises: logPayload.exercises,
          notes: logPayload.notes,
          duration_minutes: logPayload.duration_minutes,
          pr_exercises: logPayload.pr_exercises,
        })
        .match({ user_id: session.user.id, date: updatedDay.date })
        
      if (error) {
        enqueueMutation('workout_logs', 'update', logPayload)
      }
      set({ syncStatus: 'saved' })
    }
  },

  // Mark workout as complete and advance to next day
  completeWorkout: async (workoutData, metadata = {}) => {
    const { currentPhaseId, currentWeek, currentDayIndex, completedDays } = get()
    const currentDay = get().getCurrentDay()

    if (!currentDay || currentDay.isRest) {
      console.warn('Cannot complete a rest day')
      return
    }

    // Save workout to completed days
    const completedDay = {
      date: new Date().toISOString(),
      phaseId: currentPhaseId,
      week: currentWeek,
      dayIndex: currentDayIndex,
      label: currentDay.label,
      exercises: workoutData,
      sessionNotes: metadata.sessionNotes || '',
      session_notes: metadata.sessionNotes || '',
      durationMinutes: Number.isFinite(metadata.durationMinutes) ? metadata.durationMinutes : null,
      duration_minutes: Number.isFinite(metadata.durationMinutes) ? metadata.durationMinutes : null,
      prExercises: Array.isArray(metadata.prExercises) ? metadata.prExercises : [],
      pr_exercises: Array.isArray(metadata.prExercises) ? metadata.prExercises : [],
    }

    const newCompletedDays = [...completedDays, completedDay]
    storage.saveCompletedDays(newCompletedDays)

    const { program } = get()
    const next = getNextDay(program, currentPhaseId, currentWeek, currentDayIndex)

    if (!next) {
      set({ completedDays: newCompletedDays })
      return
    }

    const newProgress = {
      currentPhaseId: next.phaseId,
      currentWeek: next.week,
      currentDayIndex: next.dayIndex,
    }

    storage.saveProgress(newProgress)
    set({ ...newProgress, completedDays: newCompletedDays })

    // Sync new progress to Supabase
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      set({ syncStatus: 'syncing' })

      // Push history log (if offline, queue it. if fetch fails, queue it)
      const logPayload = {
        user_id: session.user.id,
        date: completedDay.date,
        workout_name: completedDay.label,
        exercises: completedDay.exercises,
        notes: completedDay.sessionNotes || null,
        duration_minutes: completedDay.durationMinutes,
        pr_exercises: completedDay.prExercises || [],
        week: completedDay.week,
        phase_id: completedDay.phaseId
      }

      if (!navigator.onLine) {
        enqueueMutation('workout_logs', 'insert', logPayload)
      } else {
        const { error } = await supabase.from('workout_logs').insert(logPayload)
        if (error) {
          console.warn('Network error logging workout, queuing it:', error)
          enqueueMutation('workout_logs', 'insert', logPayload)
        }
      }

      // Sync progress
      const state = get()
      const res = await syncProgressToSupabase(session.user.id, newProgress, state.programStart, {
        weightUnit: state.weightUnit,
        restTimerDefault: state.restTimerDefault,
        dismissedAlerts: state.dismissedAlerts,
      })
      set({ syncStatus: res.offline ? 'offline' : (res.error ? 'error' : 'saved') })
    }
  },

  // Skip to next day without logging
  skipDay: async () => {
    const { currentPhaseId, currentWeek, currentDayIndex } = get()
    const { program } = get()

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

    // Sync to Supabase
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

  // Jump to specific day (for manual override)
  jumpToDay: async (phaseId, week, dayIndex) => {
    if (!isValidProgress(get().program, { currentPhaseId: phaseId, currentWeek: week, currentDayIndex: dayIndex })) {
      return
    }

    const newProgress = {
      currentPhaseId: phaseId,
      currentWeek: week,
      currentDayIndex: dayIndex,
    }
    storage.saveProgress(newProgress)
    set(newProgress)

    // Sync to Supabase
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

  // Load a custom workout template into the active session
  loadCustomWorkoutTemplate: (templateData) => {
    // Structure required by WorkoutPage:
    // We override currentDay index/phase so WorkoutPage treats it as a valid day,
    // but we use the activeCustomTemplate property to tell WorkoutPage to use this instead of program.json
    set({
      activeCustomTemplate: templateData
    })
  },

  clearCustomWorkoutTemplate: () => {
    set({ activeCustomTemplate: null })
  },

  // Get history of completed workouts
  getCompletedWorkouts: () => get().completedDays,

  // Delete completed workout
  deleteCompletedWorkout: (index) => {
    const { completedDays } = get()
    const updated = completedDays.filter((_, i) => i !== index)
    storage.saveCompletedDays(updated)
    set({ completedDays: updated })
  },

  // Log Bodyweight
  logBodyweight: (weight) => {
    const { bodyweightLogs } = get()
    const today = new Date().toISOString().split('T')[0]
    
    // Check if entry for today already exists, if so update it
    const existingIndex = bodyweightLogs.findIndex(log => log.date.startsWith(today))
    
    let updated = [...bodyweightLogs]
    if (existingIndex >= 0) {
      updated[existingIndex].weight = weight
    } else {
      updated.push({ date: new Date().toISOString(), weight })
    }

    // Keep chronological
    updated.sort((a, b) => new Date(a.date) - new Date(b.date))
    storage.saveBodyweightLogs(updated)
    set({ bodyweightLogs: updated })
  },

  // Remove Bodyweight Log
  removeBodyweightLog: (index) => {
    const { bodyweightLogs } = get()
    const updated = bodyweightLogs.filter((_, i) => i !== index)
    storage.saveBodyweightLogs(updated)
    set({ bodyweightLogs: updated })
  },

  // Program Customizations
  addProgramCustomization: (originalExId, newEx) => {
    const { programCustomizations } = get()
    const updated = {
      ...programCustomizations,
      [originalExId]: { ...newEx, id: originalExId } // Ensure the customized block retains the slot ID
    }
    storage.saveProgramCustomizations(updated)
    set({ programCustomizations: updated })
  },

  removeProgramCustomization: (originalExId) => {
    const { programCustomizations } = get()
    const updated = { ...programCustomizations }
    delete updated[originalExId]
    storage.saveProgramCustomizations(updated)
    set({ programCustomizations: updated })
  },

  // Export all data
  exportData: () => storage.exportData(),

  // Import data
  importData: (data) => {
    storage.importData(data)
    get().initializeStore()
  },

  // Reset everything
  resetProgram: async () => {
    storage.clearAll()
    set({
      currentPhaseId: 'phase_1',
      currentWeek: 1,
      currentDayIndex: 0,
      programStart: null,
      completedDays: [],
      activeCustomTemplate: null,
      weightUnit: 'kg',
      restTimerDefault: 120,
      restTimerVibration: true,
      dismissedAlerts: [],
      milestoneToastQueue: [],
      syncStatus: 'saved',
    })

    // Clear Supabase progress
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      await supabase
        .from('user_progress')
        .delete()
        .eq('user_id', session.user.id)
    }
  },
}))
