import { storage } from '../../utils/storage'
import {
  BUILT_IN_PROGRAM_ID,
  normalizeProgramData,
  getProgramSignature,
  getDefaultProgressForProgram,
  isValidProgress,
  syncProgressToSupabase,
  CLOUD_SYNC_ENABLED
} from '../helpers'
import defaultProgram from '../../data/program.json'
import { supabase } from '../../lib/supabaseClient'

export const createProgramSlice = (set, get) => ({
  program: defaultProgram,
  programLibrary: [], // Initialized in initializeStore
  activeProgramId: BUILT_IN_PROGRAM_ID,
  planDisplayName: 'Dina Workout plan',
  programCustomizations: {},
  scheduledExercises: [],

  setPlanDisplayName: (name) => {
    const normalized = String(name || '').trim() || 'Dina Workout plan'
    storage.savePlanDisplayName(normalized)
    set({ planDisplayName: normalized })
  },

  switchWorkoutPlan: async (programId) => {
    const state = get()
    const target = state.programLibrary.find((entry) => entry.id === programId)
    if (!target) {
      return { ok: false, error: 'Workout plan not found.' }
    }

    const nextProgress = isValidProgress(target.program, storage.getProgress())
      ? storage.getProgress()
      : getDefaultProgressForProgram(target.program)

    storage.saveActiveProgramId(target.id)
    storage.saveProgress(nextProgress)
    storage.savePlanDisplayName(target.name)
    storage.saveProgramCustomizations({})
    storage.saveScheduledExercises([])

    set({
      program: target.program,
      activeProgramId: target.id,
      currentPhaseId: nextProgress.currentPhaseId,
      currentWeek: nextProgress.currentWeek,
      currentDayIndex: nextProgress.currentDayIndex,
      activeCustomTemplate: null,
      planDisplayName: target.name,
      programCustomizations: {},
      scheduledExercises: [],
    })

    if (!CLOUD_SYNC_ENABLED) {
      set({ syncStatus: 'saved' })
      return { ok: true, name: target.name }
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      set({ syncStatus: 'syncing' })
      const latest = get()
      const res = await syncProgressToSupabase(session.user.id, nextProgress, latest.programStart, {
        weightUnit: latest.weightUnit,
        restTimerDefault: latest.restTimerDefault,
        dismissedAlerts: latest.dismissedAlerts,
      })
      set({ syncStatus: res.offline ? 'offline' : (res.error ? 'error' : 'saved') })
    }

    return { ok: true, name: target.name }
  },

  importWorkoutPlan: async (payload, providedName = 'Imported Plan') => {
    const normalized = normalizeProgramData(payload)
    if (!normalized) {
      return { ok: false, error: 'Invalid plan format. JSON must include phases[] with weeks and days.' }
    }

    const signature = getProgramSignature(normalized)
    const state = get()
    const existing = state.programLibrary.find((entry) => entry.signature === signature)
    if (existing) {
      return { ok: true, duplicate: true, name: existing.name, programId: existing.id }
    }

    const baseName = String(payload?.name || providedName || 'Imported Plan')
      .replace(/\.json$/i, '')
      .trim() || 'Imported Plan'

    const existingNames = new Set(state.programLibrary.map((entry) => entry.name))
    let finalName = baseName
    let suffix = 2
    while (existingNames.has(finalName)) {
      finalName = `${baseName} (${suffix})`
      suffix += 1
    }

    const newEntry = {
      id: `imported_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: finalName,
      source: 'imported',
      signature,
      importedAt: new Date().toISOString(),
      program: normalized,
    }

    const nextLibrary = [...state.programLibrary, newEntry]
    const importedOnly = nextLibrary
      .filter((entry) => entry.source === 'imported')
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        source: entry.source,
        signature: entry.signature,
        importedAt: entry.importedAt,
        program: entry.program,
      }))

    storage.saveImportedPrograms(importedOnly)
    set({ programLibrary: nextLibrary })

    await get().switchWorkoutPlan(newEntry.id)

    return {
      ok: true,
      duplicate: false,
      name: newEntry.name,
      programId: newEntry.id,
    }
  },

  scheduleExerciseForDay: (payload) => {
    const exercise = payload?.exercise
    const targetPhaseId = payload?.targetPhaseId
    const targetWeek = Number(payload?.targetWeek)
    const targetDayIndex = Number(payload?.targetDayIndex)

    if (!exercise || !targetPhaseId || !Number.isFinite(targetWeek) || !Number.isFinite(targetDayIndex)) {
      return false
    }

    const queueItem = {
      id: `sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      sourcePhaseId: payload?.sourcePhaseId || null,
      sourceWeek: Number.isFinite(Number(payload?.sourceWeek)) ? Number(payload.sourceWeek) : null,
      sourceDayIndex: Number.isFinite(Number(payload?.sourceDayIndex)) ? Number(payload.sourceDayIndex) : null,
      sourceLabel: payload?.sourceLabel || null,
      targetPhaseId,
      targetWeek,
      targetDayIndex,
      targetLabel: payload?.targetLabel || null,
      exercise: {
        ...exercise,
        isSuperset: false,
        supersetGroup: null,
      },
    }

    const next = [...get().scheduledExercises, queueItem]
    storage.saveScheduledExercises(next)
    set({ scheduledExercises: next })
    return true
  },

  getScheduledExercisesForDay: (phaseId, week, dayIndex) => {
    const targetWeek = Number(week)
    const targetDay = Number(dayIndex)
    if (!phaseId || !Number.isFinite(targetWeek) || !Number.isFinite(targetDay)) return []

    return get().scheduledExercises
      .filter((item) => (
        item.targetPhaseId === phaseId
        && Number(item.targetWeek) === targetWeek
        && Number(item.targetDayIndex) === targetDay
      ))
      .map((item) => ({
        ...item.exercise,
        id: `${item.exercise?.id || 'exercise'}__scheduled__${item.id}`,
        originalExerciseId: item.exercise?.id || null,
        scheduledTransferId: item.id,
        scheduledFromLabel: item.sourceLabel || '',
      }))
  },

  clearScheduledExercisesForDay: (phaseId, week, dayIndex) => {
    const targetWeek = Number(week)
    const targetDay = Number(dayIndex)
    if (!phaseId || !Number.isFinite(targetWeek) || !Number.isFinite(targetDay)) return 0

    const existing = get().scheduledExercises
    const next = existing.filter((item) => !(
      item.targetPhaseId === phaseId
      && Number(item.targetWeek) === targetWeek
      && Number(item.targetDayIndex) === targetDay
    ))

    const removed = existing.length - next.length
    if (removed > 0) {
      storage.saveScheduledExercises(next)
      set({ scheduledExercises: next })
    }
    return removed
  },

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

  getCurrentPhase: () => {
    const { program, currentPhaseId } = get()
    return program.phases.find(p => p.id === currentPhaseId)
  },

  addProgramCustomization: async (originalExId, newEx) => {
    const { programCustomizations } = get()
    const updated = {
      ...programCustomizations,
      [originalExId]: { ...newEx, id: originalExId }
    }
    storage.saveProgramCustomizations(updated)
    set({ programCustomizations: updated })

    if (!CLOUD_SYNC_ENABLED) {
      set({ syncStatus: 'saved' })
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const payload = {
        user_id: session.user.id,
        original_exercise_id: originalExId,
        custom_exercise_json: { ...newEx, id: originalExId },
        updated_at: new Date().toISOString()
      }

      if (!navigator.onLine) {
        enqueueMutation('program_customizations', 'delete', null, { user_id: session.user.id, original_exercise_id: originalExId })
        enqueueMutation('program_customizations', 'insert', payload)
      } else {
        await supabase.from('program_customizations').delete().match({ user_id: session.user.id, original_exercise_id: originalExId })
        const { error } = await supabase.from('program_customizations').insert(payload)
        if (error) {
          enqueueMutation('program_customizations', 'delete', null, { user_id: session.user.id, original_exercise_id: originalExId })
          enqueueMutation('program_customizations', 'insert', payload)
        }
      }
    }
  },

  removeProgramCustomization: async (originalExId) => {
    const { programCustomizations } = get()
    const updated = { ...programCustomizations }
    delete updated[originalExId]
    storage.saveProgramCustomizations(updated)
    set({ programCustomizations: updated })

    if (!CLOUD_SYNC_ENABLED) {
      set({ syncStatus: 'saved' })
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const matchCriteria = { user_id: session.user.id, original_exercise_id: originalExId }

      if (!navigator.onLine) {
        enqueueMutation('program_customizations', 'delete', null, matchCriteria)
      } else {
        const { error } = await supabase.from('program_customizations').delete().match(matchCriteria)
        if (error) {
          enqueueMutation('program_customizations', 'delete', null, matchCriteria)
        }
      }
    }
  },
})
