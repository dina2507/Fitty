import { useCallback, useMemo } from 'react'

function getSessionMaxWeight(exercise) {
  let maxWeight = 0

  if (Array.isArray(exercise?.sets) && exercise.sets.length > 0) {
    exercise.sets.forEach((set) => {
      const weight = parseFloat(set.weight) || 0
      if (weight > maxWeight) maxWeight = weight
    })
    return maxWeight
  }

  const singleWeight = parseFloat(exercise?.weight) || 0
  return singleWeight
}

function getExerciseId(exercise) {
  return exercise?.exerciseId || exercise?.id || null
}

function buildPRMaps(completedDays) {
  const byId = {}
  const byName = {}

  for (const day of completedDays || []) {
    if (!Array.isArray(day?.exercises)) continue

    for (const exercise of day.exercises) {
      const maxWeight = getSessionMaxWeight(exercise)
      if (maxWeight <= 0) continue

      const exerciseId = getExerciseId(exercise)
      if (exerciseId) {
        byId[exerciseId] = Math.max(byId[exerciseId] || 0, maxWeight)
      }

      if (exercise.name) {
        byName[exercise.name] = Math.max(byName[exercise.name] || 0, maxWeight)
      }
    }
  }

  return { byId, byName }
}

function getPriorPR(prMaps, exercise) {
  const byId = prMaps.byId[exercise?.id] || 0
  const byName = prMaps.byName[exercise?.name] || 0
  return Math.max(byId, byName)
}

/**
 * Custom hook to pre-calculate Personal Records (PRs) from the user's workout history.
 * @param {Array} completedDays - The completedDays array from useWorkoutStore
 * @returns {Record<string, number>} A dictionary mapping exerciseNames to their max lifted weight.
 */
export function usePRDetection(completedDays) {
  const prMaps = useMemo(() => buildPRMaps(completedDays), [completedDays])

  const previousPRs = useMemo(() => {
    // Keep backward compatibility for callers that expect a flat map.
    return {
      ...prMaps.byName,
      ...prMaps.byId,
    }
  }, [prMaps])

  const detectSessionPRs = useCallback((sessionExercises, exerciseLog) => {
    const newPRs = []

    for (const exercise of sessionExercises || []) {
      const sets = exerciseLog?.[exercise.id]?.sets || []
      let sessionMax = 0

      for (const set of sets) {
        const weight = parseFloat(set.weight) || 0
        if (weight > sessionMax) sessionMax = weight
      }

      const priorPR = getPriorPR(prMaps, exercise)
      if (sessionMax > 0 && sessionMax > priorPR) {
        newPRs.push({
          exerciseId: exercise.id,
          name: exercise.name,
          previous: priorPR,
          current: sessionMax,
        })
      }
    }

    return newPRs
  }, [prMaps])

  return {
    previousPRs,
    priorPRById: prMaps.byId,
    priorPRByName: prMaps.byName,
    detectSessionPRs,
  }
}

/**
 * Utility to determine if a specific set is an all-time PR *up to that point in time*.
 * Useful for badging historical sets with a 🏆.
 */
export function getHistoricalPRs(completedDays) {
  const prMapById = {}
  const prMapByName = {}
  const historicalFlags = new Set() // Will store unique string keys like `${workoutId}-${exerciseIndex}-${setIndex}`

  // Ensure we sort chronologically (assuming completedDays is chronological, which it is)
  ;(completedDays || []).forEach((day, dayIndex) => {
    if (!day.exercises) return

    day.exercises.forEach((ex, exIndex) => {
      const exerciseId = getExerciseId(ex)

      if (ex.sets && Array.isArray(ex.sets)) {
        ex.sets.forEach((set, setIndex) => {
          const weight = parseFloat(set.weight) || 0
          const currentPR = Math.max(
            exerciseId ? (prMapById[exerciseId] || 0) : 0,
            ex.name ? (prMapByName[ex.name] || 0) : 0,
          )

          // Must be strictly greater than historical PR to get badged
          if (weight > 0 && weight > currentPR) {
            if (exerciseId) prMapById[exerciseId] = weight
            if (ex.name) prMapByName[ex.name] = weight
            historicalFlags.add(`${dayIndex}-${exIndex}-${setIndex}`)
          }
        })
      } 
      // Legacy single-set format
      else if (ex.weight) {
        const weight = parseFloat(ex.weight) || 0
        const currentPR = Math.max(
          exerciseId ? (prMapById[exerciseId] || 0) : 0,
          ex.name ? (prMapByName[ex.name] || 0) : 0,
        )
        
        if (weight > 0 && weight > currentPR) {
          if (exerciseId) prMapById[exerciseId] = weight
          if (ex.name) prMapByName[ex.name] = weight
          historicalFlags.add(`${dayIndex}-${exIndex}-legacy`)
        }
      }
    })
  })

  return {
    currentPRs: {
      ...prMapByName,
      ...prMapById,
    },
    historicalFlags,
  }
}
