import { create } from 'zustand'
import { storage } from '../utils/storage'
import { getNextDay } from '../utils/progressTracker'
import { supabase } from '../lib/supabaseClient'
import { enqueueMutation, getSyncQueue } from '../utils/syncQueue'
import defaultProgram from '../data/program.json'

const BUILT_IN_PROGRAM_ID = 'built_in_default_program'
const LEGACY_PROGRESS_OPTIONAL_FIELDS = ['weight_unit', 'rest_timer_default', 'dismissed_alerts']
let cloudSyncPromise = null

function isUserProgressColumnMismatch(error) {
  const message = String(error?.message || '')
  return error?.code === 'PGRST204' && message.includes('user_progress')
}

function stripLegacyProgressFields(payload) {
  if (!payload || typeof payload !== 'object') return payload
  const sanitized = { ...payload }
  LEGACY_PROGRESS_OPTIONAL_FIELDS.forEach((field) => {
    delete sanitized[field]
  })
  return sanitized
}

function normalizeRemoteDate(value) {
  if (!value) return new Date().toISOString()

  const raw = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return `${raw}T00:00:00.000Z`
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString()
  }

  return parsed.toISOString()
}

function normalizeRemoteWorkoutLog(row) {
  const weekRaw = row?.week_number ?? row?.week
  const dayIndexRaw = row?.day_index ?? row?.dayIndex
  const durationRaw = row?.duration_minutes ?? row?.durationMinutes
  const notes = row?.notes ?? row?.session_notes ?? ''
  const label = row?.workout_name || row?.day_label || row?.label || 'Workout'
  const prs = Array.isArray(row?.pr_exercises)
    ? row.pr_exercises
    : (Array.isArray(row?.prExercises) ? row.prExercises : [])

  return {
    id: row?.id || undefined,
    date: normalizeRemoteDate(row?.date),
    phaseId: row?.phase_id || row?.phaseId || '',
    week: Number.isFinite(Number(weekRaw)) ? Number(weekRaw) : 1,
    dayIndex: Number.isFinite(Number(dayIndexRaw)) ? Number(dayIndexRaw) : 0,
    label,
    workout_name: label,
    exercises: Array.isArray(row?.exercises) ? row.exercises : [],
    sessionNotes: notes,
    session_notes: notes,
    durationMinutes: Number.isFinite(Number(durationRaw)) ? Number(durationRaw) : null,
    duration_minutes: Number.isFinite(Number(durationRaw)) ? Number(durationRaw) : null,
    prExercises: prs,
    pr_exercises: prs,
  }
}

function getCompletedDayKey(day) {
  if (day?.id) return `id:${day.id}`

  return [
    'fallback',
    String(day?.date || ''),
    String(day?.phaseId || day?.phase_id || ''),
    String(day?.week ?? day?.week_number ?? ''),
    String(day?.dayIndex ?? day?.day_index ?? ''),
    String(day?.label || day?.workout_name || ''),
  ].join('|')
}

function mergeCompletedDays(localDays = [], remoteDays = []) {
  const local = Array.isArray(localDays) ? localDays : []
  const remote = Array.isArray(remoteDays) ? remoteDays : []

  const mergedByKey = new Map()

  remote.forEach((day) => {
    mergedByKey.set(getCompletedDayKey(day), day)
  })

  local.forEach((day) => {
    const key = getCompletedDayKey(day)
    if (!mergedByKey.has(key)) {
      mergedByKey.set(key, day)
    }
  })

  const merged = [...mergedByKey.values()]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return {
    items: merged,
    changed: JSON.stringify(merged) !== JSON.stringify(local),
  }
}

function getProgramSignature(programData) {
  try {
    return JSON.stringify(programData?.phases || [])
  } catch {
    return ''
  }
}

function normalizeProgramData(payload) {
  const candidate = payload?.phases
    ? payload
    : (payload?.program?.phases ? payload.program : null)

  if (!candidate || !Array.isArray(candidate.phases) || candidate.phases.length === 0) {
    return null
  }

  const hasValidShape = candidate.phases.every((phase) => {
    if (!phase || typeof phase.id !== 'string' || !Array.isArray(phase.weeks) || phase.weeks.length === 0) {
      return false
    }

    return phase.weeks.every((week) => {
      return Number.isFinite(Number(week.weekNumber))
        && Array.isArray(week.days)
        && week.days.length > 0
    })
  })

  return hasValidShape ? candidate : null
}

function getDefaultProgressForProgram(programData) {
  const phase = programData?.phases?.[0]
  const week = phase?.weeks?.[0]
  const firstTrainDay = week?.days?.find((day) => !day?.isRest)
  const fallbackDay = week?.days?.[0]

  return {
    currentPhaseId: phase?.id || 'phase_1',
    currentWeek: Number.isFinite(Number(week?.weekNumber)) ? Number(week.weekNumber) : 1,
    currentDayIndex: Number.isFinite(Number(firstTrainDay?.dayIndex))
      ? Number(firstTrainDay.dayIndex)
      : (Number.isFinite(Number(fallbackDay?.dayIndex)) ? Number(fallbackDay.dayIndex) : 0),
  }
}

// Compare two progress positions within the current program.
// Returns -1 if a is before b, 0 if equal, 1 if after.
function compareProgressPosition(a, b, programData) {
  if (!a || !b || !programData?.phases) return 0

  const phaseOrder = new Map()
  programData.phases.forEach((phase, index) => {
    phaseOrder.set(phase.id, index)
  })

  const buildOrdinal = (progress) => {
    const phaseIdx = phaseOrder.has(progress.currentPhaseId)
      ? phaseOrder.get(progress.currentPhaseId)
      : 0
    const week = Number(progress.currentWeek) || 1
    const dayIndex = Number(progress.currentDayIndex) || 0
    // This does not need to be exact day count, just a stable ordering.
    return phaseIdx * 10000 + (week - 1) * 100 + dayIndex
  }

  const aOrd = buildOrdinal(a)
  const bOrd = buildOrdinal(b)

  if (aOrd === bOrd) return 0
  return aOrd < bOrd ? -1 : 1
}

function buildProgramLibrary(importedPrograms = []) {
  const builtIn = {
    id: BUILT_IN_PROGRAM_ID,
    name: 'Dina Workout plan',
    source: 'built_in',
    signature: getProgramSignature(defaultProgram),
    importedAt: null,
    program: defaultProgram,
  }

  const imported = (Array.isArray(importedPrograms) ? importedPrograms : [])
    .map((item, index) => {
      const normalized = normalizeProgramData(item?.program || item)
      if (!normalized) return null

      return {
        id: item?.id || `imported_${index + 1}`,
        name: String(item?.name || `Imported Plan ${index + 1}`),
        source: 'imported',
        signature: item?.signature || getProgramSignature(normalized),
        importedAt: item?.importedAt || null,
        program: normalized,
      }
    })
    .filter(Boolean)

  return [builtIn, ...imported]
}

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
  const basePayload = {
    user_id: userId,
    current_phase_id: progress.currentPhaseId,
    current_week: progress.currentWeek,
    current_day_index: progress.currentDayIndex,
    program_start: programStart || null,
    updated_at: new Date().toISOString(),
  }

  const payload = {
    ...basePayload,
    weight_unit: settings.weightUnit || 'kg',
    rest_timer_default: Number.isFinite(settings.restTimerDefault)
      ? Math.max(30, settings.restTimerDefault)
      : 120,
    dismissed_alerts: Array.isArray(settings.dismissedAlerts) ? settings.dismissedAlerts : [],
  }

  const compatibilityPayload = stripLegacyProgressFields(payload)

  try {
    if (!navigator.onLine) {
      enqueueMutation('user_progress', 'upsert', payload)
      return { offline: true }
    }

    let { error } = await supabase
      .from('user_progress')
      .upsert(payload, { onConflict: 'user_id' })

    if (error && isUserProgressColumnMismatch(error)) {
      const fallback = await supabase
        .from('user_progress')
        .upsert(compatibilityPayload, { onConflict: 'user_id' })

      if (!fallback.error) {
        return { ok: true, compatibilityMode: true }
      }

      error = fallback.error
    }

    if (error) {
      console.warn('Progress sync failed, queueing retry:', error)
      enqueueMutation(
        'user_progress',
        'upsert',
        isUserProgressColumnMismatch(error) ? compatibilityPayload : payload,
      )
      return { error, queued: true }
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

async function fetchWorkoutLogsFromSupabase(userId) {
  try {
    const { data, error } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true })

    if (error) throw error

    return (Array.isArray(data) ? data : []).map(normalizeRemoteWorkoutLog)
  } catch (err) {
    console.error('Supabase workout log fetch error:', err)
    return null
  }
}

async function fetchBodyweightLogsFromSupabase(userId) {
  try {
    const { data, error } = await supabase
      .from('bodyweight_logs')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true })

    if (error) throw error

    return (Array.isArray(data) ? data : []).map(row => ({
      date: new Date(row.date).toISOString(),
      weight: Number(row.weight)
    }))
  } catch (err) {
    console.error('Supabase bodyweight fetch error:', err)
    return null
  }
}

async function fetchProgramCustomizationsFromSupabase(userId) {
  try {
    const { data, error } = await supabase
      .from('program_customizations')
      .select('*')
      .eq('user_id', userId)

    if (error) throw error

    const result = {}
    if (Array.isArray(data)) {
      data.forEach(row => {
        result[row.original_exercise_id] = row.custom_exercise_json
      })
    }
    return result
  } catch (err) {
    console.error('Supabase customizations fetch error:', err)
    return null
  }
}

export const useWorkoutStore = create((set, get) => ({
  // Program data
  program: defaultProgram,
  programLibrary: buildProgramLibrary([]),
  activeProgramId: BUILT_IN_PROGRAM_ID,

  // Current position
  currentPhaseId: 'phase_1',
  currentWeek: 1,
  currentDayIndex: 0,

  // User data
  programStart: null,
  completedDays: [],
  bodyweightLogs: [],
  planDisplayName: 'Dina Workout plan',
  weightUnit: 'kg',
  restTimerDefault: 120,
  restTimerVibration: true,
  scheduledExercises: [],
  dismissedAlerts: [],
  programCustomizations: {}, // Map of { [originalExerciseId]: overriddenExerciseObject }
  isSaved: true,

  milestoneToastQueue: [],
  
  // Custom Template Mode
  activeCustomTemplate: null, // Holds the currently running custom template

  // Sync status: 'saved' | 'syncing' | 'offline' | 'error'
  syncStatus: 'saved',

  // Central helper to keep syncStatus in sync with connectivity and queue state
  recomputeSyncStatus: ({ cleared = false, remoteOk = true } = {}) => {
    const pending = getSyncQueue().length

    if (!navigator.onLine) {
      // When offline we always surface offline, but still respect queued writes.
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
    try {
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
        fetchProgramCustomizationsFromSupabase(session.user.id)
      ])

      const statePatch = {}

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

        // Only apply remote progress if it is a valid position AND
        // it is ahead of or equal to the local position in the program.
        // This prevents a stale cloud value from pulling the user back
        // after they manually jump to a later day.
        if (isValidProgress(activeProgram, cloudProgress)) {
          const cmp = compareProgressPosition(cloudProgress, localProgress, activeProgram)
          if (cmp >= 0) {
            storage.saveProgress(cloudProgress)
            statePatch.currentPhaseId = cloudProgress.currentPhaseId
            statePatch.currentWeek = cloudProgress.currentWeek
            statePatch.currentDayIndex = cloudProgress.currentDayIndex
          }
        }

        if (remoteProgress.program_start) {
          storage.saveProgramStart(remoteProgress.program_start)
          statePatch.programStart = remoteProgress.program_start
        }

        if (remoteProgress.weight_unit) {
          storage.saveWeightUnit(remoteProgress.weight_unit)
          statePatch.weightUnit = remoteProgress.weight_unit
        }

        if (Number.isFinite(Number(remoteProgress.rest_timer_default))) {
          const parsedRestTimer = Number(remoteProgress.rest_timer_default)
          storage.saveRestTimerDefault(parsedRestTimer)
          statePatch.restTimerDefault = parsedRestTimer
        }

        if (Array.isArray(remoteProgress.dismissed_alerts)) {
          storage.saveDismissedAlerts(remoteProgress.dismissed_alerts)
          statePatch.dismissedAlerts = remoteProgress.dismissed_alerts
        }
      } else if (remoteWorkouts && remoteWorkouts.length > 0) {
        const lastWorkout = remoteWorkouts[remoteWorkouts.length - 1]
        if (lastWorkout.phaseId) {
          const nextDay = getNextDay(activeProgram, lastWorkout.phaseId, lastWorkout.week, lastWorkout.dayIndex)
          if (nextDay && isValidProgress(activeProgram, { currentPhaseId: nextDay.phaseId, currentWeek: nextDay.week, currentDayIndex: nextDay.dayIndex })) {
            const cloudProgress = {
              currentPhaseId: nextDay.phaseId,
              currentWeek: nextDay.week,
              currentDayIndex: nextDay.dayIndex
            }
            storage.saveProgress(cloudProgress)
            statePatch.currentPhaseId = cloudProgress.currentPhaseId
            statePatch.currentWeek = cloudProgress.currentWeek
            statePatch.currentDayIndex = cloudProgress.currentDayIndex
          }
        }
      }

      let hasRemoteError = false

      if (remoteWorkouts === null) {
        hasRemoteError = true
      } else {
        const merged = mergeCompletedDays(get().completedDays, remoteWorkouts)
        if (merged.changed) {
          storage.saveCompletedDays(merged.items)
          statePatch.completedDays = merged.items
        }
      }
      
      if (remoteBodyweight !== null) {
        if (remoteBodyweight.length > 0) {
          storage.saveBodyweightLogs(remoteBodyweight)
          statePatch.bodyweightLogs = remoteBodyweight
        }
      }

      if (remoteCustomizations !== null) {
        const localC = get().programCustomizations
        const mergedC = { ...localC, ...remoteCustomizations }
        storage.saveProgramCustomizations(mergedC)
        statePatch.programCustomizations = mergedC
      }

      if (Object.keys(statePatch).length > 0) {
        set(statePatch)
      }

      set({ syncStatus: hasRemoteError ? 'error' : 'saved' })
      return {
        ok: !hasRemoteError,
        offline: false,
        pulledWorkouts: Array.isArray(remoteWorkouts) ? remoteWorkouts.length : 0,
      }
    } catch (err) {
      console.error('Failed to sync from Supabase:', err)
      set({ syncStatus: navigator.onLine ? 'error' : 'offline' })
      return { ok: false, offline: !navigator.onLine, error: err }
    }
  },

  // Initialize store from localStorage, then Supabase if authenticated
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

    set({
      program: activeProgram,
      programLibrary,
      activeProgramId: activeProgramEntry.id,
    })

    // Load from localStorage first (fast)
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
      // Do NOT save to storage here, to prevent overwriting cloud sync asynchronously
      set(fallbackProgress)
    }

    if (savedCompletedDays) {
      set({ completedDays: savedCompletedDays })
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

    set({
      weightUnit: savedWeightUnit,
      restTimerDefault: savedRestTimerDefault,
      restTimerVibration: savedRestTimerVibration,
      dismissedAlerts: savedDismissedAlerts,
    })

    // Then fetch latest cloud changes so other-device updates appear locally.
    await get().syncFromCloud({ setSyncing: true })

    // Auto-sync when user returns to the tab/app (mobile browser background resume)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        get().syncFromCloud({ setSyncing: false })
      }
    }
    document.removeEventListener('visibilitychange', onVisibilityChange)
    document.addEventListener('visibilitychange', onVisibilityChange)

    // Auto-sync when device comes back online
    const onOnline = () => {
      get().syncFromCloud({ setSyncing: true })
    }
    window.removeEventListener('online', onOnline)
    window.addEventListener('online', onOnline)
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
    const workoutLabel = metadata.workoutLabel || completedDays[existingIndex].label || completedDays[existingIndex].workout_name || 'Workout'

    const updatedDay = {
      ...completedDays[existingIndex],
      label: workoutLabel,
      workout_name: workoutLabel,
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
        week_number: updatedDay.week,
        day_index: updatedDay.dayIndex,
        day_label: updatedDay.label,
        phase_id: updatedDay.phaseId,
      }
      
      const { error } = await supabase
        .from('workout_logs')
        .update({
          workout_name: logPayload.workout_name,
          exercises: logPayload.exercises,
          notes: logPayload.notes,
          duration_minutes: logPayload.duration_minutes,
          pr_exercises: logPayload.pr_exercises,
        })
        .match({ user_id: session.user.id, date: updatedDay.date })
        
      if (error) {
        enqueueMutation('workout_logs', 'update', logPayload, {
          user_id: session.user.id,
          date: updatedDay.date,
        })
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
    const workoutLabel = metadata.workoutLabel || currentDay.label

    const completedDay = {
      date: new Date().toISOString(),
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
        week_number: completedDay.week,
        day_index: completedDay.dayIndex,
        day_label: completedDay.label,
        phase_id: completedDay.phaseId,
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

      const state = get()
      const res = await syncProgressToSupabase(session.user.id, newProgress, state.programStart, {
        weightUnit: state.weightUnit,
        restTimerDefault: state.restTimerDefault,
        dismissedAlerts: state.dismissedAlerts,
      })
      set({ syncStatus: res.offline ? 'offline' : (res.error ? 'error' : 'saved') })
    }

    if (metadata.clearScheduledForCurrentDay !== false) {
      get().clearScheduledExercisesForDay(currentPhaseId, currentWeek, currentDayIndex)
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
  logBodyweight: async (weight) => {
    const { bodyweightLogs } = get()
    const today = new Date().toISOString()
    const todaySimple = today.split('T')[0]
    
    // Check if entry for today already exists, if so update it
    const existingIndex = bodyweightLogs.findIndex(log => log.date.startsWith(todaySimple))
    
    let updated = [...bodyweightLogs]
    if (existingIndex >= 0) {
      updated[existingIndex].weight = weight
    } else {
      updated.push({ date: today, weight })
    }

    // Keep chronological
    updated.sort((a, b) => new Date(a.date) - new Date(b.date))
    storage.saveBodyweightLogs(updated)
    set({ bodyweightLogs: updated })

    // Sync to Supabase
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

  // Remove Bodyweight Log
  removeBodyweightLog: async (index) => {
    const { bodyweightLogs } = get()
    const target = bodyweightLogs[index]
    if (!target) return

    const updated = bodyweightLogs.filter((_, i) => i !== index)
    storage.saveBodyweightLogs(updated)
    set({ bodyweightLogs: updated })

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

  // Program Customizations
  addProgramCustomization: async (originalExId, newEx) => {
    const { programCustomizations } = get()
    const updated = {
      ...programCustomizations,
      [originalExId]: { ...newEx, id: originalExId } // Ensure the customized block retains the slot ID
    }
    storage.saveProgramCustomizations(updated)
    set({ programCustomizations: updated })

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
      activeCustomTemplate: null,
      planDisplayName: 'Dina Workout plan',
      weightUnit: 'kg',
      restTimerDefault: 120,
      restTimerVibration: true,
      scheduledExercises: [],
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
