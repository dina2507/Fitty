import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PlateCalculator from '../components/PlateCalculator'
import { calculate1RM } from '../utils/oneRepMax'
import { generateWarmupSets } from '../utils/warmupSets'

function roundWeight(value, unit) {
  const step = unit === 'lbs' ? 5 : 2.5
  return Math.round(value / step) * step
}

function formatWeight(value, unit) {
  if (!Number.isFinite(value)) return '--'
  return `${value.toFixed(unit === 'lbs' ? 0 : 1)} ${unit}`
}

function WorkoutToolsPage() {
  const [unit, setUnit] = useState('kg')
  const [workingWeight, setWorkingWeight] = useState('100')
  const [workingReps, setWorkingReps] = useState('5')
  const [showPlateCalculator, setShowPlateCalculator] = useState(false)
  const [warmupReferenceWeight, setWarmupReferenceWeight] = useState('100')

  const parsedWeight = Number(workingWeight)
  const parsedReps = Number(workingReps)

  const estimated1RM = useMemo(() => {
    const value = calculate1RM(parsedWeight, parsedReps)
    return Number.isFinite(value) ? value : null
  }, [parsedWeight, parsedReps])

  const percentageTable = useMemo(() => {
    if (!Number.isFinite(estimated1RM) || estimated1RM <= 0) return []

    return [95, 90, 85, 80, 75, 70, 65, 60].map((percent) => {
      const rawWeight = estimated1RM * (percent / 100)
      const roundedWeight = roundWeight(rawWeight, unit)
      return {
        percent,
        roundedWeight,
      }
    })
  }, [estimated1RM, unit])

  const warmupPlan = useMemo(() => {
    return generateWarmupSets(Number(warmupReferenceWeight), unit)
  }, [warmupReferenceWeight, unit])

  return (
    <div className="mx-auto grid max-w-5xl gap-4 px-4 py-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Workout Tools</p>
            <h1 className="text-2xl font-bold text-zinc-900">FitNotes-style Calculators</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Estimate maxes, calculate training percentages, build warm-up sets, and open plate math instantly.
            </p>
          </div>

          <div className="inline-flex rounded-lg border border-zinc-300 p-1">
            <button
              type="button"
              onClick={() => setUnit('kg')}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                unit === 'kg' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              kg
            </button>
            <button
              type="button"
              onClick={() => setUnit('lbs')}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                unit === 'lbs' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              lbs
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Estimated 1RM</h2>
          <p className="mt-1 text-xs text-zinc-500">Uses the Epley formula from your best working set.</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Weight ({unit})
              <input
                type="number"
                inputMode="decimal"
                value={workingWeight}
                onChange={(event) => setWorkingWeight(event.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
              />
            </label>

            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              Reps
              <input
                type="number"
                inputMode="numeric"
                value={workingReps}
                onChange={(event) => setWorkingReps(event.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
              />
            </label>
          </div>

          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-emerald-700">Estimated 1RM</p>
            <p className="text-xl font-bold text-emerald-800">
              {estimated1RM ? formatWeight(estimated1RM, unit) : '--'}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Training Percentages</h2>
          <p className="mt-1 text-xs text-zinc-500">Quick reference from your estimated 1RM.</p>

          <div className="mt-4 grid gap-2">
            {percentageTable.length === 0 && (
              <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-500">
                Enter a valid weight and reps to generate your percentage table.
              </p>
            )}

            {percentageTable.map((row) => (
              <div
                key={row.percent}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2"
              >
                <p className="text-sm font-medium text-zinc-700">{row.percent}%</p>
                <p className="text-sm font-semibold text-zinc-900">{formatWeight(row.roundedWeight, unit)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Warm-up Planner</h2>
          <p className="mt-1 text-xs text-zinc-500">Build warm-up jumps automatically for your target working weight.</p>

          <label className="mt-4 grid gap-1 text-xs font-medium text-zinc-600">
            Working Set Weight ({unit})
            <input
              type="number"
              inputMode="decimal"
              value={warmupReferenceWeight}
              onChange={(event) => setWarmupReferenceWeight(event.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
            />
          </label>

          <div className="mt-4 grid gap-2">
            {warmupPlan.length === 0 && (
              <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-500">
                Enter a valid working weight to generate warm-up sets.
              </p>
            )}

            {warmupPlan.map((set) => (
              <div key={set.id} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                <p className="text-sm font-semibold text-zinc-900">{set.label}</p>
                <p className="text-xs text-zinc-600">
                  {set.percent}% · {set.weight} {unit} × {set.reps} reps
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Plate Math</h2>
          <p className="mt-1 text-xs text-zinc-500">Open the plate calculator for fast per-side loading.</p>

          <button
            type="button"
            onClick={() => setShowPlateCalculator(true)}
            className="mt-4 rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
          >
            Open Plate Calculator
          </button>

          <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Quick Actions</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Link
                to="/workout"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                Start Workout
              </Link>
              <Link
                to="/history"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                Open History
              </Link>
              <Link
                to="/records"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                Records and Goals
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PlateCalculator
        isOpen={showPlateCalculator}
        onClose={() => setShowPlateCalculator(false)}
        defaultUnit={unit}
      />
    </div>
  )
}

export default WorkoutToolsPage
