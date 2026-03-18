export const BADGES = [
  { id: 'first_workout', label: 'First Workout', icon: '🏋️', description: 'Completed your first workout', type: 'count', threshold: 1 },
  { id: 'workouts_10', label: '10 Workouts', icon: '🔥', description: 'Completed 10 workouts', type: 'count', threshold: 10 },
  { id: 'workouts_25', label: '25 Workouts', icon: '💪', description: 'Completed 25 workouts', type: 'count', threshold: 25 },
  { id: 'workouts_50', label: '50 Workouts', icon: '🥇', description: 'Completed 50 workouts', type: 'count', threshold: 50 },
  { id: 'workouts_100', label: '100 Workouts', icon: '🏆', description: 'Completed 100 workouts', type: 'count', threshold: 100 },

  { id: 'streak_7', label: '7-Day Streak', icon: '⚡', description: 'Reached a 7-day streak', type: 'streak', threshold: 7 },
  { id: 'streak_14', label: '14-Day Streak', icon: '🔥', description: 'Reached a 14-day streak', type: 'streak', threshold: 14 },
  { id: 'streak_30', label: '30-Day Streak', icon: '👑', description: 'Reached a 30-day streak', type: 'streak', threshold: 30 },
  { id: 'streak_60', label: '60-Day Streak', icon: '🦾', description: 'Reached a 60-day streak', type: 'streak', threshold: 60 },

  { id: 'bench_60kg', label: 'Bench 60kg', icon: '🏋️', description: 'Bench press 60kg', type: 'strength', lift: 'bench', threshold: 60 },
  { id: 'bench_80kg', label: 'Bench 80kg', icon: '🏋️', description: 'Bench press 80kg', type: 'strength', lift: 'bench', threshold: 80 },
  { id: 'bench_100kg', label: 'Bench 100kg', icon: '🏋️', description: 'Bench press 100kg', type: 'strength', lift: 'bench', threshold: 100 },
  { id: 'bench_120kg', label: 'Bench 120kg', icon: '🏋️', description: 'Bench press 120kg', type: 'strength', lift: 'bench', threshold: 120 },

  { id: 'squat_80kg', label: 'Squat 80kg', icon: '🏋️', description: 'Squat 80kg', type: 'strength', lift: 'squat', threshold: 80 },
  { id: 'squat_100kg', label: 'Squat 100kg', icon: '🏋️', description: 'Squat 100kg', type: 'strength', lift: 'squat', threshold: 100 },
  { id: 'squat_120kg', label: 'Squat 120kg', icon: '🏋️', description: 'Squat 120kg', type: 'strength', lift: 'squat', threshold: 120 },
  { id: 'squat_140kg', label: 'Squat 140kg', icon: '🏋️', description: 'Squat 140kg', type: 'strength', lift: 'squat', threshold: 140 },

  { id: 'deadlift_100kg', label: 'Deadlift 100kg', icon: '🏋️', description: 'Deadlift 100kg', type: 'strength', lift: 'deadlift', threshold: 100 },
  { id: 'deadlift_120kg', label: 'Deadlift 120kg', icon: '🏋️', description: 'Deadlift 120kg', type: 'strength', lift: 'deadlift', threshold: 120 },
  { id: 'deadlift_140kg', label: 'Deadlift 140kg', icon: '🏋️', description: 'Deadlift 140kg', type: 'strength', lift: 'deadlift', threshold: 140 },
  { id: 'deadlift_160kg', label: 'Deadlift 160kg', icon: '🏋️', description: 'Deadlift 160kg', type: 'strength', lift: 'deadlift', threshold: 160 },

  { id: 'ohp_40kg', label: 'OHP 40kg', icon: '🏋️', description: 'Overhead press 40kg', type: 'strength', lift: 'ohp', threshold: 40 },
  { id: 'ohp_60kg', label: 'OHP 60kg', icon: '🏋️', description: 'Overhead press 60kg', type: 'strength', lift: 'ohp', threshold: 60 },
  { id: 'ohp_80kg', label: 'OHP 80kg', icon: '🏋️', description: 'Overhead press 80kg', type: 'strength', lift: 'ohp', threshold: 80 },

  { id: 'phase_1_complete', label: 'Phase 1 Complete', icon: '📅', description: 'Completed Phase 1', type: 'phase', phase: 'phase_1' },
  { id: 'phase_2_complete', label: 'Phase 2 Complete', icon: '📅', description: 'Completed Phase 2', type: 'phase', phase: 'phase_2' },
  { id: 'phase_3_complete', label: 'Phase 3 Complete', icon: '📅', description: 'Completed Phase 3', type: 'phase', phase: 'phase_3' },
  { id: 'program_complete', label: 'Full Program Done', icon: '🎯', description: 'Completed the full program', type: 'program' },
]

function normalizeDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

function getMaxWeight(exercise) {
  let maxWeight = 0

  if (Array.isArray(exercise?.sets)) {
    exercise.sets.forEach((set) => {
      const weight = Number(set.weight) || 0
      if (weight > maxWeight) maxWeight = weight
    })
    return maxWeight
  }

  return Number(exercise?.weight) || 0
}

function getBestLiftMaxes(completedDays) {
  const liftMaxes = {
    bench: 0,
    squat: 0,
    deadlift: 0,
    ohp: 0,
  }

  ;(completedDays || []).forEach((day) => {
    ;(day.exercises || []).forEach((exercise) => {
      const name = (exercise.name || '').toLowerCase()
      const maxWeight = getMaxWeight(exercise)
      if (maxWeight <= 0) return

      if (name.includes('bench press')) {
        liftMaxes.bench = Math.max(liftMaxes.bench, maxWeight)
      }
      if (name.includes('squat')) {
        liftMaxes.squat = Math.max(liftMaxes.squat, maxWeight)
      }
      if (name.includes('deadlift')) {
        liftMaxes.deadlift = Math.max(liftMaxes.deadlift, maxWeight)
      }
      if (name.includes('overhead press') || name.includes('shoulder press')) {
        liftMaxes.ohp = Math.max(liftMaxes.ohp, maxWeight)
      }
    })
  })

  return liftMaxes
}

function getStreakStats(completedDays) {
  const uniqueDays = [...new Set((completedDays || [])
    .map((day) => normalizeDate(day.date))
    .filter(Boolean)
    .map((date) => date.toISOString().split('T')[0]))]
    .map((value) => normalizeDate(value))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime())

  if (uniqueDays.length === 0) {
    return { currentStreak: 0, bestStreak: 0 }
  }

  const oneDay = 24 * 60 * 60 * 1000
  let best = 1
  let run = 1

  for (let i = 1; i < uniqueDays.length; i++) {
    const diff = Math.round((uniqueDays[i].getTime() - uniqueDays[i - 1].getTime()) / oneDay)
    if (diff === 1) {
      run += 1
      best = Math.max(best, run)
    } else {
      run = 1
    }
  }

  let current = 1
  for (let i = uniqueDays.length - 1; i > 0; i--) {
    const diff = Math.round((uniqueDays[i].getTime() - uniqueDays[i - 1].getTime()) / oneDay)
    if (diff === 1) current += 1
    else break
  }

  const today = normalizeDate(new Date())
  const latest = uniqueDays[uniqueDays.length - 1]
  const daysSinceLatest = Math.round((today.getTime() - latest.getTime()) / oneDay)

  if (daysSinceLatest > 1) current = 0

  return {
    currentStreak: current,
    bestStreak: best,
  }
}

export function buildMilestoneStats({ completedDays, currentPhaseId, currentWeek }) {
  const workoutCount = (completedDays || []).length
  const liftMaxes = getBestLiftMaxes(completedDays)
  const { currentStreak, bestStreak } = getStreakStats(completedDays)

  const phase1Complete =
    currentPhaseId !== 'phase_1'
    || (completedDays || []).some((day) => day.phaseId === 'phase_2' || day.phaseId === 'phase_3')

  const phase2Complete =
    currentPhaseId === 'phase_3'
    || (completedDays || []).some((day) => day.phaseId === 'phase_3')

  const phase3Complete =
    (completedDays || []).some((day) => day.phaseId === 'phase_3' && (day.week || 0) >= 6)
    || (currentPhaseId === 'phase_3' && Number(currentWeek) >= 6)

  const programComplete = currentPhaseId === 'phase_3' && Number(currentWeek) >= 6 && phase3Complete

  return {
    workoutCount,
    currentStreak,
    bestStreak,
    liftMaxes,
    phase1Complete,
    phase2Complete,
    phase3Complete,
    programComplete,
  }
}

export function checkMilestones(stats, alreadyEarned) {
  const earnedSet = alreadyEarned instanceof Set ? alreadyEarned : new Set(alreadyEarned || [])
  const newlyEarned = []

  BADGES.forEach((badge) => {
    if (earnedSet.has(badge.id)) return

    if (badge.type === 'count' && stats.workoutCount >= badge.threshold) {
      newlyEarned.push(badge.id)
      return
    }

    if (badge.type === 'streak' && stats.bestStreak >= badge.threshold) {
      newlyEarned.push(badge.id)
      return
    }

    if (badge.type === 'strength' && stats.liftMaxes?.[badge.lift] >= badge.threshold) {
      newlyEarned.push(badge.id)
      return
    }

    if (badge.id === 'phase_1_complete' && stats.phase1Complete) {
      newlyEarned.push(badge.id)
      return
    }

    if (badge.id === 'phase_2_complete' && stats.phase2Complete) {
      newlyEarned.push(badge.id)
      return
    }

    if (badge.id === 'phase_3_complete' && stats.phase3Complete) {
      newlyEarned.push(badge.id)
      return
    }

    if (badge.id === 'program_complete' && stats.programComplete) {
      newlyEarned.push(badge.id)
    }
  })

  return newlyEarned
}
