// Muscle group definitions with colors for UI badges
export const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Legs',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Core',
  'Full Body',
]

// Color map: tailwind-compatible bg + text classes per muscle group
export const MUSCLE_GROUP_COLORS = {
  Chest: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  Back: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  Legs: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  Shoulders: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  Biceps: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  Triceps: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  Core: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  'Full Body': { bg: 'bg-zinc-100', text: 'text-zinc-700', border: 'border-zinc-200', dot: 'bg-zinc-500' },
}

export function getMuscleGroupColor(group) {
  return MUSCLE_GROUP_COLORS[group] || MUSCLE_GROUP_COLORS['Full Body']
}

// Get unique muscle groups from an array of exercises
export function getUniqueMuscleGroups(exercises) {
  if (!exercises) return []
  const groups = new Set(exercises.map(e => e.muscleGroup).filter(Boolean))
  return [...groups]
}
