// Compute the plates needed PER SIDE of a barbell for a target total weight.
const PLATES = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lbs: [45, 35, 25, 10, 5, 2.5],
}
const DEFAULT_BAR = { kg: 20, lbs: 45 }

export function computePlatesPerSide(totalWeight, unit = 'kg', barWeight) {
  const total = Number(totalWeight)
  const bar = Number.isFinite(Number(barWeight)) ? Number(barWeight) : DEFAULT_BAR[unit] || 20
  if (!Number.isFinite(total) || total <= bar) return { ok: total === bar, bar, perSide: [] }

  let perSideWeight = (total - bar) / 2
  const sizes = PLATES[unit] || PLATES.kg
  const perSide = []

  for (const plate of sizes) {
    let count = 0
    while (perSideWeight + 1e-9 >= plate) {
      perSideWeight -= plate
      count += 1
    }
    if (count > 0) perSide.push({ plate, count })
  }

  // leftover that can't be matched with standard plates
  const remainder = Math.round(perSideWeight * 100) / 100
  return { ok: remainder === 0, bar, perSide, remainder }
}

export function formatPlatesPerSide(result) {
  if (!result?.perSide?.length) return null
  return result.perSide.map((p) => (p.count > 1 ? `${p.plate}×${p.count}` : `${p.plate}`)).join(' · ')
}
