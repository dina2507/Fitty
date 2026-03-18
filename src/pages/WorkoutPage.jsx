import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PhaseIndicator from '../components/PhaseIndicator'
import { useWorkoutStore } from '../store/useWorkoutStore'
import { useRestTimer, formatTime } from '../hooks/useRestTimer'
import { usePrevWeight } from '../hooks/usePrevWeight'
import { usePRDetection } from '../hooks/usePRDetection'
import { useMilestones } from '../hooks/useMilestones'

import { AddExerciseModal } from '../components/Workout/AddExerciseModal'
import { RestTimerBar } from '../components/Workout/RestTimerBar'
import { ExerciseCard } from '../components/Workout/ExerciseCard'
import { SwapExerciseModal } from '../components/Workout/SwapExerciseModal'
import { CompletionModal } from '../components/Workout/CompletionModal'
import PlateCalculator from '../components/PlateCalculator'
import { buildInitialLog } from '../utils/workoutHelpers'
import { getProgressionSuggestion } from '../utils/progressionSuggestion'
import { buildMilestoneStats } from '../utils/milestoneChecker'

const AUTOSAVE_KEY = 'ppl_tracker_active_workout'

// ── Main Workout Page ──
function WorkoutPage() {
  const navigate = useNavigate()

  const programState = useWorkoutStore((state) => state.program)
  const currentPhaseId = useWorkoutStore((state) => state.currentPhaseId)
  const currentWeek = useWorkoutStore((state) => state.currentWeek)
  const getCurrentDay = useWorkoutStore((state) => state.getCurrentDay)
  const completeWorkout = useWorkoutStore((state) => state.completeWorkout)
  const updateTodayWorkout = useWorkoutStore((state) => state.updateTodayWorkout)
  const skipDay = useWorkoutStore((state) => state.skipDay)
  const completedDays = useWorkoutStore((state) => state.completedDays)
  const weightUnit = useWorkoutStore((state) => state.weightUnit)
  const restTimerDefault = useWorkoutStore((state) => state.restTimerDefault)
  const restTimerVibration = useWorkoutStore((state) => state.restTimerVibration)

  const currentPhase = useMemo(
    () => programState.phases.find((phase) => phase.id === currentPhaseId),
    [programState, currentPhaseId],
  )
  
  const baseProgramDay = getCurrentDay()
  
  const todaysWorkout = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    return completedDays.find(d => d.date.startsWith(todayStr))
  }, [completedDays])

  const programDay = useMemo(() => {
    if (todaysWorkout) {
       const phase = programState.phases.find(p => p.id === todaysWorkout.phaseId)
       const week = phase?.weeks?.[todaysWorkout.week - 1]
       return week?.days?.[todaysWorkout.dayIndex] || baseProgramDay
    }
    return baseProgramDay
  }, [todaysWorkout, programState, baseProgramDay])

  const [activeExercises, setActiveExercises] = useState([])
  const [exerciseLog, setExerciseLog] = useState({})
  const [sessionNotes, setSessionNotes] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [swapExerciseIndex, setSwapExerciseIndex] = useState(null)
  const activeCustomTemplate = useWorkoutStore((state) => state.activeCustomTemplate)
  const clearCustomWorkoutTemplate = useWorkoutStore((state) => state.clearCustomWorkoutTemplate)
  const [showCustomRest, setShowCustomRest] = useState(false)
  const [showPlateCalculator, setShowPlateCalculator] = useState(false)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [isSavingWorkout, setIsSavingWorkout] = useState(false)
  const [startTime, setStartTime] = useState(() => Date.now())
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isKeyboardInputFocused, setIsKeyboardInputFocused] = useState(false)
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState([])

  const { checkAndAward } = useMilestones()

  // Rest timer
  const {
    timeLeft,
    isRunning: timerRunning,
    totalDuration,
    startTimer,
    stopTimer,
    addTime,
  } = useRestTimer({ enableVibration: restTimerVibration })

  // Previous session weights: exerciseId -> { weight, reps }
  const { previousWeights } = usePrevWeight(activeExercises)

  // PR detection against completed history (before this session is saved).
  const { detectSessionPRs } = usePRDetection(completedDays)
  const sessionPRs = useMemo(
    () => detectSessionPRs(activeExercises, exerciseLog),
    [activeExercises, detectSessionPRs, exerciseLog],
  )
  const sessionPRExerciseIds = useMemo(
    () => new Set(sessionPRs.map((item) => item.exerciseId)),
    [sessionPRs],
  )

  const progressionSuggestions = useMemo(() => {
    const suggestions = {}

    activeExercises.forEach((exercise) => {
      const matchingHistory = (completedDays || [])
        .filter((day) => {
          return (day.exercises || []).some((loggedExercise) => {
            const loggedId = loggedExercise.exerciseId || loggedExercise.id
            if (loggedId && loggedId === exercise.id) return true
            return Boolean(loggedExercise.name && exercise.name && loggedExercise.name === exercise.name)
          })
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 4)
        .map((day) => {
          const loggedExercise = (day.exercises || []).find((logged) => {
            const loggedId = logged.exerciseId || logged.id
            if (loggedId && loggedId === exercise.id) return true
            return Boolean(logged.name && exercise.name && logged.name === exercise.name)
          })

          return {
            date: day.date,
            name: exercise.name,
            sets: loggedExercise?.sets || [],
            topSet: null,
          }
        })

      suggestions[exercise.id] = getProgressionSuggestion(
        matchingHistory,
        exercise.reps,
        exercise.muscleGroup,
      )
    })

    return suggestions
  }, [activeExercises, completedDays])

  // Initialize from Custom Template OR program day OR restored auto-save
  useEffect(() => {
    // 1. Custom Template Override
    if (activeCustomTemplate && activeExercises.length === 0) {
      // Deep clone exercises to avoid mutating the template
      const clonedExercises = JSON.parse(JSON.stringify(activeCustomTemplate.exercises || []))
      
      // Inject unique IDs if missing, though builder guarantees them
      const safeExercises = clonedExercises.map(ex => ({
        ...ex,
        id: ex.id || 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
      }))

      setActiveExercises(safeExercises)
      setExerciseLog(buildInitialLog(safeExercises))
      setSessionNotes('')
      setStartTime(Date.now())
      setElapsedSeconds(0)
      return
    }

    if (!programDay || programDay.isRest) return

    // 2. Try to restore auto-saved state
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Check if restoring a custom template session or a normal program session
        if (parsed.isCustomTemplate && activeCustomTemplate && parsed.templateId === activeCustomTemplate.id) {
          setActiveExercises(parsed.activeExercises)
          setExerciseLog(parsed.exerciseLog)
          setSessionNotes(parsed.sessionNotes || '')
          if (parsed.startTime) setStartTime(parsed.startTime)
          else setStartTime(Date.now())
          return
        } else if (!parsed.isCustomTemplate && parsed.dayIndex === programDay?.dayIndex && parsed.phaseId === (todaysWorkout ? todaysWorkout.phaseId : currentPhaseId)) {
          setActiveExercises(parsed.activeExercises)
          setExerciseLog(parsed.exerciseLog)
          setSessionNotes(parsed.sessionNotes || '')
          if (parsed.startTime) setStartTime(parsed.startTime)
          else setStartTime(Date.now())
          return
        }
      }
    } catch {}

    // 3. Fresh start from program.json OR edit today's workout
    if (todaysWorkout && !activeCustomTemplate) {
      const fullExercises = (todaysWorkout.exercises || []).map(ex => {
        const orig = programDay?.exercises?.find(o => o.id === ex.exerciseId) || {}
        return { ...orig, ...ex, id: ex.exerciseId || orig.id }
      })
      setActiveExercises(fullExercises)
      const log = {}
      ;(todaysWorkout.exercises || []).forEach(ex => {
        log[ex.exerciseId || ex.id] = { sets: ex.sets || [], notes: ex.notes || '' }
      })
      setExerciseLog(log)
      setSessionNotes('')
      // Try to recover a sensible start time if editing today? Otherwise start fresh
      if (todaysWorkout.duration_minutes) {
        setStartTime(Date.now() - todaysWorkout.duration_minutes * 60000)
      } else {
        setStartTime(Date.now())
      }
    } else if (programDay?.exercises && !activeCustomTemplate) {
      setActiveExercises([...programDay.exercises])
      setExerciseLog(buildInitialLog(programDay.exercises))
      setSessionNotes('')
      setStartTime(Date.now())
    }
  }, [currentPhaseId, currentWeek, programDay?.dayIndex, activeCustomTemplate, todaysWorkout, programDay])

  // Auto-prefill blank weight inputs from previous session values.
  useEffect(() => {
    if (!activeExercises.length) return

    setExerciseLog((prev) => {
      let changed = false
      const next = { ...prev }

      activeExercises.forEach((exercise) => {
        const previous = previousWeights[exercise.id]
        const current = prev[exercise.id]
        if (!previous || !current?.sets?.length) return

        const prefill = String(previous.weight)
        let changedForExercise = false
        const nextSets = current.sets.map((set) => {
          const hasWeight = set.weight !== '' && set.weight !== null && set.weight !== undefined
          if (hasWeight) return set
          changed = true
          changedForExercise = true
          return { ...set, weight: prefill }
        })

        if (changedForExercise) {
          next[exercise.id] = {
            ...current,
            sets: nextSets,
          }
        }
      })

      return changed ? next : prev
    })
  }, [activeExercises, previousWeights])

  // Duration timer while workout session is active.
  useEffect(() => {
    if ((!activeCustomTemplate && programDay?.isRest) || activeExercises.length === 0) {
      setElapsedSeconds(0)
      return
    }

    const tick = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTime) / 1000)))
    }

    tick()
    const intervalId = window.setInterval(tick, 1000)
    return () => window.clearInterval(intervalId)
  }, [activeCustomTemplate, activeExercises.length, programDay?.isRest, startTime])

  useEffect(() => {
    setDismissedSuggestionIds([])
  }, [activeCustomTemplate?.id, programDay?.dayIndex, startTime])

  // iOS keyboard-safe bottom padding for fixed footer layouts.
  useEffect(() => {
    const isiOS = /iPad|iPhone|iPod/.test(window.navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

    if (!isiOS) return

    const handleFocusIn = (event) => {
      const tag = event?.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        setIsKeyboardInputFocused(true)
      }
    }

    const handleFocusOut = () => {
      window.setTimeout(() => {
        const activeTag = document.activeElement?.tagName
        const stillFocused = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT'
        setIsKeyboardInputFocused(stillFocused)
      }, 30)
    }

    window.addEventListener('focusin', handleFocusIn)
    window.addEventListener('focusout', handleFocusOut)

    return () => {
      window.removeEventListener('focusin', handleFocusIn)
      window.removeEventListener('focusout', handleFocusOut)
    }
  }, [])

  // Auto-save to localStorage (debounced)
  const saveTimerRef = useRef(null)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      // Only auto-save if working out (either custom template OR active program day)
      if (activeCustomTemplate || (programDay && !programDay.isRest)) {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
          isCustomTemplate: !!activeCustomTemplate,
          templateId: activeCustomTemplate?.id,
          phaseId: currentPhaseId,
          week: currentWeek,
          dayIndex: programDay?.dayIndex,
          activeExercises,
          exerciseLog,
          sessionNotes,
          startTime,
        }))
      }
    }, 500)
    return () => clearTimeout(saveTimerRef.current)
  }, [activeExercises, exerciseLog, sessionNotes, startTime, activeCustomTemplate, currentPhaseId, currentWeek, programDay])

  // ── Set CRUD ──
  const addSet = useCallback((exerciseId) => {
    setExerciseLog((prev) => {
      const current = prev[exerciseId]
      if (!current) return prev
      const nextNum = current.sets.length + 1
      return {
        ...prev,
        [exerciseId]: {
          ...current,
          sets: [...current.sets, { setNumber: nextNum, weight: '', reps: '', rpe: '' }],
        },
      }
    })
  }, [])

  const removeSet = useCallback((exerciseId, setIndex) => {
    setExerciseLog((prev) => {
      const current = prev[exerciseId]
      if (!current || current.sets.length <= 1) return prev
      const updated = current.sets
        .filter((_, i) => i !== setIndex)
        .map((s, i) => ({ ...s, setNumber: i + 1 }))
      return {
        ...prev,
        [exerciseId]: { ...current, sets: updated },
      }
    })
  }, [])

  const updateSet = useCallback((exerciseId, setIndex, field, value) => {
    setExerciseLog((prev) => {
      const current = prev[exerciseId]
      if (!current) return prev
      const updatedSets = current.sets.map((s, i) =>
        i === setIndex ? { ...s, [field]: value } : s,
      )
      return {
        ...prev,
        [exerciseId]: { ...current, sets: updatedSets },
      }
    })
  }, [])

  // Swap exercise at a given index
  const swapExercise = useCallback((index, newExercise, isPermanent) => {
    const oldId = activeExercises[index]?.id

    // If permanent, let the store know about the customization
    if (isPermanent && programDay && oldId) {
      useWorkoutStore.getState().addProgramCustomization(oldId, newExercise)
    }

    setActiveExercises((prev) => {
      const updated = [...prev]
      updated[index] = newExercise
      return updated
    })
    
    setExerciseLog((prev) => {
      const updated = { ...prev }
      if (oldId) delete updated[oldId]
      updated[newExercise.id] = {
        sets: Array.from({ length: newExercise.workingSets || 1 }, (_, i) => ({
          setNumber: i + 1, weight: '', reps: '', rpe: '',
        })),
        notes: '',
      }
      return updated
    })
    setSwapExerciseIndex(null)
  }, [activeExercises, programDay])

  const updateExerciseNotes = useCallback((exerciseId, notes) => {
    setExerciseLog((prev) => ({
      ...prev,
      [exerciseId]: { ...prev[exerciseId], notes },
    }))
  }, [])

  // ── Exercise CRUD ──
  const removeExercise = useCallback((exerciseId) => {
    setActiveExercises((prev) => prev.filter((e) => e.id !== exerciseId))
    setExerciseLog((prev) => {
      const updated = { ...prev }
      delete updated[exerciseId]
      return updated
    })
  }, [])

  const addExerciseToSession = useCallback((exercise) => {
    setActiveExercises((prev) => [...prev, exercise])
    setExerciseLog((prev) => ({
      ...prev,
      [exercise.id]: {
        sets: Array.from({ length: exercise.workingSets || 1 }, (_, i) => ({
          setNumber: i + 1,
          weight: '',
          reps: '',
          rpe: '',
        })),
        notes: '',
      },
    }))
    setShowAddModal(false)
  }, [])

  // ── Move exercise up/down ──
  const moveExercise = useCallback((index, direction) => {
    setActiveExercises((prev) => {
      const newArr = [...prev]
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= newArr.length) return prev
      ;[newArr[index], newArr[targetIndex]] = [newArr[targetIndex], newArr[index]]
      return newArr
    })
  }, [])

  // ── Complete Workout ──
  const finalizeWorkout = useCallback(async () => {
    if (isSavingWorkout) return
    if (!activeCustomTemplate && (!programDay || programDay.isRest)) return

    setIsSavingWorkout(true)

    const prExercises = [...new Set(sessionPRs.map((pr) => pr.name))]
    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60))

    const payload = activeExercises.map((exercise) => ({
      exerciseId: exercise.id,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup || '',
      sets: exerciseLog[exercise.id]?.sets || [],
      notes: exerciseLog[exercise.id]?.notes || '',
    }))

    try {
      if (!activeCustomTemplate && todaysWorkout) {
        await updateTodayWorkout(payload, {
          sessionNotes,
          durationMinutes,
          prExercises,
        })
      } else {
        await completeWorkout(payload, {
          sessionNotes,
          durationMinutes,
          prExercises,
        })
      }

      const stateAfterSave = useWorkoutStore.getState()
      const milestoneStats = buildMilestoneStats({
        completedDays: stateAfterSave.completedDays,
        currentPhaseId: stateAfterSave.currentPhaseId,
        currentWeek: stateAfterSave.currentWeek,
      })
      await checkAndAward(milestoneStats)

      localStorage.removeItem(AUTOSAVE_KEY)
      if (activeCustomTemplate) clearCustomWorkoutTemplate()
      navigate('/')
    } finally {
      setIsSavingWorkout(false)
    }
  }, [
    activeCustomTemplate,
    activeExercises,
    clearCustomWorkoutTemplate,
    completeWorkout,
    elapsedSeconds,
    exerciseLog,
    isSavingWorkout,
    navigate,
    programDay,
    sessionNotes,
    sessionPRs,
    todaysWorkout,
    updateTodayWorkout,
    checkAndAward,
  ])

  const onComplete = () => {
    if (!activeCustomTemplate && (!programDay || programDay.isRest)) return
    if (activeExercises.length === 0) return
    setShowCompletionModal(true)
  }

  const onSkip = () => {
    skipDay()
    localStorage.removeItem(AUTOSAVE_KEY)
    if (activeCustomTemplate) clearCustomWorkoutTemplate()
    navigate('/')
  }

  // ── Cancel/Discard Workout ──
  const onCancelCustom = () => {
    if (window.confirm('Discard this custom workout session?')) {
      localStorage.removeItem(AUTOSAVE_KEY)
      clearCustomWorkoutTemplate()
      navigate('/program')
    }
  }

  // ── Progress calculation ──
  const progress = useMemo(() => {
    if (activeExercises.length === 0) return { done: 0, total: 0 }
    let done = 0
    activeExercises.forEach((ex) => {
      const log = exerciseLog[ex.id]
      if (log?.sets?.some(s => s.weight || s.reps)) done++
    })
    return { done, total: activeExercises.length }
  }, [activeExercises, exerciseLog])

  const supersetMeta = useMemo(() => {
    const counters = {}

    const raw = activeExercises.map((exercise) => {
      if (exercise?.isSuperset && exercise?.supersetGroup) {
        const groupKey = `template:${exercise.supersetGroup}`
        counters[groupKey] = (counters[groupKey] || 0) + 1
        return {
          groupKey,
          label: `A${counters[groupKey]}`,
        }
      }

      const programMatch = /^([A-Z])(\d+)\./.exec(exercise?.name || '')
      if (programMatch) {
        return {
          groupKey: `program:${programMatch[1]}`,
          label: `${programMatch[1]}${programMatch[2]}`,
        }
      }

      return {
        groupKey: null,
        label: null,
      }
    })

    return raw.map((item, index) => {
      const prevGroup = raw[index - 1]?.groupKey || null
      const nextGroup = raw[index + 1]?.groupKey || null
      return {
        ...item,
        isGrouped: Boolean(item.groupKey),
        isStart: Boolean(item.groupKey) && item.groupKey !== prevGroup,
        isEnd: Boolean(item.groupKey) && item.groupKey !== nextGroup,
      }
    })
  }, [activeExercises])

  const activeIds = useMemo(() => new Set(activeExercises.map(e => e.id)), [activeExercises])

  const dismissProgressionSuggestion = useCallback((exerciseId) => {
    setDismissedSuggestionIds((prev) => {
      if (prev.includes(exerciseId)) return prev
      return [...prev, exerciseId]
    })
  }, [])

  if (!programDay && !activeCustomTemplate) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          No day found for your current progress position.
        </p>
      </div>
    )
  }

  return (
    <div className={`mx-auto grid max-w-4xl gap-4 px-4 py-6 ${isKeyboardInputFocused ? 'pb-[62vh]' : 'pb-[50vh]'}`}>
      
      {activeCustomTemplate ? (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1">Custom Workout Active</p>
            <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-3">
              {activeCustomTemplate.name}
              <span className="text-sm font-medium text-zinc-500 font-mono bg-white px-2 py-0.5 rounded-md border border-zinc-200">{formatTime(elapsedSeconds)}</span>
            </h2>
          </div>
          <button onClick={onCancelCustom} className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition shadow-sm">
            Discard
          </button>
        </section>
      ) : (
        <div className="flex items-center justify-between">
           <PhaseIndicator phaseName={currentPhase?.name} week={currentWeek} day={programDay} />
           {!programDay?.isRest && (
           <div className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 shadow-sm flex items-center gap-2 font-mono">
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
             {formatTime(elapsedSeconds)}
           </div>
           )}
        </div>
      )}

      {(!activeCustomTemplate && programDay?.isRest) ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-zinc-900">Rest Day</h2>
          <p className="mt-2 text-zinc-600">
            Keep activity light, recover hard, and move to the next training day when ready.
          </p>
          <button type="button" onClick={onSkip} className="mt-4 rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700">
            Skip to Next Day
          </button>
        </section>
      ) : (
        <>
          {/* Day Header with Progress */}
          <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                  {activeCustomTemplate ? 'Workout Session' : programDay.label}
                  {todaysWorkout && !activeCustomTemplate && <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">Editing Today</span>}
                </h2>
                <p className="text-xs text-zinc-500">
                  {progress.done}/{progress.total} exercises logged
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPlateCalculator(true)}
                  className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Plate Calc
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700"
                >
                  + Add Exercise
                </button>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-3 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : '0%' }}
              />
            </div>
          </section>

          {/* Rest Timer Bar */}
          {timerRunning && (
            <RestTimerBar 
              timeLeft={timeLeft} 
              formatTime={formatTime} 
              stopTimer={stopTimer} 
              addTime={addTime}
              maxTime={totalDuration || restTimerDefault}
            />
          )}

          {/* Exercise Cards */}
          {activeExercises.map((exercise, exIndex) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              exIndex={exIndex}
              exerciseLog={exerciseLog}
              previousWeights={previousWeights}
              isPR={sessionPRExerciseIds.has(exercise.id)}
              progressionSuggestion={
                dismissedSuggestionIds.includes(exercise.id)
                  ? null
                  : progressionSuggestions[exercise.id]
              }
              onDismissSuggestion={() => dismissProgressionSuggestion(exercise.id)}
              superset={supersetMeta[exIndex]}
              setSwapExerciseIndex={setSwapExerciseIndex}
              moveExercise={moveExercise}
              activeExercisesLength={activeExercises.length}
              removeExercise={removeExercise}
              updateSet={updateSet}
              removeSet={removeSet}
              addSet={addSet}
              startTimer={startTimer}
              setShowCustomRest={setShowCustomRest}
              updateExerciseNotes={updateExerciseNotes}
            />
          ))}

          {activeExercises.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center">
              <p className="text-sm text-zinc-500">No exercises yet. Tap "+ Add Exercise" to get started.</p>
            </div>
          )}

          {/* Session Notes */}
          <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <label className="grid gap-1.5 text-sm text-zinc-600">
              Session Notes
              <textarea
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                className="min-h-14 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 resize-none"
                placeholder="How was today's session?"
              />
            </label>
          </section>

          {/* Sticky Bottom Bar */}
          <div className="fixed bottom-0 left-0 right-0 border-t border-zinc-200 bg-white/95 backdrop-blur px-4 py-3 z-10">
            <div className="mx-auto flex max-w-4xl gap-2">
              <button
                type="button"
                onClick={onComplete}
                disabled={activeExercises.length === 0}
                className="flex-1 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                Complete Workout
              </button>
              <button
                type="button"
                onClick={onSkip}
                className="rounded-full border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                Skip
              </button>
            </div>
          </div>
        </>
      )}

      {/* Add Exercise Modal */}
      {showAddModal && (
        <AddExerciseModal
          onAdd={addExerciseToSession}
          onClose={() => setShowAddModal(false)}
          activeIds={activeIds}
        />
      )}

      {/* Swap Exercise Modal */}
      {swapExerciseIndex !== null && (
        <SwapExerciseModal
          exercise={activeExercises[swapExerciseIndex]}
          onSwap={(newEx, isPermanent) => swapExercise(swapExerciseIndex, newEx, isPermanent)}
          onClose={() => setSwapExerciseIndex(null)}
        />
      )}

      {showCustomRest && (
        <CustomRestModal 
          onStart={(secs) => startTimer(secs)} 
          onClose={() => setShowCustomRest(false)} 
        />
      )}

      {showCompletionModal && (
        <CompletionModal
          activeExercises={activeExercises}
          exerciseLog={exerciseLog}
          durationMinutes={Math.max(1, Math.round(elapsedSeconds / 60))}
          newPRs={sessionPRs}
          onConfirm={finalizeWorkout}
          onClose={() => setShowCompletionModal(false)}
          isSaving={isSavingWorkout}
        />
      )}

      <PlateCalculator
        isOpen={showPlateCalculator}
        onClose={() => setShowPlateCalculator(false)}
        defaultUnit={weightUnit}
      />
    </div>
  )
}

// ── Custom Rest Modal ──
function CustomRestModal({ onStart, onClose }) {
  const [min, setMin] = useState(2)
  const [sec, setSec] = useState(0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-xs rounded-2xl bg-white p-6 shadow-xl text-center">
        <h3 className="text-lg font-semibold text-zinc-900 mb-4">Manual Timer</h3>
        <div className="flex items-center justify-center gap-3 mb-6">
          <label className="grid text-sm text-zinc-600 font-medium">
            Min
            <input 
              type="number" min="0" value={min} onChange={e => setMin(parseInt(e.target.value) || 0)}
              className="mt-1 w-20 rounded-lg text-center border border-zinc-300 px-3 py-2 text-2xl font-bold text-zinc-900 outline-none focus:border-blue-500 focus:ring-1 ring-blue-500" 
            />
          </label>
          <span className="text-3xl font-bold text-zinc-300 pb-1">:</span>
          <label className="grid text-sm text-zinc-600 font-medium">
            Sec
            <input 
              type="number" min="0" max="59" value={sec} onChange={e => setSec(parseInt(e.target.value) || 0)}
              className="mt-1 w-20 rounded-lg text-center border border-zinc-300 px-3 py-2 text-2xl font-bold text-zinc-900 outline-none focus:border-blue-500 focus:ring-1 ring-blue-500" 
            />
          </label>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              if (min > 0 || sec > 0) {
                onStart((min * 60) + sec)
                onClose()
              }
            }} 
            className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 active:scale-95 transition-transform"
          >
            Start Timer
          </button>
          <button onClick={onClose} className="rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 active:scale-95 transition-transform">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default WorkoutPage
