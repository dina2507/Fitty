import { strToU8, zipSync } from 'fflate'

const WEEKLY_GROUPS = [
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
]

function escapeCsv(value) {
  if (value === null || value === undefined) return ''
  const stringValue = String(value)
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function getSetRows(exercise) {
  if (Array.isArray(exercise?.sets) && exercise.sets.length > 0) {
    return exercise.sets.map((set, index) => ({
      setNumber: set.setNumber || index + 1,
      weight: toNumber(set.weight),
      reps: toNumber(set.reps),
      rpe: set.rpe ?? '',
    }))
  }

  return [{
    setNumber: 1,
    weight: toNumber(exercise?.weight),
    reps: toNumber(exercise?.reps),
    rpe: exercise?.rpe ?? '',
  }]
}

function toWeekStart(date) {
  const next = new Date(date)
  const day = next.getDay() || 7
  next.setHours(0, 0, 0, 0)
  next.setDate(next.getDate() - (day - 1))
  return next.toISOString().split('T')[0]
}

function normalizeGroup(group) {
  if (!group) return null
  if (group === 'Legs') return 'Quads'
  if (group === 'Full Body') return null
  return WEEKLY_GROUPS.includes(group) ? group : null
}

export function buildWorkoutHistoryCSV(workoutLogs) {
  const rows = [[
    'Date',
    'Workout',
    'Phase',
    'Week',
    'Exercise',
    'Muscle Group',
    'Set',
    'Weight (kg)',
    'Reps',
    'RPE',
    'Volume (kg)',
  ]]

  ;(workoutLogs || [])
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach((day) => {
      const date = normalizeDate(day.date)
      const dateLabel = date ? date.toISOString().split('T')[0] : ''
      const workoutName = day.label || day.workout_name || day.day_label || 'Workout'
      const phase = day.phaseId || day.phase_id || ''
      const week = day.week || day.week_number || ''

      ;(day.exercises || []).forEach((exercise) => {
        const setRows = getSetRows(exercise)
        const muscleGroup = exercise.muscleGroup || exercise.muscle_group || ''

        setRows.forEach((set) => {
          const volume = set.weight * set.reps
          rows.push([
            dateLabel,
            workoutName,
            phase,
            week,
            exercise.name || '',
            muscleGroup,
            set.setNumber,
            set.weight || '',
            set.reps || '',
            set.rpe || '',
            volume || '',
          ])
        })
      })
    })

  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n')
}

export function buildPRsCSV(workoutLogs) {
  const maxMap = new Map()

  ;(workoutLogs || []).forEach((day) => {
    const date = normalizeDate(day.date)
    const dateLabel = date ? date.toISOString().split('T')[0] : ''

    ;(day.exercises || []).forEach((exercise) => {
      const setRows = getSetRows(exercise)
      setRows.forEach((set) => {
        if (!set.weight || set.weight <= 0) return

        const key = exercise.name || 'Exercise'
        const existing = maxMap.get(key)
        if (!existing || set.weight > existing.maxWeight) {
          maxMap.set(key, {
            exercise: key,
            muscleGroup: exercise.muscleGroup || exercise.muscle_group || '',
            maxWeight: set.weight,
            repsAtMax: set.reps || '',
            est1RM: set.weight && set.reps ? Number((set.weight * (1 + set.reps / 30)).toFixed(1)) : '',
            dateAchieved: dateLabel,
          })
        }
      })
    })
  })

  const header = ['Exercise', 'Muscle Group', 'Max Weight (kg)', 'Reps at Max', 'Estimated 1RM', 'Date Achieved']
  const rows = [header]

  ;[...maxMap.values()]
    .sort((a, b) => b.maxWeight - a.maxWeight)
    .forEach((record) => {
      rows.push([
        record.exercise,
        record.muscleGroup,
        record.maxWeight,
        record.repsAtMax,
        record.est1RM,
        record.dateAchieved,
      ])
    })

  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n')
}

export function buildWeeklyVolumeCSV(workoutLogs) {
  const buckets = new Map()

  ;(workoutLogs || []).forEach((day) => {
    const date = normalizeDate(day.date)
    if (!date) return

    const weekStart = toWeekStart(date)

    if (!buckets.has(weekStart)) {
      buckets.set(weekStart, {
        weekStart,
        ...Object.fromEntries(WEEKLY_GROUPS.map((group) => [group, 0])),
      })
    }

    const bucket = buckets.get(weekStart)

    ;(day.exercises || []).forEach((exercise) => {
      const group = normalizeGroup(exercise.muscleGroup || exercise.muscle_group)
      if (!group) return
      const setCount = Array.isArray(exercise.sets) ? exercise.sets.length : 1
      bucket[group] += setCount
    })
  })

  const header = [
    'Week Starting',
    'Chest Sets',
    'Back Sets',
    'Shoulders Sets',
    'Biceps Sets',
    'Triceps Sets',
    'Quads Sets',
    'Hamstrings Sets',
    'Glutes Sets',
    'Calves Sets',
    'Core Sets',
  ]

  const rows = [header]

  ;[...buckets.values()]
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .forEach((bucket) => {
      rows.push([
        bucket.weekStart,
        bucket.Chest,
        bucket.Back,
        bucket.Shoulders,
        bucket.Biceps,
        bucket.Triceps,
        bucket.Quads,
        bucket.Hamstrings,
        bucket.Glutes,
        bucket.Calves,
        bucket.Core,
      ])
    })

  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n')
}

export function downloadAsZip(files) {
  const archiveEntries = {}

  ;(files || []).forEach((file) => {
    if (!file?.name || typeof file.content !== 'string') return
    archiveEntries[file.name] = strToU8(file.content)
  })

  const zipped = zipSync(archiveEntries)
  const blob = new Blob([zipped], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)

  const now = new Date().toISOString().split('T')[0]
  const link = document.createElement('a')
  link.href = url
  link.download = `ppl-tracker-export-${now}.zip`
  document.body.appendChild(link)
  link.click()
  link.remove()

  setTimeout(() => URL.revokeObjectURL(url), 500)
}

export function downloadCsvFile(content, filename) {
  if (typeof content !== 'string' || !content.trim()) return

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const safeName = filename?.endsWith('.csv') ? filename : `${filename || 'export'}.csv`
  const link = document.createElement('a')
  link.href = url
  link.download = safeName
  document.body.appendChild(link)
  link.click()
  link.remove()

  setTimeout(() => URL.revokeObjectURL(url), 500)
}
