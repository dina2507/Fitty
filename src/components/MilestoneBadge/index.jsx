export default function MilestoneBadge({
  badge,
  earned,
  earnedAt,
  progressText,
  progressRatio,
}) {
  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        earned
          ? 'border-emerald-300 bg-emerald-50'
          : 'border-zinc-200 bg-zinc-50 text-zinc-500'
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xl">{earned ? badge.icon : '🔒'}</span>
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${earned ? 'text-emerald-700' : 'text-zinc-400'}`}>
          {earned ? 'Earned' : 'Locked'}
        </span>
      </div>

      <p className={`text-sm font-semibold ${earned ? 'text-zinc-900' : 'text-zinc-500'}`}>{badge.label}</p>
      <p className="mt-1 text-xs">{badge.description}</p>

      {earned && earnedAt && (
        <p className="mt-2 text-[11px] font-medium text-emerald-800">
          Earned {new Date(earnedAt).toLocaleDateString()}
        </p>
      )}

      {progressText && <p className="mt-2 text-[11px] font-semibold">{progressText}</p>}

      {progressRatio !== null && progressRatio !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200">
          <div
            className={`h-full ${earned ? 'bg-emerald-500' : 'bg-zinc-400'}`}
            style={{ width: `${Math.max(6, Math.round(progressRatio * 100))}%` }}
          />
        </div>
      )}
    </div>
  )
}
