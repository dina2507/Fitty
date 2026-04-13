import React, { useMemo } from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  isSameDay
} from 'date-fns'
import { useWorkoutStore } from '../store/useWorkoutStore'

export function CalendarModal({ onClose }) {
  const completedDays = useWorkoutStore((state) => state.completedDays)

  React.useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // We map dates to their respective workout labels
  const workoutMap = useMemo(() => {
    const map = new Map()
    completedDays.forEach((day) => {
      // Just take the date part if it's ISO, or construct a Date and format to yyyy-MM-dd
      const dateStr = format(new Date(day.date), 'yyyy-MM-dd')
      map.set(dateStr, day.label)
    })
    return map
  }, [completedDays])

  // Current month simple view
  const currentMonthStart = startOfMonth(new Date())
  const currentMonthEnd = endOfMonth(new Date())
  
  const startDay = startOfWeek(currentMonthStart, { weekStartsOn: 1 })
  const endDay = endOfWeek(currentMonthEnd, { weekStartsOn: 1 })
  
  const calendarDays = eachDayOfInterval({ start: startDay, end: endDay })

  // Determine a color based on label roughly
  const getColorForLabel = (label) => {
    const l = label.toLowerCase()
    if (l.includes('push')) return 'bg-blue-100 text-blue-700 border-blue-200'
    if (l.includes('pull')) return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    if (l.includes('leg')) return 'bg-orange-100 text-orange-700 border-orange-200'
    if (l.includes('arm') || l.includes('abs') || l.includes('core')) return 'bg-purple-100 text-purple-700 border-purple-200'
    if (l.includes('full')) return 'bg-rose-100 text-rose-700 border-rose-200'
    return 'bg-zinc-100 text-zinc-700 border-zinc-200' // fallback
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 bg-zinc-50">
          <h2 className="text-lg font-bold text-zinc-900">Workout Calendar</h2>
          <button type="button" onClick={onClose} aria-label="Close calendar" className="rounded-full bg-zinc-200 p-1.5 text-zinc-600 hover:bg-zinc-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          <div className="mb-4 text-center">
            <h3 className="text-base font-semibold text-zinc-900">{format(currentMonthStart, 'MMMM yyyy')}</h3>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-semibold text-zinc-400">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d}>{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd')
              const workoutLabel = workoutMap.get(dateKey)
              const isCurrentMonth = isSameMonth(day, currentMonthStart)
              const today = isToday(day)

              let dayBadgeClasses = 'flex flex-col items-center justify-start rounded-lg border p-1 h-14 '
              if (!isCurrentMonth) {
                dayBadgeClasses += 'opacity-30 border-transparent bg-transparent '
              } else if (workoutLabel) {
                dayBadgeClasses += getColorForLabel(workoutLabel)
              } else {
                dayBadgeClasses += 'border-zinc-100 bg-white '
              }

              if (today && !workoutLabel) {
                dayBadgeClasses += ' ring-2 ring-zinc-900 ring-inset '
              }

              return (
                <div key={dateKey} className={dayBadgeClasses}>
                  <span className={`text-[11px] font-semibold ${today ? 'text-zinc-900' : ''}`}>
                    {format(day, 'd')}
                  </span>
                  {workoutLabel && (
                    <span className="mt-0.5 text-[8px] leading-tight font-medium uppercase text-center w-full truncate px-0.5 opacity-90">
                      {workoutLabel.split(' ')[0]}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-zinc-600">
              <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></div> Push
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-600">
              <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200"></div> Pull
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-600">
              <div className="w-3 h-3 rounded bg-orange-100 border border-orange-200"></div> Legs
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-600">
              <div className="w-3 h-3 rounded bg-purple-100 border border-purple-200"></div> Arms/Abs
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
