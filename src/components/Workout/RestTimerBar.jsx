import React from 'react'

export function RestTimerBar({ timeLeft, formatTime, stopTimer, addTime, maxTime = 120 }) {
  const progress = maxTime > 0 ? Math.min(100, (timeLeft / maxTime) * 100) : 0
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/30">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-blue-800 flex items-center gap-2 dark:text-blue-200">
          <span>⏱ Rest:</span> 
          <span className="font-bold">{formatTime(timeLeft)}</span>
        </p>
        <div className="flex items-center gap-3">
          {addTime && (
            <button onClick={() => addTime(30)} className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-200 transition-colors dark:bg-blue-900/50 dark:text-blue-200 dark:hover:bg-blue-900">
              +30s
            </button>
          )}
          <button onClick={stopTimer} className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors dark:text-blue-300 dark:hover:text-blue-100">Skip</button>
        </div>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-blue-100/50 overflow-hidden dark:bg-blue-900/30">
        <div className="h-full rounded-full bg-blue-500 transition-all duration-1000 ease-linear" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}
