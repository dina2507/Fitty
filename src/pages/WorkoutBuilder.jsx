import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import MuscleGroupBadge from '../components/MuscleGroupBadge'
import { MUSCLE_GROUPS } from '../utils/muscleGroups'
import program from '../data/program.json'

// Generate a random ID for custom superset groups
function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

function ensureUniqueExerciseIds(exercises = []) {
  const used = new Set()

  return exercises.map((exercise) => {
    const baseId = exercise?.id || generateId()
    let safeId = baseId

    while (used.has(safeId)) {
      safeId = `${baseId}_${generateId()}`
    }

    used.add(safeId)
    return {
      ...exercise,
      id: safeId,
    }
  })
}

// Flat list of all Jeff Nippard exercises
const ALL_PROGRAM_EXERCISES = (() => {
  const map = new Map()
  program.phases.forEach(phase => phase.weeks.forEach(week => week.days.forEach(day => day.exercises.forEach(ex => {
    if (!map.has(ex.name)) map.set(ex.name, ex)
  }))))
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
})()

// ── Exercise Library Modal ──
function ExercisePickerModal({ onAdd, onClose, excludeIds }) {
  const { user } = useAuth()
  const [tab, setTab] = useState('program')
  const [search, setSearch] = useState('')
  const [muscleFilter, setMuscleFilter] = useState('All')
  const [customExercises, setCustomExercises] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user && tab === 'custom') fetchCustom()
  }, [user, tab])

  const fetchCustom = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('custom_exercises')
        .select('*')
        .eq('user_id', user.id)
        .order('name')
      if (data) setCustomExercises(data)
    } catch (error) {
      console.error('Failed to load custom exercises:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredProgram = useMemo(() => {
    return ALL_PROGRAM_EXERCISES.filter(ex => {
      if (excludeIds.has(ex.id)) return false
      const matchSearch = !search || ex.name.toLowerCase().includes(search.toLowerCase())
      const matchMuscle = muscleFilter === 'All' || ex.muscleGroup === muscleFilter
      return matchSearch && matchMuscle
    })
  }, [search, muscleFilter, excludeIds])

  const filteredCustom = useMemo(() => {
    return customExercises.filter(ex => {
      const matchSearch = !search || ex.name.toLowerCase().includes(search.toLowerCase())
      const matchMuscle = muscleFilter === 'All' || ex.muscle_group === muscleFilter
      return matchSearch && matchMuscle
    })
  }, [customExercises, search, muscleFilter])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="flex h-full max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 p-4">
          <h3 className="text-lg font-semibold text-zinc-900">Add Exercise</h3>
          <button onClick={onClose} className="text-xl text-zinc-400 hover:text-zinc-900">×</button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          <div className="flex gap-1 rounded-xl bg-zinc-200 p-1">
            <button onClick={() => setTab('program')} className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${tab === 'program' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}>Jeff Nippard</button>
            <button onClick={() => setTab('custom')} className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${tab === 'custom' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}>My Exercises</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring ring-zinc-900"/>
            <select value={muscleFilter} onChange={e => setMuscleFilter(e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring ring-zinc-900">
              <option value="All">All Muscles</option>
              {MUSCLE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="grid gap-1.5">
            {tab === 'program' && filteredProgram.map(ex => (
              <button key={ex.id} onClick={() => onAdd({ ...ex, id: generateId() })} className="flex items-center justify-between rounded-xl border border-zinc-200 p-3 text-left hover:bg-zinc-50">
                <div className="min-w-0 pr-2">
                  <p className="font-medium text-zinc-900 truncate">{ex.name}</p>
                  <p className="text-[11px] text-zinc-500">{ex.workingSets || 3} sets × {ex.reps || '8-10'}</p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <MuscleGroupBadge group={ex.muscleGroup} subGroup={ex.subMuscleGroup} size="xs" />
                  <span className="text-blue-600 text-lg font-bold">+</span>
                </div>
              </button>
            ))}

            {tab === 'custom' && loading && <p className="text-center text-sm text-zinc-400 py-4">Loading...</p>}
            {tab === 'custom' && !loading && filteredCustom.map(ex => (
              <button key={ex.id} 
                onClick={() => onAdd({ 
                  id: generateId(), 
                  name: ex.name, muscleGroup: ex.muscle_group, subMuscleGroup: ex.secondary_muscles?.[0],
                  workingSets: ex.default_sets || 3, reps: ex.default_reps || '8-10', 
                  rpe: ex.default_rpe || '8-9', rest: ex.default_rest || '~2 min', notes: ex.notes || '' 
                })} 
                className="flex items-center justify-between rounded-xl border border-zinc-200 p-3 text-left hover:bg-zinc-50"
              >
                <div className="min-w-0 pr-2">
                  <p className="font-medium text-zinc-900 truncate">{ex.name}</p>
                  <p className="text-[11px] text-zinc-500">{ex.default_sets || 3} sets × {ex.default_reps || '8-10'}</p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <MuscleGroupBadge group={ex.muscle_group} subGroup={ex.secondary_muscles?.[0]} size="xs" />
                  <span className="text-blue-600 text-lg font-bold">+</span>
                </div>
              </button>
            ))}
            
            {((tab === 'program' && filteredProgram.length === 0) || (tab === 'custom' && !loading && filteredCustom.length === 0)) && (
              <p className="text-center text-sm text-zinc-400 py-4">No exercises found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SortableExerciseCard({
  ex,
  index,
  total,
  isTopPair,
  onToggleSuperset,
  onMoveExercise,
  onRemoveExercise,
  onUpdateExercise,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ex.id,
  })

  const style = {
    transform: transform ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)` : undefined,
    transition,
    zIndex: isDragging ? 30 : 'auto',
    opacity: isDragging ? 0.95 : 1,
  }

  const isPartOfSuperset = ex.isSuperset

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {isTopPair && (
        <div className="absolute -top-3 left-6 z-10 w-1 flex flex-col items-center">
          <div className="h-6 w-0.5 bg-violet-400" />
          <div className="absolute top-1 rounded bg-violet-500 px-1 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">SS</div>
        </div>
      )}

      <div className={`rounded-xl border bg-white p-4 shadow-sm transition-colors ${isPartOfSuperset ? 'border-violet-300 bg-violet-50' : 'border-zinc-200'}`}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-zinc-400">#{index + 1}</span>
              <MuscleGroupBadge group={ex.muscleGroup} subGroup={ex.subMuscleGroup} size="xs" />
              {isPartOfSuperset && <span className="text-[10px] font-bold text-violet-600 uppercase">Superset</span>}
            </div>
            <h3 className="truncate font-semibold text-zinc-900">{ex.name}</h3>
          </div>

          <div className="flex shrink-0 gap-1 rounded-lg bg-zinc-100 p-1">
            <button
              onClick={() => onToggleSuperset(index)}
              title="Link to next block as Superset"
              className={`rounded p-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 ${isPartOfSuperset ? 'text-violet-600 bg-violet-100' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            </button>
            <button
              {...attributes}
              {...listeners}
              title="Drag to reorder"
              className="touch-none cursor-grab rounded p-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 active:cursor-grabbing"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>
            </button>
            <button onClick={() => onMoveExercise(index, -1)} disabled={index === 0} className="rounded p-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 disabled:opacity-30">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 15-6-6-6 6"/></svg>
            </button>
            <button onClick={() => onMoveExercise(index, 1)} disabled={index === total - 1} className="rounded p-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 disabled:opacity-30">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <button onClick={() => onRemoveExercise(index)} className="rounded p-1 text-zinc-500 hover:text-red-600 hover:bg-red-50">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
          <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
            Sets
            <input
              type="number"
              min="1"
              value={ex.workingSets || 3}
              onChange={(e) => onUpdateExercise(index, 'workingSets', Number(e.target.value))}
              className="mt-1 w-full rounded border border-zinc-200 px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            />
          </label>
          <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
            Reps
            <input
              type="text"
              value={ex.reps || ''}
              onChange={(e) => onUpdateExercise(index, 'reps', e.target.value)}
              placeholder="8-10"
              className="mt-1 w-full rounded border border-zinc-200 px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            />
          </label>
          <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
            RPE (Optional)
            <input
              type="text"
              value={ex.rpe || ''}
              onChange={(e) => onUpdateExercise(index, 'rpe', e.target.value)}
              placeholder="8-9"
              className="mt-1 w-full rounded border border-zinc-200 px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            />
          </label>
          <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
            Rest Time
            <input
              type="text"
              value={ex.rest || ''}
              onChange={(e) => onUpdateExercise(index, 'rest', e.target.value)}
              placeholder="~2 min"
              className="mt-1 w-full rounded border border-zinc-200 px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            />
          </label>
        </div>

        <input
          type="text"
          value={ex.notes || ''}
          onChange={(e) => onUpdateExercise(index, 'notes', e.target.value)}
          placeholder="Private notes or cues for this session..."
          className="mt-3 w-full rounded border border-zinc-200 px-3 py-2 text-xs text-zinc-700 outline-none focus:border-zinc-400 placeholder:text-zinc-400"
        />
      </div>
    </div>
  )
}

// ── Workout Builder Main Component ──
function WorkoutBuilder() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')

  const [name, setName] = useState('')
  const [type, setType] = useState('full_body')
  const [exercises, setExercises] = useState([])
  const [showPicker, setShowPicker] = useState(false)
  const [loading, setLoading] = useState(!!editId)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  )

  const exerciseIds = useMemo(() => exercises.map((ex) => ex.id), [exercises])

  const WORKOUT_TYPES = ['push', 'pull', 'legs', 'upper', 'lower', 'full_body', 'custom']

  // Load template if editing
  useEffect(() => {
    if (!editId || !user) return
    const load = async () => {
      try {
        const { data } = await supabase
          .from('custom_workouts')
          .select('*')
          .eq('id', editId)
          .eq('user_id', user.id)
          .single()
        if (data) {
          setName(data.name)
          setType(data.workout_type || 'custom')
          setExercises(ensureUniqueExerciseIds(data.exercises || []))
        }
      } catch (error) {
        console.error('Failed to load workout template:', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [editId, user])

  const handleAddExercise = (ex) => {
    const safeExercise = {
      ...ex,
      id: ex.id || generateId(),
    }
    setExercises((prev) => [...prev, safeExercise])
    setShowPicker(false)
  }

  const updateExercise = (index, field, value) => {
    setExercises((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const removeExercise = (index) => {
    setExercises((prev) => {
      const removed = prev[index]
      const next = prev.filter((_, i) => i !== index)

      if (!removed?.supersetGroup) return next

      const remainingInGroup = next.filter((item) => item.supersetGroup === removed.supersetGroup)
      if (remainingInGroup.length <= 1) {
        return next.map((item) => {
          if (item.supersetGroup !== removed.supersetGroup) return item
          return {
            ...item,
            isSuperset: false,
            supersetGroup: null,
          }
        })
      }

      return next
    })
  }

  const moveExercise = (index, direction) => {
    setExercises((prev) => {
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= prev.length) return prev
      return arrayMove(prev, index, targetIndex)
    })
  }

  const toggleSuperset = (index) => {
    setExercises((prev) => {
      const current = prev[index]
      if (!current) return prev

      const updated = [...prev]
      if (current.isSuperset && current.supersetGroup) {
        return updated.map((item) => {
          if (item.supersetGroup !== current.supersetGroup) return item
          return {
            ...item,
            isSuperset: false,
            supersetGroup: null,
          }
        })
      }

      if (index >= updated.length - 1) return prev

      const next = updated[index + 1]
      const groupId = generateId()

      updated[index] = {
        ...current,
        isSuperset: true,
        supersetGroup: groupId,
      }
      updated[index + 1] = {
        ...next,
        isSuperset: true,
        supersetGroup: groupId,
      }

      return updated
    })
  }

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return

    setExercises((prev) => {
      const oldIndex = prev.findIndex((item) => item.id === active.id)
      const newIndex = prev.findIndex((item) => item.id === over.id)

      if (oldIndex < 0 || newIndex < 0) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  const handleSave = async () => {
    if (!name.trim()) return alert('Please enter a workout name.')
    if (exercises.length === 0) return alert('Please add at least one exercise.')
    if (!user?.id) return alert('Please sign in again before saving.')
    
    setSaving(true)
    try {
      const payload = {
        user_id: user.id,
        name: name.trim(),
        workout_type: type,
        exercises,
        is_template: true,
        updated_at: new Date().toISOString(),
      }

      const { error } = editId
        ? await supabase.from('custom_workouts').update(payload).eq('id', editId)
        : await supabase.from('custom_workouts').insert(payload)

      if (error) throw error
      navigate('/program')
    } catch (error) {
      console.error('Failed to save workout template:', error)
      alert('Could not save the workout template. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading template...</div>

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 relative pb-32">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-full bg-zinc-200 p-2 text-zinc-600 hover:bg-zinc-300">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 className="text-2xl font-bold text-zinc-900">{editId ? 'Edit Workout' : 'Create Workout'}</h1>
      </div>

      {/* Meta */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm mb-6 grid gap-4 grid-cols-1 md:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
          Workout Name *
          <input 
            type="text" value={name} onChange={e => setName(e.target.value)} 
            placeholder="e.g. My Heavy Push Day"
            className="rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-500 focus:ring-1 ring-zinc-500" 
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
          Workout Type
          <select 
            value={type} onChange={e => setType(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-500 focus:ring-1 ring-zinc-500 uppercase tracking-wider text-xs font-semibold"
          >
            {WORKOUT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </label>
      </div>

      {/* Exercises List */}
      <div className="grid gap-3">
        {exercises.length > 0 && (
          <p className="text-xs text-zinc-500">
            Drag the six-dot handle to reorder exercises.
          </p>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={exerciseIds} strategy={verticalListSortingStrategy}>
            <div className="grid gap-3">
              {exercises.map((ex, index) => {
                const isPartOfSuperset = ex.isSuperset
                const isTopPair = isPartOfSuperset && index > 0 && exercises[index - 1]?.supersetGroup === ex.supersetGroup

                return (
                  <SortableExerciseCard
                    key={ex.id}
                    ex={ex}
                    index={index}
                    total={exercises.length}
                    isTopPair={isTopPair}
                    onToggleSuperset={toggleSuperset}
                    onMoveExercise={moveExercise}
                    onRemoveExercise={removeExercise}
                    onUpdateExercise={updateExercise}
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>

        <button 
          onClick={() => setShowPicker(true)} 
          className="mt-2 w-full rounded-xl border-2 border-dashed border-zinc-300 py-6 text-center text-sm font-semibold text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition-colors flex flex-col items-center justify-center gap-2"
        >
          <div className="rounded-full bg-zinc-200 p-2 text-zinc-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          </div>
          Add Exercise
        </button>
      </div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-zinc-200 bg-white/90 p-4 backdrop-blur-md pb-safe">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-3">
          <button onClick={() => navigate(-1)} className="rounded-full px-5 py-2.5 font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="rounded-full bg-zinc-900 px-6 py-2.5 font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors shadow-sm">
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>

      {showPicker && (
        <ExercisePickerModal
          onAdd={handleAddExercise}
          onClose={() => setShowPicker(false)}
          excludeIds={new Set()}
        />
      )}
    </div>
  )
}

export default WorkoutBuilder
