import React, { useState, useMemo } from 'react'
import MuscleGroupBadge from '../MuscleGroupBadge'
import { useWorkoutStore } from '../../store/useWorkoutStore'

export function SwapExerciseModal({ exercise, onSwap, onClose }) {
  const program = useWorkoutStore((state) => state.program)
  const [activeTab, setActiveTab] = useState('subs')
  const [searchQuery, setSearchQuery] = useState('')

  const normalizeName = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
  const normalizeLooseName = (value) => normalizeName(value).replace(/\s*\([^)]*\)\s*/g, ' ')

  const allProgramExercises = useMemo(() => {
    const map = new Map()
    ;(program?.phases || []).forEach((phase) => {
      ;(phase.weeks || []).forEach((week) => {
        ;(week.days || []).forEach((day) => {
          ;(day.exercises || []).forEach((item) => {
            if (!map.has(item.name)) {
              map.set(item.name, item)
            }
          })
        })
      })
    })
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [program])

  const findByName = (name) => allProgramExercises.find((item) => item.name === name)

  const findByNameLoose = (name) => {
    const target = normalizeName(name)
    const targetLoose = normalizeLooseName(name)

    return allProgramExercises.find((item) => {
      const itemExact = normalizeName(item.name)
      if (itemExact === target) return true
      const itemLoose = normalizeLooseName(item.name)
      return itemLoose === targetLoose
    })
  }

  const buildFallbackSubstitute = (name) => ({
    id: `sub_fallback_${normalizeName(name).replace(/[^a-z0-9]+/g, '_')}`,
    name,
    muscleGroup: exercise.muscleGroup,
    workingSets: exercise.workingSets || 3,
    reps: exercise.reps || '8-10',
    rpe: exercise.rpe || '8-9',
    rest: exercise.rest || '~2 min',
    warmupSets: exercise.warmupSets || '0',
    notes: '',
    sub1: '',
    sub2: '',
  })

  const directSubstitutes = useMemo(() => {
    const seen = new Set()

    return [exercise.sub1, exercise.sub2]
      .filter((name) => name && name !== 'N/A')
      .map((name) => {
        const matched = findByName(name) || findByNameLoose(name)
        return matched || buildFallbackSubstitute(name)
      })
      .filter((item) => {
        const key = normalizeName(item.name)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
  }, [allProgramExercises, exercise])

  const sameMuscleSuggestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return allProgramExercises.filter((item) => {
      if (item.id === exercise.id) return false
      if (item.muscleGroup !== exercise.muscleGroup) return false
      if (!query) return true
      return item.name.toLowerCase().includes(query)
    }).slice(0, 30)
  }, [allProgramExercises, exercise.id, exercise.muscleGroup, searchQuery])

  const allSearchSuggestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return allProgramExercises.filter((item) => {
      if (item.id === exercise.id) return false
      if (!query) return true
      return item.name.toLowerCase().includes(query)
    }).slice(0, 40)
  }, [allProgramExercises, exercise.id, searchQuery])

  const handleSelect = (ex, isPermanent) => {
    onSwap({ ...ex }, isPermanent)
  }

  const showSearch = activeTab !== 'subs'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-900">Swap: {exercise.name}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900 text-lg">×</button>
        </div>

        <div className="px-4 pt-3">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1">
            <button
              onClick={() => setActiveTab('subs')}
              className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === 'subs' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Jeff Subs
            </button>
            <button
              onClick={() => setActiveTab('same-muscle')}
              className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === 'same-muscle' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Same Muscle
            </button>
            <button
              onClick={() => setActiveTab('search-all')}
              className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === 'search-all' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Search All
            </button>
          </div>
        </div>

        {showSearch && (
          <div className="px-4 pt-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              placeholder={
                activeTab === 'same-muscle'
                  ? `Search ${exercise.muscleGroup || 'matching'} exercises...`
                  : 'Search all exercises...'
              }
              autoFocus
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {activeTab === 'subs' && directSubstitutes.length === 0 && (
            <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-3 py-6 text-center text-xs text-zinc-500">
              No direct Jeff substitutions are available for this exercise.
            </p>
          )}

          {activeTab === 'subs' && directSubstitutes.map((item) => (
            <div key={item.id} className="w-full rounded-lg border border-zinc-200 overflow-hidden">
              <div className="flex items-center justify-between bg-zinc-50 px-3 py-2 border-b border-zinc-100">
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-zinc-900 truncate text-sm">{item.name}</p>
                  <p className="text-[11px] text-zinc-400">{item.workingSets || '?'} sets × {item.reps || '?'}</p>
                </div>
                <MuscleGroupBadge group={item.muscleGroup} size="xs" />
              </div>
              <div className="flex divide-x divide-zinc-100 bg-white">
                <button 
                  onClick={() => handleSelect(item, false)}
                  className="flex-1 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  For Today
                </button>
                <button 
                  onClick={() => handleSelect(item, true)}
                  className="flex-1 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                >
                  Permanently
                </button>
              </div>
            </div>
          ))}

          {activeTab === 'same-muscle' && sameMuscleSuggestions.length === 0 && (
            <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-3 py-6 text-center text-xs text-zinc-500">
              No same-muscle suggestions found.
            </p>
          )}

          {activeTab === 'same-muscle' && sameMuscleSuggestions.map((item) => (
            <div key={item.id} className="w-full rounded-lg border border-zinc-200 overflow-hidden">
              <div className="flex items-center justify-between bg-zinc-50 px-3 py-2 border-b border-zinc-100">
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-zinc-900 truncate text-sm">{item.name}</p>
                  <p className="text-[11px] text-zinc-400">{item.workingSets || '?'} sets × {item.reps || '?'}</p>
                </div>
                <MuscleGroupBadge group={item.muscleGroup} size="xs" />
              </div>
              <div className="flex divide-x divide-zinc-100 bg-white">
                <button 
                  onClick={() => handleSelect(item, false)}
                  className="flex-1 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  For Today
                </button>
                <button 
                  onClick={() => handleSelect(item, true)}
                  className="flex-1 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                >
                  Permanently
                </button>
              </div>
            </div>
          ))}

          {activeTab === 'search-all' && allSearchSuggestions.length === 0 && (
            <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-3 py-6 text-center text-xs text-zinc-500">
              No matching exercises found.
            </p>
          )}

          {activeTab === 'search-all' && allSearchSuggestions.map((item) => (
            <div key={item.id} className="w-full rounded-lg border border-zinc-200 overflow-hidden">
              <div className="flex items-center justify-between bg-zinc-50 px-3 py-2 border-b border-zinc-100">
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-zinc-900 truncate text-sm">{item.name}</p>
                  <p className="text-[11px] text-zinc-400">{item.workingSets || '?'} sets × {item.reps || '?'}</p>
                </div>
                <MuscleGroupBadge group={item.muscleGroup} size="xs" />
              </div>
              <div className="flex divide-x divide-zinc-100 bg-white">
                <button 
                  onClick={() => handleSelect(item, false)}
                  className="flex-1 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  For Today
                </button>
                <button 
                  onClick={() => handleSelect(item, true)}
                  className="flex-1 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                >
                  Permanently
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
