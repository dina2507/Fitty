import { useEffect, useRef } from 'react'

/**
 * Keeps the screen awake while `active` is true (e.g. during a workout).
 * Re-acquires the lock when the tab becomes visible again (the OS releases it
 * automatically when the page is hidden). No-op on browsers without the API.
 */
export function useWakeLock(active = true) {
  const lockRef = useRef(null)

  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return undefined
    }

    let released = false

    const acquire = async () => {
      try {
        lockRef.current = await navigator.wakeLock.request('screen')
        lockRef.current.addEventListener?.('release', () => { lockRef.current = null })
      } catch {
        /* user/agent denied — ignore silently */
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !lockRef.current && !released) {
        acquire()
      }
    }

    acquire()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisibility)
      try { lockRef.current?.release?.() } catch { /* ignore */ }
      lockRef.current = null
    }
  }, [active])
}
