import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import MuscleGroupBadge from '../components/MuscleGroupBadge'
import { MUSCLE_GROUPS, getMuscleGroupColor } from '../utils/muscleGroups'
import { useWorkoutStore } from '../store/useWorkoutStore'
import { analyzeRPETrend } from '../utils/rpeTrendAnalysis'

const MG_OVERRIDES_KEY = 'ppl_muscle_group_overrides'

// Load user overrides from localStorage
function loadOverrides() {
  try {
    return JSON.parse(localStorage.getItem(MG_OVERRIDES_KEY) || '{}')
  } catch { return {} }
}

function saveOverrides(overrides) {
  localStorage.setItem(MG_OVERRIDES_KEY, JSON.stringify(overrides))
}

// Extract all active plan exercises (deduplicated by name) with override support
function getJeffExercises(programData, overrides) {
  const map = new Map()
  ;(programData?.phases || []).forEach(phase => {
    phase.weeks.forEach(week => {
      week.days.forEach(day => {
        day.exercises.forEach(ex => {
          if (!map.has(ex.name)) {
            map.set(ex.name, {
              id: ex.id,
              name: ex.name,
              muscleGroup: overrides[ex.name] || ex.muscleGroup || '',
              warmupSets: ex.warmupSets,
              workingSets: ex.workingSets,
              reps: ex.reps,
              rpe: ex.rpe,
              rest: ex.rest,
              sub1: ex.sub1,
              sub2: ex.sub2,
              notes: ex.notes,
            })
          }
        })
      })
    })
  })
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

// ── Edit Muscle Group Inline ──
function EditMuscleGroupSelect({ current, onSave, onCancel }) {
  const [value, setValue] = useState(current)

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded border border-zinc-300 px-1.5 py-0.5 text-xs text-zinc-900 outline-none focus:border-zinc-400"
        autoFocus
      >
        {MUSCLE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
      </select>
      <button onClick={() => onSave(value)} className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-800">Save</button>
      <button onClick={onCancel} className="text-[10px] font-semibold text-zinc-400 hover:text-zinc-600">✕</button>
    </div>
  )
}

// ── Exercise Detail Modal ──
function ExerciseDetailModal({ exercise, isCustom, trendAlert, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">{exercise.name}</h3>
            <MuscleGroupBadge 
              group={exercise.muscleGroup || exercise.muscle_group} 
              subGroup={exercise.subMuscleGroup || exercise?.secondary_muscles?.[0]} 
              size="sm" 
            />
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900 text-xl">×</button>
        </div>

        <div className="mt-4 grid gap-3 text-sm">
          {trendAlert?.hasAlert && (
            <div className={`rounded-lg border px-3 py-2 ${trendAlert.severity === 'danger' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
              <p className="text-xs font-semibold uppercase tracking-wide">Training Alert</p>
              <p className="mt-1 text-sm">{trendAlert.message}</p>
            </div>
          )}

          {exercise.equipment && (
            <p><span className="font-medium text-zinc-500">Equipment:</span> {exercise.equipment}</p>
          )}
          <p><span className="font-medium text-zinc-500">Sets:</span> {exercise.workingSets || exercise.default_sets || '—'}</p>
          <p><span className="font-medium text-zinc-500">Reps:</span> {exercise.reps || exercise.default_reps || '—'}</p>
          <p><span className="font-medium text-zinc-500">RPE:</span> {exercise.rpe || exercise.default_rpe || '—'}</p>
          <p><span className="font-medium text-zinc-500">Rest:</span> {exercise.rest || exercise.default_rest || '—'}</p>
          {!isCustom && exercise.sub1 && exercise.sub1 !== 'N/A' && (
            <p><span className="font-medium text-zinc-500">Sub 1:</span> {exercise.sub1}</p>
          )}
          {!isCustom && exercise.sub2 && exercise.sub2 !== 'N/A' && (
            <p><span className="font-medium text-zinc-500">Sub 2:</span> {exercise.sub2}</p>
          )}
          {exercise.notes && (
            <div>
              <p className="font-medium text-zinc-500">Notes:</p>
              <p className="mt-1 text-zinc-700">{exercise.notes}</p>
            </div>
          )}
        </div>

        <button onClick={onClose} className="mt-5 w-full rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100">
          Close
        </button>
      </div>
    </div>
  )
}

// ── Exercise Form Modal (for custom exercises) ──
function ExerciseFormModal({ exercise, onSave, onClose }) {
  const [form, setForm] = useState({
    name: exercise?.name || '',
    muscle_group: exercise?.muscle_group || 'Chest',
    sub_muscle_group: exercise?.secondary_muscles?.[0] || '',
    equipment: exercise?.equipment || '',
    default_sets: exercise?.default_sets || 3,
    default_reps: exercise?.default_reps || '8-10',
    default_rpe: exercise?.default_rpe || '8-9',
    default_rest: exercise?.default_rest || '~2 min',
    notes: exercise?.notes || '',
  })

  const handleSubmit = (e) => { e.preventDefault(); onSave(form) }
  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[85vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-zinc-900">{exercise ? 'Edit Exercise' : 'Add Exercise'}</h3>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm text-zinc-600">Name *
            <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)} required className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:ring ring-zinc-900" placeholder="e.g. Incline DB Press" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm text-zinc-600">Muscle Group *
              <select value={form.muscle_group} onChange={(e) => update('muscle_group', e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:ring ring-zinc-900">
                {MUSCLE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm text-zinc-600">Sub-Group
              <input type="text" value={form.sub_muscle_group} onChange={(e) => update('sub_muscle_group', e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:ring ring-zinc-900" placeholder="e.g. Upper Chest" />
            </label>
          </div>
          <label className="grid gap-1 text-sm text-zinc-600">Equipment
            <input type="text" value={form.equipment} onChange={(e) => update('equipment', e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:ring ring-zinc-900" placeholder="e.g. Dumbbells" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm text-zinc-600">Sets
              <input type="number" min="1" value={form.default_sets} onChange={(e) => update('default_sets', parseInt(e.target.value) || 1)} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:ring ring-zinc-900" />
            </label>
            <label className="grid gap-1 text-sm text-zinc-600">Reps
              <input type="text" value={form.default_reps} onChange={(e) => update('default_reps', e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:ring ring-zinc-900" placeholder="8-10" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm text-zinc-600">RPE
              <input type="text" value={form.default_rpe} onChange={(e) => update('default_rpe', e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:ring ring-zinc-900" placeholder="8-9" />
            </label>
            <label className="grid gap-1 text-sm text-zinc-600">Rest
              <input type="text" value={form.default_rest} onChange={(e) => update('default_rest', e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:ring ring-zinc-900" placeholder="~2 min" />
            </label>
          </div>
          <label className="grid gap-1 text-sm text-zinc-600">Notes
            <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} className="min-h-16 rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:ring ring-zinc-900" placeholder="Form cues, tips…" />
          </label>
          <div className="mt-2 flex gap-2">
            <button type="submit" className="flex-1 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700">{exercise ? 'Save' : 'Add Exercise'}</button>
            <button type="button" onClick={onClose} className="rounded-full border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ──
function ExercisesPage() {
  const { user } = useAuth()
  const program = useWorkoutStore((state) => state.program)
  const completedDays = useWorkoutStore((state) => state.completedDays)
  const planDisplayName = useWorkoutStore((state) => state.planDisplayName)
  const [activeTab, setActiveTab] = useState('program')
  const [searchQuery, setSearchQuery] = useState('')
  const [muscleFilter, setMuscleFilter] = useState('All')
  const [viewMode, setViewMode] = useState('grouped') // 'grouped' | 'list'
  const [editingMuscleGroup, setEditingMuscleGroup] = useState(null) // exerciseName
  const [overrides, setOverrides] = useState(loadOverrides)
  const [expandedGroups, setExpandedGroups] = useState(new Set(MUSCLE_GROUPS))

  // Custom exercises state
  const [customExercises, setCustomExercises] = useState([])
  const [loadingCustom, setLoadingCustom] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingExercise, setEditingExercise] = useState(null)
  const [detailExercise, setDetailExercise] = useState(null)
  const [detailIsCustom, setDetailIsCustom] = useState(false)

  // Refresh exercises when overrides change
  const jeffExercises = useMemo(() => getJeffExercises(program, overrides), [program, overrides])

  useEffect(() => {
    if (user) fetchCustomExercises()
  }, [user])

  const fetchCustomExercises = async () => {
    setLoadingCustom(true)
    const { data, error } = await supabase
      .from('custom_exercises')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (!error && data) setCustomExercises(data)
    setLoadingCustom(false)
  }

  // Save muscle group override
  const handleSaveMuscleGroup = (exerciseName, newGroup) => {
    const updated = { ...overrides, [exerciseName]: newGroup }
    setOverrides(updated)
    saveOverrides(updated)
    setEditingMuscleGroup(null)
  }

  // Toggle expand/collapse a group
  const toggleGroup = (group) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(group) ? next.delete(group) : next.add(group)
      return next
    })
  }

  // CRUD for custom exercises
  const handleSaveExercise = async (form) => {
    const secondary_muscles = form.sub_muscle_group ? [form.sub_muscle_group] : null
    if (editingExercise) {
      const { error } = await supabase.from('custom_exercises').update({
        name: form.name, muscle_group: form.muscle_group, secondary_muscles, equipment: form.equipment,
        default_sets: form.default_sets, default_reps: form.default_reps,
        default_rpe: form.default_rpe, default_rest: form.default_rest, notes: form.notes,
      }).eq('id', editingExercise.id)
      if (!error) await fetchCustomExercises()
    } else {
      const { error } = await supabase.from('custom_exercises').insert({
        user_id: user.id, name: form.name, muscle_group: form.muscle_group, secondary_muscles, equipment: form.equipment,
        default_sets: form.default_sets, default_reps: form.default_reps,
        default_rpe: form.default_rpe, default_rest: form.default_rest, notes: form.notes,
      })
      if (!error) await fetchCustomExercises()
    }
    setShowForm(false)
    setEditingExercise(null)
  }

  const handleDeleteExercise = async (id) => {
    if (!window.confirm('Delete this exercise?')) return
    const { error } = await supabase.from('custom_exercises').delete().eq('id', id)
    if (!error) setCustomExercises(prev => prev.filter(e => e.id !== id))
  }

  // Filtered Jeff exercises
  const filteredJeff = useMemo(() => {
    return jeffExercises.filter(ex => {
      const matchesSearch = !searchQuery || ex.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesMuscle = muscleFilter === 'All' || ex.muscleGroup === muscleFilter
      return matchesSearch && matchesMuscle
    })
  }, [jeffExercises, searchQuery, muscleFilter])

  // Group Jeff exercises by muscle group
  const groupedJeff = useMemo(() => {
    const groups = {}
    filteredJeff.forEach(ex => {
      const g = ex.muscleGroup || 'Uncategorized'
      if (!groups[g]) groups[g] = []
      groups[g].push(ex)
    })
    // Sort by MUSCLE_GROUPS order
    const ordered = []
    MUSCLE_GROUPS.forEach(g => {
      if (groups[g]) ordered.push({ group: g, exercises: groups[g] })
    })
    if (groups['Uncategorized']) ordered.push({ group: 'Uncategorized', exercises: groups['Uncategorized'] })
    return ordered
  }, [filteredJeff])

  // Filtered custom exercises
  const filteredCustom = useMemo(() => {
    return customExercises.filter(ex => {
      const matchesSearch = !searchQuery || ex.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesMuscle = muscleFilter === 'All' || ex.muscle_group === muscleFilter
      return matchesSearch && matchesMuscle
    })
  }, [customExercises, searchQuery, muscleFilter])

  const detailTrendAlert = useMemo(() => {
    if (!detailExercise) return { hasAlert: false, message: '', severity: 'warning' }

    const name = detailExercise.name
    if (!name) return { hasAlert: false, message: '', severity: 'warning' }

    const history = [...completedDays]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((day) => {
        const matched = (day.exercises || []).find((exercise) => exercise.name === name)
        if (!matched || !Array.isArray(matched.sets)) return null

        let topSet = null
        matched.sets.forEach((set) => {
          const weight = Number(set.weight) || 0
          const reps = Number(set.reps) || 0
          const rpe = Number(set.rpe)
          if (!weight || !Number.isFinite(rpe)) return

          if (!topSet || weight > topSet.weight || (weight === topSet.weight && reps > topSet.reps)) {
            topSet = { weight, reps, rpe }
          }
        })

        if (!topSet) return null

        return {
          date: day.date,
          name,
          topSet,
        }
      })
      .filter(Boolean)

    return analyzeRPETrend(history)
  }, [completedDays, detailExercise])

  return (
    <div className="mx-auto grid max-w-5xl gap-5 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Exercise Library</h1>
        <p className="mt-1 text-sm text-zinc-500">Browse exercises by muscle group · edit categorization</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-zinc-200 p-1">
        <button onClick={() => setActiveTab('program')} className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'program' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}>
          {planDisplayName} ({jeffExercises.length})
        </button>
        <button onClick={() => setActiveTab('custom')} className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'custom' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}>
          My Exercises ({customExercises.length})
        </button>
      </div>

      {/* Search + Filter + View Toggle */}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <input id="exercise-search" type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring ring-zinc-900"
          placeholder="Search exercises…" />
        <select id="exercise-muscle-filter" value={muscleFilter} onChange={(e) => setMuscleFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:ring ring-zinc-900">
          <option value="All">All Groups</option>
          {MUSCLE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        {activeTab === 'program' && (
          <button
            onClick={() => setViewMode(v => v === 'grouped' ? 'list' : 'grouped')}
            className="rounded-lg border border-zinc-300 px-3 py-2.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
          >
            {viewMode === 'grouped' ? '☰ List' : '▦ Grouped'}
          </button>
        )}
      </div>

      {/* Plan — Grouped View */}
      {activeTab === 'program' && viewMode === 'grouped' && (
        <div className="grid gap-3">
          {groupedJeff.map(({ group, exercises }) => {
            const isExpanded = expandedGroups.has(group)
            const colors = getMuscleGroupColor(group)
            return (
              <div key={group} className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleGroup(group)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
                    <span className="font-semibold text-zinc-900 text-sm">{group}</span>
                    <span className="text-xs text-zinc-400">({exercises.length})</span>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" className={`text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </button>

                {isExpanded && (
                  <div className="border-t border-zinc-100 divide-y divide-zinc-50">
                    {exercises.map(ex => (
                      <div key={ex.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-zinc-50">
                        <button
                          onClick={() => { setDetailExercise(ex); setDetailIsCustom(false) }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="text-sm font-medium text-zinc-900 truncate">{ex.name}</p>
                          <p className="text-[11px] text-zinc-400">{ex.workingSets} sets × {ex.reps} · RPE {ex.rpe}</p>
                        </button>

                        {editingMuscleGroup === ex.name ? (
                          <EditMuscleGroupSelect
                            current={ex.muscleGroup}
                            onSave={(val) => handleSaveMuscleGroup(ex.name, val)}
                            onCancel={() => setEditingMuscleGroup(null)}
                          />
                        ) : (
                          <div className="flex items-center gap-1">
                            <MuscleGroupBadge group={ex.muscleGroup} subGroup={ex.subMuscleGroup} size="xs" />
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingMuscleGroup(ex.name) }}
                              className="rounded p-1 text-zinc-300 hover:text-zinc-600 hover:bg-zinc-100"
                              title="Edit muscle group"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {groupedJeff.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-400">No exercises match your search.</p>
          )}
        </div>
      )}

      {/* Plan — Flat List View */}
      {activeTab === 'program' && viewMode === 'list' && (
        <div className="grid gap-2">
          <p className="text-xs text-zinc-500">{filteredJeff.length} exercises</p>
          {filteredJeff.map(ex => (
            <div key={ex.id} className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm hover:bg-zinc-50">
              <button
                onClick={() => { setDetailExercise(ex); setDetailIsCustom(false) }}
                className="min-w-0 flex-1 text-left"
              >
                <p className="text-sm font-medium text-zinc-900 truncate">{ex.name}</p>
                <p className="text-[11px] text-zinc-400">{ex.workingSets} sets × {ex.reps} · RPE {ex.rpe}</p>
              </button>

              {editingMuscleGroup === ex.name ? (
                <EditMuscleGroupSelect
                  current={ex.muscleGroup}
                  onSave={(val) => handleSaveMuscleGroup(ex.name, val)}
                  onCancel={() => setEditingMuscleGroup(null)}
                />
              ) : (
                <div className="flex items-center gap-1">
                  <MuscleGroupBadge group={ex.muscleGroup} subGroup={ex.subMuscleGroup} size="xs" />
                  <button
                    onClick={() => setEditingMuscleGroup(ex.name)}
                    className="rounded p-1 text-zinc-300 hover:text-zinc-600 hover:bg-zinc-100"
                    title="Edit muscle group"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
          {filteredJeff.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-400">No exercises match your search.</p>
          )}
        </div>
      )}

      {/* Custom Exercises Tab */}
      {activeTab === 'custom' && (
        <div className="grid gap-3">
          <button id="add-exercise-btn" onClick={() => { setEditingExercise(null); setShowForm(true) }}
            className="rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 justify-self-start">
            + Add Exercise
          </button>

          {loadingCustom ? (
            <p className="py-8 text-center text-sm text-zinc-400">Loading…</p>
          ) : filteredCustom.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">
              {customExercises.length === 0 ? 'No custom exercises yet.' : 'No matches.'}
            </p>
          ) : (
            <div className="grid gap-2">
              {filteredCustom.map(ex => (
                <div key={ex.id} className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <button onClick={() => { setDetailExercise(ex); setDetailIsCustom(true) }} className="min-w-0 flex-1 text-left">
                    <p className="font-medium text-zinc-900 truncate">{ex.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{ex.default_sets} sets × {ex.default_reps}{ex.equipment ? ` · ${ex.equipment}` : ''}</p>
                  </button>
                  <MuscleGroupBadge group={ex.muscle_group} subGroup={ex.secondary_muscles?.[0]} size="xs" />
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingExercise(ex); setShowForm(true) }} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" title="Edit">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    </button>
                    <button onClick={() => handleDeleteExercise(ex.id)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600" title="Delete">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <ExerciseFormModal exercise={editingExercise} onSave={handleSaveExercise}
          onClose={() => { setShowForm(false); setEditingExercise(null) }} />
      )}
      {detailExercise && (
        <ExerciseDetailModal exercise={detailExercise} isCustom={detailIsCustom} trendAlert={detailTrendAlert}
          onClose={() => setDetailExercise(null)} />
      )}
    </div>
  )
}

export default ExercisesPage
