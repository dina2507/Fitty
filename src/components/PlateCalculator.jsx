import { useMemo, useState } from 'react'
import { calculatePlateBreakdown } from '../utils/plateCalc'

function PlateStack({ row, unit }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div>
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{row.plate}{unit}</p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">per side</p>
      </div>
      <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">x {row.count}</p>
    </div>
  )
}

export default function PlateCalculator({ isOpen, onClose, defaultUnit = 'kg' }) {
  const [targetWeight, setTargetWeight] = useState('')
  const [barWeight, setBarWeight] = useState('')
  const [unit, setUnit] = useState(defaultUnit === 'lbs' ? 'lbs' : 'kg')

  const breakdown = useMemo(() => {
    return calculatePlateBreakdown(targetWeight, unit, barWeight)
  }, [barWeight, targetWeight, unit])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 py-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Plate Calculator</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Calculate plates per side for your target lift.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            ×
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Target Weight
            <input
              type="number"
              inputMode="decimal"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder={unit === 'kg' ? '100' : '225'}
            />
          </label>

          <label className="grid gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Unit
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value === 'lbs' ? 'lbs' : 'kg')}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="kg">kg</option>
              <option value="lbs">lbs</option>
            </select>
          </label>
        </div>

        <label className="mt-3 grid gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
          Bar Weight ({breakdown.unit})
          <input
            type="number"
            inputMode="decimal"
            value={barWeight}
            onChange={(e) => setBarWeight(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            placeholder={String(unit === 'kg' ? 20 : 45)}
          />
        </label>

        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/40">
          {!breakdown.valid ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{breakdown.reason}</p>
          ) : (
            <>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Per side: {breakdown.perSide}{breakdown.unit}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Achieved total: {breakdown.achievedTotal}{breakdown.unit}
                {breakdown.remainder > 0 ? ` (remaining ${breakdown.remainder}${breakdown.unit} per side)` : ''}
              </p>
            </>
          )}
        </div>

        {breakdown.valid && (
          <div className="mt-3 grid gap-2">
            {breakdown.platesPerSide.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-600 dark:text-zinc-400">
                No plates needed. Bar only.
              </p>
            ) : (
              breakdown.platesPerSide.map((row) => (
                <PlateStack key={`${row.plate}-${row.count}`} row={row} unit={breakdown.unit} />
              ))
            )}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
