const STORAGE_KEYS = {
  PROGRESS: 'ppl_tracker_progress',
  COMPLETED_DAYS: 'ppl_tracker_completed_days',
  PROGRAM_START: 'ppl_tracker_program_start',
  BODYWEIGHT_LOGS: 'ppl_tracker_bodyweight_logs',
  PROGRAM_CUSTOMIZATIONS: 'ppl_tracker_program_customizations',
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

  getProgramCustomizations() {
    const data = localStorage.getItem(STORAGE_KEYS.PROGRAM_CUSTOMIZATIONS)
    return data ? JSON.parse(data) : {}
  },

  saveProgramCustomizations(customizations) {
    localStorage.setItem(STORAGE_KEYS.PROGRAM_CUSTOMIZATIONS, JSON.stringify(customizations))
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
      programCustomizations: this.getProgramCustomizations(),
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
    if (data.programCustomizations) this.saveProgramCustomizations(data.programCustomizations)
    if (data.weightUnit) this.saveWeightUnit(data.weightUnit)
    if (data.restTimerDefault) this.saveRestTimerDefault(data.restTimerDefault)
    if (typeof data.restTimerVibration === 'boolean') this.saveRestTimerVibration(data.restTimerVibration)
    if (Array.isArray(data.dismissedAlerts)) this.saveDismissedAlerts(data.dismissedAlerts)
  }
}

export default storage
