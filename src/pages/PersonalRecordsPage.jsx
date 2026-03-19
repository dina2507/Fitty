import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import MuscleGroupBadge from '../components/MuscleGroupBadge'
import { useWorkoutStore } from '../store/useWorkoutStore'
import {
  buildPersonalRecords,
  buildRecordsLookup,
  buildRepPrRows,
  evaluateGoal,
} from '../utils/personalRecords'

function formatDate(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleDateString()
}

function formatWeight(value) {
  if (!Number.isFinite(Number(value))) return '--'
  return `${Number(value).toFixed(1)} kg`
}

function PersonalRecordsPage() {
  const completedDays = useWorkoutStore((state) => state.completedDays)
  const exerciseGoals = useWorkoutStore((state) => state.exerciseGoals)
  const upsertExerciseGoal = useWorkoutStore((state) => state.upsertExerciseGoal)
  const removeExerciseGoal = useWorkoutStore((state) => state.removeExerciseGoal)

  const [searchQuery, setSearchQuery] = useState('')
  const [muscleFilter, setMuscleFilter] = useState('All')
  const [expandedRecord, setExpandedRecord] = useState('')

  const [goalExerciseName, setGoalExerciseName] = useState('')
  const [goalType, setGoalType] = useState('top_set')
  const [goalTargetWeight, setGoalTargetWeight] = useState('')
  const [goalTargetReps, setGoalTargetReps] = useState('5')
  const [goalNotes, setGoalNotes] = useState('')
  const [formStatus, setFormStatus] = useState('')

  const records = useMemo(() => buildPersonalRecords(completedDays), [completedDays])
  const recordsLookup = useMemo(() => buildRecordsLookup(records), [records])

  const muscleOptions = useMemo(() => {
    const options = new Set(['All'])
    records.forEach((record) => {
      options.add(record.muscleGroup || 'Full Body')
    })
    return [...options]
  }, [records])

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesSearch = !searchQuery || record.exerciseName.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesMuscle = muscleFilter === 'All' || (record.muscleGroup || 'Full Body') === muscleFilter
      return matchesSearch && matchesMuscle
    })
  }, [records, searchQuery, muscleFilter])

  useEffect(() => {
    if (records.length === 0) {
      setGoalExerciseName('')
      return
    }

    const exists = records.some((record) => record.exerciseName === goalExerciseName)
    if (!goalExerciseName || !exists) {
      setGoalExerciseName(records[0].exerciseName)
    }
  }, [records, goalExerciseName])

  useEffect(() => {
    if (filteredRecords.length === 0) {
      setExpandedRecord('')
      return
    }

    const exists = filteredRecords.some((record) => record.exerciseName === expandedRecord)
    if (!expandedRecord || !exists) {
      setExpandedRecord(filteredRecords[0].exerciseName)
    }
  }, [filteredRecords, expandedRecord])

  const bestEstimatedOneRepMax = useMemo(() => {
    return records.reduce((best, record) => {
      const value = record?.bestE1RM?.value || 0
      return value > best ? value : best
    }, 0)
  }, [records])

  const goalStatuses = useMemo(() => {
    return (Array.isArray(exerciseGoals) ? exerciseGoals : [])
      .map((goal) => {
        const record = recordsLookup[String(goal.exerciseName || '').toLowerCase()] || null
        const evaluation = evaluateGoal(goal, record)
        return {
          goal,
          record,
          evaluation,
        }
      })
      .filter((item) => item.evaluation)
      .sort((a, b) => {
        if (a.evaluation.achieved !== b.evaluation.achieved) {
          return a.evaluation.achieved ? 1 : -1
        }
        return new Date(b.goal.updatedAt || b.goal.createdAt || 0).getTime() - new Date(a.goal.updatedAt || a.goal.createdAt || 0).getTime()
      })
  }, [exerciseGoals, recordsLookup])

  const activeGoals = goalStatuses.filter((item) => !item.evaluation.achieved)
  const achievedGoals = goalStatuses.filter((item) => item.evaluation.achieved)

  const handleSaveGoal = () => {
    const targetWeight = Number(goalTargetWeight)
    const targetReps = Number(goalTargetReps)

    if (!goalExerciseName) {
      setFormStatus('Choose an exercise first.')
      return
    }

    if (!Number.isFinite(targetWeight) || targetWeight <= 0) {
      setFormStatus('Enter a valid target weight.')
      return
    }

    if (goalType === 'top_set' && (!Number.isFinite(targetReps) || targetReps <= 0)) {
      setFormStatus('Enter valid target reps.')
      return
    }

    const existing = (exerciseGoals || []).find((goal) => {
      return goal.exerciseName === goalExerciseName && goal.type === goalType
    })

    const savedGoalId = upsertExerciseGoal({
      id: existing?.id,
      createdAt: existing?.createdAt,
      exerciseName: goalExerciseName,
      type: goalType,
      targetWeight,
      targetReps: goalType === 'top_set' ? Math.round(targetReps) : null,
      notes: goalNotes,
    })

    if (!savedGoalId) {
      setFormStatus('Could not save goal. Check goal fields and try again.')
      return
    }

    setFormStatus(existing ? 'Goal updated.' : 'Goal saved.')
    setGoalTargetWeight('')
    setGoalTargetReps('5')
    setGoalNotes('')
  }

  const handleRemoveGoal = (goalId) => {
    if (!goalId) return
    const ok = window.confirm('Remove this goal?')
    if (!ok) return
    const removed = removeExerciseGoal(goalId)
    if (removed) {
      setFormStatus('Goal removed.')
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 pb-24">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Records Center</p>
            <h1 className="text-2xl font-bold text-zinc-900">Personal Records and Goal Tracking</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Drill into rep-specific PRs, then set targets and track progress against real logged sets.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Tracked Exercises</p>
              <p className="mt-1 text-xl font-semibold text-zinc-900">{records.length}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Best Estimated 1RM</p>
              <p className="mt-1 text-xl font-semibold text-zinc-900">{formatWeight(bestEstimatedOneRepMax)}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Active Goals</p>
              <p className="mt-1 text-xl font-semibold text-zinc-900">{activeGoals.length}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/stats"
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            Open Stats
          </Link>
          <Link
            to="/history"
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            Open History
          </Link>
          <Link
            to="/workout"
            className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
          >
            Log New Workout
          </Link>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Goal Planner</h2>
          <p className="mt-1 text-xs text-zinc-500">Create a top-set target or estimated 1RM target for any tracked exercise.</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold text-zinc-600">
              Exercise
              <select
                value={goalExerciseName}
                onChange={(event) => setGoalExerciseName(event.target.value)}
                disabled={records.length === 0}
                className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
              >
                {records.length === 0 ? (
                  <option value="">No exercises logged</option>
                ) : (
                  records.map((record) => (
                    <option key={record.exerciseName} value={record.exerciseName}>{record.exerciseName}</option>
                  ))
                )}
              </select>
            </label>

            <label className="grid gap-1 text-xs font-semibold text-zinc-600">
              Goal Type
              <select
                value={goalType}
                onChange={(event) => setGoalType(event.target.value === 'e1rm' ? 'e1rm' : 'top_set')}
                className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
              >
                <option value="top_set">Top Set (weight x reps)</option>
                <option value="e1rm">Estimated 1RM</option>
              </select>
            </label>

            <label className="grid gap-1 text-xs font-semibold text-zinc-600">
              Target Weight (kg)
              <input
                type="number"
                inputMode="decimal"
                value={goalTargetWeight}
                onChange={(event) => setGoalTargetWeight(event.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
                placeholder="100"
              />
            </label>

            {goalType === 'top_set' && (
              <label className="grid gap-1 text-xs font-semibold text-zinc-600">
                Target Reps
                <input
                  type="number"
                  inputMode="numeric"
                  value={goalTargetReps}
                  onChange={(event) => setGoalTargetReps(event.target.value)}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
                  placeholder="5"
                />
              </label>
            )}
          </div>

          <label className="mt-3 grid gap-1 text-xs font-semibold text-zinc-600">
            Notes (optional)
            <input
              type="text"
              value={goalNotes}
              onChange={(event) => setGoalNotes(event.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
              placeholder="Meet this by end of month"
            />
          </label>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveGoal}
              disabled={records.length === 0}
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              Save Goal
            </button>
            {formStatus && <p className="text-xs text-zinc-600">{formStatus}</p>}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">Goal Progress</h2>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
              {goalStatuses.length} total
            </span>
          </div>

          {goalStatuses.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
              No goals yet. Create your first target to start tracking.
            </p>
          ) : (
            <div className="grid gap-2">
              {goalStatuses.map(({ goal, evaluation }) => (
                <article
                  key={goal.id}
                  className={`rounded-lg border px-3 py-2 ${
                    evaluation.achieved
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-zinc-200 bg-zinc-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{goal.exerciseName}</p>
                      <p className="text-xs text-zinc-600">Target: {evaluation.targetLabel}</p>
                      <p className="text-xs text-zinc-500">Best: {evaluation.bestLabel}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {evaluation.achieved && (
                        <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-900">
                          Achieved
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveGoal(goal.id)}
                        className="rounded-full border border-zinc-300 px-2.5 py-1 text-[10px] font-semibold text-zinc-600 hover:bg-zinc-100"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className={`h-full ${evaluation.achieved ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                      style={{ width: `${Math.max(6, Math.round((evaluation.progressRatio || 0) * 100))}%` }}
                    />
                  </div>

                  <p className="mt-1 text-[11px] text-zinc-600">{evaluation.statusText}</p>
                </article>
              ))}
            </div>
          )}

          {achievedGoals.length > 0 && (
            <p className="mt-3 text-[11px] text-zinc-500">
              {achievedGoals.length} goal{achievedGoals.length === 1 ? '' : 's'} achieved
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Personal Records Detail Tables</h2>

          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
              placeholder="Search exercise"
            />
            <select
              value={muscleFilter}
              onChange={(event) => setMuscleFilter(event.target.value)}
              className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
            >
              {muscleOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-3 text-sm text-zinc-500">
            No PR records match this filter yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredRecords.map((record) => {
              const isExpanded = expandedRecord === record.exerciseName
              const repRows = buildRepPrRows(record, { minReps: 1, maxReps: 12 })
              const topSets = record.allSets.slice(0, 5)

              return (
                <article key={record.exerciseName} className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                  <button
                    type="button"
                    onClick={() => setExpandedRecord(isExpanded ? '' : record.exerciseName)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left hover:bg-zinc-100"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-zinc-900">{record.exerciseName}</h3>
                        <MuscleGroupBadge group={record.muscleGroup || 'Full Body'} size="xs" />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-zinc-600">
                        <span>Best Set: {record.bestSet ? `${record.bestSet.weight.toFixed(1)} kg${record.bestSet.reps ? ` x ${record.bestSet.reps}` : ''}` : '--'}</span>
                        <span>Best e1RM: {record.bestE1RM ? `${record.bestE1RM.value.toFixed(1)} kg` : '--'}</span>
                        <span>Last: {formatDate(record.lastPerformedAt)}</span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-zinc-500">{isExpanded ? 'Hide' : 'View'}</span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-zinc-200 bg-white px-3 py-3">
                      <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">
                        <div>
                          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Rep PR Table (1 to 12 reps)</h4>
                          <div className="overflow-x-auto rounded-lg border border-zinc-200">
                            <table className="min-w-full text-left text-xs">
                              <thead className="bg-zinc-100 text-zinc-600">
                                <tr>
                                  <th className="px-2 py-1.5 font-semibold">Reps</th>
                                  <th className="px-2 py-1.5 font-semibold">Best Weight</th>
                                  <th className="px-2 py-1.5 font-semibold">Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {repRows.map((row) => (
                                  <tr key={row.reps} className="border-t border-zinc-100">
                                    <td className="px-2 py-1.5 text-zinc-600">{row.reps}</td>
                                    <td className="px-2 py-1.5 font-medium text-zinc-900">
                                      {row.best ? `${row.best.weight.toFixed(1)} kg` : '--'}
                                    </td>
                                    <td className="px-2 py-1.5 text-zinc-500">{row.best ? formatDate(row.best.date) : '--'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div>
                          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Top Logged Sets</h4>
                          <div className="grid gap-2">
                            {topSets.length === 0 && (
                              <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                                No set-level data for this exercise yet.
                              </p>
                            )}

                            {topSets.map((set, index) => (
                              <div key={`${record.exerciseName}_${index}`} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                                <p className="text-sm font-semibold text-zinc-900">
                                  {set.weight.toFixed(1)} kg{set.reps ? ` x ${set.reps}` : ''}
                                </p>
                                <p className="text-[11px] text-zinc-500">{formatDate(set.date)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

export default PersonalRecordsPage
