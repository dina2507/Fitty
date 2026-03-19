import { calculate1RM } from './oneRepMax'

function toTimestamp(value) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

function parseSetEntries(exercise, date) {
  const entries = []

  if (Array.isArray(exercise?.sets) && exercise.sets.length > 0) {
    exercise.sets.forEach((set) => {
      const weight = Number(set?.weight)
      if (!Number.isFinite(weight) || weight <= 0) return

      const parsedReps = Number(set?.reps)
      const reps = Number.isFinite(parsedReps) && parsedReps > 0
        ? Math.round(parsedReps)
        : null

      entries.push({
        weight,
        reps,
        date,
      })
    })

    return entries
  }

  const singleWeight = Number(exercise?.weight)
  if (!Number.isFinite(singleWeight) || singleWeight <= 0) {
    return entries
  }

  const parsedReps = Number(exercise?.reps)
  const reps = Number.isFinite(parsedReps) && parsedReps > 0
    ? Math.round(parsedReps)
    : null

  entries.push({
    weight: singleWeight,
    reps,
    date,
  })

  return entries
}

function compareSetEntries(a, b) {
  if (a.weight !== b.weight) return b.weight - a.weight
  return (b.reps || 0) - (a.reps || 0)
}

function formatDateString(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function buildPersonalRecords(completedDays = []) {
  const byExercise = new Map()

  ;(Array.isArray(completedDays) ? completedDays : []).forEach((day) => {
    const dayDate = formatDateString(day?.date)
    if (!dayDate) return

    ;(day?.exercises || []).forEach((exercise) => {
      const exerciseName = String(exercise?.name || '').trim()
      if (!exerciseName) return

      const key = exerciseName.toLowerCase()
      const record = byExercise.get(key) || {
        exerciseName,
        muscleGroup: exercise?.muscleGroup || exercise?.muscle_group || 'Full Body',
        sessionsCount: 0,
        totalSets: 0,
        lastPerformedAt: dayDate,
        bestSet: null,
        bestE1RM: null,
        bestByRep: {},
        allSets: [],
      }

      record.sessionsCount += 1
      if (toTimestamp(dayDate) > toTimestamp(record.lastPerformedAt)) {
        record.lastPerformedAt = dayDate
      }

      if (!record.muscleGroup && (exercise?.muscleGroup || exercise?.muscle_group)) {
        record.muscleGroup = exercise.muscleGroup || exercise.muscle_group
      }

      const setEntries = parseSetEntries(exercise, dayDate)
      record.totalSets += setEntries.length

      setEntries.forEach((entry) => {
        record.allSets.push(entry)

        if (!record.bestSet || compareSetEntries(entry, record.bestSet) < 0) {
          record.bestSet = { ...entry }
        }

        if (entry.reps && entry.reps > 0) {
          const e1rm = calculate1RM(entry.weight, entry.reps)
          if (Number.isFinite(e1rm) && e1rm > 0) {
            if (!record.bestE1RM || e1rm > record.bestE1RM.value) {
              record.bestE1RM = {
                value: e1rm,
                weight: entry.weight,
                reps: entry.reps,
                date: entry.date,
              }
            }
          }

          const existingRepBest = record.bestByRep[entry.reps]
          if (!existingRepBest || entry.weight > existingRepBest.weight) {
            record.bestByRep[entry.reps] = {
              weight: entry.weight,
              date: entry.date,
              e1rm,
            }
          }
        }
      })

      byExercise.set(key, record)
    })
  })

  return [...byExercise.values()]
    .map((record) => ({
      ...record,
      allSets: [...record.allSets].sort((a, b) => compareSetEntries(a, b)),
    }))
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName))
}

export function buildRecordsLookup(records = []) {
  const map = {}
  ;(Array.isArray(records) ? records : []).forEach((record) => {
    map[String(record.exerciseName || '').toLowerCase()] = record
  })
  return map
}

export function buildRepPrRows(record, { minReps = 1, maxReps = 12 } = {}) {
  const rows = []
  for (let reps = minReps; reps <= maxReps; reps += 1) {
    const best = record?.bestByRep?.[reps] || null
    rows.push({ reps, best })
  }
  return rows
}

export function evaluateGoal(goal, record) {
  const normalizedGoal = goal && typeof goal === 'object' ? goal : null
  if (!normalizedGoal) return null

  const type = normalizedGoal.type === 'e1rm' ? 'e1rm' : 'top_set'
  const targetWeight = Number(normalizedGoal.targetWeight)
  const targetReps = Number(normalizedGoal.targetReps)

  if (!Number.isFinite(targetWeight) || targetWeight <= 0) {
    return {
      achieved: false,
      progressRatio: 0,
      targetLabel: '--',
      bestLabel: 'No target configured',
      statusText: 'Invalid goal target.',
      achievedAt: null,
    }
  }

  if (type === 'e1rm') {
    const best = record?.bestE1RM || null
    const current = best?.value || 0
    const achieved = current >= targetWeight

    return {
      achieved,
      progressRatio: Math.min(current / targetWeight, 1),
      targetLabel: `${targetWeight} kg e1RM`,
      bestLabel: current > 0 ? `${current.toFixed(1)} kg` : 'No valid sets yet',
      statusText: achieved
        ? `Achieved on ${new Date(best.date).toLocaleDateString()}`
        : `${(targetWeight - current).toFixed(1)} kg to target`,
      achievedAt: achieved ? best.date : null,
    }
  }

  const minimumReps = Number.isFinite(targetReps) && targetReps > 0 ? Math.round(targetReps) : 1
  const allSets = Array.isArray(record?.allSets) ? record.allSets : []

  const bestCandidate = allSets[0] || null
  const achievedSet = allSets.find((set) => {
    const reps = Number.isFinite(Number(set.reps)) ? Number(set.reps) : 0
    return set.weight >= targetWeight && reps >= minimumReps
  }) || null

  const bestWeight = bestCandidate?.weight || 0
  const bestReps = Number.isFinite(Number(bestCandidate?.reps)) ? Number(bestCandidate.reps) : null
  const achieved = Boolean(achievedSet)

  let statusText = 'No sets logged yet.'
  if (bestCandidate) {
    if (achieved) {
      statusText = `Achieved on ${new Date(achievedSet.date).toLocaleDateString()}`
    } else if (bestWeight >= targetWeight && (bestReps || 0) < minimumReps) {
      statusText = `Weight reached. Need ${(minimumReps - (bestReps || 0)).toFixed(0)} more reps.`
    } else {
      statusText = `${Math.max(targetWeight - bestWeight, 0).toFixed(1)} kg to target weight.`
    }
  }

  return {
    achieved,
    progressRatio: Math.min(bestWeight / targetWeight, 1),
    targetLabel: `${targetWeight} kg x ${minimumReps}`,
    bestLabel: bestCandidate
      ? `${bestWeight.toFixed(1)} kg${bestReps ? ` x ${bestReps}` : ''}`
      : 'No valid sets yet',
    statusText,
    achievedAt: achieved ? achievedSet.date : null,
  }
}
