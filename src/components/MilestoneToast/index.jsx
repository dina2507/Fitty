import { useEffect, useMemo } from 'react'
import { useWorkoutStore } from '../../store/useWorkoutStore'
import { BADGES } from '../../utils/milestoneChecker'

const CONFETTI_COLORS = ['#34d399', '#f59e0b', '#60a5fa', '#f87171', '#a78bfa', '#fbbf24']

function ConfettiField() {
  const pieces = useMemo(() => {
    return Array.from({ length: 32 }, (_, index) => {
      return {
        id: index,
        left: `${(index * 37) % 100}%`,
        delay: `${(index % 12) * 0.1}s`,
        duration: `${2 + (index % 5) * 0.2}s`,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      }
    })
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="absolute top-[-10%] h-2 w-1.5 rounded-sm opacity-80"
          style={{
            left: piece.left,
            backgroundColor: piece.color,
            animationName: 'fittyConfettiFall',
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite',
            animationDelay: piece.delay,
            animationDuration: piece.duration,
          }}
        />
      ))}
    </div>
  )
}

export default function MilestoneToastHost() {
  const queue = useWorkoutStore((state) => state.milestoneToastQueue)
  const shiftMilestoneToast = useWorkoutStore((state) => state.shiftMilestoneToast)

  const activeBadgeId = queue[0] || null
  const activeBadge = useMemo(
    () => BADGES.find((badge) => badge.id === activeBadgeId) || null,
    [activeBadgeId],
  )

  useEffect(() => {
    if (!activeBadge) return undefined

    const timeout = window.setTimeout(() => {
      shiftMilestoneToast()
    }, 2500)

    return () => window.clearTimeout(timeout)
  }, [activeBadge, shiftMilestoneToast])

  if (!activeBadge) return null

  return (
    <>
      <style>{`
        @keyframes fittyConfettiFall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
          10% { opacity: 0.95; }
          100% { transform: translateY(110vh) rotate(360deg); opacity: 0; }
        }
      `}</style>
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 px-4"
        onClick={shiftMilestoneToast}
      >
        <ConfettiField />
        <div className="relative w-full max-w-sm rounded-2xl border border-emerald-300 bg-white p-6 text-center shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Milestone Unlocked</p>
          <p className="mt-3 text-5xl">{activeBadge.icon}</p>
          <h3 className="mt-3 text-xl font-semibold text-zinc-900">{activeBadge.label}</h3>
          <p className="mt-2 text-sm text-zinc-600">{activeBadge.description}</p>
          <button
            type="button"
            onClick={shiftMilestoneToast}
            className="mt-4 rounded-full border border-zinc-300 px-4 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            Dismiss
          </button>
        </div>
      </div>
    </>
  )
}
