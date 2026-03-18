import { getDayTheme } from '../utils/dayTheme'

function DayCard({ day, isActive = false, isCompleted = false, onClick }) {
  if (!day) {
    return null
  }

  const theme = getDayTheme(day.type, day.isRest)

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full rounded-xl border p-4 text-left transition-all',
        `bg-gradient-to-br ${theme.surface}`,
        theme.border,
        isActive ? 'ring-2 ring-zinc-900 ring-offset-2' : 'hover:shadow-md',
      ].join(' ')}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-zinc-500">Day {day.dayIndex + 1}</span>
        <span
          className={[
            'rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide',
            theme.badge,
          ].join(' ')}
        >
          {day.isRest ? 'Rest' : day.type}
        </span>
      </div>

      <p className="text-base font-semibold text-zinc-900">{day.label}</p>

      <p className="mt-2 text-sm text-zinc-600">
        {day.isRest
          ? 'Recovery day'
          : `${day.exercises?.length || 0} exercise${day.exercises?.length === 1 ? '' : 's'}`}
      </p>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-zinc-500">Tap to select day</span>
        {isCompleted && (
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
            Completed
          </span>
        )}
      </div>
    </button>
  )
}

export default DayCard
