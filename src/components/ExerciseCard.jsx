function ExerciseCard({ exercise, index }) {
  const alternatives = [exercise.sub1, exercise.sub2].filter(
    (option) => option && option !== 'N/A',
  )

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Exercise {index + 1}</p>
          <h3 className="text-lg font-semibold text-zinc-900">{exercise.name}</h3>
        </div>
        <span className="rounded-full bg-zinc-900 px-2 py-1 text-xs font-semibold text-white">
          RPE {exercise.rpe}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm text-zinc-700 md:grid-cols-4">
        <div>
          <dt className="text-zinc-500">Warmup</dt>
          <dd className="font-medium">{exercise.warmupSets}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Working Sets</dt>
          <dd className="font-medium">{exercise.workingSets}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Reps</dt>
          <dd className="font-medium">{exercise.reps}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Rest</dt>
          <dd className="font-medium">{exercise.rest}</dd>
        </div>
      </dl>

      {alternatives.length > 0 && (
        <p className="mt-3 text-sm text-zinc-600">
          <span className="font-medium text-zinc-700">Substitutes:</span> {alternatives.join(' | ')}
        </p>
      )}

      {exercise.notes && <p className="mt-3 text-sm leading-relaxed text-zinc-600">{exercise.notes}</p>}
    </article>
  )
}

export default ExerciseCard
