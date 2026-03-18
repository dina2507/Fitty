function ProgressBar({ value, max, label }) {
  const safeMax = Math.max(max, 1)
  const safeValue = Math.min(Math.max(value, 0), safeMax)
  const percent = Math.round((safeValue / safeMax) * 100)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm text-zinc-600">
        <p className="font-medium text-zinc-800">{label}</p>
        <p>
          {safeValue}/{safeMax} ({percent}%)
        </p>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-200">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

export default ProgressBar
