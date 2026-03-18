import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MuscleGroupBadge from '../components/MuscleGroupBadge'
import { useAuth } from '../components/AuthProvider'
import { supabase } from '../lib/supabaseClient'
import { enqueueMutation } from '../utils/syncQueue'
import { useWorkoutStore } from '../store/useWorkoutStore'
import { calculateWorkoutVolume } from '../utils/volumeCalc'
import { getHistoricalPRs } from '../hooks/usePRDetection'
import { calculate1RM } from '../utils/oneRepMax'
import { storage } from '../utils/storage'
import { createWorkoutLogId, toWorkoutDateOnly } from '../utils/workoutLogIdentity'
import { buildWorkoutHistoryCSV, downloadCsvFile } from '../utils/csvExport'
import { generateMonthlyPDF } from '../utils/pdfExport'

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

const TYPE_FILTERS = ['All', 'Push', 'Pull', 'Legs']

function toMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeWorkoutLabel(item) {
  return item.label || item.workout_name || 'Workout'
}

function getTypeLabel(item) {
  const raw = (item.label || item.workout_name || item.workout_type || '').toLowerCase()
  if (raw.includes('push')) return 'Push'
  if (raw.includes('pull')) return 'Pull'
  if (raw.includes('leg')) return 'Legs'
  return 'Custom'
}

function getUniqueMuscleGroups(exercises = []) {
  return [...new Set(exercises.map((exercise) => exercise.muscleGroup).filter(Boolean))]
}

function buildWorkoutDeleteMatch(log, userId) {
  if (!userId) return null

  const dateOnly = toWorkoutDateOnly(log?.date)
  if (!dateOnly) return null

  const match = {
    user_id: userId,
    date: dateOnly,
  }

  const phaseId = log?.phaseId || log?.phase_id || null
  if (phaseId) {
    match.phase_id = phaseId
  }

  const weekNumber = Number(log?.week ?? log?.week_number)
  if (Number.isFinite(weekNumber)) {
    match.week_number = weekNumber
  }

  const dayIndex = Number(log?.dayIndex ?? log?.day_index)
  if (Number.isFinite(dayIndex)) {
    match.day_index = dayIndex
  }

  return match
}

function queueWorkoutDelete(log, userId, nowIso) {
  const deletePayload = { deleted_at: nowIso, updated_at: nowIso }
  const legacyMatch = buildWorkoutDeleteMatch(log, userId)

  if (legacyMatch) {
    enqueueMutation('workout_logs', 'update', deletePayload, legacyMatch)
    return
  }

  if (log?.id && userId) {
    enqueueMutation('workout_logs', 'update', deletePayload, { user_id: userId, id: log.id })
  }
}

function findExerciseSessionMax(exercise) {
  let maxWeight = 0
  let repsAtMax = null

  if (Array.isArray(exercise?.sets)) {
    exercise.sets.forEach((set) => {
      const weight = parseFloat(set.weight) || 0
      const reps = parseInt(set.reps, 10) || null
      if (weight > maxWeight) {
        maxWeight = weight
        repsAtMax = reps
      }
    })
  } else {
    const weight = parseFloat(exercise?.weight) || 0
    if (weight > maxWeight) {
      maxWeight = weight
      repsAtMax = parseInt(exercise?.reps, 10) || null
    }
  }

  return { maxWeight, repsAtMax }
}

function EditWorkoutModal({
  draft,
  onClose,
  onSave,
  onChangeSet,
  onChangeExerciseNotes,
  onChangeSessionNotes,
  isSaving,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">Edit Workout</h3>
            <p className="text-xs text-zinc-500">
              {new Date(draft.date).toLocaleDateString()} · {normalizeWorkoutLabel(draft)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            disabled={isSaving}
          >
            ×
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
          <section className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Session Notes
              <textarea
                value={draft.sessionNotes || draft.session_notes || ''}
                onChange={(e) => onChangeSessionNotes(e.target.value)}
                className="min-h-16 rounded border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-400"
                placeholder="Session notes"
              />
            </label>
          </section>

          <div className="space-y-4">
            {(draft.exercises || []).map((exercise, exIdx) => (
              <section
                key={`${exercise.exerciseId || exercise.id || exIdx}`}
                className="rounded-xl border border-zinc-200 bg-zinc-50 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-zinc-900">{exercise.name}</h4>
                  {exercise.muscleGroup && <MuscleGroupBadge group={exercise.muscleGroup} size="xs" />}
                </div>

                {(exercise.sets || []).map((set, setIdx) => (
                  <div key={setIdx} className="mb-2 grid grid-cols-[2.5rem_1fr_1fr_1fr] gap-2">
                    <span className="rounded border border-zinc-200 bg-white px-2 py-1.5 text-center text-xs text-zinc-500">
                      {set.setNumber || setIdx + 1}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={set.weight ?? ''}
                      onChange={(e) => onChangeSet(exIdx, setIdx, 'weight', e.target.value)}
                      className="rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                      placeholder="Weight"
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={set.reps ?? ''}
                      onChange={(e) => onChangeSet(exIdx, setIdx, 'reps', e.target.value)}
                      className="rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                      placeholder="Reps"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={set.rpe ?? ''}
                      onChange={(e) => onChangeSet(exIdx, setIdx, 'rpe', e.target.value)}
                      className="rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                      placeholder="RPE"
                    />
                  </div>
                ))}

                <textarea
                  value={exercise.notes || ''}
                  onChange={(e) => onChangeExerciseNotes(exIdx, e.target.value)}
                  className="mt-1 min-h-12 w-full rounded border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 outline-none focus:border-zinc-400"
                  placeholder="Exercise notes"
                />
              </section>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function HistoryPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const completedDays = useWorkoutStore((state) => state.completedDays)

  const [expandedIndex, setExpandedIndex] = useState(null)
  const [viewMonth, setViewMonth] = useState(() => toMonthStart(new Date()))
  const [filterType, setFilterType] = useState('All')
  const [filterMuscle, setFilterMuscle] = useState('All')
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [isExportingCsv, setIsExportingCsv] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isDeletingIndex, setIsDeletingIndex] = useState(null)
  const [editing, setEditing] = useState(null)
  const [exportStatus, setExportStatus] = useState('')

  const { historicalFlags } = useMemo(() => getHistoricalPRs(completedDays), [completedDays])

  const monthLabel = useMemo(
    () => viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    [viewMonth],
  )
  const hasActiveFilters = filterType !== 'All' || filterMuscle !== 'All'
  const canGoForwardMonth = useMemo(() => {
    const currentMonth = toMonthStart(new Date())
    return viewMonth.getTime() < currentMonth.getTime()
  }, [viewMonth])

  const prLeaderboard = useMemo(() => {
    const map = {}

    completedDays.forEach((day) => {
      ;(day.exercises || []).forEach((exercise) => {
        if (!exercise?.name) return

        const { maxWeight, repsAtMax } = findExerciseSessionMax(exercise)
        if (maxWeight <= 0) return

        const existing = map[exercise.name]
        if (!existing || maxWeight > existing.maxWeight) {
          map[exercise.name] = {
            name: exercise.name,
            muscleGroup: exercise.muscleGroup || 'Full Body',
            maxWeight,
            repsAtMax,
            date: day.date,
          }
        }
      })
    })

    return Object.values(map).sort((a, b) => b.maxWeight - a.maxWeight)
  }, [completedDays])

  const entries = useMemo(() => {
    let list = completedDays
      .map((item, originalIndex) => ({ item, originalIndex }))
      .filter(({ item }) => {
        const date = new Date(item.date)
        return (
          date.getFullYear() === viewMonth.getFullYear() &&
          date.getMonth() === viewMonth.getMonth()
        )
      })

    if (filterType !== 'All') {
      list = list.filter(({ item }) => getTypeLabel(item).toLowerCase() === filterType.toLowerCase())
    }

    if (filterMuscle !== 'All') {
      list = list.filter(({ item }) => {
        return (item.exercises || []).some(
          (exercise) => (exercise.muscleGroup || '').toLowerCase() === filterMuscle.toLowerCase(),
        )
      })
    }

    return list.sort((a, b) => new Date(b.item.date).getTime() - new Date(a.item.date).getTime())
  }, [completedDays, filterMuscle, filterType, viewMonth])

  const monthSummary = useMemo(() => {
    const sets = entries.reduce((sum, { item }) => {
      return sum + (item.exercises || []).reduce((exerciseSum, exercise) => {
        if (Array.isArray(exercise.sets)) return exerciseSum + exercise.sets.length
        return exerciseSum + 1
      }, 0)
    }, 0)

    const volume = entries.reduce((sum, { item }) => {
      return sum + calculateWorkoutVolume(item.exercises || [])
    }, 0)

    return {
      workouts: entries.length,
      sets,
      volume,
    }
  }, [entries])

  const setCompletedDays = (next) => {
    storage.saveCompletedDays(next)
    useWorkoutStore.setState({ completedDays: next })
  }

  const buildHistoryLogPayload = (log, userId, nowIso, { deletedAt = null } = {}) => {
    const dateOnly = toWorkoutDateOnly(log?.date)

    return {
      id: log?.id || createWorkoutLogId(),
      user_id: userId,
      date: dateOnly,
      phase_id: log?.phaseId || null,
      week_number: Number.isFinite(Number(log?.week)) ? Number(log.week) : null,
      day_index: Number.isFinite(Number(log?.dayIndex)) ? Number(log.dayIndex) : null,
      day_label: log?.label || log?.workout_name || 'Workout',
      workout_name: log?.label || log?.workout_name || 'Workout',
      exercises: Array.isArray(log?.exercises) ? log.exercises : [],
      notes: log?.sessionNotes || log?.session_notes || null,
      duration_minutes: log?.durationMinutes || log?.duration_minutes || null,
      pr_exercises: Array.isArray(log?.prExercises)
        ? log.prExercises
        : (Array.isArray(log?.pr_exercises) ? log.pr_exercises : []),
      updated_at: nowIso,
      deleted_at: deletedAt,
    }
  }

  const handleDelete = async (entry) => {
    const { item, originalIndex } = entry
    if (!window.confirm('Delete this workout? This action cannot be undone.')) return

    setIsDeletingIndex(originalIndex)

    const next = completedDays.filter((_, index) => index !== originalIndex)
    setCompletedDays(next)

    try {
      if (user?.id) {
        const nowIso = new Date().toISOString()
        const deletePayload = { deleted_at: nowIso, updated_at: nowIso }

        if (!navigator.onLine) {
          queueWorkoutDelete(item, user.id, nowIso)
        } else {
          let deletedRemote = false

          if (item.id) {
            const { data, error } = await supabase
              .from('workout_logs')
              .update(deletePayload)
              .match({ user_id: user.id, id: item.id })
              .select('id')

            if (!error && Array.isArray(data) && data.length > 0) {
              deletedRemote = true
            }
          }

          if (!deletedRemote) {
            const fallbackMatch = buildWorkoutDeleteMatch(item, user.id)

            if (fallbackMatch) {
              const { data, error } = await supabase
                .from('workout_logs')
                .update(deletePayload)
                .match(fallbackMatch)
                .is('deleted_at', null)
                .select('id')

              if (!error && Array.isArray(data) && data.length > 0) {
                deletedRemote = true
              }
            }
          }

          if (!deletedRemote) {
            queueWorkoutDelete(item, user.id, nowIso)
          }
        }
      }
    } catch (error) {
      console.error('Failed to delete workout log in Supabase:', error)
    } finally {
      setIsDeletingIndex(null)
      setExpandedIndex(null)
    }
  }

  const handleOpenEdit = (entry) => {
    setEditing({
      originalIndex: entry.originalIndex,
      draft: deepClone(entry.item),
    })
  }

  const handleDraftSetChange = (exerciseIndex, setIndex, field, value) => {
    setEditing((prev) => {
      if (!prev) return prev
      const draft = deepClone(prev.draft)
      if (!draft.exercises?.[exerciseIndex]?.sets?.[setIndex]) return prev
      draft.exercises[exerciseIndex].sets[setIndex][field] = value
      return { ...prev, draft }
    })
  }

  const handleDraftExerciseNotesChange = (exerciseIndex, value) => {
    setEditing((prev) => {
      if (!prev) return prev
      const draft = deepClone(prev.draft)
      if (!draft.exercises?.[exerciseIndex]) return prev
      draft.exercises[exerciseIndex].notes = value
      return { ...prev, draft }
    })
  }

  const handleDraftSessionNotesChange = (value) => {
    setEditing((prev) => {
      if (!prev) return prev
      const draft = deepClone(prev.draft)
      draft.sessionNotes = value
      draft.session_notes = value
      return { ...prev, draft }
    })
  }

  const handleSaveEdit = async () => {
    if (!editing) return
    setIsSavingEdit(true)

    const nowIso = new Date().toISOString()
    const updatedDraft = {
      ...editing.draft,
      id: editing.draft.id || createWorkoutLogId(),
      updatedAt: nowIso,
      updated_at: nowIso,
      deletedAt: null,
      deleted_at: null,
    }

    const next = [...completedDays]
    next[editing.originalIndex] = updatedDraft
    setCompletedDays(next)

    try {
      if (user?.id) {
        const logPayload = buildHistoryLogPayload(updatedDraft, user.id, nowIso, { deletedAt: null })

        if (!navigator.onLine) {
          enqueueMutation('workout_logs', 'upsert', logPayload)
        } else {
          const { error } = await supabase
            .from('workout_logs')
            .upsert(logPayload, { onConflict: 'id' })

          if (error) {
            enqueueMutation('workout_logs', 'upsert', logPayload)
          }
        }
      }
    } catch (error) {
      console.error('Failed to update workout log in Supabase:', error)
    } finally {
      setIsSavingEdit(false)
      setEditing(null)
    }
  }

  const handleExportPdf = () => {
    if (entries.length === 0) return
    setIsExportingPdf(true)
    setExportStatus('')

    try {
      const filteredMonthLogs = entries.map(({ item }) => item)
      generateMonthlyPDF(
        filteredMonthLogs,
        user?.email,
        viewMonth.getMonth() + 1,
        viewMonth.getFullYear(),
      )
      setExportStatus('Monthly PDF downloaded.')
    } catch (error) {
      console.error('Failed to export monthly PDF:', error)
      setExportStatus('PDF export failed. Please try again.')
    } finally {
      setIsExportingPdf(false)
    }
  }

  const handleExportCsv = () => {
    if (entries.length === 0) return
    setIsExportingCsv(true)
    setExportStatus('')

    try {
      const filteredMonthLogs = entries.map(({ item }) => item)
      const csv = buildWorkoutHistoryCSV(filteredMonthLogs)
      const filename = `history-${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, '0')}.csv`
      downloadCsvFile(csv, filename)
      setExportStatus('Monthly CSV downloaded (Excel-compatible).')
    } catch (error) {
      console.error('Failed to export monthly CSV:', error)
      setExportStatus('CSV export failed. Please try again.')
    } finally {
      setIsExportingCsv(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setViewMonth((current) => addMonths(current, -1))}
              className="rounded-full border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-100"
              title="Previous month"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <p className="min-w-44 text-center text-sm font-semibold text-zinc-800">{monthLabel}</p>
            <button
              onClick={() => setViewMonth((current) => addMonths(current, 1))}
              className="rounded-full border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
              title="Next month"
              disabled={!canGoForwardMonth}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
            </button>
            <button
              onClick={() => setViewMonth(toMonthStart(new Date()))}
              className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
            >
              This Month
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCsv}
              disabled={entries.length === 0 || isExportingCsv}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            >
              {isExportingCsv ? 'Exporting CSV...' : 'Export CSV'}
            </button>
            <button
              onClick={handleExportPdf}
              disabled={entries.length === 0 || isExportingPdf}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            >
              {isExportingPdf ? 'Exporting PDF...' : 'Export PDF'}
            </button>
          </div>
        </div>

        {exportStatus && <p className="text-xs text-zinc-600">{exportStatus}</p>}

        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-zinc-900">All-Time PR Leaderboard</h3>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
              🏆 {prLeaderboard.length} exercises
            </span>
          </div>

          {prLeaderboard.length === 0 ? (
            <p className="text-sm text-zinc-500">No PRs yet. Log a few workouts to populate this section.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {prLeaderboard.slice(0, 12).map((item) => (
                <div key={item.name} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900">{item.name}</p>
                    <p className="text-[11px] text-zinc-500">{new Date(item.date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-amber-700">{item.maxWeight}kg</p>
                    <p className="text-[11px] text-zinc-500">{item.repsAtMax ? `${item.repsAtMax} reps` : 'max set'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {TYPE_FILTERS.map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    filterType === type
                      ? 'bg-zinc-900 text-white'
                      : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {hasActiveFilters && (
              <button
                onClick={() => {
                  setFilterType('All')
                  setFilterMuscle('All')
                }}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
              >
                Clear Filters
              </button>
            )}
          </div>

          <p className="text-[11px] text-zinc-500">
            Active: {filterType} type · {filterMuscle === 'All' ? 'All muscles' : filterMuscle}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilterMuscle('All')}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                filterMuscle === 'All'
                  ? 'bg-emerald-600 text-white'
                  : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              All Muscles
            </button>
            {MUSCLE_GROUPS.map((group) => (
              <button
                key={group}
                onClick={() => setFilterMuscle(group)}
                className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                  filterMuscle === group
                    ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                {group}
              </button>
            ))}
          </div>
        </div>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-zinc-900">Completed Workouts</h2>
              <p className="text-zinc-600">Quick monthly snapshot at a glance.</p>
            </div>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
              {entries.length} visible entries
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Sessions</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">{monthSummary.workouts}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Total Sets</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">{monthSummary.sets}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Volume</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {Math.round(monthSummary.volume).toLocaleString()} <span className="text-base text-zinc-500">kg</span>
              </p>
            </div>
          </div>
        </section>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-900">No workouts in this view</h3>
          <p className="mt-2 text-sm text-zinc-600">Try a different month or loosen your filters.</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setViewMonth(toMonthStart(new Date()))}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
            >
              Go to This Month
            </button>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setFilterType('All')
                  setFilterMuscle('All')
                }}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                Reset Filters
              </button>
            )}
            <button
              onClick={() => navigate('/workout')}
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Start Workout
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {entries.map((entry) => {
            const { item, originalIndex } = entry
            const isExpanded = expandedIndex === originalIndex
            const workoutType = getTypeLabel(item)
            const muscleGroups = getUniqueMuscleGroups(item.exercises || [])
            const sessionNote = item.sessionNotes || item.session_notes || item.notes
            const totalSets = (item.exercises || []).reduce((sum, exercise) => {
              if (Array.isArray(exercise.sets)) return sum + exercise.sets.length
              return sum + 1
            }, 0)
            const totalVolume = calculateWorkoutVolume(item.exercises || [])

            return (
              <article key={`${item.date}-${originalIndex}`} className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                <button
                  onClick={() => setExpandedIndex(isExpanded ? null : originalIndex)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-500">{new Date(item.date).toLocaleDateString()}</p>
                    <h3 className="text-base font-semibold text-zinc-900">{normalizeWorkoutLabel(item)}</h3>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700">
                        {workoutType}
                      </span>
                      <span>{totalSets} sets</span>
                      <span>•</span>
                      <span className="font-semibold text-zinc-700">{Math.round(totalVolume).toLocaleString()} kg vol.</span>
                    </div>

                    {muscleGroups.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {muscleGroups.map((group) => (
                          <MuscleGroupBadge key={`${item.date}-${group}`} group={group} size="xs" />
                        ))}
                      </div>
                    )}
                  </div>

                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`shrink-0 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="border-t border-zinc-100 px-4 py-3">
                    {sessionNote && (
                      <div className="mb-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Session Notes</p>
                        <p className="text-sm text-zinc-700">{sessionNote}</p>
                      </div>
                    )}

                    <div className="grid gap-3">
                      {(item.exercises || []).map((exercise, exIdx) => (
                        <div key={`${item.date}-${exercise.exerciseId || exIdx}`} className="rounded-lg bg-zinc-50 p-3">
                          <div className="mb-2 flex items-center gap-2">
                            <p className="text-sm font-medium text-zinc-900">{exercise.name}</p>
                            {exercise.muscleGroup && <MuscleGroupBadge group={exercise.muscleGroup} size="xs" />}
                          </div>

                          {Array.isArray(exercise.sets) && exercise.sets.length > 0 ? (
                            <div className="grid gap-1">
                              {exercise.sets.map((set, setIdx) => {
                                const isPR = historicalFlags.has(`${originalIndex}-${exIdx}-${setIdx}`)

                                return (
                                  <p key={setIdx} className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-600">
                                    <span className="w-10 text-zinc-400">Set {set.setNumber || setIdx + 1}</span>
                                    <span className="font-medium text-zinc-900">{set.weight ? `${set.weight}kg` : '—'}</span>
                                    {set.reps ? ` × ${set.reps}` : ''}
                                    {set.rpe ? ` @ RPE ${set.rpe}` : ''}
                                    {set.weight && set.reps && (
                                      <span className="ml-auto text-zinc-400">(Est. 1RM: {calculate1RM(set.weight, set.reps)}kg)</span>
                                    )}
                                    {isPR && <span className="ml-1 text-[10px]" title="Personal Record">🏆</span>}
                                  </p>
                                )
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-600">
                              {exercise.weight ? `${exercise.weight}kg` : '—'}
                              {exercise.reps ? ` × ${exercise.reps}` : ''}
                            </p>
                          )}

                          {exercise.notes && (
                            <p className="mt-2 border-l-2 border-zinc-200 pl-2 text-xs italic text-zinc-500">
                              "{exercise.notes}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(entry)}
                        className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(entry)}
                        disabled={isDeletingIndex === originalIndex}
                        className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {isDeletingIndex === originalIndex ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {editing && (
        <EditWorkoutModal
          draft={editing.draft}
          onClose={() => (isSavingEdit ? null : setEditing(null))}
          onSave={handleSaveEdit}
          onChangeSet={handleDraftSetChange}
          onChangeExerciseNotes={handleDraftExerciseNotesChange}
          onChangeSessionNotes={handleDraftSessionNotesChange}
          isSaving={isSavingEdit}
        />
      )}
    </div>
  )
}

export default HistoryPage
