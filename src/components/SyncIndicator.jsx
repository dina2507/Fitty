import { useCallback, useEffect, useState } from 'react'
import { useWorkoutStore } from '../store/useWorkoutStore'
import { flushSyncQueue, getSyncQueue } from '../utils/syncQueue'

function SyncIndicator() {
  const syncStatus = useWorkoutStore((state) => state.syncStatus)
  const syncFromCloud = useWorkoutStore((state) => state.syncFromCloud)
  const [pendingCount, setPendingCount] = useState(0)
  const [isManualSyncing, setIsManualSyncing] = useState(false)

  const statusConfig = {
    saved: { icon: '☁️', label: 'All workouts synced', color: 'text-emerald-600' },
    syncing: { icon: '🔄', label: 'Syncing…', color: 'text-amber-600' },
    offline: { icon: '📴', label: 'Offline – changes queued', color: 'text-zinc-400' },
    error: { icon: '⚠️', label: 'Sync issue – tap to retry', color: 'text-red-500' },
  }

  const config = statusConfig[syncStatus] || statusConfig.saved
  const showRetryButton = syncStatus === 'error' || syncStatus === 'offline' || pendingCount > 0

  const refreshPendingCount = useCallback(() => {
    setPendingCount(getSyncQueue().length)
  }, [])

  useEffect(() => {
    refreshPendingCount()

    const onStorage = (event) => {
      if (!event?.key || event.key === 'fitty_offline_sync_queue') {
        refreshPendingCount()
      }
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('online', refreshPendingCount)
    window.addEventListener('focus', refreshPendingCount)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('online', refreshPendingCount)
      window.removeEventListener('focus', refreshPendingCount)
    }
  }, [refreshPendingCount])

  useEffect(() => {
    refreshPendingCount()
  }, [refreshPendingCount, syncStatus])

  const handleManualSync = useCallback(async () => {
    if (isManualSyncing) return

    setIsManualSyncing(true)
    useWorkoutStore.setState({ syncStatus: 'syncing' })

    try {
      const cleared = await flushSyncQueue()
      let remoteOk = true

      if (cleared && navigator.onLine) {
        const cloud = await syncFromCloud({ setSyncing: false })
        remoteOk = Boolean(cloud?.ok || cloud?.offline)
      }

      const remaining = getSyncQueue().length
      setPendingCount(remaining)

      useWorkoutStore.getState().recomputeSyncStatus({ cleared, remoteOk })
    } finally {
      setIsManualSyncing(false)
    }
  }, [isManualSyncing, syncFromCloud])

  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium ${config.color}`}
        title={config.label}
      >
        <span>{config.icon}</span>
        <span className="hidden sm:inline">{config.label}</span>
        {pendingCount > 0 && (
          <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700">
            {pendingCount}
          </span>
        )}
      </span>

      {showRetryButton && (
        <button
          type="button"
          onClick={handleManualSync}
          disabled={isManualSyncing}
          className="rounded-full border border-zinc-300 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
          title="Retry syncing pending logs"
        >
          {isManualSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      )}
    </div>
  )
}

export default SyncIndicator
