import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { supabase } from '../lib/supabaseClient'
import { useWorkoutStore } from '../store/useWorkoutStore'
import { flushSyncQueue, getSyncQueue } from '../utils/syncQueue'
import {
  buildPRsCSV,
  buildWeeklyVolumeCSV,
  buildWorkoutHistoryCSV,
  downloadCsvFile,
  downloadAsZip,
} from '../utils/csvExport'
import { generateMonthlyPDF } from '../utils/pdfExport'

function SettingsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const exportData = useWorkoutStore((state) => state.exportData)
  const importData = useWorkoutStore((state) => state.importData)
  const resetProgram = useWorkoutStore((state) => state.resetProgram)
  const setProgramStart = useWorkoutStore((state) => state.setProgramStart)
  const jumpToDay = useWorkoutStore((state) => state.jumpToDay)
  const importWorkoutPlan = useWorkoutStore((state) => state.importWorkoutPlan)
  const switchWorkoutPlan = useWorkoutStore((state) => state.switchWorkoutPlan)
  const programLibrary = useWorkoutStore((state) => state.programLibrary)
  const activeProgramId = useWorkoutStore((state) => state.activeProgramId)
  const program = useWorkoutStore((state) => state.program)
  const planDisplayName = useWorkoutStore((state) => state.planDisplayName)
  const setPlanDisplayName = useWorkoutStore((state) => state.setPlanDisplayName)
  const currentPhaseId = useWorkoutStore((state) => state.currentPhaseId)
  const currentWeek = useWorkoutStore((state) => state.currentWeek)
  const currentDayIndex = useWorkoutStore((state) => state.currentDayIndex)
  const programStart = useWorkoutStore((state) => state.programStart)
  const weightUnit = useWorkoutStore((state) => state.weightUnit)
  const setWeightUnit = useWorkoutStore((state) => state.setWeightUnit)
  const restTimerDefault = useWorkoutStore((state) => state.restTimerDefault)
  const setRestTimerDefault = useWorkoutStore((state) => state.setRestTimerDefault)
  const restTimerVibration = useWorkoutStore((state) => state.restTimerVibration)
  const setRestTimerVibration = useWorkoutStore((state) => state.setRestTimerVibration)
  const completedDays = useWorkoutStore((state) => state.completedDays)
  const syncStatus = useWorkoutStore((state) => state.syncStatus)

  const [backupText, setBackupText] = useState('')
  const [status, setStatus] = useState('')
  const [restDefaultInput, setRestDefaultInput] = useState(String(restTimerDefault))
  const [isSavingPrefs, setIsSavingPrefs] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [isUpdatingProgramPosition, setIsUpdatingProgramPosition] = useState(false)
  const [isSwitchingProgram, setIsSwitchingProgram] = useState(false)
  const [isImportingProgram, setIsImportingProgram] = useState(false)
  const [isExportingAllCsv, setIsExportingAllCsv] = useState(false)
  const [isExportingCsv, setIsExportingCsv] = useState(false)
  const [isExportingMonthlyPdf, setIsExportingMonthlyPdf] = useState(false)
  const [reportMonth, setReportMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [planNameInput, setPlanNameInput] = useState(planDisplayName)
  const [selectedPhaseId, setSelectedPhaseId] = useState(currentPhaseId)
  const [selectedWeek, setSelectedWeek] = useState(String(currentWeek))
  const [selectedDayIndex, setSelectedDayIndex] = useState(String(currentDayIndex))
  const [pendingSyncCount, setPendingSyncCount] = useState(() => getSyncQueue().length)

  const formattedStartDate = useMemo(() => {
    if (!programStart) return ''
    return new Date(programStart).toISOString().slice(0, 10)
  }, [programStart])

  const [startDate, setStartDate] = useState(formattedStartDate)

  const selectedPhase = useMemo(() => {
    return (program?.phases || []).find((phase) => phase.id === selectedPhaseId) || null
  }, [program, selectedPhaseId])

  const selectableWeeks = useMemo(() => {
    return selectedPhase?.weeks || []
  }, [selectedPhase])

  const selectedWeekData = useMemo(() => {
    const parsedWeek = Number(selectedWeek)
    if (!Number.isFinite(parsedWeek)) return null
    return selectableWeeks.find((week) => week.weekNumber === parsedWeek) || null
  }, [selectableWeeks, selectedWeek])

  const selectableDays = useMemo(() => {
    return selectedWeekData?.days || []
  }, [selectedWeekData])

  const selectedReportLogs = useMemo(() => {
    const [yearText, monthText] = (reportMonth || '').split('-')
    const year = Number(yearText)
    const month = Number(monthText)
    if (!year || !month) return []

    return (completedDays || []).filter((day) => {
      const date = new Date(day.date)
      if (Number.isNaN(date.getTime())) return false
      return date.getFullYear() === year && date.getMonth() + 1 === month
    })
  }, [completedDays, reportMonth])

  useEffect(() => {
    setStartDate(formattedStartDate)
  }, [formattedStartDate])

  useEffect(() => {
    setSelectedPhaseId(currentPhaseId)
    setSelectedWeek(String(currentWeek))
    setSelectedDayIndex(String(currentDayIndex))
  }, [currentDayIndex, currentPhaseId, currentWeek])

  useEffect(() => {
    setPlanNameInput(planDisplayName)
  }, [planDisplayName])

  useEffect(() => {
    if (!selectedPhase) return

    const hasSelectedWeek = selectedPhase.weeks.some(
      (week) => String(week.weekNumber) === String(selectedWeek),
    )

    if (!hasSelectedWeek) {
      const firstWeek = selectedPhase.weeks?.[0]?.weekNumber
      if (firstWeek) setSelectedWeek(String(firstWeek))
    }
  }, [selectedPhase, selectedWeek])

  useEffect(() => {
    if (!selectableDays.length) return

    const hasSelectedDay = selectableDays.some(
      (day) => String(day.dayIndex) === String(selectedDayIndex),
    )

    if (!hasSelectedDay) {
      const fallbackDay = selectableDays.find((day) => !day.isRest)?.dayIndex ?? selectableDays[0].dayIndex
      setSelectedDayIndex(String(fallbackDay))
    }
  }, [selectableDays, selectedDayIndex])

  useEffect(() => {
    setRestDefaultInput(String(restTimerDefault))
  }, [restTimerDefault])

  const onExport = () => {
    const payload = exportData()
    setBackupText(JSON.stringify(payload, null, 2))
    setStatus('Exported data to the text box below.')
  }

  const onImport = () => {
    try {
      const parsed = JSON.parse(backupText)
      importData(parsed)
      setStatus('Import successful.')
    } catch (error) {
      console.error(error)
      setStatus('Import failed. Check your JSON and try again.')
    }
  }

  const onReset = () => {
    const ok = window.confirm('Reset all progress data? This cannot be undone.')
    if (!ok) return
    resetProgram()
    setBackupText('')
    setStatus('Program reset complete.')
  }

  const onExportCsvZip = () => {
    if (isExportingCsv) return
    if (!completedDays || completedDays.length === 0) {
      setStatus('No workout data available to export yet.')
      return
    }

    setIsExportingCsv(true)
    try {
      const workoutHistoryCsv = buildWorkoutHistoryCSV(completedDays)
      const prsCsv = buildPRsCSV(completedDays)
      const weeklyVolumeCsv = buildWeeklyVolumeCSV(completedDays)

      downloadAsZip([
        { name: 'workout-history.csv', content: workoutHistoryCsv },
        { name: 'personal-records.csv', content: prsCsv },
        { name: 'weekly-volume.csv', content: weeklyVolumeCsv },
      ])

      setStatus('CSV export downloaded.')
    } catch (error) {
      console.error('Failed to export CSV zip:', error)
      setStatus('CSV export failed. Please try again.')
    } finally {
      setIsExportingCsv(false)
    }
  }

  const onExportAllWorkoutsCsv = () => {
    if (isExportingAllCsv) return
    if (!completedDays || completedDays.length === 0) {
      setStatus('No workout data available to export yet.')
      return
    }

    setIsExportingAllCsv(true)
    try {
      const workoutHistoryCsv = buildWorkoutHistoryCSV(completedDays)
      const filename = `workout-history-${new Date().toISOString().slice(0, 10)}.csv`
      downloadCsvFile(workoutHistoryCsv, filename)
      setStatus('Workout CSV downloaded (Excel-compatible).')
    } catch (error) {
      console.error('Failed to export workout CSV:', error)
      setStatus('Workout CSV export failed. Please try again.')
    } finally {
      setIsExportingAllCsv(false)
    }
  }

  const onExportMonthlyPdf = () => {
    if (isExportingMonthlyPdf) return

    const [yearText, monthText] = (reportMonth || '').split('-')
    const year = Number(yearText)
    const month = Number(monthText)

    if (!year || !month) {
      setStatus('Select a valid month to export a report.')
      return
    }

    if (selectedReportLogs.length === 0) {
      setStatus('No workouts found in the selected month.')
      return
    }

    setIsExportingMonthlyPdf(true)
    try {
      generateMonthlyPDF(selectedReportLogs, user?.email, month, year)
      setStatus('Monthly PDF report downloaded.')
    } catch (error) {
      console.error('Failed to generate monthly PDF report:', error)
      setStatus('Monthly PDF export failed. Please try again.')
    } finally {
      setIsExportingMonthlyPdf(false)
    }
  }

  const onStartDateChange = (value) => {
    setStartDate(value)
    if (!value) return
    setProgramStart(new Date(value).toISOString())
    setStatus('Program start date updated.')
  }

  const onSavePlanDisplayName = () => {
    const normalized = String(planNameInput || '').trim() || 'Dina Workout plan'
    setPlanDisplayName(normalized)
    setPlanNameInput(normalized)
    setStatus('Plan name updated.')
  }

  const onApplyProgramPosition = async () => {
    if (isUpdatingProgramPosition) return
    if (!selectedPhase) {
      setStatus('Select a valid phase first.')
      return
    }

    const parsedWeek = Number(selectedWeek)
    if (!Number.isFinite(parsedWeek)) {
      setStatus('Select a valid week first.')
      return
    }

    if (!selectedWeekData) {
      setStatus('Selected week does not exist in this phase.')
      return
    }

    const parsedDayIndex = Number(selectedDayIndex)
    if (!Number.isFinite(parsedDayIndex)) {
      setStatus('Select a valid day first.')
      return
    }

    const selectedDay = selectedWeekData.days.find((day) => day.dayIndex === parsedDayIndex)
    if (!selectedDay) {
      setStatus('Selected day does not exist in this week.')
      return
    }

    setIsUpdatingProgramPosition(true)
    try {
      await jumpToDay(selectedPhase.id, parsedWeek, parsedDayIndex)
      setStatus(`Program position updated to ${selectedPhase.name}, Week ${parsedWeek}, ${selectedDay.label}.`)
    } catch (error) {
      console.error('Failed to update program position:', error)
      setStatus('Could not update phase/week/day. Please try again.')
    } finally {
      setIsUpdatingProgramPosition(false)
    }
  }

  const onSwitchWorkoutPlan = async (programId) => {
    if (!programId || programId === activeProgramId || isSwitchingProgram) return

    setIsSwitchingProgram(true)
    try {
      const result = await switchWorkoutPlan(programId)
      if (result?.ok) {
        setStatus(`Switched to ${result.name}.`)
      } else {
        setStatus(result?.error || 'Could not switch workout plan.')
      }
    } catch (error) {
      console.error('Failed to switch workout plan:', error)
      setStatus('Could not switch workout plan.')
    } finally {
      setIsSwitchingProgram(false)
    }
  }

  const onImportWorkoutPlanFile = async (event) => {
    const file = event?.target?.files?.[0]
    if (!file || isImportingProgram) return

    setIsImportingProgram(true)
    try {
      const content = await file.text()
      const parsed = JSON.parse(content)
      const fallbackName = file.name.replace(/\.json$/i, '').trim() || 'Imported Plan'
      const result = await importWorkoutPlan(parsed, fallbackName)

      if (!result?.ok) {
        setStatus(result?.error || 'Workout plan import failed.')
      } else if (result.duplicate) {
        setStatus(`Plan already exists as ${result.name}. Reusing existing plan.`)
      } else {
        setStatus(`Imported new workout plan: ${result.name}.`)
      }
    } catch (error) {
      console.error('Failed to import workout plan JSON:', error)
      setStatus('Invalid JSON file. Please upload a valid workout plan file.')
    } finally {
      setIsImportingProgram(false)
      if (event?.target) {
        event.target.value = ''
      }
    }
  }

  const onUnitChange = async (nextUnit) => {
    if (isSavingPrefs || nextUnit === weightUnit) return
    setIsSavingPrefs(true)
    await setWeightUnit(nextUnit)
    setStatus('Training preferences saved.')
    setIsSavingPrefs(false)
  }

  const onSaveRestTimerDefault = async () => {
    if (isSavingPrefs) return

    const parsed = Number(restDefaultInput)
    if (!Number.isFinite(parsed) || parsed < 30 || parsed > 600) {
      setStatus('Rest timer default must be between 30 and 600 seconds.')
      return
    }

    setIsSavingPrefs(true)
    await setRestTimerDefault(parsed)
    setStatus('Training preferences saved.')
    setIsSavingPrefs(false)
  }

  const onToggleVibration = (enabled) => {
    setRestTimerVibration(enabled)
    setStatus('Training preferences saved.')
  }

  const handleSettingsManualSync = async () => {
    if (!navigator.onLine) {
      setStatus('You are currently offline. Changes will sync automatically once you are back online.')
      setPendingSyncCount(getSyncQueue().length)
      return
    }

    useWorkoutStore.setState({ syncStatus: 'syncing' })

    const cleared = await flushSyncQueue()
    let remoteOk = true

    if (cleared) {
      const cloud = await useWorkoutStore.getState().syncFromCloud({ setSyncing: false })
      remoteOk = Boolean(cloud?.ok || cloud?.offline)
    }

    const remaining = getSyncQueue().length
    setPendingSyncCount(remaining)
    useWorkoutStore.getState().recomputeSyncStatus({ cleared, remoteOk })

    if (remaining === 0 && remoteOk) {
      setStatus('All workouts are synced with the cloud.')
    } else if (!navigator.onLine) {
      setStatus('You went offline while syncing. Your changes are queued and will sync later.')
    } else if (!remoteOk) {
      setStatus('Some data could not be synced. You can retry from here or the header.')
    }
  }

  const onLogout = async () => {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  const onDeleteAccount = async () => {
    if (!user?.id || isDeletingAccount) return

    const confirmation = window.prompt('Type DELETE to permanently remove your account and data.')
    if (confirmation !== 'DELETE') {
      setStatus('Account deletion cancelled.')
      return
    }

    setIsDeletingAccount(true)

    try {
      const tables = ['workout_logs', 'custom_exercises', 'custom_workouts', 'achievements', 'user_progress']

      for (const table of tables) {
        try {
          const { error } = await supabase
            .from(table)
            .delete()
            .eq('user_id', user.id)

          if (error) {
            console.error(`Failed deleting rows from ${table}:`, error)
          }
        } catch (tableError) {
          console.error(`Delete failed for ${table}:`, tableError)
        }
      }

      let authDeleted = false
      try {
        const { error: authDeleteError } = await supabase.auth.admin.deleteUser(user.id)
        authDeleted = !authDeleteError
        if (authDeleteError) {
          console.error('Auth account deletion requires elevated permissions:', authDeleteError)
        }
      } catch (authError) {
        console.error('Auth account deletion not available in this client context:', authError)
      }

      await resetProgram()
      await supabase.auth.signOut()

      if (authDeleted) {
        setStatus('Account deleted successfully.')
      } else {
        setStatus('Training data deleted and you were signed out. Auth account deletion requires admin access.')
      }

      navigate('/auth')
    } catch (error) {
      console.error('Account deletion failed:', error)
      setStatus('Something went wrong while deleting your account. Your local data is still safe.')
    } finally {
      setIsDeletingAccount(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
      {/* Account Section */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Account</h2>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Logged in as</p>
            <p className="font-medium truncate text-zinc-900 dark:text-zinc-100">{user?.email || '—'}</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={onLogout}
              className="w-full sm:w-auto text-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Logout
            </button>
            <button
              type="button"
              onClick={onDeleteAccount}
              disabled={isDeletingAccount}
              className="w-full sm:w-auto text-center rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
            </button>
          </div>
        </div>
      </section>

      {/* Training Preferences */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Training Preferences</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">Weight Unit</p>
            <div className="inline-flex rounded-lg border border-zinc-300 p-1 dark:border-zinc-600">
              <button
                type="button"
                onClick={() => onUnitChange('kg')}
                disabled={isSavingPrefs}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                  weightUnit === 'kg'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                kg
              </button>
              <button
                type="button"
                onClick={() => onUnitChange('lbs')}
                disabled={isSavingPrefs}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                  weightUnit === 'lbs'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                lbs
              </button>
            </div>
          </div>

          <label className="grid gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            Rest Timer Default (seconds)
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="30"
                max="600"
                value={restDefaultInput}
                onChange={(event) => setRestDefaultInput(event.target.value)}
                onBlur={onSaveRestTimerDefault}
                className="w-28 rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none ring-zinc-900 focus:ring dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={onSaveRestTimerDefault}
                disabled={isSavingPrefs}
                className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Save
              </button>
            </div>
          </label>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
          <div>
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Rest Timer Vibration</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Vibrate when rest countdown completes.</p>
          </div>
          <button
            type="button"
            onClick={() => onToggleVibration(!restTimerVibration)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              restTimerVibration
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            {restTimerVibration ? 'On' : 'Off'}
          </button>
        </div>
      </section>

      {/* Program Settings */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Program Settings</h2>

        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Workout Plan Manager</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Import a full plan JSON and switch plans from one place. Duplicate plan files are skipped automatically.
          </p>

          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
            <label className="grid gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Active Plan
              <select
                value={activeProgramId}
                onChange={(event) => onSwitchWorkoutPlan(event.target.value)}
                disabled={isSwitchingProgram}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-900 focus:ring disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {(programLibrary || []).map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
            </label>

            <div className="flex md:items-end mt-2 md:mt-0">
              <label className="cursor-pointer block text-center w-full md:w-auto rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">
                {isImportingProgram ? 'Importing...' : 'Import Plan JSON'}
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={onImportWorkoutPlanFile}
                  disabled={isImportingProgram}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Plan Name</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Rename once and it updates everywhere this plan is shown.
          </p>

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <input
              type="text"
              value={planNameInput}
              onChange={(event) => setPlanNameInput(event.target.value)}
              onBlur={onSavePlanDisplayName}
              className="w-full sm:w-[14rem] rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-900 focus:ring dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={onSavePlanDisplayName}
              className="w-full sm:w-auto text-center flex-shrink-0 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Save Name
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Program Position</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Jump to a specific phase, week, and day in your {planDisplayName}.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <label className="grid gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Phase
              <select
                value={selectedPhaseId}
                onChange={(event) => setSelectedPhaseId(event.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-900 focus:ring dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {(program?.phases || []).map((phase) => (
                  <option key={phase.id} value={phase.id}>{phase.name}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Week
              <select
                value={selectedWeek}
                onChange={(event) => setSelectedWeek(event.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-900 focus:ring dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {selectableWeeks.map((week) => (
                  <option key={week.weekNumber} value={String(week.weekNumber)}>Week {week.weekNumber}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Day
              <select
                value={selectedDayIndex}
                onChange={(event) => setSelectedDayIndex(event.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-900 focus:ring dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {selectableDays.map((day) => (
                  <option key={day.dayIndex} value={String(day.dayIndex)}>
                    Day {day.dayIndex + 1} - {day.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex md:items-end mt-2 md:mt-0">
              <button
                type="button"
                onClick={onApplyProgramPosition}
                disabled={isUpdatingProgramPosition}
                className="w-full md:w-auto text-center rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {isUpdatingProgramPosition ? 'Updating...' : 'Apply'}
              </button>
            </div>
          </div>

          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            Current: {currentPhaseId} · Week {currentWeek} · Day {currentDayIndex + 1}
          </p>
        </div>

        <label className="mt-4 grid max-w-xs gap-1 text-sm text-zinc-600 dark:text-zinc-400">
          Program Start Date
          <input
            type="date"
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none ring-zinc-900 focus:ring dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </label>
      </section>

      {/* Cloud Sync Overview */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Cloud Sync</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Fitty saves everything locally first, then syncs changes to the cloud when you are online.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Current status</p>
            <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {syncStatus === 'syncing' && 'Syncing in progress…'}
              {syncStatus === 'saved' && 'All workouts are synced.'}
              {syncStatus === 'offline' && 'Offline – changes will sync when you are back online.'}
              {syncStatus === 'error' && 'Sync issue – you can retry syncing your changes.'}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Pending changes in the queue: {pendingSyncCount}
            </p>
          </div>

          <button
            type="button"
            onClick={handleSettingsManualSync}
            className="w-full rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 sm:w-auto dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Sync Now
          </button>
        </div>
      </section>

      {/* Backup & Data */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Backup & Data</h3>
        <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap gap-2 w-full">
          <button
            type="button"
            onClick={onExport}
            className="w-full sm:w-auto text-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700"
          >
            Export Data
          </button>
          <button
            type="button"
            onClick={onImport}
            className="w-full sm:w-auto text-center rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Import Data
          </button>
          <button
            type="button"
            onClick={onReset}
            className="w-full sm:w-auto text-center rounded-full border border-red-300 px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            Reset Program
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Analytics Exports</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Download structured CSVs and a polished monthly training report.
          </p>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-row lg:flex-wrap items-stretch lg:items-center gap-2">
            <button
              type="button"
              onClick={onExportAllWorkoutsCsv}
              disabled={isExportingAllCsv}
              className="w-full text-center flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {isExportingAllCsv ? 'Preparing CSV...' : 'Export Workouts (CSV)'}
            </button>

            <button
              type="button"
              onClick={onExportCsvZip}
              disabled={isExportingCsv}
              className="w-full text-center flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {isExportingCsv ? 'Preparing Zip...' : 'Export CSV Archive'}
            </button>

            <div className="flex flex-col w-full gap-2 sm:flex-row sm:col-span-2 lg:w-auto">
              <input
                type="month"
                value={reportMonth}
                onChange={(event) => setReportMonth(event.target.value)}
                className="w-full sm:flex-1 lg:w-32 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-zinc-900 focus:ring dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              />

              <button
                type="button"
                onClick={onExportMonthlyPdf}
                disabled={isExportingMonthlyPdf}
                className="w-full sm:flex-1 text-center rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {isExportingMonthlyPdf ? 'Generating...' : 'Export PDF'}
              </button>
            </div>
          </div>

          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            {selectedReportLogs.length} workouts found for selected month.
          </p>
        </div>

        <textarea
          value={backupText}
          onChange={(event) => setBackupText(event.target.value)}
          className="mt-3 min-h-48 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-900 focus:ring dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          placeholder="Exported JSON appears here. Paste JSON here to import."
        />

        {status && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{status}</p>}
      </section>
    </div>
  )
}

export default SettingsPage
