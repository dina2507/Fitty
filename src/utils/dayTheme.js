const DAY_THEME = {
  push: {
    badge: 'bg-red-100 text-red-700 border-red-200',
    border: 'border-red-200',
    surface: 'from-red-50 to-orange-50',
  },
  pull: {
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    border: 'border-blue-200',
    surface: 'from-blue-50 to-cyan-50',
  },
  legs: {
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    border: 'border-emerald-200',
    surface: 'from-emerald-50 to-lime-50',
  },
  rest: {
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    border: 'border-slate-200',
    surface: 'from-slate-50 to-zinc-50',
  },
  default: {
    badge: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    border: 'border-zinc-200',
    surface: 'from-zinc-50 to-stone-50',
  },
}

export function getDayTheme(type, isRest = false) {
  if (isRest) {
    return DAY_THEME.rest
  }

  return DAY_THEME[type] || DAY_THEME.default
}
