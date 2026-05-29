import { useState } from 'react'
import {
  Plus, Copy, Trash2, ChevronLeft, ChevronUp, ChevronDown, Pencil,
  Check, Dumbbell,
} from 'lucide-react'
import { useWorkoutStore } from '../store/useWorkoutStore'
import MuscleGroupBadge from '../components/MuscleGroupBadge'
import ExercisePickerSheet from '../components/ExercisePickerSheet'
import { MUSCLE_GROUPS } from '../utils/muscleGroups'
import { BUILT_IN_PROGRAM_ID } from '../store/helpers'

// ── Inline exercise editor ──
function ExerciseRow({ ex, index, total, onMove, onPatch, onRemove }) {
  const [open, setOpen] = useState(false)
  const patch = onPatch
  return (
    <div className="rounded-xl bg-surface-overlay">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex flex-col">
          <button onClick={() => onMove(index, index - 1)} disabled={index === 0} className="text-zinc-600 disabled:opacity-20" aria-label="Move up"><ChevronUp size={14} /></button>
          <button onClick={() => onMove(index, index + 1)} disabled={index === total - 1} className="text-zinc-600 disabled:opacity-20" aria-label="Move down"><ChevronDown size={14} /></button>
        </div>
        <button onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left">
          <p className="truncate font-medium text-zinc-800">{ex.name || 'Untitled'}</p>
          <div className="mt-0.5 flex items-center gap-2">
            {ex.muscleGroup && <MuscleGroupBadge group={ex.muscleGroup} size="xs" />}
            <span className="tnum text-xs text-zinc-550">{ex.workingSets || 1} × {ex.reps || '–'}{ex.rpe ? ` @ RPE ${ex.rpe}` : ''}</span>
          </div>
        </button>
        <button onClick={() => setOpen(!open)} className="btn-ghost p-2"><Pencil size={15} /></button>
        <button onClick={onRemove} className="p-2 text-zinc-600 active:scale-95"><Trash2 size={15} /></button>
      </div>

      {open && (
        <div className="space-y-2 border-t border-surface-border px-3 py-3">
          <input value={ex.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Exercise name" className="field" />
          <select value={ex.muscleGroup || ''} onChange={(e) => patch({ muscleGroup: e.target.value })} className="field">
            <option value="">Muscle group…</option>
            {MUSCLE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs text-zinc-500">Sets
              <input inputMode="numeric" value={ex.workingSets} onChange={(e) => patch({ workingSets: parseInt(e.target.value, 10) || 1 })} className="field mt-1 tnum" />
            </label>
            <label className="text-xs text-zinc-500">Reps
              <input value={ex.reps} onChange={(e) => patch({ reps: e.target.value })} placeholder="8-12" className="field mt-1 tnum" />
            </label>
            <label className="text-xs text-zinc-500">RPE
              <input value={ex.rpe} onChange={(e) => patch({ rpe: e.target.value })} placeholder="8" className="field mt-1 tnum" />
            </label>
          </div>
          <label className="block text-xs text-zinc-500">Rest
            <input value={ex.rest} onChange={(e) => patch({ rest: e.target.value })} placeholder="~2 min" className="field mt-1" />
          </label>
        </div>
      )}
    </div>
  )
}

export default function PlanBuilderPage() {
  const userPlans = useWorkoutStore((s) => s.userPlans)
  const planDisplayName = useWorkoutStore((s) => s.planDisplayName)
  const createPlan = useWorkoutStore((s) => s.createPlan)
  const clonePlan = useWorkoutStore((s) => s.clonePlan)
  const deletePlan = useWorkoutStore((s) => s.deletePlan)
  const renamePlan = useWorkoutStore((s) => s.renamePlan)
  const addPlanDay = useWorkoutStore((s) => s.addPlanDay)
  const removePlanDay = useWorkoutStore((s) => s.removePlanDay)
  const renamePlanDay = useWorkoutStore((s) => s.renamePlanDay)
  const reorderPlanDays = useWorkoutStore((s) => s.reorderPlanDays)
  const addExerciseToDay = useWorkoutStore((s) => s.addExerciseToDay)
  const updateExerciseInDay = useWorkoutStore((s) => s.updateExerciseInDay)
  const removeExerciseFromDay = useWorkoutStore((s) => s.removeExerciseFromDay)
  const reorderExercises = useWorkoutStore((s) => s.reorderExercises)

  const [selectedId, setSelectedId] = useState(null)
  const [addTarget, setAddTarget] = useState(null) // dayId for add-exercise sheet
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  const plan = userPlans.find((p) => p.id === selectedId) || null

  // ── List view ──
  if (!plan) {
    return (
      <div className="space-y-5 pt-4">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">Plans</h1>
          <p className="text-sm text-zinc-550">Build and edit your own workout plans.</p>
        </header>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => { const id = createPlan('New Plan'); setSelectedId(id) }} className="btn-primary">
            <Plus size={18} /> New plan
          </button>
          <button onClick={() => { const id = clonePlan(BUILT_IN_PROGRAM_ID); if (id) setSelectedId(id) }} className="btn-secondary">
            <Copy size={18} /> Clone {planDisplayName?.split(' ')[0] || 'Dina'}
          </button>
        </div>

        <section className="space-y-2">
          {userPlans.length === 0 && (
            <div className="card flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Dumbbell size={28} className="text-zinc-600" />
              <p className="text-zinc-400">No custom plans yet.</p>
              <p className="text-sm text-zinc-600">Create a blank plan or clone the built-in one to get started.</p>
            </div>
          )}
          {userPlans.map((p) => (
            <div key={p.id} className="card flex items-center gap-3 px-4 py-3">
              <button onClick={() => setSelectedId(p.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate font-semibold text-zinc-800">{p.name}</p>
                <p className="text-sm text-zinc-500">{(p.days || []).length} day{(p.days || []).length === 1 ? '' : 's'}</p>
              </button>
              <button onClick={() => { const id = clonePlan(p.id); if (id) setSelectedId(id) }} className="btn-ghost p-2" aria-label="Duplicate"><Copy size={16} /></button>
              <button
                onClick={() => { if (confirm(`Delete "${p.name}"? This cannot be undone.`)) deletePlan(p.id) }}
                className="p-2 text-zinc-600 active:scale-95" aria-label="Delete"
              ><Trash2 size={16} /></button>
            </div>
          ))}
        </section>
      </div>
    )
  }

  // ── Editor view ──
  return (
    <div className="space-y-4 pt-4">
      <header className="flex items-center gap-2">
        <button onClick={() => setSelectedId(null)} className="btn-ghost p-2" aria-label="Back"><ChevronLeft size={22} /></button>
        {editingName ? (
          <div className="flex flex-1 items-center gap-2">
            <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className="field" />
            <button onClick={() => { renamePlan(plan.id, nameDraft); setEditingName(false) }} className="btn-ghost p-2 text-accent"><Check size={20} /></button>
          </div>
        ) : (
          <button onClick={() => { setNameDraft(plan.name); setEditingName(true) }} className="flex flex-1 items-center gap-2 text-left">
            <h1 className="truncate text-xl font-extrabold text-zinc-900">{plan.name}</h1>
            <Pencil size={15} className="shrink-0 text-zinc-500" />
          </button>
        )}
      </header>

      <div className="space-y-4">
        {(plan.days || []).map((day, dIdx) => (
          <section key={day.id} className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex flex-col">
                <button onClick={() => reorderPlanDays(plan.id, dIdx, dIdx - 1)} disabled={dIdx === 0} className="text-zinc-600 disabled:opacity-20"><ChevronUp size={16} /></button>
                <button onClick={() => reorderPlanDays(plan.id, dIdx, dIdx + 1)} disabled={dIdx === plan.days.length - 1} className="text-zinc-600 disabled:opacity-20"><ChevronDown size={16} /></button>
              </div>
              <input
                value={day.label}
                onChange={(e) => renamePlanDay(plan.id, day.id, e.target.value)}
                className="flex-1 bg-transparent text-lg font-bold text-zinc-900 outline-none"
              />
              <button
                onClick={() => { if (confirm(`Delete day "${day.label}"?`)) removePlanDay(plan.id, day.id) }}
                className="p-2 text-zinc-600 active:scale-95" aria-label="Delete day"
              ><Trash2 size={16} /></button>
            </div>

            <div className="space-y-2">
              {(day.exercises || []).map((ex, eIdx) => (
                <ExerciseRow
                  key={ex.id}
                  ex={ex}
                  index={eIdx}
                  total={day.exercises.length}
                  onMove={(from, to) => reorderExercises(plan.id, day.id, from, to)}
                  onPatch={(p) => updateExerciseInDay(plan.id, day.id, ex.id, p)}
                  onRemove={() => removeExerciseFromDay(plan.id, day.id, ex.id)}
                />
              ))}
            </div>

            <button onClick={() => setAddTarget(day.id)} className="mt-3 w-full btn-ghost text-sm text-accent">
              <Plus size={16} /> Add exercise
            </button>
          </section>
        ))}
      </div>

      <button
        onClick={() => addPlanDay(plan.id)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-surface-border px-4 py-4 text-sm font-medium text-zinc-400 active:scale-[0.99]"
      >
        <Plus size={18} /> Add day
      </button>

      {addTarget && (
        <ExercisePickerSheet
          onClose={() => setAddTarget(null)}
          onAdd={(exercise) => addExerciseToDay(plan.id, addTarget, exercise)}
        />
      )}
    </div>
  )
}
