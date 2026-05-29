import { storage } from '../../utils/storage'
import { BUILT_IN_PROGRAM_ID } from '../helpers'

// ── id helpers ──
const genId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

const newExerciseTemplate = (overrides = {}) => ({
  id: genId('ex'),
  name: '',
  muscleGroup: '',
  subMuscleGroup: '',
  workingSets: 3,
  reps: '8-12',
  rpe: '8',
  rest: '~2 min',
  warmupSets: '0',
  notes: '',
  sub1: '',
  sub2: '',
  ...overrides,
})

const newDay = (label = 'Day 1', exercises = []) => ({
  id: genId('day'),
  label,
  exercises,
})

const newPlan = (name = 'New Plan', days) => {
  const now = new Date().toISOString()
  return {
    id: genId('plan'),
    kind: 'simple',
    source: 'user',
    name: String(name || 'New Plan').trim() || 'New Plan',
    createdAt: now,
    updatedAt: now,
    days: days && days.length ? days : [newDay()],
  }
}

// Flatten a periodized program into a list of simple, unique-labelled days
// (used when cloning the built-in Dina PPL into an editable plan).
function flattenPeriodizedToDays(program) {
  const seen = new Set()
  const days = []
  const firstPhase = program?.phases?.[0]
  const firstWeek = firstPhase?.weeks?.[0]
  ;(firstWeek?.days || []).forEach((day) => {
    if (day?.isRest) return
    const label = day.label || `Day ${days.length + 1}`
    if (seen.has(label)) return
    seen.add(label)
    days.push(newDay(label, (day.exercises || []).map((ex) => newExerciseTemplate({
      name: ex.name || '',
      muscleGroup: ex.muscleGroup || '',
      subMuscleGroup: ex.subMuscleGroup || '',
      workingSets: ex.workingSets || 3,
      reps: ex.reps || '8-12',
      rpe: ex.rpe || '8',
      rest: ex.rest || '~2 min',
      warmupSets: ex.warmupSets || '0',
      notes: ex.notes || '',
      sub1: ex.sub1 || '',
      sub2: ex.sub2 || '',
    }))))
  })
  return days.length ? days : [newDay()]
}

export const createPlansSlice = (set, get) => ({
  userPlans: [],
  activePlanId: BUILT_IN_PROGRAM_ID,
  activePlanDayId: null,

  // Persist + update state in one shot
  _commitUserPlans: (plans) => {
    storage.saveUserPlans(plans)
    set({ userPlans: plans })
  },

  // Unified, UI-facing plan list: built-in periodized program + imported + user simple plans
  getPlans: () => {
    const state = get()
    const periodized = (state.programLibrary || []).map((entry) => ({
      id: entry.id,
      kind: 'periodized',
      source: entry.source,
      name: entry.id === BUILT_IN_PROGRAM_ID
        ? (state.planDisplayName || entry.name || 'Dina PPL')
        : entry.name,
      dayCount: (entry.program?.phases?.[0]?.weeks?.[0]?.days || []).filter((d) => !d?.isRest).length,
      program: entry.program,
    }))
    const simple = (state.userPlans || []).map((p) => ({
      id: p.id,
      kind: 'simple',
      source: 'user',
      name: p.name,
      dayCount: (p.days || []).length,
      plan: p,
    }))
    return [...periodized, ...simple]
  },

  getUserPlan: (planId) => (get().userPlans || []).find((p) => p.id === planId) || null,

  // Set which plan/day the user is currently logging against.
  setActivePlan: (planId, dayId = null) => {
    storage.saveActivePlanId(planId)
    storage.saveActivePlanDayId(dayId)
    set({ activePlanId: planId, activePlanDayId: dayId })
  },

  // Returns the normalized session to log against, for either plan kind.
  // { kind, planId, planDayId, label, exercises, isRest }
  getActiveSession: () => {
    const state = get()
    const planId = state.activePlanId
    const simple = (state.userPlans || []).find((p) => p.id === planId)

    if (simple) {
      const day = (simple.days || []).find((d) => d.id === state.activePlanDayId)
        || (simple.days || [])[0]
        || null
      return {
        kind: 'simple',
        planId: simple.id,
        planName: simple.name,
        planDayId: day?.id || null,
        label: day?.label || simple.name,
        exercises: day?.exercises || [],
        isRest: false,
      }
    }

    // Periodized (Dina PPL / imported) — defer to existing program machinery
    const day = get().getCurrentDay()
    return {
      kind: 'periodized',
      planId: planId || BUILT_IN_PROGRAM_ID,
      planName: state.planDisplayName || 'Dina PPL',
      planDayId: day ? `${state.currentPhaseId}_w${state.currentWeek}_d${day.dayIndex}` : null,
      label: day?.label || 'Workout',
      exercises: day?.exercises || [],
      isRest: Boolean(day?.isRest),
    }
  },

  // ── CRUD: plans ──
  createPlan: (name) => {
    const plan = newPlan(name)
    get()._commitUserPlans([...(get().userPlans || []), plan])
    return plan.id
  },

  clonePlan: (sourcePlanId, name) => {
    const state = get()
    const userSource = (state.userPlans || []).find((p) => p.id === sourcePlanId)
    let days
    let baseName
    if (userSource) {
      baseName = name || `${userSource.name} (copy)`
      days = (userSource.days || []).map((d) => newDay(
        d.label,
        (d.exercises || []).map((ex) => newExerciseTemplate({ ...ex, id: genId('ex') })),
      ))
    } else {
      // periodized source (built-in / imported)
      const entry = (state.programLibrary || []).find((e) => e.id === sourcePlanId)
      if (!entry) return null
      baseName = name || `${entry.id === BUILT_IN_PROGRAM_ID ? (state.planDisplayName || entry.name) : entry.name} (editable)`
      days = flattenPeriodizedToDays(entry.program)
    }
    const plan = newPlan(baseName, days)
    get()._commitUserPlans([...(state.userPlans || []), plan])
    return plan.id
  },

  deletePlan: (planId) => {
    const state = get()
    const next = (state.userPlans || []).filter((p) => p.id !== planId)
    get()._commitUserPlans(next)
    if (state.activePlanId === planId) {
      get().setActivePlan(BUILT_IN_PROGRAM_ID, null)
    }
  },

  renamePlan: (planId, name) => {
    const next = (get().userPlans || []).map((p) =>
      p.id === planId ? { ...p, name: String(name || '').trim() || p.name, updatedAt: new Date().toISOString() } : p)
    get()._commitUserPlans(next)
  },

  // ── CRUD: days ──
  _updatePlan: (planId, updater) => {
    const next = (get().userPlans || []).map((p) =>
      p.id === planId ? { ...updater(p), updatedAt: new Date().toISOString() } : p)
    get()._commitUserPlans(next)
  },

  addPlanDay: (planId, label) => {
    let createdId = null
    get()._updatePlan(planId, (p) => {
      const day = newDay(label || `Day ${(p.days || []).length + 1}`)
      createdId = day.id
      return { ...p, days: [...(p.days || []), day] }
    })
    return createdId
  },

  removePlanDay: (planId, dayId) => {
    get()._updatePlan(planId, (p) => ({ ...p, days: (p.days || []).filter((d) => d.id !== dayId) }))
  },

  renamePlanDay: (planId, dayId, label) => {
    get()._updatePlan(planId, (p) => ({
      ...p,
      days: (p.days || []).map((d) => d.id === dayId ? { ...d, label: String(label || '').trim() || d.label } : d),
    }))
  },

  reorderPlanDays: (planId, fromIndex, toIndex) => {
    get()._updatePlan(planId, (p) => {
      const days = [...(p.days || [])]
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= days.length || toIndex >= days.length) return p
      const [moved] = days.splice(fromIndex, 1)
      days.splice(toIndex, 0, moved)
      return { ...p, days }
    })
  },

  // ── CRUD: exercises within a day ──
  addExerciseToDay: (planId, dayId, exercise) => {
    get()._updatePlan(planId, (p) => ({
      ...p,
      days: (p.days || []).map((d) => d.id === dayId
        ? { ...d, exercises: [...(d.exercises || []), newExerciseTemplate(exercise || {})] }
        : d),
    }))
  },

  updateExerciseInDay: (planId, dayId, exId, patch) => {
    get()._updatePlan(planId, (p) => ({
      ...p,
      days: (p.days || []).map((d) => d.id === dayId
        ? { ...d, exercises: (d.exercises || []).map((ex) => ex.id === exId ? { ...ex, ...patch } : ex) }
        : d),
    }))
  },

  removeExerciseFromDay: (planId, dayId, exId) => {
    get()._updatePlan(planId, (p) => ({
      ...p,
      days: (p.days || []).map((d) => d.id === dayId
        ? { ...d, exercises: (d.exercises || []).filter((ex) => ex.id !== exId) }
        : d),
    }))
  },

  reorderExercises: (planId, dayId, fromIndex, toIndex) => {
    get()._updatePlan(planId, (p) => ({
      ...p,
      days: (p.days || []).map((d) => {
        if (d.id !== dayId) return d
        const exercises = [...(d.exercises || [])]
        if (fromIndex < 0 || toIndex < 0 || fromIndex >= exercises.length || toIndex >= exercises.length) return d
        const [moved] = exercises.splice(fromIndex, 1)
        exercises.splice(toIndex, 0, moved)
        return { ...d, exercises }
      }),
    }))
  },
})
