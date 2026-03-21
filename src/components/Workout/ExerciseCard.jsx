import React from 'react'
import MuscleGroupBadge from '../MuscleGroupBadge'
import { PRBadge } from '../PRBadge'
import { parseRestSeconds } from '../../utils/workoutHelpers'
import { generateWarmupSets, getWarmupReferenceWeight } from '../../utils/warmupSets'
import { calculate1RM } from '../../utils/oneRepMax'
import { useWorkoutStore } from '../../store/useWorkoutStore'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export function ExerciseCard({
  exercise,
  instructionNote,
  exIndex,
  exerciseLog,
  previousWeights,
  isPR,
  superset,
  progressionSuggestion,
  onDismissSuggestion,
  exerciseSaveState,
  onSaveExercise,
  setSwapExerciseIndex,
  onScheduleExercise,
  moveExercise,
  activeExercisesLength,
  removeExercise,
  updateSet,
  removeSet,
  addSet,
  startTimer,
  setShowCustomRest,
  updateExerciseNotes
}) {
  const [activeTab, setActiveTab] = React.useState('track')
  const completedDays = useWorkoutStore((state) => state.completedDays)
  const weightUnit = useWorkoutStore((state) => state.weightUnit)
  const restTimerDefault = useWorkoutStore((state) => state.restTimerDefault)
  const previous = previousWeights[exercise.id]
  const firstSetWeight = exerciseLog[exercise.id]?.sets?.[0]?.weight

  const warmupReferenceWeight = React.useMemo(() => {
    return getWarmupReferenceWeight(firstSetWeight, previous?.weight)
  }, [firstSetWeight, previous?.weight])

  const warmupSets = React.useMemo(() => {
    return generateWarmupSets(warmupReferenceWeight, weightUnit, {
      warmupSets: exercise.warmupSets,
      workingReps: exercise.reps,
    })
  }, [warmupReferenceWeight, weightUnit, exercise.warmupSets, exercise.reps])

  const handleSetFieldChange = (setIdx, field, value) => {
    const currentSet = exerciseLog[exercise.id]?.sets?.[setIdx] || {}
    const nextSet = { ...currentSet, [field]: value }

    const wasComplete = String(currentSet.weight ?? '').trim() !== '' && String(currentSet.reps ?? '').trim() !== ''
    const isComplete = String(nextSet.weight ?? '').trim() !== '' && String(nextSet.reps ?? '').trim() !== ''

    updateSet(exercise.id, setIdx, field, value)

    if (!wasComplete && isComplete) {
      startTimer(parseRestSeconds(exercise.rest, restTimerDefault))
    }
  }

  const exerciseHistory = React.useMemo(() => {
    const history = []
    completedDays.forEach(day => {
      const ex = day.exercises?.find(e => e.name === exercise.name)
      if (ex && ex.sets?.length > 0) {
        let best1rm = 0
        let totalVolume = 0
        ex.sets.forEach(set => {
          const w = parseFloat(set.weight) || 0
          const r = parseInt(set.reps) || 0
          if (w > 0 && r > 0) {
            totalVolume += w * r
            const e1rm = w * (36 / (37 - r))
            if (e1rm > best1rm) best1rm = e1rm
          }
        })
        
        history.push({
          dateStr: new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          fullDate: day.date,
          sets: ex.sets,
          best1rm: Math.round(best1rm),
          volume: totalVolume
        })
      }
    })
    return history.sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime())
  }, [completedDays, exercise.name])

  const cardClass = [
    'relative rounded-xl border bg-white shadow-sm overflow-hidden',
    superset?.isGrouped ? 'border-violet-300 border-l-4 border-l-violet-400' : 'border-zinc-200',
    superset?.isGrouped && !superset?.isStart ? 'rounded-t-none mt-0' : '',
    superset?.isGrouped && !superset?.isEnd ? 'rounded-b-none border-b-0 mb-0' : 'mb-4',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={cardClass}>
      {superset?.isGrouped && !superset?.isStart && (
        <div className="pointer-events-none absolute -top-4 left-3 h-4 w-0.5 bg-violet-400" />
      )}

      {/* Exercise Header */}
      <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs text-zinc-500">#{exIndex + 1}</p>
              {superset?.isGrouped && superset?.label && (
                <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                  {superset.label}
                </span>
              )}
              <MuscleGroupBadge group={exercise.muscleGroup} size="xs" />
              {isPR && <PRBadge />}
              {exercise.isCustom && (
                <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-600">Custom</span>
              )}
              {exerciseSaveState?.isSaved && (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">Saved</span>
              )}
            </div>
            <h3 className="mt-1 text-sm font-semibold text-zinc-900">{exercise.name}</h3>
            <p className="text-[11px] text-zinc-500">
              {exercise.workingSets || '?'} sets × {exercise.reps || '?'} · RPE {exercise.rpe || '?'} · Rest {exercise.rest || `${restTimerDefault}s`}
            </p>

            {progressionSuggestion?.suggest && (
              <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-medium text-emerald-800">
                    💡 {progressionSuggestion.message}
                  </p>
                  <button
                    type="button"
                    onClick={onDismissSuggestion}
                    className="rounded p-0.5 text-[11px] text-emerald-600 hover:bg-emerald-100 hover:text-emerald-800"
                    title="Dismiss suggestion"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={() => setSwapExerciseIndex(exIndex)} className="p-1 text-zinc-300 hover:text-blue-500" title="Swap exercise">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
            </button>
            <button onClick={() => onScheduleExercise?.(exercise)} className="p-1 text-zinc-300 hover:text-amber-600" title="Move to another day">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
            </button>
            <button onClick={() => moveExercise(exIndex, -1)} disabled={exIndex === 0} className="p-1 text-zinc-300 hover:text-zinc-600 disabled:opacity-30" title="Move up">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 15-6-6-6 6"/></svg>
            </button>
            <button onClick={() => moveExercise(exIndex, 1)} disabled={exIndex === activeExercisesLength - 1} className="p-1 text-zinc-300 hover:text-zinc-600 disabled:opacity-30" title="Move down">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <button onClick={() => removeExercise(exercise.id)} className="p-1 text-zinc-300 hover:text-red-500" title="Remove">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-100 bg-zinc-50/50">
        <button onClick={() => setActiveTab('track')} className={`flex-1 py-2 text-xs font-semibold overflow-hidden transition-colors ${activeTab === 'track' ? 'border-b-2 border-zinc-900 text-zinc-900 bg-white' : 'text-zinc-500 hover:bg-zinc-100'}`}>Track</button>
        <button onClick={() => setActiveTab('history')} className={`flex-1 py-2 text-xs font-semibold overflow-hidden transition-colors ${activeTab === 'history' ? 'border-b-2 border-zinc-900 text-zinc-900 bg-white' : 'text-zinc-500 hover:bg-zinc-100'}`}>History <span>({exerciseHistory.length})</span></button>
        <button onClick={() => setActiveTab('graph')} className={`flex-1 py-2 text-xs font-semibold overflow-hidden transition-colors ${activeTab === 'graph' ? 'border-b-2 border-zinc-900 text-zinc-900 bg-white' : 'text-zinc-500 hover:bg-zinc-100'}`}>Graph</button>
      </div>

      {activeTab === 'track' && (
        <div className="px-4 py-3">
          {instructionNote && (
            <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-blue-800">Exercise instruction</p>
              <p className="mt-1 text-xs leading-relaxed text-blue-900">{instructionNote}</p>
            </div>
          )}

          {warmupSets.length > 0 && (
            <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900/60 dark:bg-emerald-950/30">
              <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-200">Warm-up suggestion</p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                Based on {warmupReferenceWeight}{weightUnit} working weight.
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {warmupSets.map((step) => (
                  <span
                    key={step.id}
                    className="rounded-full border border-emerald-300 bg-white px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                  >
                    {step.weight}{weightUnit} × {step.reps}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Previous Session Weight */}
          {previous && (
            <div className="pb-3 text-[11px] text-zinc-500 flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              <span>Last time: <span className="font-semibold text-zinc-700">{previous.weight}kg × {previous.reps || '?'}</span></span>
            </div>
          )}

          <div className="mb-2 flex gap-2 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
            <span className="w-8 shrink-0 text-center">Set</span>
            <span className="flex-1 min-w-0">Weight</span>
            <span className="flex-1 min-w-0">Reps</span>
            <span className="flex-1 min-w-0">RPE</span>
            <span className="w-6 shrink-0"></span>
          </div>

        {(exerciseLog[exercise.id]?.sets || []).map((set, setIdx) => (
          <div key={setIdx} className="mb-1.5">
            <div className="flex flex-row gap-2 items-start">
              <span className="w-8 shrink-0 text-xs font-medium text-zinc-400 text-center pt-2">{set.setNumber}</span>
              <div className="flex-1 min-w-0">
                <input
                  type="text" inputMode="decimal"
                  value={set.weight}
                  onChange={(e) => handleSetFieldChange(setIdx, 'weight', e.target.value)}
                  className="w-full min-w-0 rounded border border-zinc-200 px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  placeholder={previous?.weight || weightUnit}
                />
                {setIdx === 0 && previous && (
                  <p className="pt-1 text-[10px] text-zinc-400 truncate w-full">Last time: {previous.weight}{weightUnit} × {previous.reps || '?'}</p>
                )}
              </div>
              <input
                type="text" inputMode="numeric"
                value={set.reps}
                onChange={(e) => handleSetFieldChange(setIdx, 'reps', e.target.value)}
                className="flex-1 w-full min-w-0 rounded border border-zinc-200 px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                placeholder="reps"
              />
              <input
                type="text" inputMode="decimal"
                value={set.rpe}
                onChange={(e) => updateSet(exercise.id, setIdx, 'rpe', e.target.value)}
                className="flex-1 w-full min-w-0 rounded border border-zinc-200 px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                placeholder="RPE"
              />
              <button
                onClick={() => removeSet(exercise.id, setIdx)}
                className="w-6 shrink-0 pt-2 text-zinc-300 hover:text-red-500 flex justify-center"
                title="Remove set"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/></svg>
              </button>
            </div>
            {set.weight && set.reps && (
              <p className="pl-[2.5rem] pt-1 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                Estimated 1RM: {calculate1RM(set.weight, set.reps)}{weightUnit}
              </p>
            )}
          </div>
        ))}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => onSaveExercise(exercise.id)}
            className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
          >
            {exerciseSaveState?.isSaved ? 'Saved' : 'Save Exercise'}
          </button>
          <button
            onClick={() => addSet(exercise.id)}
            className="rounded border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
          >
            + Add Set
          </button>
          <button
            onClick={() => startTimer(parseRestSeconds(exercise.rest, restTimerDefault))}
            className="rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100"
          >
            ⏱ Rest ({exercise.rest || `${restTimerDefault}s`})
          </button>
          <button
            onClick={() => setShowCustomRest(true)}
            className="rounded border border-zinc-200 px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
            title="Custom Manual Timer"
          >
            ⏱ Custom
          </button>
        </div>

          <textarea
            value={exerciseLog[exercise.id]?.notes || ''}
            onChange={(e) => updateExerciseNotes(exercise.id, e.target.value)}
            className="mt-2 w-full rounded border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-700 outline-none focus:border-zinc-400 resize-none"
            rows="1"
            placeholder="Your notes for this session..."
          />
        </div>
      )}

      {activeTab === 'history' && (
        <div className="px-4 py-3 max-h-64 overflow-y-auto">
          {exerciseHistory.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-4">No history yet.</p>
          ) : (
            exerciseHistory.slice().reverse().map((session, i) => (
              <div key={i} className="mb-3 border-b border-zinc-100 pb-3 last:border-0 last:pb-0">
                <p className="text-xs font-semibold text-zinc-900 mb-1">{session.dateStr}</p>
                <div className="flex gap-2 text-[10px] font-medium text-zinc-500 mb-1">
                  <span className="w-8 shrink-0 text-center">Set</span>
                  <span className="flex-1 min-w-0">Weight</span>
                  <span className="flex-1 min-w-0">Reps</span>
                  <span className="flex-1 min-w-0">RPE</span>
                </div>
                {(session.sets || []).map((s, idx) => (
                  <div key={idx} className="flex gap-2 text-xs text-zinc-800 mb-0.5">
                    <span className="w-8 shrink-0 text-center text-zinc-400">{s.setNumber || idx + 1}</span>
                    <span className="flex-1 min-w-0 font-medium text-zinc-700 truncate">{s.weight ? `${s.weight}kg` : '-'}</span>
                    <span className="flex-1 min-w-0 truncate">{s.reps || '-'}</span>
                    <span className="flex-1 min-w-0 truncate">{s.rpe || '-'}</span>
                  </div>
                ))}
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-500">
                  <span className="bg-zinc-100 px-1.5 py-0.5 rounded">Vol: {session.volume}kg</span>
                  <span>Est. 1RM: <span className="font-semibold text-zinc-800">{session.best1rm}kg</span></span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'graph' && (
        <div className="px-4 py-4 h-56 w-full">
          {exerciseHistory.length < 2 ? (
            <p className="text-xs text-zinc-500 text-center py-4">Need at least 2 sessions to show a graph.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={exerciseHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                <XAxis dataKey="dateStr" tick={{ fontSize: 10, fill: '#71717A' }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fontSize: 10, fill: '#71717A' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                  labelStyle={{ fontWeight: 'bold', color: '#18181B', marginBottom: '4px' }}
                />
                <Line type="monotone" dataKey="best1rm" name="Est. 1RM (kg)" stroke="#18181B" strokeWidth={2} activeDot={{ r: 6 }} dot={{ r: 4, fill: '#18181B', strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </section>
  )
}
