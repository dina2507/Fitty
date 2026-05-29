const STORAGE_KEYS = {
  PROGRESS: 'ppl_tracker_progress',
  COMPLETED_DAYS: 'ppl_tracker_completed_days',
  PROGRAM_START: 'ppl_tracker_program_start',
  BODYWEIGHT_LOGS: 'ppl_tracker_bodyweight_logs',
  PLAN_DISPLAY_NAME: 'ppl_tracker_plan_display_name',
  IMPORTED_PROGRAMS: 'ppl_tracker_imported_programs',
  ACTIVE_PROGRAM_ID: 'ppl_tracker_active_program_id',
  PROGRAM_CUSTOMIZATIONS: 'ppl_tracker_program_customizations',
  SCHEDULED_EXERCISES: 'ppl_tracker_scheduled_exercises',
  WEIGHT_UNIT: 'ppl_tracker_weight_unit',
  REST_TIMER_DEFAULT: 'ppl_tracker_rest_timer_default',
  REST_TIMER_VIBRATION: 'ppl_tracker_rest_timer_vibration',
  DISMISSED_ALERTS: 'ppl_tracker_dismissed_alerts',
  EXERCISE_GOALS: 'ppl_tracker_exercise_goals',
  CUSTOM_EXERCISES: 'ppl_tracker_custom_exercises',
  // v2 — plan-centric restructure
  USER_PLANS: 'ppl_tracker_user_plans',
  ACTIVE_PLAN_ID: 'ppl_tracker_active_plan_id',
  ACTIVE_PLAN_DAY_ID: 'ppl_tracker_active_plan_day_id',
  SCHEMA_VERSION: 'ppl_tracker_schema_version',
}

export const SCHEMA_VERSION = 'v2'

// Safety keys live OUTSIDE STORAGE_KEYS so clearAll()/reset never deletes them —
// they are the recovery net for accidental data loss.
const SAFETY_KEYS = {
  HISTORY_BACKUP: 'ppl_tracker_history_backup',     // last good copy of completed_days before a shrink/clear
  RECOVERY_SNAPSHOT: 'ppl_tracker_recovery_snapshot', // full export snapshot before a reset/replace
}

function isQuotaError(e) {
  return (
    e instanceof DOMException &&
    (e.code === 22 ||
      e.code === 1014 ||
      e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch (e) {
    if (isQuotaError(e)) {
      console.error(`LocalStorage quota exceeded while saving key "${key}".`)
      window.dispatchEvent(new CustomEvent('fitty:storage-quota-exceeded', { detail: { key } }))
    } else {
      console.error(`Error saving key "${key}" to LocalStorage:`, e)
    }
  }
}

export const storage = {
  getProgress() {
    const data = localStorage.getItem(STORAGE_KEYS.PROGRESS)
    return data ? JSON.parse(data) : null
  },

  saveProgress(progress) {
    // Safeguard: prevent overwriting with null/empty if we already have progress
    if (!progress && this.getProgress()) {
      console.warn('Safeguard: Blocked attempt to overwrite existing progress with empty value.')
      return
    }
    safeSetItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress))
  },

  getCompletedDays() {
    const data = localStorage.getItem(STORAGE_KEYS.COMPLETED_DAYS)
    return data ? JSON.parse(data) : []
  },

  saveCompletedDays(days) {
    const current = this.getCompletedDays()
    const next = Array.isArray(days) ? days : []

    // Hard safeguard: never replace existing history with an empty list.
    if (next.length === 0 && current.length > 0) {
      console.warn('Safeguard: Blocked attempt to overwrite existing workout history with an empty list.')
      // Make sure a backup of the current history exists in case something is wrong.
      this.backupHistory(current, 'blocked-empty-write')
      return
    }

    // Safety net: if the new list is SHORTER than what we have (a delete, a bad
    // merge, etc.), snapshot the current history first so it can be recovered.
    if (current.length > 0 && next.length < current.length) {
      this.backupHistory(current, 'shrink')
    }

    safeSetItem(STORAGE_KEYS.COMPLETED_DAYS, JSON.stringify(next))
  },

  // ── Recovery net ──
  backupHistory(days, reason = 'auto') {
    const list = Array.isArray(days) ? days : this.getCompletedDays()
    if (!list.length) return
    safeSetItem(SAFETY_KEYS.HISTORY_BACKUP, JSON.stringify({ savedAt: new Date().toISOString(), reason, days: list }))
  },

  getHistoryBackup() {
    const raw = localStorage.getItem(SAFETY_KEYS.HISTORY_BACKUP)
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
  },

  // Full-export snapshot taken before a destructive reset/replace. Only overwrites
  // an existing snapshot when the current data actually has workouts to protect.
  snapshotForRecovery() {
    try {
      const data = this.exportData()
      if (!Array.isArray(data.completedDays) || data.completedDays.length === 0) return
      safeSetItem(SAFETY_KEYS.RECOVERY_SNAPSHOT, JSON.stringify({ savedAt: new Date().toISOString(), data }))
    } catch (e) {
      console.error('Failed to snapshot for recovery:', e)
    }
  },

  getRecoverySnapshot() {
    const raw = localStorage.getItem(SAFETY_KEYS.RECOVERY_SNAPSHOT)
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
  },

  // Restore the full pre-reset snapshot. Returns true on success.
  restoreFromRecovery() {
    const snap = this.getRecoverySnapshot()
    if (!snap?.data) return false
    this.importData(snap.data, { replaceExisting: true })
    return true
  },

  getProgramStart() {
    return localStorage.getItem(STORAGE_KEYS.PROGRAM_START)
  },

  saveProgramStart(date) {
    safeSetItem(STORAGE_KEYS.PROGRAM_START, date || '')
  },

  getBodyweightLogs() {
    const data = localStorage.getItem(STORAGE_KEYS.BODYWEIGHT_LOGS)
    return data ? JSON.parse(data) : []
  },

  saveBodyweightLogs(logs) {
    safeSetItem(STORAGE_KEYS.BODYWEIGHT_LOGS, JSON.stringify(logs))
  },

  getPlanDisplayName() {
    const value = localStorage.getItem(STORAGE_KEYS.PLAN_DISPLAY_NAME)
    return value?.trim() || 'Dina Workout plan'
  },

  savePlanDisplayName(name) {
    const normalized = String(name || '').trim() || 'Dina Workout plan'
    safeSetItem(STORAGE_KEYS.PLAN_DISPLAY_NAME, normalized)
  },

  getImportedPrograms() {
    const data = localStorage.getItem(STORAGE_KEYS.IMPORTED_PROGRAMS)
    if (!data) return []
    try {
      const parsed = JSON.parse(data)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  },

  saveImportedPrograms(programs) {
    safeSetItem(
      STORAGE_KEYS.IMPORTED_PROGRAMS,
      JSON.stringify(Array.isArray(programs) ? programs : []),
    )
  },

  getActiveProgramId() {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_PROGRAM_ID) || 'built_in_default_program'
  },

  saveActiveProgramId(programId) {
    safeSetItem(STORAGE_KEYS.ACTIVE_PROGRAM_ID, String(programId || 'built_in_default_program'))
  },

  getProgramCustomizations() {
    const data = localStorage.getItem(STORAGE_KEYS.PROGRAM_CUSTOMIZATIONS)
    return data ? JSON.parse(data) : {}
  },

  saveProgramCustomizations(customizations) {
    safeSetItem(STORAGE_KEYS.PROGRAM_CUSTOMIZATIONS, JSON.stringify(customizations))
  },

  getScheduledExercises() {
    const data = localStorage.getItem(STORAGE_KEYS.SCHEDULED_EXERCISES)
    if (!data) return []
    try {
      const parsed = JSON.parse(data)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  },

  saveScheduledExercises(items) {
    safeSetItem(
      STORAGE_KEYS.SCHEDULED_EXERCISES,
      JSON.stringify(Array.isArray(items) ? items : []),
    )
  },

  getWeightUnit() {
    return localStorage.getItem(STORAGE_KEYS.WEIGHT_UNIT) || 'kg'
  },

  saveWeightUnit(unit) {
    safeSetItem(STORAGE_KEYS.WEIGHT_UNIT, unit)
  },

  getRestTimerDefault() {
    const value = localStorage.getItem(STORAGE_KEYS.REST_TIMER_DEFAULT)
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 120
  },

  saveRestTimerDefault(seconds) {
    safeSetItem(STORAGE_KEYS.REST_TIMER_DEFAULT, String(seconds))
  },

  getRestTimerVibration() {
    const value = localStorage.getItem(STORAGE_KEYS.REST_TIMER_VIBRATION)
    if (value === null) return true
    return value === 'true'
  },

  saveRestTimerVibration(enabled) {
    safeSetItem(STORAGE_KEYS.REST_TIMER_VIBRATION, String(Boolean(enabled)))
  },

  getDismissedAlerts() {
    const value = localStorage.getItem(STORAGE_KEYS.DISMISSED_ALERTS)
    if (!value) return []
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  },

  saveDismissedAlerts(alertIds) {
    safeSetItem(STORAGE_KEYS.DISMISSED_ALERTS, JSON.stringify(Array.isArray(alertIds) ? alertIds : []))
  },

  getExerciseGoals() {
    const value = localStorage.getItem(STORAGE_KEYS.EXERCISE_GOALS)
    if (!value) return []
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  },

  saveExerciseGoals(goals) {
    safeSetItem(STORAGE_KEYS.EXERCISE_GOALS, JSON.stringify(Array.isArray(goals) ? goals : []))
  },

  getCustomExercises() {
    const value = localStorage.getItem(STORAGE_KEYS.CUSTOM_EXERCISES)
    if (!value) return []
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  },

  saveCustomExercises(exercises) {
    safeSetItem(STORAGE_KEYS.CUSTOM_EXERCISES, JSON.stringify(Array.isArray(exercises) ? exercises : []))
  },

  // ── v2: user-built simple plans ──
  getUserPlans() {
    const data = localStorage.getItem(STORAGE_KEYS.USER_PLANS)
    if (!data) return []
    try {
      const parsed = JSON.parse(data)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  },

  saveUserPlans(plans) {
    safeSetItem(STORAGE_KEYS.USER_PLANS, JSON.stringify(Array.isArray(plans) ? plans : []))
  },

  getActivePlanId() {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_PLAN_ID) || null
  },

  saveActivePlanId(planId) {
    if (!planId) {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_PLAN_ID)
      return
    }
    safeSetItem(STORAGE_KEYS.ACTIVE_PLAN_ID, String(planId))
  },

  getActivePlanDayId() {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_PLAN_DAY_ID) || null
  },

  saveActivePlanDayId(dayId) {
    if (!dayId) {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_PLAN_DAY_ID)
      return
    }
    safeSetItem(STORAGE_KEYS.ACTIVE_PLAN_DAY_ID, String(dayId))
  },

  getSchemaVersion() {
    return localStorage.getItem(STORAGE_KEYS.SCHEMA_VERSION) || null
  },

  saveSchemaVersion(version) {
    safeSetItem(STORAGE_KEYS.SCHEMA_VERSION, String(version || ''))
  },

  clearAll() {
    // Always capture a recovery snapshot before wiping, then preserve safety keys.
    this.snapshotForRecovery()
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key))
  },

  exportData() {
    return {
      progress: this.getProgress(),
      completedDays: this.getCompletedDays(),
      programStart: this.getProgramStart(),
      bodyweightLogs: this.getBodyweightLogs(),
      planDisplayName: this.getPlanDisplayName(),
      importedPrograms: this.getImportedPrograms(),
      activeProgramId: this.getActiveProgramId(),
      programCustomizations: this.getProgramCustomizations(),
      scheduledExercises: this.getScheduledExercises(),
      weightUnit: this.getWeightUnit(),
      restTimerDefault: this.getRestTimerDefault(),
      restTimerVibration: this.getRestTimerVibration(),
      dismissedAlerts: this.getDismissedAlerts(),
      exerciseGoals: this.getExerciseGoals(),
      customExercises: this.getCustomExercises(),
      userPlans: this.getUserPlans(),
      activePlanId: this.getActivePlanId(),
      activePlanDayId: this.getActivePlanDayId(),
    }
  },

  importData(data, options = {}) {
    if (!data || typeof data !== 'object') return

    const { replaceExisting = false } = options
    if (replaceExisting) {
      this.clearAll()
    }

    if ('progress' in data) this.saveProgress(data.progress || null)
    if ('completedDays' in data) this.saveCompletedDays(Array.isArray(data.completedDays) ? data.completedDays : [])
    if ('programStart' in data) this.saveProgramStart(data.programStart || '')
    if ('bodyweightLogs' in data) this.saveBodyweightLogs(Array.isArray(data.bodyweightLogs) ? data.bodyweightLogs : [])
    if ('planDisplayName' in data) this.savePlanDisplayName(data.planDisplayName || 'Dina Workout plan')
    if ('importedPrograms' in data) this.saveImportedPrograms(Array.isArray(data.importedPrograms) ? data.importedPrograms : [])
    if ('activeProgramId' in data) this.saveActiveProgramId(data.activeProgramId || 'built_in_default_program')
    if ('programCustomizations' in data) this.saveProgramCustomizations(data.programCustomizations && typeof data.programCustomizations === 'object' ? data.programCustomizations : {})
    if ('scheduledExercises' in data) this.saveScheduledExercises(Array.isArray(data.scheduledExercises) ? data.scheduledExercises : [])
    if ('weightUnit' in data) this.saveWeightUnit(data.weightUnit || 'kg')
    if ('restTimerDefault' in data) this.saveRestTimerDefault(data.restTimerDefault)
    if ('restTimerVibration' in data && typeof data.restTimerVibration === 'boolean') this.saveRestTimerVibration(data.restTimerVibration)
    if ('dismissedAlerts' in data) this.saveDismissedAlerts(Array.isArray(data.dismissedAlerts) ? data.dismissedAlerts : [])
    if ('exerciseGoals' in data) this.saveExerciseGoals(Array.isArray(data.exerciseGoals) ? data.exerciseGoals : [])
    if ('customExercises' in data) this.saveCustomExercises(Array.isArray(data.customExercises) ? data.customExercises : [])
    if ('userPlans' in data) this.saveUserPlans(Array.isArray(data.userPlans) ? data.userPlans : [])
    if ('activePlanId' in data) this.saveActivePlanId(data.activePlanId || null)
    if ('activePlanDayId' in data) this.saveActivePlanDayId(data.activePlanDayId || null)
  }
}

export default storage
