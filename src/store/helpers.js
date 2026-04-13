import { storage } from '../utils/storage'
import { getNextDay } from '../utils/progressTracker'
import { supabase } from '../lib/supabaseClient'
import { clearSyncQueue, enqueueMutation, getSyncQueue } from '../utils/syncQueue'
import { createWorkoutLogId, getWorkoutLegacySlotKey, toWorkoutDateOnly } from '../utils/workoutLogIdentity'
import defaultProgram from '../data/program.json'

export const BUILT_IN_PROGRAM_ID = 'built_in_default_program'
export const LEGACY_PROGRESS_OPTIONAL_FIELDS = ['weight_unit', 'rest_timer_default', 'dismissed_alerts']
export const CLOUD_SYNC_ENABLED = false

export let cloudSyncPromise = null
export function setCloudSyncPromise(promise) {
  cloudSyncPromise = promise
}

export function isUserProgressColumnMismatch(error) {
  const message = String(error?.message || '')
  return error?.code === 'PGRST204' && message.includes('user_progress')
}

export function isWorkoutLogsDeletedColumnMismatch(error) {
  const message = String(error?.message || '')
  return error?.code === 'PGRST204'
    && message.includes('workout_logs')
    && message.includes('deleted_at')
}

export function stripLegacyProgressFields(payload) {
  if (!payload || typeof payload !== 'object') return payload
  const sanitized = { ...payload }
  LEGACY_PROGRESS_OPTIONAL_FIELDS.forEach((field) => {
    delete sanitized[field]
  })
  return sanitized
}

export function normalizeRemoteDate(value) {
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

export function normalizeNullableTimestamp(value) {
  if (!value) return null
  return normalizeRemoteDate(value)
}

export function normalizeWorkoutLogEntry(row, { ensureId = false } = {}) {
  if (!row || typeof row !== 'object') return null

  const weekRaw = row?.week_number ?? row?.week
  const dayIndexRaw = row?.day_index ?? row?.dayIndex
  const durationRaw = row?.duration_minutes ?? row?.durationMinutes
  const notes = row?.notes ?? row?.session_notes ?? row?.sessionNotes ?? ''
  const label = row?.workout_name || row?.day_label || row?.label || 'Workout'
  const prs = Array.isArray(row?.pr_exercises)
    ? row.pr_exercises
    : (Array.isArray(row?.prExercises) ? row.prExercises : [])

  const normalizedDate = normalizeRemoteDate(row?.date)
  const normalizedUpdatedAt = normalizeRemoteDate(row?.updated_at || row?.updatedAt || row?.created_at || normalizedDate)
  const normalizedDeletedAt = normalizeNullableTimestamp(row?.deleted_at || row?.deletedAt)
  const normalizedId = row?.id || (ensureId ? createWorkoutLogId() : undefined)

  return {
    id: normalizedId,
    date: normalizedDate,
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
    updatedAt: normalizedUpdatedAt,
    updated_at: normalizedUpdatedAt,
    deletedAt: normalizedDeletedAt,
    deleted_at: normalizedDeletedAt,
  }
}

export function normalizeLocalWorkoutLogs(days = []) {
  const local = Array.isArray(days) ? days : []

  const normalized = local
    .map((day) => normalizeWorkoutLogEntry(day, { ensureId: true }))
    .filter(Boolean)
    .filter((day) => !day.deletedAt)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return {
    items: normalized,
    changed: JSON.stringify(normalized) !== JSON.stringify(local),
  }
}

export function getUpdatedTimestamp(entry) {
  const value = entry?.updatedAt || entry?.updated_at || entry?.date
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

export function resolveWorkoutVersion(currentEntry, incomingEntry, { preferIncomingOnTie = false } = {}) {
  if (!currentEntry) return incomingEntry
  if (!incomingEntry) return currentEntry

  const currentTs = getUpdatedTimestamp(currentEntry)
  const incomingTs = getUpdatedTimestamp(incomingEntry)

  if (incomingTs === currentTs) {
    return preferIncomingOnTie ? incomingEntry : currentEntry
  }

  return incomingTs > currentTs ? incomingEntry : currentEntry
}

export function getBodyweightKey(entry) {
  return String(entry?.date || '').split('T')[0]
}

export function hasPendingMutation(queue, table) {
  return (Array.isArray(queue) ? queue : []).some((job) => job?.table === table)
}

export function hasPendingDeleteAll(queue, table, userId) {
  if (!userId) return false

  return (Array.isArray(queue) ? queue : []).some((job) => {
    if (job?.table !== table || job?.action !== 'delete') return false
    const match = job?.match
    if (!match || typeof match !== 'object') return false
    return match.user_id === userId && Object.keys(match).length === 1
  })
}

export function getPendingWorkoutOverlays(queue = []) {
  const jobs = Array.isArray(queue) ? queue : []
  const nowIso = new Date().toISOString()

  return jobs
    .filter((job) => job?.table === 'workout_logs')
    .map((job) => {
      if (job?.action === 'upsert' && job?.payload && typeof job.payload === 'object') {
        return normalizeWorkoutLogEntry(job.payload, { ensureId: true })
      }

      if (job?.action === 'update' && job?.match?.id && job?.payload && typeof job.payload === 'object') {
        return normalizeWorkoutLogEntry({
          ...job.payload,
          id: job.match.id,
        }, { ensureId: true })
      }

      if (job?.action === 'update' && job?.match && typeof job.match === 'object') {
        const date = job.match.date || job.payload?.date
        const phaseId = job.match.phase_id || job.payload?.phase_id
        const weekNumber = job.match.week_number ?? job.payload?.week_number
        const dayIndex = job.match.day_index ?? job.payload?.day_index

        if (date && phaseId && Number.isFinite(Number(weekNumber)) && Number.isFinite(Number(dayIndex))) {
          return normalizeWorkoutLogEntry({
            ...job.payload,
            date,
            phase_id: phaseId,
            week_number: Number(weekNumber),
            day_index: Number(dayIndex),
            updated_at: job.payload?.updated_at || nowIso,
            deleted_at: job.payload?.deleted_at || null,
          }, { ensureId: true })
        }
      }

      if (job?.action === 'delete' && job?.match?.id) {
        return normalizeWorkoutLogEntry({
          id: job.match.id,
          date: nowIso,
          updated_at: nowIso,
          deleted_at: nowIso,
        }, { ensureId: true })
      }

      return null
    })
    .filter(Boolean)
}

export function mergeCompletedDays(localDays = [], remoteDays = [], { preferLocal = false } = {}) {
  const local = (Array.isArray(localDays) ? localDays : [])
    .map((day) => normalizeWorkoutLogEntry(day, { ensureId: true }))
    .filter(Boolean)

  const remote = (Array.isArray(remoteDays) ? remoteDays : [])
    .map((day) => normalizeWorkoutLogEntry(day, { ensureId: false }))
    .filter(Boolean)

  const mergedByIdentity = new Map()
  const legacyIdentityByKey = new Map()

  const registerEntry = (entry, source) => {
    const legacyKey = getWorkoutLegacySlotKey(entry)
    const identityKey = entry.id ? `id:${entry.id}` : `legacy:${legacyKey}`
    const existingKey = mergedByIdentity.has(identityKey)
      ? identityKey
      : legacyIdentityByKey.get(legacyKey)

    if (!existingKey) {
      const withId = entry.id ? entry : { ...entry, id: createWorkoutLogId() }
      const normalizedIdentityKey = `id:${withId.id}`
      mergedByIdentity.set(normalizedIdentityKey, withId)
      legacyIdentityByKey.set(legacyKey, normalizedIdentityKey)
      return
    }

    const existing = mergedByIdentity.get(existingKey)
    const incoming = existing?.id
      ? { ...entry, id: existing.id }
      : entry

    const winner = resolveWorkoutVersion(existing, incoming, {
      preferIncomingOnTie: preferLocal && source === 'local',
    })

    const withId = winner.id ? winner : { ...winner, id: existing?.id || createWorkoutLogId() }
    const winnerKey = `id:${withId.id}`

    if (winnerKey !== existingKey) {
      mergedByIdentity.delete(existingKey)
    }

    mergedByIdentity.set(winnerKey, withId)
    legacyIdentityByKey.set(legacyKey, winnerKey)
  }

  remote.forEach((entry) => registerEntry(entry, 'remote'))
  local.forEach((entry) => registerEntry(entry, 'local'))

  const merged = [...mergedByIdentity.values()]
    .filter((entry) => !entry.deletedAt)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const localComparable = local
    .filter((entry) => !entry.deletedAt)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return {
    items: merged,
    changed: JSON.stringify(merged) !== JSON.stringify(localComparable),
  }
}

export function mergeBodyweightLogs(localLogs = [], remoteLogs = []) {
  const local = Array.isArray(localLogs) ? localLogs : []
  const remote = Array.isArray(remoteLogs) ? remoteLogs : []

  const mergedByDate = new Map()

  remote.forEach((entry) => {
    mergedByDate.set(getBodyweightKey(entry), entry)
  })

  local.forEach((entry) => {
    const key = getBodyweightKey(entry)
    if (!mergedByDate.has(key)) {
      mergedByDate.set(key, entry)
    }
  })

  const merged = [...mergedByDate.values()]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return {
    items: merged,
    changed: JSON.stringify(merged) !== JSON.stringify(local),
  }
}

export function mergeProgramCustomizations(localCustomizations = {}, remoteCustomizations = {}) {
  const local = localCustomizations && typeof localCustomizations === 'object'
    ? localCustomizations
    : {}
  const remote = remoteCustomizations && typeof remoteCustomizations === 'object'
    ? remoteCustomizations
    : {}

  const merged = { ...remote }

  Object.entries(local).forEach(([exerciseId, customization]) => {
    if (!(exerciseId in merged)) {
      merged[exerciseId] = customization
    }
  })

  return {
    items: merged,
    changed: JSON.stringify(merged) !== JSON.stringify(local),
  }
}

export function getProgramSignature(programData) {
  try {
    return JSON.stringify(programData?.phases || [])
  } catch {
    return ''
  }
}

export function normalizeProgramData(payload) {
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

export function getDefaultProgressForProgram(programData) {
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

export function compareProgressPosition(a, b, programData) {
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
    return phaseIdx * 10000 + (week - 1) * 100 + dayIndex
  }

  const aOrd = buildOrdinal(a)
  const bOrd = buildOrdinal(b)

  if (aOrd === bOrd) return 0
  return aOrd < bOrd ? -1 : 1
}

export function buildProgramLibrary(importedPrograms = []) {
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

export function isValidProgress(data, progress) {
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

export function triggerAutoDriveBackup() {
  const autoDriveBackup = localStorage.getItem('fitty_auto_drive_backup') === 'true'
  if (!autoDriveBackup) return

  import('../lib/googleDrive')
    .then(({ uploadAutomaticBackupToDrive, uploadBackupToDrive, signInWithGoogle }) => {
      signInWithGoogle()
        .then((token) => {
          if (typeof uploadAutomaticBackupToDrive === 'function') {
            return uploadAutomaticBackupToDrive(storage.exportData(), token)
          }

          return uploadBackupToDrive(storage.exportData(), token, { automatic: true })
        })
        .catch((error) => {
          console.error('Auto Google Drive backup failed:', error)
        })
    })
    .catch((error) => {
      console.error('Failed to load Google Drive backup module:', error)
    })
}

export async function syncProgressToSupabase(userId, progress, programStart, settings = {}) {
  if (!CLOUD_SYNC_ENABLED) {
    return { ok: true, disabled: true }
  }

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

export async function fetchProgressFromSupabase(userId) {
  try {
    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  } catch (err) {
    console.error('Supabase fetch error:', err)
    return null
  }
}

export async function fetchWorkoutLogsFromSupabase(userId) {
  try {
    let { data, error } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('date', { ascending: true })

    if (error && isWorkoutLogsDeletedColumnMismatch(error)) {
      const fallback = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true })

      data = fallback.data
      error = fallback.error
    }

    if (error) throw error

    return (Array.isArray(data) ? data : [])
      .map((row) => normalizeWorkoutLogEntry(row, { ensureId: false }))
      .filter(Boolean)
  } catch (err) {
    console.error('Supabase workout log fetch error:', err)
    return null
  }
}

export function buildWorkoutLogPayload(userId, day) {
  const normalized = normalizeWorkoutLogEntry(day, { ensureId: true })
  const updatedAt = normalized.updatedAt || normalizeRemoteDate(new Date().toISOString())

  return {
    id: normalized.id,
    user_id: userId,
    date: toWorkoutDateOnly(normalized.date),
    phase_id: normalized.phaseId || null,
    week_number: normalized.week,
    day_index: normalized.dayIndex,
    day_label: normalized.label || null,
    workout_name: normalized.label || null,
    exercises: Array.isArray(normalized.exercises) ? normalized.exercises : [],
    notes: normalized.sessionNotes || normalized.session_notes || null,
    duration_minutes: normalized.durationMinutes,
    pr_exercises: Array.isArray(normalized.prExercises) ? normalized.prExercises : [],
    updated_at: updatedAt,
    deleted_at: normalized.deletedAt || null,
  }
}

export async function upsertWorkoutLogToSupabase(payload) {
  if (!CLOUD_SYNC_ENABLED) {
    return { ok: true, disabled: true }
  }

  try {
    if (!navigator.onLine) {
      enqueueMutation('workout_logs', 'upsert', payload)
      return { offline: true }
    }

    const { error } = await supabase
      .from('workout_logs')
      .upsert(payload, { onConflict: 'id' })

    if (error) {
      enqueueMutation('workout_logs', 'upsert', payload)
      return { error, queued: true }
    }

    return { ok: true }
  } catch (err) {
    console.error('Workout log upsert failed, queueing retry:', err)
    enqueueMutation('workout_logs', 'upsert', payload)
    return { error: err, queued: true }
  }
}

export async function fetchBodyweightLogsFromSupabase(userId) {
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

export async function fetchProgramCustomizationsFromSupabase(userId) {
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
