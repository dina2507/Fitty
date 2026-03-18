/**
 * Calculates Estimated 1-Rep Max (1RM) using the Epley formula:
 * 1RM = weight * (1 + (reps / 30))
 * 
 * Works best for rep ranges between 1 and 10.
 */
export function calculate1RM(weight, reps) {
  const w = parseFloat(weight)
  const r = parseInt(reps)
  if (isNaN(w) || isNaN(r) || r < 1 || w <= 0) return 0
  if (r === 1) return w
  
  // Epley formula
  const epleyRm = w * (1 + (r / 30))
  // Round to nearest 2.5kg or 1kg based on preference, here rounding to 1 decimal place typically.
  return Math.round(epleyRm * 10) / 10
}
