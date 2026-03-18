import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Rest timer hook.
 * Call startTimer(seconds) after logging a set.
 * Returns { timeLeft, isRunning, totalDuration, startTimer, stopTimer, addTime }
 */
export function useRestTimer(options = {}) {
  const enableVibration = options.enableVibration !== false
  const [timeLeft, setTimeLeft] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [totalDuration, setTotalDuration] = useState(0)
  const intervalRef = useRef(null)
  const endTimeRef = useRef(null)

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    endTimeRef.current = null
    setIsRunning(false)
    setTimeLeft(0)
    setTotalDuration(0)
  }, [])

  const addTime = useCallback((seconds) => {
    if (endTimeRef.current) {
      endTimeRef.current += seconds * 1000
      setTimeLeft(prev => prev + seconds)
      setTotalDuration(prev => prev + seconds)
    }
  }, [])

  const startTimer = useCallback((seconds) => {
    stopTimer()
    endTimeRef.current = Date.now() + seconds * 1000
    setTimeLeft(seconds)
    setTotalDuration(seconds)
    setIsRunning(true)

    intervalRef.current = setInterval(() => {
      if (!endTimeRef.current) return

      const remainingMs = endTimeRef.current - Date.now()
      const remainingSecs = Math.ceil(remainingMs / 1000)

      if (remainingSecs <= 0) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
        endTimeRef.current = null
        setIsRunning(false)
        setTimeLeft(0)

        // Vibrate on completion
        if (enableVibration && navigator.vibrate) {
          navigator.vibrate([200, 100, 200])
        }
      } else {
        setTimeLeft(remainingSecs)
      }
    }, 200) // Poll more frequently for precision upon returning from background
  }, [enableVibration, stopTimer])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])
  return { timeLeft, isRunning, totalDuration, startTimer, stopTimer, addTime }
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
