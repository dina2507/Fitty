import { readFileSync } from 'fs'

const data = JSON.parse(readFileSync('./src/data/program.json', 'utf8'))
const names = new Set()
data.phases.forEach(ph => ph.weeks.forEach(w => w.days.forEach(d => d.exercises.forEach(e => {
  if (!e.muscleGroup) names.add(e.name)
}))))

console.log(JSON.stringify([...names].sort(), null, 2))
