import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Minus, Plus, Check, Trash2, Timer, X, ChevronLeft, ChevronRight, ChevronDown, Flag, StickyNote,
  Lightbulb, Flame, Weight, AlertTriangle, TrendingDown,
} from 'lucide-react'
import { useWorkoutStore } from '../store/useWorkoutStore'
import { useRestTimer, formatTime } from '../hooks/useRestTimer'
import { usePrevWeight } from '../hooks/usePrevWeight'
import { usePRDetection } from '../hooks/usePRDetection'
import { useWakeLock } from '../hooks/useWakeLock'
import MuscleGroupBadge from '../components/MuscleGroupBadge'
import ExercisePickerSheet from '../components/ExercisePickerSheet'
import { parseRestSeconds } from '../utils/workoutHelpers'
import { getProgressionSuggestion, detectPlateau } from '../utils/progressionSuggestion'
import { generateWarmupSets, getWarmupReferenceWeight } from '../utils/warmupSets'
import { computePlatesPerSide, formatPlatesPerSide } from '../utils/plateMath'

const AUTOSAVE_KEY = 'ppl_tracker_active_workout'
const genExId = () => `added_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

const emptySet = () => ({ weight: '', reps: '', rpe: '' })

function buildLog(exercises) {
  const log = {}
  for (const ex of exercises || []) {
    const n = Math.max(1, Number(ex.workingSets) || 1)
    log[ex.id] = { sets: Array.from({ length: n }, emptySet), notes: '' }
  }
  return log
}

const isSetComplete = (s) =>
  String(s?.weight ?? '').trim() !== '' && String(s?.reps ?? '').trim() !== ''

// ── compact, fluid number stepper for thumb input (fits any phone width) ──
function Stepper({ value, onChange, step = 1, min = 0, placeholder, decimal }) {
  const num = parseFloat(value)
  const bump = (dir) => {
    const base = Number.isFinite(num) ? num : 0
    let next = base + dir * step
    if (next < min) next = min
    onChange(decimal ? String(Math.round(next * 100) / 100) : String(Math.round(next)))
  }
  return (
    <div className="flex w-full items-center gap-0.5">
      <button
        type="button"
        onClick={() => bump(-1)}
        className="flex h-11 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-800 active:scale-90"
        aria-label="Decrease"
      >
        <Minus size={16} />
      </button>
      <input
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="tnum h-11 w-full min-w-0 flex-1 rounded-lg bg-surface border border-surface-border text-center text-base font-semibold text-zinc-800 placeholder-zinc-400 outline-none focus:ring-1 focus:ring-accent"
      />
      <button
        type="button"
        onClick={() => bump(1)}
        className="flex h-11 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-800 active:scale-90"
        aria-label="Increase"
      >
        <Plus size={16} />
      </button>
    </div>
  )
}

export default function ActiveWorkoutPage() {
  const navigate = useNavigate()

  const getActiveSession = useWorkoutStore((s) => s.getActiveSession)
  const completeWorkout = useWorkoutStore((s) => s.completeWorkout)
  const completeSimpleWorkout = useWorkoutStore((s) => s.completeSimpleWorkout)
  const completedDays = useWorkoutStore((s) => s.completedDays)
  const weightUnit = useWorkoutStore((s) => s.weightUnit)
  const restTimerDefault = useWorkoutStore((s) => s.restTimerDefault)
  const restTimerVibration = useWorkoutStore((s) => s.restTimerVibration)
  const program = useWorkoutStore((s) => s.program)
  const currentPhaseId = useWorkoutStore((s) => s.currentPhaseId)
  const currentWeek = useWorkoutStore((s) => s.currentWeek)
  const currentDayIndex = useWorkoutStore((s) => s.currentDayIndex)
  const setPeriodizedPosition = useWorkoutStore((s) => s.setPeriodizedPosition)
  const setActivePlan = useWorkoutStore((s) => s.setActivePlan)
  const userPlans = useWorkoutStore((s) => s.userPlans)

  const session = getActiveSession()
  const [showDaySwitcher, setShowDaySwitcher] = useState(false)
  const [switcherWeek, setSwitcherWeek] = useState(1)
  const sessionKey = `${session.planId}::${session.planDayId}`

  const [exercises, setExercises] = useState(session.exercises || [])
  const [exerciseLog, setExerciseLog] = useState(() => buildLog(session.exercises))
  const [sessionNotes, setSessionNotes] = useState('')
  const [savedExercises, setSavedExercises] = useState({})
  const [showNotes, setShowNotes] = useState(false)
  const [expandedTool, setExpandedTool] = useState({}) // { [exId]: 'warmup' | 'plates' | null }
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [showFinish, setShowFinish] = useState(false)
  const [saving, setSaving] = useState(false)
  const startTimeRef = useRef(Date.now())
  const hydratedRef = useRef(false)

  const { previousWeights } = usePrevWeight(exercises)
  const { detectSessionPRs } = usePRDetection(completedDays)
  const { timeLeft, isRunning, startTimer, stopTimer, addTime } = useRestTimer({ enableVibration: restTimerVibration })

  // Keep the screen awake while logging.
  useWakeLock(true)

  // One-tap: fill the first empty set of an exercise with last session's weight/reps.
  const applyLast = useCallback((exId) => {
    const prev = previousWeights[exId]
    if (!prev) return
    setExerciseLog((log) => {
      const ex = log[exId] || { sets: [emptySet()], notes: '' }
      const idx = ex.sets.findIndex((s) => !isSetComplete(s))
      const target = idx === -1 ? ex.sets.length - 1 : idx
      const sets = ex.sets.map((s, i) => i === target
        ? { ...s, weight: String(prev.weight ?? ''), reps: String(prev.reps ?? '') }
        : s)
      return { ...log, [exId]: { ...ex, sets } }
    })
  }, [previousWeights])

  // Hydrate from autosave (same plan+day) or initialize fresh when session changes.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved?.sessionKey === sessionKey && saved.exerciseLog) {
          setExercises(saved.exercises || session.exercises || [])
          setExerciseLog(saved.exerciseLog)
          setSessionNotes(saved.sessionNotes || '')
          startTimeRef.current = saved.startTime || Date.now()
          hydratedRef.current = true
          return
        }
      }
    } catch { /* ignore */ }
    setExercises(session.exercises || [])
    setExerciseLog(buildLog(session.exercises))
    setSessionNotes('')
    startTimeRef.current = Date.now()
    hydratedRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey])

  // Autosave on change.
  useEffect(() => {
    if (!hydratedRef.current) return
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
        sessionKey,
        kind: session.kind,
        planId: session.planId,
        planDayId: session.planDayId,
        label: session.label,
        exercises,
        exerciseLog,
        sessionNotes,
        startTime: startTimeRef.current,
      }))
    } catch { /* ignore */ }
  }, [exercises, exerciseLog, sessionNotes, sessionKey, session.kind, session.planId, session.planDayId, session.label])

  // Editing a set does NOT start the timer (FitNotes-style). The rest timer
  // only runs when the user taps "Save exercise".
  const updateSet = useCallback((exId, idx, field, value) => {
    setExerciseLog((prev) => {
      const ex = prev[exId] || { sets: [emptySet()], notes: '' }
      const sets = ex.sets.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
      return { ...prev, [exId]: { ...ex, sets } }
    })
    // a fresh edit after saving un-marks the saved state for that exercise
    setSavedExercises((prev) => {
      if (!prev[exId]) return prev
      const next = { ...prev }
      delete next[exId]
      return next
    })
  }, [])

  // Save an exercise: confirm its logged sets and start the rest timer.
  const saveExercise = useCallback((exId) => {
    const target = exercises.find((e) => e.id === exId)
    startTimer(parseRestSeconds(target?.rest, restTimerDefault))
    setSavedExercises((prev) => ({ ...prev, [exId]: true }))
  }, [exercises, restTimerDefault, startTimer])

  const addSet = useCallback((exId) => {
    setExerciseLog((prev) => {
      const ex = prev[exId] || { sets: [], notes: '' }
      return { ...prev, [exId]: { ...ex, sets: [...ex.sets, emptySet()] } }
    })
  }, [])

  const addExerciseToSession = useCallback((template) => {
    const ex = {
      id: genExId(),
      name: template.name || 'New exercise',
      muscleGroup: template.muscleGroup || '',
      subMuscleGroup: template.subMuscleGroup || '',
      workingSets: Number(template.workingSets) || 3,
      reps: template.reps || '8-12',
      rpe: template.rpe || '',
      rest: template.rest || '~2 min',
      warmupSets: template.warmupSets || '0',
    }
    setExercises((prev) => [...prev, ex])
    setExerciseLog((prev) => ({
      ...prev,
      [ex.id]: { sets: Array.from({ length: Math.max(1, ex.workingSets) }, emptySet), notes: '' },
    }))
  }, [])

  const removeExercise = useCallback((exId) => {
    setExercises((prev) => prev.filter((e) => e.id !== exId))
    setExerciseLog((prev) => {
      const next = { ...prev }
      delete next[exId]
      return next
    })
  }, [])

  const removeSet = useCallback((exId, idx) => {
    setExerciseLog((prev) => {
      const ex = prev[exId]
      if (!ex || ex.sets.length <= 1) return prev
      return { ...prev, [exId]: { ...ex, sets: ex.sets.filter((_, i) => i !== idx) } }
    })
  }, [])

  // Per-exercise history (newest-first), keyed by name — feeds progression suggestions.
  const historyByName = useMemo(() => {
    const map = {}
    for (let i = (completedDays?.length || 0) - 1; i >= 0; i--) {
      const day = completedDays[i]
      if (day?.deletedAt || day?.deleted_at) continue
      for (const ex of day.exercises || []) {
        if (!ex?.name || !Array.isArray(ex.sets) || ex.sets.length === 0) continue
        if (!map[ex.name]) map[ex.name] = []
        map[ex.name].push(ex)
      }
    }
    return map
  }, [completedDays])

  const loggedSetCount = useMemo(() => {
    let n = 0
    for (const ex of exercises) {
      for (const s of exerciseLog[ex.id]?.sets || []) if (isSetComplete(s)) n++
    }
    return n
  }, [exercises, exerciseLog])

  const handleFinish = async () => {
    setSaving(true)
    const workoutData = exercises.map((ex) => {
      const sets = (exerciseLog[ex.id]?.sets || [])
        .filter(isSetComplete)
        .map((s) => ({
          weight: parseFloat(s.weight) || 0,
          reps: parseInt(s.reps, 10) || 0,
          rpe: s.rpe === '' ? null : parseFloat(s.rpe),
          timestamp: new Date().toISOString(),
        }))
      return {
        id: ex.id,
        exerciseId: ex.id,
        name: ex.name,
        muscleGroup: ex.muscleGroup || '',
        sets,
        notes: exerciseLog[ex.id]?.notes || '',
      }
    }).filter((ex) => ex.sets.length > 0)

    const prs = detectSessionPRs(exercises, exerciseLog)
    const durationMinutes = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 60000))
    const metadata = {
      workoutLabel: session.label,
      sessionNotes,
      durationMinutes,
      prExercises: prs.map((p) => p.name),
    }

    try {
      if (session.kind === 'periodized') {
        await completeWorkout(workoutData, metadata)
      } else {
        await completeSimpleWorkout(workoutData, {
          ...metadata,
          planId: session.planId,
          planDayId: session.planDayId,
        })
      }
      localStorage.removeItem(AUTOSAVE_KEY)
      stopTimer()
      navigate('/history')
    } finally {
      setSaving(false)
    }
  }

  const discard = () => {
    localStorage.removeItem(AUTOSAVE_KEY)
    stopTimer()
    navigate('/')
  }

  if (session.isRest) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-xl font-bold text-zinc-900">Rest day</h1>
        <p className="text-zinc-500">Today's a scheduled rest day. Recover well.</p>
        <button onClick={() => navigate('/')} className="btn-secondary">Back home</button>
      </div>
    )
  }

  if (!exercises.length) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-xl font-bold text-zinc-900">No exercises here yet</h1>
        <p className="max-w-xs text-zinc-500">This day has no exercises. Add some in the plan builder, then come back to log.</p>
        <div className="flex gap-2">
          <button onClick={() => navigate('/plans')} className="btn-primary">Open builder</button>
          <button onClick={() => navigate('/')} className="btn-secondary">Home</button>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-4">
      {/* header */}
      <header className="mb-4 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="btn-ghost p-2" aria-label="Back">
          <ChevronLeft size={22} />
        </button>
        <button
          onClick={() => { setSwitcherWeek(Number(currentWeek) || 1); setShowDaySwitcher(true) }}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          aria-label="Switch day"
        >
          <div className="min-w-0">
            <p className="truncate text-xs uppercase tracking-wider text-zinc-500">{session.planName}</p>
            <h1 className="truncate text-xl font-extrabold text-zinc-900">{session.label}</h1>
          </div>
          <ChevronDown size={18} className="shrink-0 text-zinc-400" />
        </button>
        <span className="tnum rounded-full bg-surface border border-surface-border px-3 py-1 text-sm font-semibold text-zinc-700">
          {loggedSetCount} set{loggedSetCount === 1 ? '' : 's'}
        </span>
      </header>

      {/* exercise cards */}
      <div className="space-y-4">
        {exercises.map((ex) => {
          const log = exerciseLog[ex.id] || { sets: [emptySet()], notes: '' }
          const prev = previousWeights[ex.id]
          const exHistory = historyByName[ex.name] || []
          const suggestion = getProgressionSuggestion(exHistory, ex.reps, ex.muscleGroup)
          const plateau = detectPlateau(exHistory)
          const firstWeight = log.sets?.[0]?.weight
          const refWeight = getWarmupReferenceWeight(firstWeight, prev?.weight)
          const warmups = generateWarmupSets(refWeight, weightUnit, { warmupSets: ex.warmupSets, workingReps: ex.reps })
          const topEntered = (log.sets || []).reduce((m, s) => {
            const w = parseFloat(s.weight)
            return Number.isFinite(w) && w > m ? w : m
          }, 0)
          const plateWeight = topEntered || refWeight
          const plates = plateWeight ? computePlatesPerSide(plateWeight, weightUnit) : null
          const hasPlates = Boolean(plates?.perSide?.length)
          const tool = expandedTool[ex.id] || null
          const toggleTool = (name) => setExpandedTool((p) => ({ ...p, [ex.id]: p[ex.id] === name ? null : name }))
          return (
            <section key={ex.id} className="card p-4">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-bold text-zinc-900">{ex.name || 'Exercise'}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    {ex.muscleGroup && <MuscleGroupBadge group={ex.muscleGroup} />}
                    {ex.reps && <span className="tnum">Target {ex.reps} reps</span>}
                    {ex.rpe && <span className="tnum">RPE {ex.rpe}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {prev && (
                    <button
                      onClick={() => applyLast(ex.id)}
                      className="rounded-lg bg-surface border border-surface-border px-2 py-1 text-right transition hover:border-accent active:scale-95"
                      aria-label={`Use last session: ${prev.weight} by ${prev.reps}`}
                      title="Tap to use last session's weight & reps"
                    >
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">Last · tap</p>
                      <p className="tnum text-sm font-semibold text-zinc-700">{prev.weight}×{prev.reps}</p>
                    </button>
                  )}
                  <button
                    onClick={() => removeExercise(ex.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:text-danger active:scale-95"
                    aria-label="Remove exercise from this workout"
                    title="Remove from this workout"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* plateau warning (takes priority — flags a stall before the nudge) */}
              {plateau.plateaued && (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warn" />
                  <span>{plateau.message}</span>
                </div>
              )}

              {/* progression suggestion */}
              {suggestion.suggest && suggestion.message && (
                <div className="mb-3 flex items-start gap-2 rounded-xl bg-accent-soft px-3 py-2 text-xs text-accent-fg">
                  {suggestion.type === 'backoff'
                    ? <TrendingDown size={15} className="mt-0.5 shrink-0 text-accent" />
                    : <Lightbulb size={15} className="mt-0.5 shrink-0 text-accent" />}
                  <span>{suggestion.message}</span>
                </div>
              )}

              {/* warm-up / plates tools */}
              {(warmups.length > 0 || hasPlates) && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {warmups.length > 0 && (
                    <button
                      onClick={() => toggleTool('warmup')}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${tool === 'warmup' ? 'border-accent bg-accent-soft text-accent' : 'border-surface-border bg-surface text-zinc-600'}`}
                    >
                      <Flame size={13} /> Warm-up
                    </button>
                  )}
                  {hasPlates && (
                    <button
                      onClick={() => toggleTool('plates')}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${tool === 'plates' ? 'border-accent bg-accent-soft text-accent' : 'border-surface-border bg-surface text-zinc-600'}`}
                    >
                      <Weight size={13} /> Plates
                    </button>
                  )}
                </div>
              )}

              {tool === 'warmup' && warmups.length > 0 && (
                <div className="mb-3 space-y-1 rounded-xl border border-surface-border bg-surface p-3">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">Warm-up (not logged) · based on {Math.round(refWeight)}{weightUnit}</p>
                  {warmups.map((w) => (
                    <div key={w.id} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">{w.label} · {w.percent}%</span>
                      <span className="tnum font-semibold text-zinc-800">{w.weight}{weightUnit} × {w.reps}</span>
                    </div>
                  ))}
                </div>
              )}

              {tool === 'plates' && hasPlates && (
                <div className="mb-3 rounded-xl border border-surface-border bg-surface p-3 text-sm">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
                    Per side for {plateWeight}{weightUnit} (bar {plates.bar}{weightUnit})
                  </p>
                  <p className="tnum font-semibold text-zinc-800">{formatPlatesPerSide(plates)}</p>
                  {plates.remainder > 0 && (
                    <p className="mt-1 text-xs text-warn">+{plates.remainder}{weightUnit}/side not matchable with standard plates</p>
                  )}
                </div>
              )}

              {/* set rows */}
              <div className="space-y-2">
                <div className="grid grid-cols-[20px_1fr_1fr_44px_28px] items-center gap-1.5 px-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
                  <span>#</span>
                  <span className="text-center">Weight ({weightUnit})</span>
                  <span className="text-center">Reps</span>
                  <span className="text-center">RPE</span>
                  <span />
                </div>
                {log.sets.map((s, idx) => {
                  const done = isSetComplete(s)
                  return (
                    <div
                      key={idx}
                      className={`grid grid-cols-[20px_1fr_1fr_44px_28px] items-center gap-1.5 rounded-xl px-0.5 py-1 ${done ? 'bg-accent-soft border border-surface-border' : ''}`}
                    >
                      <span className={`tnum text-center text-sm font-bold ${done ? 'text-accent' : 'text-zinc-400'}`}>
                        {done ? <Check size={15} className="mx-auto" /> : idx + 1}
                      </span>
                      <Stepper value={s.weight} onChange={(v) => updateSet(ex.id, idx, 'weight', v)} step={2.5} decimal placeholder="0" />
                      <Stepper value={s.reps} onChange={(v) => updateSet(ex.id, idx, 'reps', v)} step={1} placeholder="0" />
                      <input
                        inputMode="decimal"
                        value={s.rpe}
                        placeholder="–"
                        aria-label={`RPE for set ${idx + 1}`}
                        onChange={(e) => updateSet(ex.id, idx, 'rpe', e.target.value)}
                        className="tnum h-11 w-full min-w-0 rounded-lg bg-surface border border-surface-border text-center text-sm text-zinc-800 placeholder-zinc-400 outline-none focus:ring-1 focus:ring-accent"
                      />
                      <button
                        onClick={() => removeSet(ex.id, idx)}
                        disabled={log.sets.length <= 1}
                        className="flex h-8 w-7 items-center justify-center rounded-lg text-zinc-400 active:scale-95 disabled:opacity-30"
                        aria-label="Remove set"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>

              {(() => {
                const exDone = (log.sets || []).some(isSetComplete)
                const saved = Boolean(savedExercises[ex.id])
                return (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button onClick={() => addSet(ex.id)} className="btn-secondary text-sm">
                      <Plus size={16} /> Add set
                    </button>
                    <button
                      onClick={() => saveExercise(ex.id)}
                      disabled={!exDone}
                      className={saved
                        ? 'inline-flex items-center justify-center gap-2 rounded-xl border border-surface-border bg-accent-soft px-4 py-3 text-sm font-semibold text-accent disabled:opacity-50'
                        : 'btn-primary text-sm'}
                    >
                      <Check size={16} /> {saved ? 'Saved' : 'Save exercise'}
                    </button>
                  </div>
                )
              })()}
            </section>
          )
        })}
      </div>

      {/* add exercise mid-workout */}
      <button
        onClick={() => setShowAddExercise(true)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-surface-border px-4 py-4 text-sm font-medium text-zinc-500 transition active:scale-[0.99] hover:bg-surface-raised"
      >
        <Plus size={18} /> Add exercise
      </button>

      {/* notes */}
      <div className="mt-4">
        {showNotes ? (
          <textarea
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            placeholder="Session notes…"
            rows={3}
            className="field resize-none"
            autoFocus
          />
        ) : (
          <button onClick={() => setShowNotes(true)} className="btn-ghost text-sm text-zinc-500">
            <StickyNote size={16} /> {sessionNotes ? 'Edit notes' : 'Add session notes'}
          </button>
        )}
      </div>

      {/* sticky bottom action bar */}
      <div className="fixed inset-x-0 bottom-[60px] z-20 px-4">
        <div className="mx-auto max-w-2xl">
          {isRunning && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-surface-border bg-surface px-3 py-2 shadow-sm">
              <Timer size={18} className="text-accent" />
              <span className="tnum flex-1 text-lg font-bold text-zinc-800">{formatTime(timeLeft)}</span>
              <button onClick={() => addTime(30)} className="rounded-lg bg-white border border-surface-border px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">+30s</button>
              <button onClick={stopTimer} className="rounded-lg bg-white border border-surface-border px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">Skip</button>
            </div>
          )}
          <button
            onClick={() => setShowFinish(true)}
            disabled={loggedSetCount === 0}
            className="btn-primary w-full text-base"
          >
            <Flag size={18} /> Finish workout
          </button>
        </div>
      </div>

      {showAddExercise && (
        <ExercisePickerSheet
          title="Add exercise to workout"
          onClose={() => setShowAddExercise(false)}
          onAdd={addExerciseToSession}
        />
      )}

      {/* finish confirm sheet */}
      {showFinish && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={() => setShowFinish(false)}>
          <div className="w-full rounded-t-3xl border-t border-surface-border bg-surface-raised p-5 pb-safe" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900">Finish workout?</h2>
              <button onClick={() => setShowFinish(false)} className="btn-ghost p-2"><X size={20} /></button>
            </div>
            <p className="mb-4 text-sm text-zinc-500">
              Logging <span className="tnum font-semibold text-zinc-800">{loggedSetCount}</span> set{loggedSetCount === 1 ? '' : 's'} for <span className="font-semibold text-zinc-800">{session.label}</span>.
            </p>
            <button onClick={handleFinish} disabled={saving} className="btn-primary mb-2 w-full">
              {saving ? 'Saving…' : 'Save & finish'}
            </button>
            <button onClick={discard} className="w-full btn-ghost text-sm text-danger">
              Discard workout
            </button>
          </div>
        </div>
      )}

      {/* day switcher sheet */}
      {showDaySwitcher && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={() => setShowDaySwitcher(false)}>
          <div className="w-full rounded-t-3xl border-t border-surface-border bg-surface-raised p-5 pb-safe" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900">Switch day</h2>
              <button onClick={() => setShowDaySwitcher(false)} className="btn-ghost p-2"><X size={20} /></button>
            </div>

            {session.kind === 'periodized' ? (() => {
              const phase = program?.phases?.find((p) => p.id === currentPhaseId)
              const weeks = phase?.weeks || []
              const week = weeks[switcherWeek - 1] || weeks[0]
              const days = week?.days || []
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      disabled={switcherWeek <= 1}
                      onClick={() => setSwitcherWeek((w) => Math.max(1, w - 1))}
                      className="btn-ghost p-2 disabled:opacity-30"
                      aria-label="Previous week"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <p className="text-sm font-semibold text-zinc-800">
                      Week {switcherWeek} <span className="font-normal text-zinc-400">of {weeks.length}</span>
                    </p>
                    <button
                      disabled={switcherWeek >= weeks.length}
                      onClick={() => setSwitcherWeek((w) => Math.min(weeks.length, w + 1))}
                      className="btn-ghost p-2 disabled:opacity-30"
                      aria-label="Next week"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                  <div className="max-h-[50vh] space-y-2 overflow-y-auto">
                    {days.map((day, dIdx) => {
                      const isCurrent = switcherWeek === Number(currentWeek) && dIdx === Number(currentDayIndex)
                      if (day.isRest) {
                        return (
                          <div key={day.id || dIdx} className="flex items-center justify-between rounded-xl bg-surface px-4 py-3 text-sm text-zinc-400">
                            <span>{day.label || 'Rest day'}</span>
                            <span className="text-xs uppercase tracking-wider">Rest</span>
                          </div>
                        )
                      }
                      return (
                        <button
                          key={day.id || dIdx}
                          onClick={async () => { await setPeriodizedPosition(currentPhaseId, switcherWeek, dIdx); setShowDaySwitcher(false) }}
                          className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition active:scale-[0.98] ${isCurrent ? 'border-accent bg-accent-soft' : 'border-surface-border bg-surface-overlay hover:bg-zinc-50'}`}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-zinc-800">{day.label}</p>
                            <p className="text-xs text-zinc-500">{(day.exercises || []).length} exercise{(day.exercises || []).length === 1 ? '' : 's'}</p>
                          </div>
                          {isCurrent && <span className="shrink-0 text-xs font-semibold text-accent">Current</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })() : (() => {
              const plan = (userPlans || []).find((p) => p.id === session.planId)
              const days = plan?.days || []
              return (
                <div className="max-h-[50vh] space-y-2 overflow-y-auto">
                  {days.length === 0 && <p className="px-1 py-2 text-sm text-zinc-500">No other days in this plan.</p>}
                  {days.map((day) => {
                    const isCurrent = day.id === session.planDayId
                    return (
                      <button
                        key={day.id}
                        onClick={() => { setActivePlan(session.planId, day.id); setShowDaySwitcher(false) }}
                        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition active:scale-[0.98] ${isCurrent ? 'border-accent bg-accent-soft' : 'border-surface-border bg-surface-overlay hover:bg-zinc-50'}`}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-zinc-800">{day.label}</p>
                          <p className="text-xs text-zinc-500">{(day.exercises || []).length} exercise{(day.exercises || []).length === 1 ? '' : 's'}</p>
                        </div>
                        {isCurrent && <span className="shrink-0 text-xs font-semibold text-accent">Current</span>}
                      </button>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
