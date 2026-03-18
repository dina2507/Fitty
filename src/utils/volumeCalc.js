/**
 * Calculates total volume (weight * reps) for an array of exercises.
 * @param {Array} exercises - The exercises array from a completed workout day.
 * @returns {number} The total volume lifted in kg (or lbs, whatever unit is stored).
 */
export function calculateWorkoutVolume(exercises) {
  if (!exercises || !Array.isArray(exercises)) return 0

  return exercises.reduce((workoutTotal, ex) => {
    let exerciseTotal = 0

    // Multi-set structure
    if (ex.sets && Array.isArray(ex.sets)) {
      exerciseTotal = ex.sets.reduce((setTotal, set) => {
        const weight = parseFloat(set.weight) || 0
        const reps = parseInt(set.reps, 10) || 0
        return setTotal + (weight * reps)
      }, 0)
    } 
    // Legacy single-set structure fallback
    else if (ex.weight || ex.reps) {
      const weight = parseFloat(ex.weight) || 0
      const reps = parseInt(ex.reps, 10) || 0
      exerciseTotal = weight * reps
    }

    return workoutTotal + exerciseTotal
  }, 0)
}
