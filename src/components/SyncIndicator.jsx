import { useWorkoutStore } from '../store/useWorkoutStore'

function SyncIndicator() {
  const syncStatus = useWorkoutStore((state) => state.syncStatus)

  const statusConfig = {
    saved: { icon: '☁️', label: 'Saved', color: 'text-emerald-600' },
    syncing: { icon: '🔄', label: 'Syncing', color: 'text-amber-600' },
    offline: { icon: '📴', label: 'Offline', color: 'text-zinc-400' },
    error: { icon: '⚠️', label: 'Sync Error', color: 'text-red-500' },
  }

  const config = statusConfig[syncStatus] || statusConfig.saved

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium ${config.color}`}
      title={config.label}
    >
      <span>{config.icon}</span>
      <span className="hidden sm:inline">{config.label}</span>
    </span>
  )
}

export default SyncIndicator
