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
  const loadCustomWorkoutTemplate = useWorkoutStore((state) => state.loadCustomWorkoutTemplate)
  const completedDays = useWorkoutStore((state) => state.completedDays)
  const weightUnit = useWorkoutStore((state) => state.weightUnit)
  const restTimerDefault = useWorkoutStore((state) => state.restTimerDefault)
  const restTimerVibration = useWorkoutStore((state) => state.restTimerVibration)
  const scheduleExerciseForDay = useWorkoutStore((state) => state.scheduleExerciseForDay)
  const getScheduledExercisesForDay = useWorkoutStore((state) => state.getScheduledExercisesForDay)
  const clearScheduledExercisesForDay = useWorkoutStore((state) => state.clearScheduledExercisesForDay)

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
  const [showProgramDayPicker, setShowProgramDayPicker] = useState(false)
  const [pickerWeekNumber, setPickerWeekNumber] = useState(String(currentWeek))
  const [pickerDayIndex, setPickerDayIndex] = useState(String(programDay?.dayIndex ?? 0))
  const [exerciseToSchedule, setExerciseToSchedule] = useState(null)
  const [scheduleWeekNumber, setScheduleWeekNumber] = useState(String(currentWeek))
  const [scheduleDayIndex, setScheduleDayIndex] = useState(String(programDay?.dayIndex ?? 0))
  const [sessionNotice, setSessionNotice] = useState('')
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

  const currentPhaseWeeks = useMemo(() => currentPhase?.weeks || [], [currentPhase])

  const pickerWeekData = useMemo(() => {
    const parsed = Number(pickerWeekNumber)
    if (!Number.isFinite(parsed)) return null
    return currentPhaseWeeks.find((week) => week.weekNumber === parsed) || null
  }, [currentPhaseWeeks, pickerWeekNumber])

  const pickerDayOptions = useMemo(() => {
    return (pickerWeekData?.days || []).filter((day) => !day.isRest)
  }, [pickerWeekData])

  const scheduleWeekData = useMemo(() => {
    const parsed = Number(scheduleWeekNumber)
    if (!Number.isFinite(parsed)) return null
    return currentPhaseWeeks.find((week) => week.weekNumber === parsed) || null
  }, [currentPhaseWeeks, scheduleWeekNumber])

  const scheduleDayOptions = useMemo(() => {
    return (scheduleWeekData?.days || []).filter((day) => !day.isRest)
  }, [scheduleWeekData])

  const scheduledForCurrentDay = useMemo(() => {
    if (!programDay || activeCustomTemplate) return []
    return getScheduledExercisesForDay(currentPhaseId, currentWeek, programDay.dayIndex)
  }, [activeCustomTemplate, currentPhaseId, currentWeek, getScheduledExercisesForDay, programDay])

  const recommendedExercises = useMemo(() => {
    if (!scheduledForCurrentDay.length) return []
    const activeOriginalIds = new Set(
      activeExercises.map((exercise) => exercise.originalExerciseId || exercise.id),
    )

    return scheduledForCurrentDay.filter((exercise) => {
      const sourceId = exercise.originalExerciseId || exercise.id
      return !activeOriginalIds.has(sourceId)
    })
  }, [activeExercises, scheduledForCurrentDay])

  const hasRecommendedSection = Boolean(!activeCustomTemplate && !programDay?.isRest && recommendedExercises.length)

  useEffect(() => {
    setPickerWeekNumber(String(currentWeek))
    setScheduleWeekNumber(String(currentWeek))
  }, [currentWeek])

  useEffect(() => {
    if (!programDay) return
    setPickerDayIndex(String(programDay.dayIndex))
    setScheduleDayIndex(String(programDay.dayIndex))
  }, [programDay])

  useEffect(() => {
    if (!pickerDayOptions.length) return
    const hasSelected = pickerDayOptions.some((day) => String(day.dayIndex) === String(pickerDayIndex))
    if (!hasSelected) {
      setPickerDayIndex(String(pickerDayOptions[0].dayIndex))
    }
  }, [pickerDayIndex, pickerDayOptions])

  useEffect(() => {
    if (!scheduleDayOptions.length) return
    const hasSelected = scheduleDayOptions.some((day) => String(day.dayIndex) === String(scheduleDayIndex))
    if (!hasSelected) {
      setScheduleDayIndex(String(scheduleDayOptions[0].dayIndex))
    }
  }, [scheduleDayIndex, scheduleDayOptions])

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

  const applyProgramDayTemplate = useCallback(() => {
    const targetWeek = Number(pickerWeekNumber)
    const targetDayIndex = Number(pickerDayIndex)
    if (!currentPhase || !Number.isFinite(targetWeek) || !Number.isFinite(targetDayIndex)) return

    const weekData = currentPhase.weeks.find((week) => week.weekNumber === targetWeek)
    const dayData = weekData?.days?.find((day) => day.dayIndex === targetDayIndex)
    if (!dayData || dayData.isRest) return

    const template = {
      id: `program_${currentPhaseId}_w${targetWeek}_d${targetDayIndex}`,
      name: dayData.label,
      templateSource: 'program',
      templateWeek: targetWeek,
      exercises: JSON.parse(JSON.stringify(dayData.exercises || [])),
    }

    localStorage.removeItem(AUTOSAVE_KEY)
    setActiveExercises([])
    setExerciseLog({})
    setSessionNotes('')
    setDismissedSuggestionIds([])
    setShowProgramDayPicker(false)
    setSessionNotice(`Using ${dayData.label} from Week ${targetWeek} for this session.`)
    loadCustomWorkoutTemplate(template)
  }, [currentPhase, currentPhaseId, loadCustomWorkoutTemplate, pickerDayIndex, pickerWeekNumber])

  const openScheduleExerciseModal = useCallback((exercise) => {
    if (!exercise || !currentPhase || !programDay) return

    const allDays = []
    currentPhase.weeks.forEach((week) => {
      week.days.forEach((day) => {
        if (day.isRest) return
        allDays.push({
          weekNumber: week.weekNumber,
          dayIndex: day.dayIndex,
          label: day.label,
          type: day.type,
        })
      })
    })

    const recommended = allDays.find((day) => {
      if (day.weekNumber < currentWeek) return false
      if (day.weekNumber === currentWeek && day.dayIndex <= programDay.dayIndex) return false
      return day.type === programDay.type
    }) || allDays.find((day) => !(day.weekNumber === currentWeek && day.dayIndex === programDay.dayIndex))

    if (recommended) {
      setScheduleWeekNumber(String(recommended.weekNumber))
      setScheduleDayIndex(String(recommended.dayIndex))
    }

    setExerciseToSchedule(exercise)
  }, [currentPhase, currentWeek, programDay])

  const confirmScheduleExercise = useCallback(() => {
    if (!exerciseToSchedule || !currentPhase) return

    const targetWeek = Number(scheduleWeekNumber)
    const targetDay = Number(scheduleDayIndex)
    if (!Number.isFinite(targetWeek) || !Number.isFinite(targetDay)) return

    const weekData = currentPhase.weeks.find((week) => week.weekNumber === targetWeek)
    const dayData = weekData?.days?.find((day) => day.dayIndex === targetDay)
    if (!dayData || dayData.isRest) return

    if (targetWeek === currentWeek && targetDay === programDay?.dayIndex) {
      setSessionNotice('Choose a different day to move this exercise.')
      return
    }

    scheduleExerciseForDay({
      exercise: exerciseToSchedule,
      sourcePhaseId: currentPhaseId,
      sourceWeek: currentWeek,
      sourceDayIndex: programDay?.dayIndex,
      sourceLabel: programDay?.label,
      targetPhaseId: currentPhaseId,
      targetWeek,
      targetDayIndex: targetDay,
      targetLabel: dayData.label,
    })

    removeExercise(exerciseToSchedule.id)
    setSessionNotice(`${exerciseToSchedule.name} moved to Week ${targetWeek} - ${dayData.label}.`)
    setExerciseToSchedule(null)
  }, [currentPhase, currentPhaseId, currentWeek, exerciseToSchedule, programDay, removeExercise, scheduleDayIndex, scheduleExerciseForDay, scheduleWeekNumber])

  const appendRecommendedExercises = useCallback((items) => {
    if (!Array.isArray(items) || items.length === 0) return 0

    const existingOriginalIds = new Set(
      activeExercises.map((exercise) => exercise.originalExerciseId || exercise.id),
    )

    const addedExercises = []

    items.forEach((item) => {
      const sourceId = item.originalExerciseId || item.id
      if (existingOriginalIds.has(sourceId)) return

      existingOriginalIds.add(sourceId)
      const sessionId = `recommended_${item.scheduledTransferId || sourceId}`
      addedExercises.push({
        ...item,
        id: sessionId,
        originalExerciseId: sourceId,
      })
    })

    if (addedExercises.length === 0) return 0

    setActiveExercises((prev) => [...prev, ...addedExercises])

    setExerciseLog((prev) => {
      const next = { ...prev }

      addedExercises.forEach((exercise) => {
        if (next[exercise.id]) return

        const numSets = exercise.workingSets || exercise.default_sets || 1
        next[exercise.id] = {
          sets: Array.from({ length: numSets }, (_, index) => ({
            setNumber: index + 1,
            weight: '',
            reps: '',
            rpe: '',
          })),
          notes: '',
        }
      })

      return next
    })

    return addedExercises.length
  }, [activeExercises])

  const addRecommendedExercise = useCallback((exercise) => {
    const addedCount = appendRecommendedExercises([exercise])
    if (addedCount > 0) {
      setSessionNotice(`${exercise.name} added from recommendations.`)
      return
    }

    setSessionNotice(`${exercise.name} is already in today's workout.`)
  }, [appendRecommendedExercises])

  const addAllRecommendedExercises = useCallback(() => {
    const addedCount = appendRecommendedExercises(recommendedExercises)
    if (addedCount > 0) {
      setSessionNotice(`${addedCount} recommended exercise${addedCount === 1 ? '' : 's'} added to today's workout.`)
      return
    }

    setSessionNotice('All recommended exercises are already in your workout.')
  }, [appendRecommendedExercises, recommendedExercises])

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
      exerciseId: exercise.originalExerciseId || exercise.id,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup || '',
      sets: exerciseLog[exercise.id]?.sets || [],
      notes: exerciseLog[exercise.id]?.notes || '',
    }))

    const workoutLabelOverride = activeCustomTemplate?.name || undefined

    try {
      if (!activeCustomTemplate && todaysWorkout) {
        await updateTodayWorkout(payload, {
          sessionNotes,
          durationMinutes,
          prExercises,
          workoutLabel: workoutLabelOverride,
        })
      } else {
        await completeWorkout(payload, {
          sessionNotes,
          durationMinutes,
          prExercises,
          workoutLabel: workoutLabelOverride,
          clearScheduledForCurrentDay: !activeCustomTemplate,
        })
      }

      if (!activeCustomTemplate && todaysWorkout && programDay) {
        clearScheduledExercisesForDay(currentPhaseId, currentWeek, programDay.dayIndex)
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
    clearScheduledExercisesForDay,
    clearCustomWorkoutTemplate,
    completeWorkout,
    currentPhaseId,
    currentWeek,
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

  const resetToDefaultDaySession = useCallback(() => {
    localStorage.removeItem(AUTOSAVE_KEY)
    clearCustomWorkoutTemplate()
    setShowProgramDayPicker(false)
    setExerciseToSchedule(null)
    setDismissedSuggestionIds([])

    const fallbackProgramDay = baseProgramDay || programDay
    if (!fallbackProgramDay || fallbackProgramDay.isRest) {
      setActiveExercises([])
      setExerciseLog({})
      setSessionNotes('')
      setStartTime(Date.now())
      setSessionNotice('Back to your default day workout.')
      return
    }

    if (todaysWorkout) {
      const fullExercises = (todaysWorkout.exercises || []).map((loggedExercise) => {
        const original = fallbackProgramDay.exercises?.find(
          (candidate) => candidate.id === loggedExercise.exerciseId,
        ) || {}

        return {
          ...original,
          ...loggedExercise,
          id: loggedExercise.exerciseId || original.id || loggedExercise.id,
        }
      })

      const restoredLog = {}
      ;(todaysWorkout.exercises || []).forEach((loggedExercise) => {
        const sourceId = loggedExercise.exerciseId || loggedExercise.id
        if (!sourceId) return

        restoredLog[sourceId] = {
          sets: loggedExercise.sets || [],
          notes: loggedExercise.notes || '',
        }
      })

      setActiveExercises(fullExercises)
      setExerciseLog(restoredLog)
      setSessionNotes(todaysWorkout.sessionNotes || todaysWorkout.session_notes || '')
      if (todaysWorkout.duration_minutes) {
        setStartTime(Date.now() - todaysWorkout.duration_minutes * 60000)
      } else {
        setStartTime(Date.now())
      }
      setSessionNotice('Back to your default day workout.')
      return
    }

    const nextExercises = [...(fallbackProgramDay.exercises || [])]
    setActiveExercises(nextExercises)
    setExerciseLog(buildInitialLog(nextExercises))
    setSessionNotes('')
    setStartTime(Date.now())
    setSessionNotice('Back to your default day workout.')
  }, [baseProgramDay, clearCustomWorkoutTemplate, programDay, todaysWorkout])

  // ── Cancel/Discard Workout ──
  const onCancelCustom = () => {
    if (activeCustomTemplate?.templateSource === 'program') {
      resetToDefaultDaySession()
      return
    }

    if (window.confirm('Discard this workout override/session?')) {
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

  const programInstructionById = useMemo(() => {
    const map = {}
    ;(programState?.phases || []).forEach((phase) => {
      ;(phase.weeks || []).forEach((week) => {
        ;(week.days || []).forEach((day) => {
          ;(day.exercises || []).forEach((exercise) => {
            if (!exercise?.id) return
            if (!map[exercise.id]) {
              map[exercise.id] = exercise.notes || ''
            }
          })
        })
      })
    })
    return map
  }, [programState])

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
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1">
              {activeCustomTemplate?.templateSource === 'program' ? 'Program Day Override Active' : 'Custom Workout Active'}
            </p>
            <h2 className="text-xl font-bold text-zinc-900">{activeCustomTemplate.name}</h2>
            {activeCustomTemplate?.templateSource === 'program' && (
              <p className="mt-1 text-xs text-zinc-600">Week {activeCustomTemplate.templateWeek}</p>
            )}
          </div>
          <button onClick={onCancelCustom} className="w-full sm:w-auto rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition shadow-sm">
            {activeCustomTemplate?.templateSource === 'program' ? 'Use Default Day' : 'Discard'}
          </button>
        </section>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <PhaseIndicator phaseName={currentPhase?.name} week={currentWeek} day={programDay} />
          {!programDay?.isRest && (
            <button
              type="button"
              onClick={() => setShowProgramDayPicker(true)}
              className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
            >
              Use Another Day
            </button>
          )}
        </div>
      )}

      {sessionNotice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {sessionNotice}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 flex flex-wrap items-center gap-2">
                  {activeCustomTemplate ? 'Workout Session' : programDay.label}
                  {todaysWorkout && !activeCustomTemplate && <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">Editing Today</span>}
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {progress.done}/{progress.total} exercises logged
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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

          {hasRecommendedSection && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Recommended</p>
                  <p className="text-xs text-amber-800">Moved exercises queued for this day.</p>
                </div>
                <button
                  type="button"
                  onClick={addAllRecommendedExercises}
                  className="w-full sm:w-auto rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Add All ({recommendedExercises.length})
                </button>
              </div>

              <div className="mt-3 grid gap-2">
                {recommendedExercises.map((exercise) => (
                  <div key={exercise.scheduledTransferId || exercise.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-3 py-2 max-w-full">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-sm font-medium text-zinc-900 truncate">{exercise.name}</p>
                      <p className="text-[11px] text-zinc-500">{exercise.workingSets || '?'} sets × {exercise.reps || '?'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addRecommendedExercise(exercise)}
                      className="rounded-full bg-zinc-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-zinc-700"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Exercise Cards */}
          {activeExercises.map((exercise, exIndex) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              instructionNote={programInstructionById[exercise.id] || exercise.notes || ''}
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
              onScheduleExercise={openScheduleExerciseModal}
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

      {showProgramDayPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">Choose Workout Day</h3>
            <p className="mt-1 text-xs text-zinc-500">Use another day template for this session without changing your saved progression order.</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                Week
                <select
                  value={pickerWeekNumber}
                  onChange={(event) => setPickerWeekNumber(event.target.value)}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
                >
                  {currentPhaseWeeks.map((week) => (
                    <option key={week.weekNumber} value={String(week.weekNumber)}>
                      Week {week.weekNumber}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                Day
                <select
                  value={pickerDayIndex}
                  onChange={(event) => setPickerDayIndex(event.target.value)}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
                >
                  {pickerDayOptions.map((day) => (
                    <option key={day.dayIndex} value={String(day.dayIndex)}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowProgramDayPicker(false)}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyProgramDayTemplate}
                className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Use This Day
              </button>
            </div>
          </div>
        </div>
      )}

      {exerciseToSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">Move Exercise To Another Day</h3>
            <p className="mt-1 text-xs text-zinc-500">
              {exerciseToSchedule.name} will be removed from today and added to your selected future day.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                Target Week
                <select
                  value={scheduleWeekNumber}
                  onChange={(event) => setScheduleWeekNumber(event.target.value)}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
                >
                  {currentPhaseWeeks.map((week) => (
                    <option key={week.weekNumber} value={String(week.weekNumber)}>
                      Week {week.weekNumber}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                Target Day
                <select
                  value={scheduleDayIndex}
                  onChange={(event) => setScheduleDayIndex(event.target.value)}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
                >
                  {scheduleDayOptions.map((day) => (
                    <option key={day.dayIndex} value={String(day.dayIndex)}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setExerciseToSchedule(null)}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmScheduleExercise}
                className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Move Exercise
              </button>
            </div>
          </div>
        </div>
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
