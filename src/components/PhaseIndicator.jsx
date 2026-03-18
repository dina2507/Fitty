import { getDayTheme } from '../utils/dayTheme'

function PhaseIndicator({ phaseName, week, day }) {
  const theme = getDayTheme(day?.type, day?.isRest)

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-zinc-500">Current Block</p>
      <h2 className="mt-1 text-lg font-semibold text-zinc-900">{phaseName || 'Program'}</h2>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-zinc-900 px-2 py-0.5 font-medium text-white">Week {week}</span>
        <span
          className={[
            'rounded-full border px-2 py-0.5 font-medium uppercase',
            theme.badge,
          ].join(' ')}
        >
          {day?.label || 'No day selected'}
        </span>
      </div>
    </section>
  )
}

export default PhaseIndicator
