const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25]
const LBS_PLATES = [45, 35, 25, 10, 5, 2.5]

function roundToIncrement(value, increment) {
  return Math.round(value / increment) * increment
}

function getConfig(unit) {
  if (unit === 'lbs') {
    return {
      barWeight: 45,
      increment: 5,
      plates: LBS_PLATES,
      label: 'lb',
    }
  }

  return {
    barWeight: 20,
    increment: 2.5,
    plates: KG_PLATES,
    label: 'kg',
  }
}

export function calculatePlateBreakdown(targetWeight, unit = 'kg', customBarWeight) {
  const config = getConfig(unit)
  const barWeight = Number.isFinite(Number(customBarWeight))
    ? Number(customBarWeight)
    : config.barWeight

  const normalizedTarget = roundToIncrement(Number(targetWeight), config.increment)
  if (!Number.isFinite(normalizedTarget) || normalizedTarget <= 0) {
    return {
      valid: false,
      reason: 'Enter a valid target weight.',
      unit: config.label,
      barWeight,
      targetWeight: 0,
      perSide: 0,
      platesPerSide: [],
      achievedTotal: barWeight,
      remainder: 0,
    }
  }

  if (normalizedTarget < barWeight) {
    return {
      valid: false,
      reason: `Target must be at least bar weight (${barWeight}${config.label}).`,
      unit: config.label,
      barWeight,
      targetWeight: normalizedTarget,
      perSide: 0,
      platesPerSide: [],
      achievedTotal: barWeight,
      remainder: 0,
    }
  }

  let perSide = (normalizedTarget - barWeight) / 2
  let remaining = perSide
  const platesPerSide = []

  config.plates.forEach((plate) => {
    const count = Math.floor((remaining + 0.0001) / plate)
    if (count > 0) {
      platesPerSide.push({
        plate,
        count,
      })
      remaining -= count * plate
    }
  })

  remaining = Math.max(0, Number(remaining.toFixed(2)))

  const loadedPerSide = platesPerSide.reduce((sum, row) => sum + row.plate * row.count, 0)
  const achievedTotal = Number((barWeight + loadedPerSide * 2).toFixed(2))

  return {
    valid: true,
    reason: '',
    unit: config.label,
    barWeight,
    targetWeight: normalizedTarget,
    perSide,
    platesPerSide,
    achievedTotal,
    remainder: remaining,
  }
}
