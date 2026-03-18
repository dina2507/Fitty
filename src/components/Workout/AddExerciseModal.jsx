import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../AuthProvider'
import MuscleGroupBadge from '../MuscleGroupBadge'
import { MUSCLE_GROUPS } from '../../utils/muscleGroups'
import { generateId } from '../../utils/workoutHelpers'
import { useWorkoutStore } from '../../store/useWorkoutStore'

export function AddExerciseModal({ onAdd, onClose, activeIds }) {
  const { user } = useAuth()
  const program = useWorkoutStore((state) => state.program)
  const [searchQuery, setSearchQuery] = useState('')
  const [tab, setTab] = useState('program') // program | custom | create
  const [customExercises, setCustomExercises] = useState([])
  const [loading, setLoading] = useState(false)

  // New exercise form
  const [newName, setNewName] = useState('')
  const [newMuscle, setNewMuscle] = useState('Chest')
  const [newSets, setNewSets] = useState(3)
  const [newReps, setNewReps] = useState('8-10')
  const [newRpe, setNewRpe] = useState('8-9')
  const [newRest, setNewRest] = useState('~2 min')

  const allProgramExercises = useMemo(() => {
    const map = new Map()
    ;(program?.phases || []).forEach((phase) => {
      ;(phase.weeks || []).forEach((week) => {
        ;(week.days || []).forEach((day) => {
          ;(day.exercises || []).forEach((exercise) => {
            if (!map.has(exercise.name)) {
              map.set(exercise.name, exercise)
            }
          })
        })
      })
    })

    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [program])

  useEffect(() => {
    if (user) fetchCustomExercises()
  }, [user])

  const fetchCustomExercises = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('custom_exercises')
      .select('*')
      .eq('user_id', user.id)
      .order('name')
    if (data) setCustomExercises(data)
    setLoading(false)
  }

  const filteredProgram = useMemo(() => {
    return allProgramExercises.filter(ex => {
      if (activeIds.has(ex.id)) return false
      if (!searchQuery) return true
      return ex.name.toLowerCase().includes(searchQuery.toLowerCase())
    })
  }, [allProgramExercises, searchQuery, activeIds])

  const filteredCustom = useMemo(() => {
    return customExercises.filter(ex => {
      if (!searchQuery) return true
      return ex.name.toLowerCase().includes(searchQuery.toLowerCase())
    })
  }, [customExercises, searchQuery])

  const handleCreateAndAdd = () => {
    if (!newName.trim()) return
    const exercise = {
      id: generateId(),
      name: newName.trim(),
      muscleGroup: newMuscle,
      workingSets: newSets,
      reps: newReps,
      rpe: newRpe,
      rest: newRest,
      warmupSets: '0',
      sub1: '',
      sub2: '',
      notes: '',
      isCustom: true,
    }
    onAdd(exercise)
  }

  const handleAddCustom = (ex) => {
    const exercise = {
      id: generateId(),
      name: ex.name,
      muscleGroup: ex.muscle_group,
      workingSets: ex.default_sets || 3,
      reps: ex.default_reps || '8-10',
      rpe: ex.default_rpe || '8-9',
      rest: ex.default_rest || '~2 min',
      warmupSets: '0',
      sub1: '',
      sub2: '',
      notes: ex.notes || '',
      isCustom: true,
    }
    onAdd(exercise)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4">
      <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <h3 className="text-base font-semibold text-zinc-900">Add Exercise</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900 text-lg">×</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-100 p-1 mx-4 mt-3 rounded-lg">
          {[
            { key: 'program', label: 'Program' },
            { key: 'custom', label: 'My Exercises' },
            { key: 'create', label: '+ Create New' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                tab === t.key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search (for program/custom tabs) */}
        {tab !== 'create' && (
          <div className="px-4 mt-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              placeholder="Search exercises…"
              autoFocus
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {tab === 'program' && (
            <div className="grid gap-1">
              {filteredProgram.length === 0 && (
                <p className="text-sm text-zinc-400 py-4 text-center">No matching exercises.</p>
              )}
              {filteredProgram.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => onAdd(ex)}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm hover:bg-zinc-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-zinc-900 truncate">{ex.name}</p>
                    <p className="text-[11px] text-zinc-400">{ex.workingSets} sets × {ex.reps}</p>
                  </div>
                  <MuscleGroupBadge group={ex.muscleGroup} size="xs" />
                </button>
              ))}
            </div>
          )}

          {tab === 'custom' && (
            <div className="grid gap-1">
              {loading && <p className="text-sm text-zinc-400 py-4 text-center">Loading…</p>}
              {!loading && filteredCustom.length === 0 && (
                <p className="text-sm text-zinc-400 py-4 text-center">
                  No custom exercises. Use the "Create New" tab to add one.
                </p>
              )}
              {filteredCustom.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => handleAddCustom(ex)}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm hover:bg-zinc-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-zinc-900 truncate">{ex.name}</p>
                    <p className="text-[11px] text-zinc-400">{ex.default_sets || 3} sets × {ex.default_reps || '8-10'}</p>
                  </div>
                  <MuscleGroupBadge group={ex.muscle_group} size="xs" />
                </button>
              ))}
            </div>
          )}

          {tab === 'create' && (
            <div className="grid gap-3">
              <label className="grid gap-1 text-sm text-zinc-600">
                Exercise Name *
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-400"
                  placeholder="e.g. Incline DB Curl"
                  autoFocus
                />
              </label>
              <label className="grid gap-1 text-sm text-zinc-600">
                Muscle Group
                <select
                  value={newMuscle}
                  onChange={(e) => setNewMuscle(e.target.value)}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-400"
                >
                  {MUSCLE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-sm text-zinc-600">
                  Sets
                  <input
                    type="number"
                    min="1"
                    value={newSets}
                    onChange={(e) => setNewSets(parseInt(e.target.value) || 1)}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </label>
                <label className="grid gap-1 text-sm text-zinc-600">
                  Reps
                  <input
                    type="text"
                    value={newReps}
                    onChange={(e) => setNewReps(e.target.value)}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-400"
                    placeholder="8-10"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-sm text-zinc-600">
                  RPE
                  <input
                    type="text"
                    value={newRpe}
                    onChange={(e) => setNewRpe(e.target.value)}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-400"
                    placeholder="8-9"
                  />
                </label>
                <label className="grid gap-1 text-sm text-zinc-600">
                  Rest
                  <input
                    type="text"
                    value={newRest}
                    onChange={(e) => setNewRest(e.target.value)}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-400"
                    placeholder="~2 min"
                  />
                </label>
              </div>
              <button
                onClick={handleCreateAndAdd}
                disabled={!newName.trim()}
                className="rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-40"
              >
                Create & Add to Workout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
