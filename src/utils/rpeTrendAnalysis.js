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
