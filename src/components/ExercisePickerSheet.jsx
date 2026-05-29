import { useMemo, useState } from 'react'
import { Plus, X, Search } from 'lucide-react'
import MuscleGroupBadge from './MuscleGroupBadge'
import { ALL_PROGRAM_EXERCISES } from '../utils/workoutHelpers'
import { searchExercises } from '../utils/exerciseSearch'

// Bottom-sheet exercise picker: forgiving search across the library + custom add.
// onAdd receives a plain exercise template object.
export default function ExercisePickerSheet({ onClose, onAdd, title = 'Add exercise' }) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchExercises(ALL_PROGRAM_EXERCISES, query, 50), [query])
  const trimmed = query.trim()

  const addLibrary = (ex) => {
    onAdd({
      name: ex.name,
      muscleGroup: ex.muscleGroup || '',
      subMuscleGroup: ex.subMuscleGroup || '',
      workingSets: ex.workingSets || 3,
      reps: ex.reps || '8-12',
      rpe: ex.rpe || '8',
      rest: ex.rest || '~2 min',
      warmupSets: ex.warmupSets || '0',
      sub1: ex.sub1 || '',
      sub2: ex.sub2 || '',
      notes: ex.notes || '',
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/50" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl mx-auto flex-col rounded-t-3xl border-t border-surface-border bg-surface-raised p-4 pb-safe"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
          <button onClick={onClose} className="btn-ghost p-2" aria-label="Close"><X size={20} /></button>
        </div>

        <div className="relative mb-3">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises…"
            className="field pl-10"
          />
        </div>

        <button
          onClick={() => { onAdd({ name: trimmed || 'New exercise', muscleGroup: '' }); onClose() }}
          className="mb-3 flex shrink-0 items-center gap-2 rounded-xl border border-dashed border-surface-border px-4 py-3 text-sm font-medium text-accent"
        >
          <Plus size={16} /> Add custom “{trimmed || 'New exercise'}”
        </button>

        <div className="-mx-1 flex-1 space-y-1 overflow-y-auto px-1">
          {results.length === 0 && (
            <p className="px-1 py-6 text-center text-sm text-zinc-500">No matches in the library — add it as a custom exercise above.</p>
          )}
          {results.map((ex) => (
            <button
              key={ex.id}
              onClick={() => addLibrary(ex)}
              className="flex w-full items-center justify-between gap-2 rounded-xl bg-surface px-4 py-3 text-left transition active:scale-[0.98] hover:bg-zinc-100"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-900">{ex.name}</p>
                <p className="tnum text-xs text-zinc-500">{ex.workingSets || 3} × {ex.reps || '8-12'}</p>
              </div>
              {ex.muscleGroup && <MuscleGroupBadge group={ex.muscleGroup} size="xs" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
