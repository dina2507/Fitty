import { useState } from 'react'
import { Dumbbell, ListChecks, TrendingUp } from 'lucide-react'

const STEPS = [
  {
    icon: Dumbbell,
    title: 'Welcome to Fitty',
    body: 'Your phone-first workout logger. Pick a plan, log every set, and watch your numbers climb.',
  },
  {
    icon: ListChecks,
    title: 'Log in seconds',
    body: 'Tap a day to start, set weight & reps with the steppers, then Save. RPE chips, supersets, warm-ups and plate math are built in.',
  },
  {
    icon: TrendingUp,
    title: 'Get smarter',
    body: 'Progression hints, plateau & deload alerts, PR celebrations and a consistency heatmap keep you moving. Back up anytime in Settings.',
  },
]

export default function Onboarding({ onDone }) {
  const [index, setIndex] = useState(0)
  const isLast = index === STEPS.length - 1
  const step = STEPS[index]
  const Icon = step.icon

  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/60 sm:items-center sm:justify-center">
      <div className="w-full rounded-t-3xl bg-surface-raised p-6 pb-safe sm:max-w-sm sm:rounded-3xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-white">
          <Icon size={30} />
        </div>
        <h2 className="text-center text-xl font-extrabold text-zinc-900">{step.title}</h2>
        <p className="mt-2 text-center text-sm text-zinc-500">{step.body}</p>

        <div className="mt-5 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-accent' : 'w-1.5 bg-surface-border'}`}
            />
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          {!isLast && (
            <button onClick={onDone} className="btn-ghost flex-1 text-sm text-zinc-500">Skip</button>
          )}
          <button
            onClick={() => (isLast ? onDone() : setIndex(index + 1))}
            className="btn-primary flex-1"
          >
            {isLast ? 'Get started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
