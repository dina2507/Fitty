import { useMemo } from 'react'
import { useWorkoutStore } from '../store/useWorkoutStore'

function getLastLoggedSet(sets) {
  if (!Array.isArray(sets) || sets.length === 0) return null

  for (let i = sets.length - 1; i >= 0; i--) {
    const set = sets[i]
    if (set?.weight !== '' && set?.weight !== undefined && set?.weight !== null) {
      return {
        weight: set.weight,
        reps: set.reps ?? '',
      }
    }
  }

  return null
}

export function usePrevWeight(activeExercises = []) {
  const completedDays = useWorkoutStore((state) => state.completedDays)

  const previousWeights = useMemo(() => {
    const map = {}

    if (!Array.isArray(activeExercises) || activeExercises.length === 0) {
      return map
    }

    for (const exercise of activeExercises) {
      if (!exercise?.id) continue

      for (let i = completedDays.length - 1; i >= 0; i--) {
        const day = completedDays[i]
        const matchedExercise = (day.exercises || []).find((loggedExercise) => {
          const loggedId = loggedExercise.exerciseId || loggedExercise.id
          if (loggedId && loggedId === exercise.id) return true

          // Backward compatibility for historic logs that only stored names.
          return loggedExercise.name && exercise.name && loggedExercise.name === exercise.name
        })

        if (!matchedExercise) continue

        if (matchedExercise.sets?.length) {
          const lastSet = getLastLoggedSet(matchedExercise.sets)
          if (lastSet && lastSet.weight !== '') {
            map[exercise.id] = {
              weight: lastSet.weight,
              reps: lastSet.reps,
            }
            break
          }
        } else if (matchedExercise.weight !== '' && matchedExercise.weight !== undefined && matchedExercise.weight !== null) {
          map[exercise.id] = {
            weight: matchedExercise.weight,
            reps: matchedExercise.reps ?? '',
          }
          break
        }
      }
    }

    return map
  }, [activeExercises, completedDays])

  const getPreviousWeight = (exerciseId) => previousWeights[exerciseId]

  return { previousWeights, getPreviousWeight }
}
