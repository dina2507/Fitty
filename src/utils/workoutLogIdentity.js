export function createWorkoutLogId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `wl_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function toWorkoutDateOnly(value) {
  if (!value) {
    return new Date().toISOString().split('T')[0]
  }

  const raw = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    return raw.split('T')[0]
  }

  return parsed.toISOString().split('T')[0]
}

export function getWorkoutLegacySlotKey(workout) {
  return [
    toWorkoutDateOnly(workout?.date),
    String(workout?.phaseId || workout?.phase_id || ''),
    String(workout?.week ?? workout?.week_number ?? ''),
    String(workout?.dayIndex ?? workout?.day_index ?? ''),
  ].join('|')
}
