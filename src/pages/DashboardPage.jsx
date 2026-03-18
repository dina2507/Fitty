import { Link } from 'react-router-dom'
import { useMemo, useState, useEffect } from 'react'
import DayCard from '../components/DayCard'
import MuscleGroupBadge from '../components/MuscleGroupBadge'
import PhaseIndicator from '../components/PhaseIndicator'
import ProgressBar from '../components/ProgressBar'
import TrainingAlerts from '../components/TrainingAlerts'
import { useWorkoutStore } from '../store/useWorkoutStore'
import { CalendarModal } from '../components/CalendarModal'
import { analyzeRPETrend } from '../utils/rpeTrendAnalysis'

function DashboardPage() {
  const program = useWorkoutStore((state) => state.program)
  const currentPhaseId = useWorkoutStore((state) => state.currentPhaseId)
  const currentWeek = useWorkoutStore((state) => state.currentWeek)
  const currentDayIndex = useWorkoutStore((state) => state.currentDayIndex)
  const completedDays = useWorkoutStore((state) => state.completedDays)
  const jumpToDay = useWorkoutStore((state) => state.jumpToDay)
  const getCurrentDay = useWorkoutStore((state) => state.getCurrentDay)
  const logBodyweight = useWorkoutStore((state) => state.logBodyweight)
  const bodyweightLogs = useWorkoutStore((state) => state.bodyweightLogs)
  const dismissedAlerts = useWorkoutStore((state) => state.dismissedAlerts)
  const dismissTrainingAlert = useWorkoutStore((state) => state.dismissTrainingAlert)

  const [bwInput, setBwInput] = useState('')
  const [showSavedMsg, setShowSavedMsg] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)

  const orderedProgramWeeks = useMemo(() => {
    return (program?.phases || []).flatMap((phase) =>
      (phase.weeks || []).map((week) => {
        const firstTrainDay = (week.days || []).find((day) => !day.isRest)
        const fallbackDay = (week.days || [])[0]

        return {
          phaseId: phase.id,
          weekNumber: week.weekNumber,
          dayIndex: Number.isFinite(Number(firstTrainDay?.dayIndex))
            ? Number(firstTrainDay.dayIndex)
            : (Number.isFinite(Number(fallbackDay?.dayIndex)) ? Number(fallbackDay.dayIndex) : 0),
        }
      }),
    )
  }, [program])

  const activeWeekCursorIndex = useMemo(() => {
    return orderedProgramWeeks.findIndex(
      (item) => item.phaseId === currentPhaseId && Number(item.weekNumber) === Number(currentWeek),
    )
  }, [orderedProgramWeeks, currentPhaseId, currentWeek])

  const canGoPrevWeek = activeWeekCursorIndex > 0
  const canGoNextWeek = activeWeekCursorIndex >= 0 && activeWeekCursorIndex < orderedProgramWeeks.length - 1

  const goToAdjacentWeek = async (direction) => {
    if (!Number.isFinite(activeWeekCursorIndex) || activeWeekCursorIndex < 0) return

    const targetIndex = activeWeekCursorIndex + direction
    if (targetIndex < 0 || targetIndex >= orderedProgramWeeks.length) return

    const target = orderedProgramWeeks[targetIndex]
    if (!target) return

    await jumpToDay(target.phaseId, target.weekNumber, target.dayIndex)
  }

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])
  const todaysLog = useMemo(() => bodyweightLogs.find(l => l.date.startsWith(todayStr)), [bodyweightLogs, todayStr])

  useEffect(() => {
    if (todaysLog && !showSavedMsg) {
      setBwInput(todaysLog.weight)
    }
  }, [todaysLog])

  const handleLogWeight = () => {
    if (!bwInput || isNaN(parseFloat(bwInput))) return
    logBodyweight(parseFloat(bwInput))
    setShowSavedMsg(true)
    setTimeout(() => setShowSavedMsg(false), 2000)
  }

  const currentPhase = program.phases.find((phase) => phase.id === currentPhaseId)
  const weekData = currentPhase?.weeks[currentWeek - 1]
  const currentDay = getCurrentDay()

  const completedSet = useMemo(
    () =>
      new Set(
        completedDays.map((entry) => `${entry.phaseId}-${entry.week}-${entry.dayIndex}`),
      ),
    [completedDays],
  )

  const weekWorkoutDays = weekData?.days.filter((day) => !day.isRest).length || 0
  const weekCompleted =
    weekData?.days.filter((day) => completedSet.has(`${currentPhaseId}-${currentWeek}-${day.dayIndex}`)).length ||
    0

  // Today's muscle groups
  const todayMuscleGroups = useMemo(() => {
    if (!currentDay?.exercises) return []
    const groups = new Set(currentDay.exercises.map((e) => e.muscleGroup).filter(Boolean))
    return [...groups]
  }, [currentDay])

  // Weekly volume: total sets per muscle group this week
  const weeklyVolume = useMemo(() => {
    const volume = {}
    completedDays.forEach((entry) => {
      if (entry.phaseId !== currentPhaseId || entry.week !== currentWeek) return
      entry.exercises?.forEach((ex) => {
        const group = ex.muscleGroup || 'Other'
        const setCount = ex.sets?.length || 1
        volume[group] = (volume[group] || 0) + setCount
      })
    })
    // Sort by volume descending
    return Object.entries(volume).sort((a, b) => b[1] - a[1])
  }, [completedDays, currentPhaseId, currentWeek])

  const streakStats = useMemo(() => {
    const uniqueDays = [...new Set(completedDays.map((entry) => new Date(entry.date).toISOString().split('T')[0]))]
      .map((day) => new Date(day))
      .sort((a, b) => a.getTime() - b.getTime())

    if (uniqueDays.length === 0) {
      return { current: 0, best: 0 }
    }

    const oneDayMs = 24 * 60 * 60 * 1000
    let best = 1
    let run = 1

    for (let i = 1; i < uniqueDays.length; i++) {
      const diff = Math.round((uniqueDays[i].getTime() - uniqueDays[i - 1].getTime()) / oneDayMs)
      if (diff === 1) {
        run += 1
        best = Math.max(best, run)
      } else {
        run = 1
      }
    }

    let current = 1
    for (let i = uniqueDays.length - 1; i > 0; i--) {
      const diff = Math.round((uniqueDays[i].getTime() - uniqueDays[i - 1].getTime()) / oneDayMs)
      if (diff === 1) current += 1
      else break
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const latest = new Date(uniqueDays[uniqueDays.length - 1])
    latest.setHours(0, 0, 0, 0)
    const daysSinceLatest = Math.round((today.getTime() - latest.getTime()) / oneDayMs)

    if (daysSinceLatest > 1) {
      current = 0
    }

    return { current, best }
  }, [completedDays])

  // Recovery Heatmap (last 48 hours)
  const recoveryStatus = useMemo(() => {
    const volume = {}
    const fortyEightMs = 48 * 60 * 60 * 1000
    const cutoff = Date.now() - fortyEightMs

    completedDays.forEach(day => {
      if (new Date(day.date).getTime() > cutoff) {
        day.exercises?.forEach(ex => {
          if (!ex.muscleGroup) return
          let group = ex.muscleGroup
          // Simplify for a high-level overview
          if (['Quads', 'Hamstrings', 'Glutes', 'Calves'].includes(group)) group = 'Legs'
          if (['Biceps', 'Triceps'].includes(group)) group = 'Arms'
          
          volume[group] = (volume[group] || 0) + (ex.sets?.length || 1)
        })
      }
    })

    const displayGroups = ['Chest', 'Back', 'Shoulders', 'Legs', 'Arms', 'Core']
    return displayGroups.map(group => {
      const sets = volume[group] || 0
      let status = 'Ready'
      let colorClass = 'bg-emerald-500'
      let textClass = 'text-emerald-700'
      let bgClass = 'bg-emerald-50'
      let borderClass = 'border-emerald-200'
      
      if (sets >= 10) { 
        status = 'Exhausted'
        colorClass = 'bg-red-500'
        textClass = 'text-red-700'
        bgClass = 'bg-red-50'
        borderClass = 'border-red-200'
      } else if (sets >= 4) { 
        status = 'Recovering'
        colorClass = 'bg-amber-500'
        textClass = 'text-amber-800'
        bgClass = 'bg-amber-50'
        borderClass = 'border-amber-200'
      }
      return { group, sets, status, colorClass, textClass, bgClass, borderClass }
    })
  }, [completedDays])

  const trainingAlerts = useMemo(() => {
    const byExercise = {}

    const sorted = [...completedDays]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    sorted.forEach((day) => {
      ;(day.exercises || []).forEach((exercise) => {
        const name = exercise?.name
        if (!name) return

        const sets = Array.isArray(exercise?.sets) ? exercise.sets : []
        let topSet = null

        sets.forEach((set) => {
          const weight = Number(set.weight) || 0
          const reps = Number(set.reps) || 0
          const rpe = Number(set.rpe)

          if (!weight || !Number.isFinite(rpe)) return

          if (!topSet || weight > topSet.weight || (weight === topSet.weight && reps > topSet.reps)) {
            topSet = { weight, reps, rpe }
          }
        })

        if (!topSet) return

        if (!byExercise[name]) byExercise[name] = []
        byExercise[name].push({
          date: day.date,
          name,
          topSet,
        })
      })
    })

    return Object.keys(byExercise)
      .map((exerciseName) => {
        const history = byExercise[exerciseName]
        const result = analyzeRPETrend(history)
        if (!result.hasAlert) return null

        const alertId = `rpe:${exerciseName.toLowerCase()}`
        return {
          id: alertId,
          exerciseName,
          severity: result.severity,
          message: result.message,
        }
      })
      .filter(Boolean)
      .filter((alert) => !dismissedAlerts.includes(alert.id))
  }, [completedDays, dismissedAlerts])

  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6">
      <TrainingAlerts
        alerts={trainingAlerts}
        onDismiss={dismissTrainingAlert}
      />

      <section className="grid gap-4 md:grid-cols-2">
        <PhaseIndicator
          phaseName={currentPhase?.name}
          week={currentWeek}
          day={currentDay}
        />

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Up Next</p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-900">{currentDay?.label || 'No day selected'}</h2>

          {/* Today's muscle groups */}
          {todayMuscleGroups.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {todayMuscleGroups.map((g) => (
                <MuscleGroupBadge key={g} group={g} size="xs" />
              ))}
            </div>
          )}

          <p className="mt-1.5 text-sm text-zinc-600">
            {currentDay?.isRest
              ? 'Recovery focus today.'
              : `${currentDay?.exercises?.length || 0} exercises queued.`}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/workout"
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
            >
              Start Workout
            </Link>
            <Link
              to="/history"
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
            >
              View History
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm flex flex-col justify-center">
          <ProgressBar value={weekCompleted} max={weekWorkoutDays} label="Weekly Workout Progress" />
        </div>
        
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm flex flex-col justify-center">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-900">Today's Bodyweight</h3>
            {showSavedMsg && <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Saved!</span>}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                step="0.1"
                value={bwInput}
                onChange={(e) => setBwInput(e.target.value)}
                placeholder="0.0"
                className="w-full rounded-lg border border-zinc-200 py-2 pl-3 pr-8 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-medium">kg</span>
            </div>
            <button
              onClick={handleLogWeight}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
            >
              Log
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm flex flex-col justify-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Streak</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {streakStats.current} day{streakStats.current === 1 ? '' : 's'}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Current consecutive training streak</p>
          <p className="mt-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Best: {streakStats.best} day{streakStats.best === 1 ? '' : 's'}
          </p>
        </div>
      </section>

      {/* Recovery Heatmap */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900 mb-3">Muscle Recovery (48h)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {recoveryStatus.map(({ group, status, colorClass, textClass, bgClass, borderClass }) => (
            <div key={group} className={`flex items-center gap-2 rounded-lg border ${borderClass} ${bgClass} p-2`}>
              <div className={`h-2 w-2 rounded-full ${colorClass}`} />
              <div>
                <p className="text-xs font-semibold text-zinc-900">{group}</p>
                <p className={`text-[10px] font-medium ${textClass}`}>{status}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Weekly Volume Summary */}
      {weeklyVolume.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-900 mb-3">Weekly Volume (sets per muscle group)</h3>
          <div className="grid gap-2">
            {weeklyVolume.map(([group, sets]) => (
              <div key={group} className="flex items-center gap-3">
                <MuscleGroupBadge group={group} size="xs" />
                <div className="flex-1 h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-zinc-800 transition-all"
                    style={{ width: `${Math.min((sets / Math.max(...weeklyVolume.map(v => v[1]))) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-zinc-600 w-8 text-right">{sets}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => goToAdjacentWeek(-1)}
              disabled={!canGoPrevWeek}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 bg-white text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Go to previous week"
              title="Previous week"
            >
              {'<'}
            </button>

            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-zinc-900">Week {currentWeek} Plan</h2>
              <p className="text-sm text-zinc-500">Tap any day to jump</p>
            </div>

            <button
              type="button"
              onClick={() => goToAdjacentWeek(1)}
              disabled={!canGoNextWeek}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 bg-white text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Go to next week"
              title="Next week"
            >
              {'>'}
            </button>
          </div>

          <button
            onClick={() => setShowCalendar(true)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            Calendar
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {weekData?.days?.map((day) => (
            <DayCard
              key={`${currentPhaseId}-${currentWeek}-${day.dayIndex}`}
              day={day}
              isActive={day.dayIndex === currentDayIndex}
              isCompleted={completedSet.has(`${currentPhaseId}-${currentWeek}-${day.dayIndex}`)}
              onClick={() => jumpToDay(currentPhaseId, currentWeek, day.dayIndex)}
            />
          ))}
        </div>
      </section>

      {showCalendar && <CalendarModal onClose={() => setShowCalendar(false)} />}
    </div>
  )
}

export default DashboardPage
