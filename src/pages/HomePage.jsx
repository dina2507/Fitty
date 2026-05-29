import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dumbbell, Plus, ChevronRight, Calendar, Layers, Play } from 'lucide-react'
import { useWorkoutStore } from '../store/useWorkoutStore'
import SyncIndicator from '../components/SyncIndicator'
import { getTodayDateString } from '../utils/dateUtils'

const AUTOSAVE_KEY = 'ppl_tracker_active_workout'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function HomePage() {
  const navigate = useNavigate()
  const getPlans = useWorkoutStore((s) => s.getPlans)
  const userPlans = useWorkoutStore((s) => s.userPlans)
  const programLibrary = useWorkoutStore((s) => s.programLibrary)
  const planDisplayName = useWorkoutStore((s) => s.planDisplayName)
  const activeProgramId = useWorkoutStore((s) => s.activeProgramId)
  const activePlanId = useWorkoutStore((s) => s.activePlanId)
  const completedDays = useWorkoutStore((s) => s.completedDays)
  const getCurrentDay = useWorkoutStore((s) => s.getCurrentDay)
  const setActivePlan = useWorkoutStore((s) => s.setActivePlan)
  const switchWorkoutPlan = useWorkoutStore((s) => s.switchWorkoutPlan)

  const plans = getPlans()

  const [expandedPlanId, setExpandedPlanId] = useState(null)

  const nextPeriodizedDay = getCurrentDay()

  const todayCount = useMemo(() => {
    const today = getTodayDateString()
    return (completedDays || []).filter((d) => String(d?.date || '').startsWith(today) && !d?.deletedAt).length
  }, [completedDays])

  const resume = useMemo(() => {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      const hasData = parsed?.exercises?.length || Object.keys(parsed?.exerciseLog || {}).length
      return hasData ? parsed : null
    } catch {
      return null
    }
  }, [])

  const startPeriodized = async (planId) => {
    if (planId !== activeProgramId) {
      await switchWorkoutPlan(planId)
    }
    setActivePlan(planId, null)
    navigate('/workout')
  }

  const startSimpleDay = (planId, dayId) => {
    setActivePlan(planId, dayId)
    navigate('/workout')
  }

  return (
    <div className="space-y-5 pt-4">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-500">{greeting()}</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">Let's train</h1>
        </div>
        <SyncIndicator />
      </header>
 
      {todayCount > 0 && (
        <div className="card flex items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Calendar size={18} />
          </div>
          <p className="text-sm text-zinc-600">
            <span className="tnum font-semibold text-zinc-900">{todayCount}</span> workout{todayCount > 1 ? 's' : ''} logged today
          </p>
        </div>
      )}
 
      {resume && (
        <button
          onClick={() => navigate('/workout')}
          className="w-full card flex items-center gap-3 px-4 py-4 text-left transition active:scale-[0.99]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white">
            <Play size={18} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-zinc-900">Resume workout</p>
            <p className="text-sm text-zinc-500">{resume.label || 'In progress'}</p>
          </div>
          <ChevronRight size={20} className="text-zinc-500" />
        </button>
      )}
 
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Your plans</h2>
          <button onClick={() => navigate('/plans')} className="btn-ghost text-sm text-accent">
            <Plus size={16} /> New plan
          </button>
        </div>
 
        {plans.map((plan) => {
          const isActive = plan.id === activePlanId
          const isExpanded = expandedPlanId === plan.id
 
          return (
            <div key={plan.id} className="card overflow-hidden">
              <button
                className="flex w-full items-center gap-3 px-4 py-4 text-left transition active:scale-[0.99]"
                onClick={() => {
                  if (plan.kind === 'periodized') {
                    startPeriodized(plan.id)
                  } else {
                    setExpandedPlanId(isExpanded ? null : plan.id)
                  }
                }}
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${plan.kind === 'periodized' ? 'bg-accent-soft text-accent' : 'bg-surface border border-surface-border text-zinc-500'}`}>
                  {plan.kind === 'periodized' ? <Layers size={22} /> : <Dumbbell size={22} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-zinc-900">{plan.name}</p>
                    {isActive && (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-500">
                    {plan.kind === 'periodized'
                      ? `Periodized · ${nextPeriodizedDay?.label ? `Next: ${nextPeriodizedDay.label}` : `${plan.dayCount} days`}`
                      : `${plan.dayCount} day${plan.dayCount === 1 ? '' : 's'}`}
                  </p>
                </div>
                <ChevronRight
                  size={20}
                  className={`text-zinc-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                />
              </button>
 
              {plan.kind === 'simple' && isExpanded && (
                <div className="border-t border-surface-border px-3 py-3">
                  {(plan.plan?.days || []).length === 0 ? (
                    <p className="px-1 py-2 text-sm text-zinc-500">No days yet. Add some in the builder.</p>
                  ) : (
                    <div className="space-y-2">
                      {plan.plan.days.map((day) => (
                        <button
                          key={day.id}
                          onClick={() => startSimpleDay(plan.id, day.id)}
                          className="flex w-full items-center justify-between rounded-xl bg-surface-overlay border border-surface-border px-4 py-3 text-left transition active:scale-[0.98] hover:bg-zinc-50"
                        >
                          <div>
                            <p className="font-medium text-zinc-800">{day.label}</p>
                            <p className="text-xs text-zinc-500">
                              {(day.exercises || []).length} exercise{(day.exercises || []).length === 1 ? '' : 's'}
                            </p>
                          </div>
                          <span className="flex items-center gap-1 text-sm font-semibold text-accent">
                            <Play size={15} /> Start
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => navigate('/plans')}
                    className="mt-2 w-full btn-ghost text-sm text-zinc-500"
                  >
                    Edit plan
                  </button>
                </div>
              )}
            </div>
          )
        })}
 
        <button
          onClick={() => navigate('/plans')}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-surface-border px-4 py-5 text-sm font-medium text-zinc-500 hover:bg-white transition active:scale-[0.99]"
        >
          <Plus size={18} /> Create your own plan
        </button>
      </section>
    </div>
  )
}
