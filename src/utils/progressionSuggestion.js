function parseRepTop(repRange) {
  if (!repRange || typeof repRange !== 'string') return null
  const matches = repRange.match(/\d+/g)
  if (!matches || matches.length === 0) return null
  return Math.max(...matches.map((value) => Number(value)).filter((value) => Number.isFinite(value)))
}

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function getTopSetFromEntry(entry) {
  if (!entry) return null

  if (entry.topSet) {
    const weight = toNumber(entry.topSet.weight)
    const reps = toNumber(entry.topSet.reps)
    const rpe = toNumber(entry.topSet.rpe)
    if (!weight || !reps) return null
    return { weight, reps, rpe }
  }

  const sets = Array.isArray(entry.sets) ? entry.sets : []
  let best = null

  sets.forEach((set) => {
    const weight = toNumber(set.weight)
    const reps = toNumber(set.reps)
    const rpe = toNumber(set.rpe)
    if (!weight || !reps) return

    if (!best || weight > best.weight || (weight === best.weight && reps > best.reps)) {
      best = { weight, reps, rpe }
    }
  })

  return best
}

function getLoadIncrement(bodyPart) {
  const lowerBodyGroups = ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Legs', 'Lower Body']
  return lowerBodyGroups.includes(bodyPart) ? 5 : 2.5
}

function formatRpeValue(value) {
  if (!Number.isFinite(value)) return 'n/a'
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(1)
}

export function getProgressionSuggestion(exerciseHistory, repRange, bodyPart) {
  const history = Array.isArray(exerciseHistory) ? exerciseHistory : []

  if (history.length < 2) {
    return {
      suggest: false,
      message: '',
      recommendedWeight: null,
    }
  }

  const lastSession = getTopSetFromEntry(history[0])
  const previousSession = getTopSetFromEntry(history[1])

  if (!lastSession || !previousSession) {
    return {
      suggest: false,
      message: '',
      recommendedWeight: null,
    }
  }

  const topRep = parseRepTop(repRange)
  if (!topRep) {
    return {
      suggest: false,
      message: '',
      recommendedWeight: null,
    }
  }

  const hitTop = lastSession.reps >= topRep
  const rpe = lastSession.rpe

  if (!hitTop) {
    return {
      suggest: true,
      message: `Hold ${lastSession.weight}kg and aim for ${topRep} reps before increasing load.`,
      recommendedWeight: lastSession.weight,
    }
  }

  if (Number.isFinite(rpe) && rpe <= 8) {
    const increment = getLoadIncrement(bodyPart)
    const recommendedWeight = Number((lastSession.weight + increment).toFixed(1))

    return {
      suggest: true,
      message: `Try ${recommendedWeight}kg today - you hit ${lastSession.weight}kg x ${lastSession.reps} at RPE ${formatRpeValue(rpe)} last session.`,
      recommendedWeight,
    }
  }

  return {
    suggest: true,
    message: `Keep ${lastSession.weight}kg and push for extra reps (last session ${lastSession.reps} reps at RPE ${formatRpeValue(rpe)}).`,
    recommendedWeight: lastSession.weight,
  }
}
