function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function roundToNearest(value, increment = 2.5) {
  if (!Number.isFinite(value)) return 0
  return Math.round(value / increment) * increment
}

export function generateWarmupSets(workingWeight, unit = 'kg') {
  const parsed = Number(workingWeight)
  if (!Number.isFinite(parsed) || parsed <= 0) return []

  const minStep = unit === 'lbs' ? 5 : 2.5
  const normalized = Math.max(minStep, roundToNearest(parsed, minStep))

  const template = [
    { percent: 0.45, reps: 8 },
    { percent: 0.6, reps: 5 },
    { percent: 0.75, reps: 3 },
    { percent: 0.85, reps: 1 },
  ]

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
