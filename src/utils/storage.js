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
}

export const storage = {
  getProgress() {
    const data = localStorage.getItem(STORAGE_KEYS.PROGRESS)
    return data ? JSON.parse(data) : null
  },

  saveProgress(progress) {
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress))
  },

  getCompletedDays() {
    const data = localStorage.getItem(STORAGE_KEYS.COMPLETED_DAYS)
    return data ? JSON.parse(data) : []
  },

  saveCompletedDays(days) {
    localStorage.setItem(STORAGE_KEYS.COMPLETED_DAYS, JSON.stringify(days))
  },

  getProgramStart() {
    return localStorage.getItem(STORAGE_KEYS.PROGRAM_START)
  },

  saveProgramStart(date) {
    localStorage.setItem(STORAGE_KEYS.PROGRAM_START, date)
  },

  getBodyweightLogs() {
    const data = localStorage.getItem(STORAGE_KEYS.BODYWEIGHT_LOGS)
    return data ? JSON.parse(data) : []
  },

  saveBodyweightLogs(logs) {
    localStorage.setItem(STORAGE_KEYS.BODYWEIGHT_LOGS, JSON.stringify(logs))
  },

  getPlanDisplayName() {
    const value = localStorage.getItem(STORAGE_KEYS.PLAN_DISPLAY_NAME)
    return value?.trim() || 'Dina Workout plan'
  },

  savePlanDisplayName(name) {
    const normalized = String(name || '').trim() || 'Dina Workout plan'
    localStorage.setItem(STORAGE_KEYS.PLAN_DISPLAY_NAME, normalized)
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
    localStorage.setItem(
      STORAGE_KEYS.IMPORTED_PROGRAMS,
      JSON.stringify(Array.isArray(programs) ? programs : []),
    )
  },

  getActiveProgramId() {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_PROGRAM_ID) || 'built_in_default_program'
  },

  saveActiveProgramId(programId) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROGRAM_ID, String(programId || 'built_in_default_program'))
  },

  getProgramCustomizations() {
    const data = localStorage.getItem(STORAGE_KEYS.PROGRAM_CUSTOMIZATIONS)
    return data ? JSON.parse(data) : {}
  },

  saveProgramCustomizations(customizations) {
    localStorage.setItem(STORAGE_KEYS.PROGRAM_CUSTOMIZATIONS, JSON.stringify(customizations))
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
    localStorage.setItem(
      STORAGE_KEYS.SCHEDULED_EXERCISES,
      JSON.stringify(Array.isArray(items) ? items : []),
    )
  },

  getWeightUnit() {
    return localStorage.getItem(STORAGE_KEYS.WEIGHT_UNIT) || 'kg'
  },

  saveWeightUnit(unit) {
    localStorage.setItem(STORAGE_KEYS.WEIGHT_UNIT, unit)
  },

  getRestTimerDefault() {
    const value = localStorage.getItem(STORAGE_KEYS.REST_TIMER_DEFAULT)
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 120
  },

  saveRestTimerDefault(seconds) {
    localStorage.setItem(STORAGE_KEYS.REST_TIMER_DEFAULT, String(seconds))
  },

  getRestTimerVibration() {
    const value = localStorage.getItem(STORAGE_KEYS.REST_TIMER_VIBRATION)
    if (value === null) return true
    return value === 'true'
  },

  saveRestTimerVibration(enabled) {
    localStorage.setItem(STORAGE_KEYS.REST_TIMER_VIBRATION, String(Boolean(enabled)))
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
    localStorage.setItem(STORAGE_KEYS.DISMISSED_ALERTS, JSON.stringify(Array.isArray(alertIds) ? alertIds : []))
  },

  clearAll() {
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
    }
  },

  importData(data) {
    if (data.progress) this.saveProgress(data.progress)
    if (data.completedDays) this.saveCompletedDays(data.completedDays)
    if (data.programStart) this.saveProgramStart(data.programStart)
    if (data.bodyweightLogs) this.saveBodyweightLogs(data.bodyweightLogs)
    if (data.planDisplayName) this.savePlanDisplayName(data.planDisplayName)
    if (Array.isArray(data.importedPrograms)) this.saveImportedPrograms(data.importedPrograms)
    if (data.activeProgramId) this.saveActiveProgramId(data.activeProgramId)
    if (data.programCustomizations) this.saveProgramCustomizations(data.programCustomizations)
    if (Array.isArray(data.scheduledExercises)) this.saveScheduledExercises(data.scheduledExercises)
    if (data.weightUnit) this.saveWeightUnit(data.weightUnit)
    if (data.restTimerDefault) this.saveRestTimerDefault(data.restTimerDefault)
    if (typeof data.restTimerVibration === 'boolean') this.saveRestTimerVibration(data.restTimerVibration)
    if (Array.isArray(data.dismissedAlerts)) this.saveDismissedAlerts(data.dismissedAlerts)
  }
}

export default storage
