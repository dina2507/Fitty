function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function roundToNearest(value, increment = 2.5) {
  if (!Number.isFinite(value)) return 0
  return Math.round(value / increment) * increment
}

function parseBaseReps(repsValue) {
  const parsed = String(repsValue || '').match(/\d+/)
  const firstNumber = parsed ? Number(parsed[0]) : NaN
  if (!Number.isFinite(firstNumber) || firstNumber <= 0) return 8
  return firstNumber
}

export function parseWarmupSetCount(rawWarmupSets) {
  if (rawWarmupSets === null || rawWarmupSets === undefined) return 3

  const normalized = String(rawWarmupSets).trim()
  if (!normalized) return 3

  const leading = normalized.match(/\d+/)
  const parsed = leading ? Number(leading[0]) : NaN
  if (!Number.isFinite(parsed)) return 3

  return clamp(parsed, 0, 3)
}

function buildWarmupTemplate(warmupSetCount, workingReps) {
  const topReps = parseBaseReps(workingReps)
  const midReps = Math.max(1, topReps - 3)
  const lowReps = Math.max(1, topReps - 5)

  if (warmupSetCount <= 0) return []
  if (warmupSetCount === 1) {
    return [{ percent: 0.6, reps: topReps }]
  }
  if (warmupSetCount === 2) {
    return [
      { percent: 0.5, reps: topReps },
      { percent: 0.7, reps: midReps },
    ]
  }

  return [
    { percent: 0.45, reps: topReps },
    { percent: 0.65, reps: midReps },
    { percent: 0.85, reps: lowReps },
  ]
}

export function generateWarmupSets(workingWeight, unit = 'kg', options = {}) {
  const parsed = Number(workingWeight)
  if (!Number.isFinite(parsed) || parsed <= 0) return []

  const { warmupSets: rawWarmupSets, workingReps } = options
  const warmupSetCount = parseWarmupSetCount(rawWarmupSets)
  if (warmupSetCount <= 0) return []

  const minStep = unit === 'lbs' ? 5 : 2.5
  const normalized = Math.max(minStep, roundToNearest(parsed, minStep))

  const template = buildWarmupTemplate(warmupSetCount, workingReps)

  return template
    .map((step, idx) => {
      const raw = normalized * step.percent
      const rounded = roundToNearest(raw, minStep)
      const weight = clamp(rounded, minStep, normalized)

      return {
        id: `warmup_${idx + 1}`,
        label: `Warm-up ${idx + 1}`,
        weight,
        reps: step.reps,
        percent: Math.round(step.percent * 100),
      }
    })
    .filter((step, idx, arr) => idx === 0 || step.weight > arr[idx - 1].weight)
}

export function getWarmupReferenceWeight(firstSetWeight, previousWeight) {
  const first = Number(firstSetWeight)
  if (Number.isFinite(first) && first > 0) return first

  const prev = Number(previousWeight)
  if (Number.isFinite(prev) && prev > 0) return prev

  return null
}
