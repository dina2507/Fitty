import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home, Dumbbell, History, BarChart3, MoreHorizontal,
  ListChecks, Trophy, BookOpen, Wrench, Settings, X,
} from 'lucide-react'

const TABS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/workout', label: 'Log', icon: Dumbbell },
  { to: '/history', label: 'History', icon: History },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
]

const MORE_LINKS = [
  { to: '/plans', label: 'Plans & Builder', icon: ListChecks },
  { to: '/records', label: 'Records', icon: Trophy },
  { to: '/exercises', label: 'Exercises', icon: BookOpen },
  { to: '/tools', label: 'Tools', icon: Wrench },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function tabClass({ isActive }) {
  return [
    'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
    isActive ? 'text-accent' : 'text-zinc-500 hover:text-zinc-800',
  ].join(' ')
}

export default function BottomTabBar() {
  const [moreOpen, setMoreOpen] = useState(false)
  const navigate = useNavigate()

  const go = (to) => {
    setMoreOpen(false)
    navigate(to)
  }

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60"
          onClick={() => setMoreOpen(false)}
          aria-hidden
        >
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-surface-border bg-surface-raised p-4 pb-safe"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="More"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-800">More</h2>
              <button onClick={() => setMoreOpen(false)} className="btn-ghost p-2" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 pb-4">
              {MORE_LINKS.map(({ to, label, icon: Icon }) => (
                <button
                  key={to}
                  onClick={() => go(to)}
                  className="flex items-center gap-3 rounded-xl bg-surface px-4 py-4 text-left text-sm font-medium text-zinc-700 border border-surface-border transition active:scale-[0.98] hover:bg-zinc-50"
                >
                  <Icon size={20} className="text-accent" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-surface-border bg-surface-raised/95 pb-safe backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-stretch">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={tabClass}>
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-800"
          >
            <MoreHorizontal size={22} />
            <span>More</span>
          </button>
        </div>
      </nav>
    </>
  )
}
