import React, { useMemo, useEffect, useState } from 'react'
import Confetti from 'react-confetti'

export function CompletionModal({
  activeExercises,
  exerciseLog,
  durationMinutes,
  newPRs = [],
  earnedBadges = [],
  onConfirm,
  onClose,
  isSaving = false,
}) {
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight })

  const prNames = useMemo(() => {
    return (newPRs || [])
      .map((item) => (typeof item === 'string' ? item : item?.name))
      .filter(Boolean)
  }, [newPRs])

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const { setsCount, totalVolume } = useMemo(() => {
    let setsCount = 0
    let totalVolume = 0

    activeExercises.forEach((ex) => {
      const log = exerciseLog[ex.id]
      if (!log || !log.sets) return

      log.sets.forEach((set) => {
        const w = parseFloat(set.weight) || 0
        const r = parseInt(set.reps) || 0
        if (w > 0 && r > 0) {
          setsCount++
          totalVolume += w * r
        }
      })
    })

    return { setsCount, totalVolume }
  }, [activeExercises, exerciseLog])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm px-4">
      {prNames.length > 0 && (
         <Confetti
           width={windowSize.width}
           height={windowSize.height}
           recycle={false}
           numberOfPieces={400}
           gravity={0.15}
         />
      )}
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl animate-in fade-in zoom-in duration-200">
        <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-4 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h2 className="text-xl font-bold text-zinc-900">Workout Complete!</h2>
          <p className="mt-1 text-sm text-zinc-500">Great job getting it done today.</p>
        </div>

        <div className="px-6 py-5">
          <div className="grid grid-cols-3 gap-3 text-center mb-6">
            <div className="rounded-xl bg-zinc-50 p-3">
              <p className="text-xl font-bold text-zinc-900">{durationMinutes}</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mt-0.5">Mins</p>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3">
              <p className="text-xl font-bold text-zinc-900">{setsCount}</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mt-0.5">Sets</p>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3">
              <p className="text-xl font-bold text-zinc-900">{Math.round(totalVolume)}</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mt-0.5">Vol (kg)</p>
            </div>
          </div>

          {prNames.length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="flex items-center gap-2 font-bold text-amber-800">
                <span>🏆</span> New Personal Records!
              </h3>
              <ul className="mt-2 list-inside list-disc text-sm text-amber-900">
                {prNames.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          )}

          {earnedBadges.length > 0 && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="flex items-center gap-2 font-bold text-emerald-800">
                <span>🎖️</span> New Badges Unlocked!
              </h3>
              <ul className="mt-2 list-inside list-disc text-sm text-emerald-900">
                {earnedBadges.map((badge) => (
                  <li key={badge}>{badge}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Keep Editing
            </button>
            <button
              onClick={onConfirm}
              disabled={isSaving}
              className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors shadow-sm"
            >
              {isSaving ? 'Saving...' : 'Save & Finish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
