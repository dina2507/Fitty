function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function extractTopSet(entry) {
  if (!entry) return null

  if (entry.topSet) {
    const weight = toNumber(entry.topSet.weight)
    const rpe = toNumber(entry.topSet.rpe)
    const reps = toNumber(entry.topSet.reps)
    if (!weight || !rpe) return null
    return {
      weight,
      rpe,
      reps: reps || null,
      date: entry.date || null,
      name: entry.name || null,
    }
  }

  const sets = Array.isArray(entry.sets) ? entry.sets : []
  let best = null

  sets.forEach((set) => {
    const weight = toNumber(set.weight)
    const rpe = toNumber(set.rpe)
    const reps = toNumber(set.reps)

    if (!weight || !rpe) return

    if (!best || weight > best.weight || (weight === best.weight && (reps || 0) > (best.reps || 0))) {
      best = {
        weight,
        rpe,
        reps: reps || null,
        date: entry.date || null,
        name: entry.name || null,
      }
    }
  })

  return best
}

function weekStartKey(date) {
  const d = new Date(date)
  const day = d.getDay() || 7
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (day - 1))
  return d.toISOString().split('T')[0]
}

// Deload detection per muscle group: if the average top-set RPE for a muscle
// group is >= 8.5 across the 2 most recent weeks with data, suggest a deload.
// Returns TrainingAlerts-shaped objects: { id, severity, message }.
export function detectDeloadByMuscleGroup(completedDays) {
  const days = Array.isArray(completedDays) ? completedDays : []
  const groups = {} // group -> Map(weekKey -> { sum, count })

  for (const day of days) {
    if (day?.deletedAt || day?.deleted_at) continue
    const when = new Date(day.date)
    if (Number.isNaN(when.getTime())) continue
    const weekKey = weekStartKey(when)

    for (const exercise of day.exercises || []) {
      const top = extractTopSet(exercise)
      if (!top || !Number.isFinite(top.rpe)) continue
      const group = exercise.muscleGroup || exercise.muscle_group
      if (!group || group === 'Full Body') continue

      if (!groups[group]) groups[group] = new Map()
      const wk = groups[group]
      const cur = wk.get(weekKey) || { sum: 0, count: 0 }
      cur.sum += top.rpe
      cur.count += 1
      wk.set(weekKey, cur)
    }
  }

  const alerts = []
  for (const [group, wk] of Object.entries(groups)) {
    const weeks = [...wk.entries()]
      .map(([key, v]) => ({ key, avg: v.sum / v.count }))
      .sort((a, b) => a.key.localeCompare(b.key))
    if (weeks.length < 2) continue

    const lastTwo = weeks.slice(-2)
    if (lastTwo.every((w) => w.avg >= 8.5)) {
      const peak = Math.max(...lastTwo.map((w) => w.avg))
      alerts.push({
        id: `deload_${group}`,
        severity: peak >= 9 ? 'danger' : 'warning',
        message: `${group}: top-set RPE has averaged ≥8.5 for 2 straight weeks (peak ${peak.toFixed(1)}). Consider scheduling a deload week for ${group}.`,
      })
    }
  }
  return alerts
}

export function analyzeRPETrend(exerciseHistory) {
  const history = Array.isArray(exerciseHistory) ? exerciseHistory : []
  if (history.length < 4) {
    return {
      hasAlert: false,
      message: '',
      severity: 'warning',
    }
  }

  const topSetsNewestFirst = history
    .map((entry) => extractTopSet(entry))
    .filter(Boolean)

  if (topSetsNewestFirst.length < 4) {
    return {
      hasAlert: false,
      message: '',
      severity: 'warning',
    }
  }

  const chronological = [...topSetsNewestFirst].reverse()

  let bestWindow = null

  for (let i = 0; i <= chronological.length - 3; i++) {
    const window = chronological.slice(i, i + 4)

    for (let len = 3; len <= window.length; len++) {
      const slice = window.slice(0, len)
      const baselineWeight = slice[0].weight
      const closeWeight = slice.every((set) => Math.abs(set.weight - baselineWeight) <= 2.5)
      const increasingRPE = slice.every((set, idx) => {
        if (idx === 0) return true
        return set.rpe > slice[idx - 1].rpe
      })

      if (closeWeight && increasingRPE) {
        bestWindow = slice
      }
    }
  }

  if (!bestWindow) {
    return {
      hasAlert: false,
      message: '',
      severity: 'warning',
    }
  }

  const first = bestWindow[0]
  const last = bestWindow[bestWindow.length - 1]
  const name = last.name || first.name || 'This exercise'
  const severity = last.rpe >= 9 ? 'danger' : 'warning'

  return {
    hasAlert: true,
    severity,
    message: `${name}: RPE climbed from ${first.rpe} to ${last.rpe} over ${bestWindow.length} sessions at roughly the same load. Consider a deload set or reducing load by 10%.`,
  }
}
