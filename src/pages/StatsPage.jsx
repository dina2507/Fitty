import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import MilestoneBadge from '../components/MilestoneBadge'
import { supabase } from '../lib/supabaseClient'
import { useWorkoutStore } from '../store/useWorkoutStore'
import { calculate1RM } from '../utils/oneRepMax'

const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Core',
  'Full Body',
]

const MUSCLE_COLORS = {
  Chest: '#C0392B',
  Back: '#1A5276',
  Shoulders: '#B7950B',
  Biceps: '#0E6655',
  Triceps: '#7D3C98',
  Quads: '#1F618D',
  Hamstrings: '#CA6F1E',
  Glutes: '#717D7E',
  Calves: '#1E8449',
  Core: '#CB4335',
  'Full Body': '#2C3E50',
}

const BADGES = [
  { id: 'first_workout', label: 'First Workout', icon: '🏋️', type: 'count', threshold: 1, description: 'Complete 1 workout' },
  { id: 'workouts_10', label: '10 Workouts', icon: '🔥', type: 'count', threshold: 10, description: 'Complete 10 workouts' },
  { id: 'workouts_25', label: '25 Workouts', icon: '💪', type: 'count', threshold: 25, description: 'Complete 25 workouts' },
  { id: 'workouts_50', label: '50 Workouts', icon: '🥇', type: 'count', threshold: 50, description: 'Complete 50 workouts' },
  { id: 'workouts_100', label: '100 Workouts', icon: '🏆', type: 'count', threshold: 100, description: 'Complete 100 workouts' },
  { id: 'streak_7', label: '7-Day Streak', icon: '⚡', type: 'streak', threshold: 7, description: 'Hit a 7-day streak' },
  { id: 'streak_14', label: '14-Day Streak', icon: '🔥', type: 'streak', threshold: 14, description: 'Hit a 14-day streak' },
  { id: 'streak_30', label: '30-Day Streak', icon: '👑', type: 'streak', threshold: 30, description: 'Hit a 30-day streak' },
  { id: 'streak_60', label: '60-Day Streak', icon: '🦾', type: 'streak', threshold: 60, description: 'Hit a 60-day streak' },
  { id: 'bench_60kg', label: 'Bench 60kg', icon: '🏋️', type: 'strength', lift: 'bench', threshold: 60, description: 'Bench press 60kg' },
  { id: 'bench_80kg', label: 'Bench 80kg', icon: '🏋️', type: 'strength', lift: 'bench', threshold: 80, description: 'Bench press 80kg' },
  { id: 'bench_100kg', label: 'Bench 100kg', icon: '🏋️', type: 'strength', lift: 'bench', threshold: 100, description: 'Bench press 100kg' },
  { id: 'bench_120kg', label: 'Bench 120kg', icon: '🏋️', type: 'strength', lift: 'bench', threshold: 120, description: 'Bench press 120kg' },
  { id: 'squat_80kg', label: 'Squat 80kg', icon: '🏋️', type: 'strength', lift: 'squat', threshold: 80, description: 'Squat 80kg' },
  { id: 'squat_100kg', label: 'Squat 100kg', icon: '🏋️', type: 'strength', lift: 'squat', threshold: 100, description: 'Squat 100kg' },
  { id: 'squat_120kg', label: 'Squat 120kg', icon: '🏋️', type: 'strength', lift: 'squat', threshold: 120, description: 'Squat 120kg' },
  { id: 'squat_140kg', label: 'Squat 140kg', icon: '🏋️', type: 'strength', lift: 'squat', threshold: 140, description: 'Squat 140kg' },
  { id: 'deadlift_100kg', label: 'Deadlift 100kg', icon: '🏋️', type: 'strength', lift: 'deadlift', threshold: 100, description: 'Deadlift 100kg' },
  { id: 'deadlift_120kg', label: 'Deadlift 120kg', icon: '🏋️', type: 'strength', lift: 'deadlift', threshold: 120, description: 'Deadlift 120kg' },
  { id: 'deadlift_140kg', label: 'Deadlift 140kg', icon: '🏋️', type: 'strength', lift: 'deadlift', threshold: 140, description: 'Deadlift 140kg' },
  { id: 'deadlift_160kg', label: 'Deadlift 160kg', icon: '🏋️', type: 'strength', lift: 'deadlift', threshold: 160, description: 'Deadlift 160kg' },
  { id: 'ohp_40kg', label: 'OHP 40kg', icon: '🏋️', type: 'strength', lift: 'ohp', threshold: 40, description: 'Overhead press 40kg' },
  { id: 'ohp_60kg', label: 'OHP 60kg', icon: '🏋️', type: 'strength', lift: 'ohp', threshold: 60, description: 'Overhead press 60kg' },
  { id: 'ohp_80kg', label: 'OHP 80kg', icon: '🏋️', type: 'strength', lift: 'ohp', threshold: 80, description: 'Overhead press 80kg' },
  { id: 'phase_1_complete', label: 'Phase 1 Complete', icon: '📅', type: 'phase', phase: 'phase_1', description: 'Advance past Phase 1' },
  { id: 'phase_2_complete', label: 'Phase 2 Complete', icon: '📅', type: 'phase', phase: 'phase_2', description: 'Advance past Phase 2' },
  { id: 'phase_3_complete', label: 'Phase 3 Complete', icon: '📅', type: 'phase', phase: 'phase_3', description: 'Complete Phase 3' },
  { id: 'program_complete', label: 'Program Complete', icon: '🎯', type: 'program', description: 'Complete the full program' },
]

function startOfDay(date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date, amount) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function startOfWeek(date) {
  const day = date.getDay() || 7
  return addDays(startOfDay(date), -(day - 1))
}

function formatDay(date) {
  return startOfDay(date).toISOString().split('T')[0]
}

function formatShortDate(date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatWeekLabel(weekStartDate) {
  const endDate = addDays(weekStartDate, 6)
  return `${weekStartDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

function getSetCount(exercise) {
  if (Array.isArray(exercise?.sets)) return exercise.sets.length
  return 1
}

function getExerciseVolume(exercise) {
  if (Array.isArray(exercise?.sets)) {
    return exercise.sets.reduce((sum, set) => {
      const weight = parseFloat(set.weight) || 0
      const reps = parseInt(set.reps, 10) || 0
      return sum + weight * reps
    }, 0)
  }

  const weight = parseFloat(exercise?.weight) || 0
  const reps = parseInt(exercise?.reps, 10) || 0
  return weight * reps
}

function getSessionMaxWeight(exercise) {
  let maxWeight = 0

  if (Array.isArray(exercise?.sets)) {
    exercise.sets.forEach((set) => {
      const weight = parseFloat(set.weight) || 0
      if (weight > maxWeight) maxWeight = weight
    })
  } else {
    const single = parseFloat(exercise?.weight) || 0
    if (single > maxWeight) maxWeight = single
  }

  return maxWeight
}

function getBestLiftMaxes(completedDays) {
  const result = {
    bench: 0,
    squat: 0,
    deadlift: 0,
    ohp: 0,
  }

  completedDays.forEach((day) => {
    ;(day.exercises || []).forEach((exercise) => {
      const name = (exercise.name || '').toLowerCase()
      const max = getSessionMaxWeight(exercise)
      if (max <= 0) return

      if (name.includes('bench press')) result.bench = Math.max(result.bench, max)
      if (name.includes('squat')) result.squat = Math.max(result.squat, max)
      if (name.includes('deadlift')) result.deadlift = Math.max(result.deadlift, max)
      if (name.includes('overhead press') || name.includes('shoulder press')) {
        result.ohp = Math.max(result.ohp, max)
      }
    })
  })

  return result
}

function getBestStreak(completedDays) {
  const unique = [...new Set(completedDays.map((day) => formatDay(new Date(day.date))))]
    .map((day) => new Date(day))
    .sort((a, b) => a.getTime() - b.getTime())

  if (unique.length === 0) return 0

  let best = 1
  let current = 1

  for (let i = 1; i < unique.length; i++) {
    const diffDays = Math.round((unique[i].getTime() - unique[i - 1].getTime()) / 86400000)
    if (diffDays === 1) {
      current += 1
      best = Math.max(best, current)
    } else {
      current = 1
    }
  }

  return best
}

function getHeatColor(count) {
  if (count <= 0) return 'bg-zinc-100'
  if (count === 1) return 'bg-emerald-200'
  if (count === 2) return 'bg-emerald-400'
  return 'bg-emerald-600'
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function StatsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const completedDays = useWorkoutStore((state) => state.completedDays)
  const bodyweightLogs = useWorkoutStore((state) => state.bodyweightLogs)
  const logBodyweight = useWorkoutStore((state) => state.logBodyweight)
  const currentPhaseId = useWorkoutStore((state) => state.currentPhaseId)
  const currentWeek = useWorkoutStore((state) => state.currentWeek)

  const [selectedExercise, setSelectedExercise] = useState('')
  const [bodyweightInput, setBodyweightInput] = useState('')
  const [earnedAchievementMap, setEarnedAchievementMap] = useState({})

  useEffect(() => {
    let active = true

    async function fetchAchievements() {
      if (!user?.id) {
        setEarnedAchievementMap({})
        return
      }

      try {
        const { data, error } = await supabase
          .from('achievements')
          .select('badge_id, earned_at')
          .eq('user_id', user.id)

        if (error) throw error
        if (active) {
          const map = {}
          ;(data || []).forEach((row) => {
            if (row?.badge_id) {
              map[row.badge_id] = row.earned_at || null
            }
          })
          setEarnedAchievementMap(map)
        }
      } catch (error) {
        // Table might not exist yet in early sprints.
        console.error('Failed to load achievements:', error)
        if (active) setEarnedAchievementMap({})
      }
    }

    fetchAchievements()

    return () => {
      active = false
    }
  }, [user])

  const workoutCount = completedDays.length

  const weeklyData = useMemo(() => {
    const today = startOfDay(new Date())
    const currentWeekStart = startOfWeek(today)

    const buckets = {}
    for (let i = 11; i >= 0; i--) {
      const weekStartDate = addDays(currentWeekStart, -i * 7)
      const key = formatDay(weekStartDate)

      buckets[key] = {
        weekStart: key,
        weekLabel: formatWeekLabel(weekStartDate),
        weekShort: formatShortDate(weekStartDate),
        totalSets: 0,
        ...Object.fromEntries(MUSCLE_GROUPS.map((group) => [group, 0])),
      }
    }

    completedDays.forEach((day) => {
      const date = new Date(day.date)
      const weekStart = formatDay(startOfWeek(date))
      if (!buckets[weekStart]) return

      ;(day.exercises || []).forEach((exercise) => {
        const group = MUSCLE_GROUPS.includes(exercise.muscleGroup) ? exercise.muscleGroup : 'Full Body'
        const setCount = getSetCount(exercise)
        const volume = getExerciseVolume(exercise)

        buckets[weekStart].totalSets += setCount
        buckets[weekStart][group] += volume
      })
    })

    return Object.values(buckets)
  }, [completedDays])

  const totalVolumeAllTime = useMemo(() => {
    return completedDays.reduce((sum, day) => {
      return sum + (day.exercises || []).reduce((exerciseSum, exercise) => exerciseSum + getExerciseVolume(exercise), 0)
    }, 0)
  }, [completedDays])

  const avgSetsPerWeek = useMemo(() => {
    if (weeklyData.length === 0) return 0
    const recent = weeklyData.slice(-6)
    if (recent.length === 0) return 0
    const total = recent.reduce((sum, week) => sum + week.totalSets, 0)
    return Math.round(total / recent.length)
  }, [weeklyData])

  const weeklyVolumeByMuscleData = useMemo(() => weeklyData.slice(-8), [weeklyData])
  const totalSetsPerWeekData = useMemo(() => weeklyData, [weeklyData])

  const exerciseProgressSeries = useMemo(() => {
    const map = {}

    completedDays.forEach((day) => {
      const label = formatShortDate(new Date(day.date))
      ;(day.exercises || []).forEach((exercise) => {
        if (!exercise?.name) return

        const maxWeight = getSessionMaxWeight(exercise)
        if (maxWeight <= 0) return

        const repsCandidates = Array.isArray(exercise?.sets)
          ? exercise.sets.map((set) => parseInt(set.reps, 10) || 1)
          : [parseInt(exercise?.reps, 10) || 1]
        const maxReps = Math.max(...repsCandidates, 1)

        if (!map[exercise.name]) map[exercise.name] = []
        map[exercise.name].push({
          date: label,
          fullDate: new Date(day.date).getTime(),
          maxWeight,
          est1RM: calculate1RM(maxWeight, maxReps),
        })
      })
    })

    Object.keys(map).forEach((name) => {
      map[name] = map[name]
        .sort((a, b) => a.fullDate - b.fullDate)
        .map((item) => ({ date: item.date, maxWeight: item.maxWeight, est1RM: item.est1RM }))
    })

    return map
  }, [completedDays])

  const exerciseOptions = useMemo(
    () => Object.keys(exerciseProgressSeries).sort((a, b) => a.localeCompare(b)),
    [exerciseProgressSeries],
  )

  useEffect(() => {
    if (exerciseOptions.length === 0) {
      setSelectedExercise('')
      return
    }

    if (!selectedExercise || !exerciseOptions.includes(selectedExercise)) {
      setSelectedExercise(exerciseOptions[0])
    }
  }, [exerciseOptions, selectedExercise])

  const selectedExerciseSeries = useMemo(
    () => exerciseProgressSeries[selectedExercise] || [],
    [exerciseProgressSeries, selectedExercise],
  )

  const heatmapWeeks = useMemo(() => {
    const dailyCounts = {}
    completedDays.forEach((day) => {
      const key = formatDay(new Date(day.date))
      dailyCounts[key] = (dailyCounts[key] || 0) + 1
    })

    const thisWeekStart = startOfWeek(new Date())
    const firstWeekStart = addDays(thisWeekStart, -11 * 7)

    const weeks = []
    for (let weekIndex = 0; weekIndex < 12; weekIndex++) {
      const weekStartDate = addDays(firstWeekStart, weekIndex * 7)
      const days = []

      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const date = addDays(weekStartDate, dayIndex)
        const key = formatDay(date)
        days.push({
          key,
          date,
          count: dailyCounts[key] || 0,
        })
      }

      weeks.push(days)
    }

    return weeks
  }, [completedDays])

  const activeHeatmapDays = useMemo(() => {
    return heatmapWeeks.flat().filter((day) => day.count > 0).length
  }, [heatmapWeeks])

  const bodyweightSeries = useMemo(() => {
    return [...bodyweightLogs]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((entry) => ({
        date: formatShortDate(new Date(entry.date)),
        weight: Number(entry.weight),
      }))
  }, [bodyweightLogs])

  const latestBodyweight = bodyweightSeries.length
    ? bodyweightSeries[bodyweightSeries.length - 1].weight
    : null

  const bodyweightDelta = bodyweightSeries.length > 1
    ? Number((bodyweightSeries[bodyweightSeries.length - 1].weight - bodyweightSeries[0].weight).toFixed(1))
    : null

  const achievementProgress = useMemo(() => {
    const liftMaxes = getBestLiftMaxes(completedDays)
    const bestStreak = getBestStreak(completedDays)

    const phase1Complete = currentPhaseId !== 'phase_1' || completedDays.some((day) => day.phaseId === 'phase_2' || day.phaseId === 'phase_3')
    const phase2Complete = currentPhaseId === 'phase_3' || completedDays.some((day) => day.phaseId === 'phase_3')
    const phase3Complete = completedDays.some((day) => day.phaseId === 'phase_3' && (day.week || 0) >= 6)
    const programComplete = phase3Complete && currentPhaseId === 'phase_3' && currentWeek >= 6

    const localEarned = new Set()

    BADGES.forEach((badge) => {
      if (badge.type === 'count' && workoutCount >= badge.threshold) localEarned.add(badge.id)
      if (badge.type === 'streak' && bestStreak >= badge.threshold) localEarned.add(badge.id)
      if (badge.type === 'strength' && liftMaxes[badge.lift] >= badge.threshold) localEarned.add(badge.id)
      if (badge.id === 'phase_1_complete' && phase1Complete) localEarned.add(badge.id)
      if (badge.id === 'phase_2_complete' && phase2Complete) localEarned.add(badge.id)
      if (badge.id === 'phase_3_complete' && phase3Complete) localEarned.add(badge.id)
      if (badge.id === 'program_complete' && programComplete) localEarned.add(badge.id)
    })

    const merged = new Set([...Object.keys(earnedAchievementMap), ...localEarned])

    return {
      bestStreak,
      liftMaxes,
      earned: merged,
    }
  }, [completedDays, currentPhaseId, currentWeek, earnedAchievementMap, workoutCount])

  const handleAddBodyweight = () => {
    const parsed = parseFloat(bodyweightInput)
    if (!Number.isFinite(parsed) || parsed <= 0) return
    logBodyweight(parsed)
    setBodyweightInput('')
  }

  const showStatsEmpty = workoutCount < 2

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-24">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-zinc-900">Training Analytics</h2>
        <p className="text-sm text-zinc-500">
          {workoutCount} sessions tracked
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Sessions</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{workoutCount}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Total Volume</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{formatCompactNumber(Math.round(totalVolumeAllTime))}</p>
            <p className="text-xs text-zinc-500">kg lifted</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Avg Sets/Week</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{avgSetsPerWeek}</p>
            <p className="text-xs text-zinc-500">last 6 weeks</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Best Streak</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{achievementProgress.bestStreak}</p>
            <p className="text-xs text-zinc-500">consecutive days</p>
          </div>
        </div>
      </div>

      {showStatsEmpty ? (
        <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-900">Stats preview</h3>
          <p className="mt-2 text-sm text-zinc-600">Log at least 2 workouts to see your stats.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="h-40 animate-pulse rounded-lg bg-zinc-100" />
            <div className="h-40 animate-pulse rounded-lg bg-zinc-100" />
            <div className="h-40 animate-pulse rounded-lg bg-zinc-100 md:col-span-2" />
          </div>
          <div className="mt-4">
            <button
              onClick={() => navigate('/workout')}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Start a Workout
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-800">Weekly Volume by Muscle Group (Last 8 Weeks)</h3>
              <p className="text-xs text-zinc-500">Stacked bars show where your weekly load is concentrated.</p>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyVolumeByMuscleData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                  <XAxis dataKey="weekShort" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4e4e7', fontSize: 12 }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  {MUSCLE_GROUPS.map((group) => (
                    <Bar key={group} dataKey={group} stackId="volume" fill={MUSCLE_COLORS[group]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-800">Total Sets per Week (Last 12 Weeks)</h3>
              <p className="text-xs text-zinc-500">Use this trend to spot fatigue spikes or missed weeks.</p>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={totalSetsPerWeekData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                  <XAxis dataKey="weekShort" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4e4e7', fontSize: 12 }} />
                  <Line type="monotone" dataKey="totalSets" stroke="#18181b" strokeWidth={2.5} dot={{ r: 3, fill: '#18181b' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-semibold text-zinc-800">PR Progress per Exercise</h3>
              <select
                value={selectedExercise}
                onChange={(e) => setSelectedExercise(e.target.value)}
                disabled={exerciseOptions.length === 0}
                className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 outline-none focus:border-zinc-400"
              >
                {exerciseOptions.length === 0 ? (
                  <option value="">No exercises yet</option>
                ) : (
                  exerciseOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))
                )}
              </select>
            </div>

            <div className="h-64 w-full">
              {selectedExerciseSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selectedExerciseSeries}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4e4e7', fontSize: 12 }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                    <Line type="monotone" dataKey="maxWeight" name="Max Weight (kg)" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="est1RM" name="Estimated 1RM (kg)" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-500">
                  No data for selected exercise yet.
                </div>
              )}
            </div>
          </section>

          <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-800">Workout Frequency Heatmap (Last 12 Weeks)</h3>
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
                {activeHeatmapDays} active days
              </span>
            </div>
            <div className="overflow-x-auto">
              <div className="flex min-w-max gap-1">
                {heatmapWeeks.map((week, weekIdx) => (
                  <div key={weekIdx} className="grid grid-rows-7 gap-1">
                    {week.map((day) => (
                      <div
                        key={day.key}
                        title={`${day.date.toLocaleDateString()} - ${day.count} workout${day.count === 1 ? '' : 's'}`}
                        className={`h-3.5 w-3.5 rounded-sm ${getHeatColor(day.count)}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-zinc-500">
              <span>Less</span>
              <span className="h-3 w-3 rounded-sm bg-zinc-100" />
              <span className="h-3 w-3 rounded-sm bg-emerald-200" />
              <span className="h-3 w-3 rounded-sm bg-emerald-400" />
              <span className="h-3 w-3 rounded-sm bg-emerald-600" />
              <span>More</span>
            </div>
          </section>
        </>
      )}

      <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-800">Body Weight Log</h3>
            {latestBodyweight !== null ? (
              <p className="text-xs text-zinc-500">
                Latest: {latestBodyweight.toFixed(1)} kg
                {bodyweightDelta !== null && (
                  <span className={`ml-2 font-semibold ${bodyweightDelta > 0 ? 'text-amber-700' : bodyweightDelta < 0 ? 'text-emerald-700' : 'text-zinc-500'}`}>
                    {bodyweightDelta > 0 ? '+' : ''}{bodyweightDelta.toFixed(1)} kg since first log
                  </span>
                )}
              </p>
            ) : (
              <p className="text-xs text-zinc-500">No body weight entries yet.</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={bodyweightInput}
              onChange={(e) => setBodyweightInput(e.target.value)}
              className="w-28 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              placeholder="kg"
            />
            <button
              onClick={handleAddBodyweight}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              Add Today
            </button>
          </div>
        </div>

        <div className="h-64 w-full">
          {bodyweightSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bodyweightSeries}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4e4e7', fontSize: 12 }} />
                <Line type="monotone" dataKey="weight" stroke="#059669" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-500">
              Add your body weight to start tracking the trend.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-800">Achievements</h3>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
            {achievementProgress.earned.size} / {BADGES.length} earned
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BADGES.map((badge) => {
            const earned = achievementProgress.earned.has(badge.id)
            const earnedAt = earnedAchievementMap[badge.id] || null

            let progressText = null
            let progressRatio = null
            if (badge.type === 'count') {
              progressText = `${Math.min(workoutCount, badge.threshold)} / ${badge.threshold}`
              progressRatio = Math.min(workoutCount / badge.threshold, 1)
            } else if (badge.type === 'streak') {
              progressText = `${Math.min(achievementProgress.bestStreak, badge.threshold)} / ${badge.threshold}`
              progressRatio = Math.min(achievementProgress.bestStreak / badge.threshold, 1)
            }

            return (
              <MilestoneBadge
                key={badge.id}
                badge={badge}
                earned={earned}
                earnedAt={earnedAt}
                progressText={progressText}
                progressRatio={progressRatio}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}

export default StatsPage
