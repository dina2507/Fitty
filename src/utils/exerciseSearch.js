// Forgiving exercise search: case-insensitive, word-order independent, and
// matches across the exercise name, its aliases/substitutes, and muscle group.
// Every whitespace-separated token in the query must appear somewhere in the
// searchable text, so "press incline", "incline press", and "inc press" all
// match "Incline Bench Press".

function searchableText(ex) {
  return [
    ex?.name,
    ex?.muscleGroup,
    ex?.subMuscleGroup,
    ex?.sub1,
    ex?.sub2,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function matchExercise(ex, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return true
  const tokens = q.split(/\s+/).filter(Boolean)
  const text = searchableText(ex)
  return tokens.every((t) => text.includes(t))
}

export function searchExercises(list, query, limit = 50) {
  const q = String(query || '').trim().toLowerCase()
  const items = Array.isArray(list) ? list : []
  if (!q) return items.slice(0, limit)

  const tokens = q.split(/\s+/).filter(Boolean)
  // Rank: name-prefix > name-includes > other-field match.
  const scored = []
  for (const ex of items) {
    if (!matchExercise(ex, q)) continue
    const name = String(ex?.name || '').toLowerCase()
    let score = 0
    if (name.startsWith(q)) score += 100
    if (name.includes(q)) score += 40
    score += tokens.reduce((acc, t) => acc + (name.includes(t) ? 5 : 0), 0)
    scored.push({ ex, score })
  }
  scored.sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name))
  return scored.slice(0, limit).map((s) => s.ex)
}
