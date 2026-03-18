export default function TrainingAlerts({ alerts, onDismiss }) {
  const list = Array.isArray(alerts) ? alerts : []
  if (list.length === 0) return null

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-amber-900">Training Alerts</h3>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
          {list.length} active
        </span>
      </div>

      <div className="grid gap-2">
        {list.map((alert) => (
          <article
            key={alert.id}
            className={`rounded-lg border px-3 py-2 ${
              alert.severity === 'danger'
                ? 'border-red-200 bg-red-50'
                : 'border-amber-200 bg-white'
            }`}
          >
            <p className={`text-sm ${alert.severity === 'danger' ? 'text-red-800' : 'text-amber-900'}`}>
              {alert.message}
            </p>
            <div className="mt-2 flex justify-end">
              <button
                onClick={() => onDismiss(alert.id)}
                className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                Dismiss
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
