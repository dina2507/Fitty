import program from '../data/program.json'

export function parseRestSeconds(rest, fallbackSeconds = 120) {
  const safeFallback = Number.isFinite(Number(fallbackSeconds))
    ? Math.max(30, Number(fallbackSeconds))
    : 120

  if (!rest) return safeFallback
  const str = rest.toLowerCase().replace('~', '').trim()
  const minMatch = str.match(/(\d+)\s*min/)
  if (minMatch) return parseInt(minMatch[1]) * 60
  const secMatch = str.match(/(\d+)\s*s/)
  if (secMatch) return parseInt(secMatch[1])
  return safeFallback
}

export function buildInitialLog(exercises) {
  if (!exercises) return {}
  return exercises.reduce((acc, exercise) => {
    const numSets = exercise.workingSets || exercise.default_sets || 1
    acc[exercise.id] = {
      sets: Array.from({ length: numSets }, (_, i) => ({
        setNumber: i + 1,
        weight: '',
        reps: '',
        rpe: '',
      })),
      notes: '',
    }
    return acc
  }, {})
}

export function generateId() {
  return 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
}

function getAllProgramExercises() {
  const map = new Map()
  program.phases.forEach(phase => {
    phase.weeks.forEach(week => {
      week.days.forEach(day => {
        day.exercises.forEach(ex => {
          if (!map.has(ex.name)) map.set(ex.name, ex)
        })
      })
    })
  })
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export const ALL_PROGRAM_EXERCISES = getAllProgramExercises()
