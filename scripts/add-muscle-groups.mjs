import { readFileSync, writeFileSync } from 'fs'

// ── Full mapping: exerciseName → { muscleGroup, subMuscleGroup } ──
const MAPPING = {
  // CHEST
  'Bench Press':                              { muscleGroup: 'Chest', subMuscleGroup: 'Mid Chest' },
  'Larsen Press':                             { muscleGroup: 'Chest', subMuscleGroup: 'Mid Chest' },
  'DB Bench Press':                           { muscleGroup: 'Chest', subMuscleGroup: 'Mid Chest' },
  'Machine Chest Press':                      { muscleGroup: 'Chest', subMuscleGroup: 'Mid Chest' },
  'Weighted Dip':                             { muscleGroup: 'Chest', subMuscleGroup: 'Lower Chest' },
  'Incline Dumbbell Press':                   { muscleGroup: 'Chest', subMuscleGroup: 'Upper Chest' },
  'High-to-Low Cable Fly':                    { muscleGroup: 'Chest', subMuscleGroup: 'Lower Chest' },
  'Low-to-High Cable Fly':                    { muscleGroup: 'Chest', subMuscleGroup: 'Upper Chest' },
  'A1. Press-Around':                         { muscleGroup: 'Chest', subMuscleGroup: 'Mid Chest' },
  'A2. Pec Static Stretch 30s':               { muscleGroup: 'Chest', subMuscleGroup: 'Stretch' },
  'Seated Cable Fly':                         { muscleGroup: 'Chest', subMuscleGroup: 'Mid Chest' },
  'Smith Machine Incline Press':              { muscleGroup: 'Chest', subMuscleGroup: 'Upper Chest' },
  'Cable Pullover':                           { muscleGroup: 'Chest', subMuscleGroup: 'Upper Chest' },
  'Pec Deck Fly':                             { muscleGroup: 'Chest', subMuscleGroup: 'Mid Chest' },
  'High-Incline Smith Machine Press':         { muscleGroup: 'Chest', subMuscleGroup: 'Upper Chest' },
  'Low Incline DB Press':                     { muscleGroup: 'Chest', subMuscleGroup: 'Upper Chest' },
  'Med-Ball Close Grip Push Up':              { muscleGroup: 'Chest', subMuscleGroup: 'Mid Chest' },
  'Machine Pec Flye':                         { muscleGroup: 'Chest', subMuscleGroup: 'Mid Chest' },
  'Close Grip Push Up':                       { muscleGroup: 'Chest', subMuscleGroup: 'Mid Chest' },
  'Bench Press (Back Off AMRAP)':             { muscleGroup: 'Chest', subMuscleGroup: 'Mid Chest' },
  'Bench Press (Top Set)':                    { muscleGroup: 'Chest', subMuscleGroup: 'Mid Chest' },
  'Bent-Over Cable Pec Flye':                 { muscleGroup: 'Chest', subMuscleGroup: 'Mid Chest' },
  'Cable Crossover Ladder':                   { muscleGroup: 'Chest', subMuscleGroup: 'All Chest' },
  'Close-Grip Barbell Incline Press':         { muscleGroup: 'Chest', subMuscleGroup: 'Upper Chest' },
  'Diamond Push Up':                          { muscleGroup: 'Chest', subMuscleGroup: 'Mid Chest' },

  // SHOULDERS
  'Standing Dumbbell Arnold Press':           { muscleGroup: 'Shoulders', subMuscleGroup: 'Anterior Delt' },
  'Seated Dumbbell Press':                    { muscleGroup: 'Shoulders', subMuscleGroup: 'Anterior Delt' },
  'Machine Lateral Raise':                    { muscleGroup: 'Shoulders', subMuscleGroup: 'Lateral Delt' },
  'Cross-Body Cable Y-Raise (Side Delt)':     { muscleGroup: 'Shoulders', subMuscleGroup: 'Lateral Delt' },
  'Cable Lateral Raise':                      { muscleGroup: 'Shoulders', subMuscleGroup: 'Lateral Delt' },
  'Dumbbell Lateral Raise':                   { muscleGroup: 'Shoulders', subMuscleGroup: 'Lateral Delt' },
  'Dumbbell Rear Delt Fly':                   { muscleGroup: 'Shoulders', subMuscleGroup: 'Rear Delt' },
  'Cable Rear Delt Fly':                      { muscleGroup: 'Shoulders', subMuscleGroup: 'Rear Delt' },
  'Reverse Pec Deck':                         { muscleGroup: 'Shoulders', subMuscleGroup: 'Rear Delt' },
  'Face Pull':                                { muscleGroup: 'Shoulders', subMuscleGroup: 'Rear Delt' },
  'Overhead Press':                           { muscleGroup: 'Shoulders', subMuscleGroup: 'Anterior Delt' },
  'Machine Shoulder Press':                   { muscleGroup: 'Shoulders', subMuscleGroup: 'Anterior Delt' },
  'Lean-Away Cable Lateral Raise':            { muscleGroup: 'Shoulders', subMuscleGroup: 'Lateral Delt' },
  'Rope Facepull':                            { muscleGroup: 'Shoulders', subMuscleGroup: 'Rear Delt' },
  'Omni-Direction Face Pull':                 { muscleGroup: 'Shoulders', subMuscleGroup: 'Rear Delt' },
  'Constant-Tension Cable Lateral Raise':     { muscleGroup: 'Shoulders', subMuscleGroup: 'Lateral Delt' },
  'Egyptian Cable Lateral Raise':             { muscleGroup: 'Shoulders', subMuscleGroup: 'Lateral Delt' },
  'Constant Tension DB Lateral Raise':        { muscleGroup: 'Shoulders', subMuscleGroup: 'Lateral Delt' },
  'Machine Lateral Raise (+ Myoreps)':        { muscleGroup: 'Shoulders', subMuscleGroup: 'Lateral Delt' },
  'Plate Front Raise':                        { muscleGroup: 'Shoulders', subMuscleGroup: 'Anterior Delt' },
  'Machine Shrug':                            { muscleGroup: 'Shoulders', subMuscleGroup: 'Traps' },
  'Seated DB Shoulder Press':                 { muscleGroup: 'Shoulders', subMuscleGroup: 'Anterior Delt' },
  'Lean-In Constant Tension DB Lateral Raise': { muscleGroup: 'Shoulders', subMuscleGroup: 'Lateral Delt' },
  'Cable Lateral Raise, Constant Tension':    { muscleGroup: 'Shoulders', subMuscleGroup: 'Lateral Delt' },
  'A1: Lean-In Constant Tension DB Lateral Raise': { muscleGroup: 'Shoulders', subMuscleGroup: 'Lateral Delt' },
  'A2: Side Delt Static Stretch (30s)':       { muscleGroup: 'Shoulders', subMuscleGroup: 'Stretch' },
  'Cable Shrug-In':                           { muscleGroup: 'Shoulders', subMuscleGroup: 'Traps' },
  'Eccentric-Accentuated Cable Lateral Raise, Constant-Tension Cable Lateral Raise': { muscleGroup: 'Shoulders', subMuscleGroup: 'Lateral Delt' },

  // TRICEPS
  'Triceps Pressdown':                        { muscleGroup: 'Triceps', subMuscleGroup: 'Lateral Head' },
  'Overhead Triceps Extension':               { muscleGroup: 'Triceps', subMuscleGroup: 'Long Head' },
  'Squeeze-Only Triceps Pressdown + Stretch-Only Overhead Triceps Extension': { muscleGroup: 'Triceps', subMuscleGroup: 'All Heads' },
  'Cable Overhead Triceps Extension':         { muscleGroup: 'Triceps', subMuscleGroup: 'Long Head' },
  'Skull Crusher':                            { muscleGroup: 'Triceps', subMuscleGroup: 'Long Head' },
  'Close-Grip Bench Press':                   { muscleGroup: 'Triceps', subMuscleGroup: 'All Heads' },
  'EZ Bar Skull Crusher':                     { muscleGroup: 'Triceps', subMuscleGroup: 'Long Head' },
  '1-Arm Bottom-Half Overhead Cable Tricep Extension': { muscleGroup: 'Triceps', subMuscleGroup: 'Long Head' },
  'N1-Style Cross-Body Triceps Extension':    { muscleGroup: 'Triceps', subMuscleGroup: 'Lateral Head' },
  'Floor Skull Crusher (Heavy)':              { muscleGroup: 'Triceps', subMuscleGroup: 'Long Head' },
  'Tricep Dip':                               { muscleGroup: 'Triceps', subMuscleGroup: 'All Heads' },
  '1-Arm Bottom-Half Overhead Cable Tricep Extensions': { muscleGroup: 'Triceps', subMuscleGroup: 'Long Head' },
  'Cable Triceps Kickback':                   { muscleGroup: 'Triceps', subMuscleGroup: 'All Heads' },
  'Overhead Cable Triceps Extension':         { muscleGroup: 'Triceps', subMuscleGroup: 'Long Head' },

  // BACK
  'Wide-Grip Pull-Up':                        { muscleGroup: 'Back', subMuscleGroup: 'Upper Lats' },
  'Wide-Grip Cable Row':                      { muscleGroup: 'Back', subMuscleGroup: 'Upper Back' },
  'Lat Pulldown':                             { muscleGroup: 'Back', subMuscleGroup: 'Lats' },
  'Chest-Supported Row':                      { muscleGroup: 'Back', subMuscleGroup: 'Mid Back' },
  'Single-Arm Cable Row':                     { muscleGroup: 'Back', subMuscleGroup: 'Lats' },
  'Barbell Row':                              { muscleGroup: 'Back', subMuscleGroup: 'Mid Back' },
  'Seated Cable Row':                         { muscleGroup: 'Back', subMuscleGroup: 'Mid Back' },
  'Straight-Arm Pulldown':                    { muscleGroup: 'Back', subMuscleGroup: 'Lats' },
  'T-Bar Row':                                { muscleGroup: 'Back', subMuscleGroup: 'Mid Back' },
  'Dumbbell Row':                             { muscleGroup: 'Back', subMuscleGroup: 'Lats' },
  'Cable Pulldown':                           { muscleGroup: 'Back', subMuscleGroup: 'Lats' },
  'Close-Grip Lat Pulldown':                  { muscleGroup: 'Back', subMuscleGroup: 'Lower Lats' },
  'Machine Row':                              { muscleGroup: 'Back', subMuscleGroup: 'Mid Back' },
  'Pulldown Pullover':                        { muscleGroup: 'Back', subMuscleGroup: 'Lats' },
  'Pull-Up':                                  { muscleGroup: 'Back', subMuscleGroup: 'Lats' },
  'Lat Pulldown (Feeder Sets)':               { muscleGroup: 'Back', subMuscleGroup: 'Lats' },
  'Lat Pulldown (Failure Set)':               { muscleGroup: 'Back', subMuscleGroup: 'Lats' },
  'Omni-Grip Machine Chest-Supported Row':    { muscleGroup: 'Back', subMuscleGroup: 'Mid Back' },
  'A1. Bottom-Half DB Lat Pullover':          { muscleGroup: 'Back', subMuscleGroup: 'Lats' },
  'A2. Lat Static Stretch 30s':               { muscleGroup: 'Back', subMuscleGroup: 'Stretch' },
  'SLOW Barbell Row (3 up, 3 down)':          { muscleGroup: 'Back', subMuscleGroup: 'Mid Back' },
  'Neutral-Grip Lat Pulldown':                { muscleGroup: 'Back', subMuscleGroup: 'Lats' },
  'Omni-Grip Lat Pulldown':                   { muscleGroup: 'Back', subMuscleGroup: 'Lats' },
  'Kneeling Lat Pulldown':                    { muscleGroup: 'Back', subMuscleGroup: 'Lats' },
  'Machine Low Row':                          { muscleGroup: 'Back', subMuscleGroup: 'Lower Lats' },
  'Kroc Row':                                 { muscleGroup: 'Back', subMuscleGroup: 'Lats' },
  'Pendlay Row':                              { muscleGroup: 'Back', subMuscleGroup: 'Mid Back' },
  'Pull-Up (1 AMRAP set)':                    { muscleGroup: 'Back', subMuscleGroup: 'Lats' },
  'Wide-Grip Pull-Up (1 AMRAP set)':          { muscleGroup: 'Back', subMuscleGroup: 'Upper Lats' },
  '1-Arm Half Kneeling Lat Pulldown':         { muscleGroup: 'Back', subMuscleGroup: 'Lats' },
  '1-Arm Half-Kneeling Lat Pulldown':         { muscleGroup: 'Back', subMuscleGroup: 'Lats' },
  'Close-Grip Seated Cable Row':              { muscleGroup: 'Back', subMuscleGroup: 'Mid Back' },

  // BICEPS
  'Incline Dumbbell Curl':                    { muscleGroup: 'Biceps', subMuscleGroup: 'Long Head' },
  'Preacher Curl':                            { muscleGroup: 'Biceps', subMuscleGroup: 'Short Head' },
  'Cable Curl':                               { muscleGroup: 'Biceps', subMuscleGroup: 'All Heads' },
  'Bayesian Cable Curl':                      { muscleGroup: 'Biceps', subMuscleGroup: 'Long Head' },
  'EZ Bar Preacher Curl':                     { muscleGroup: 'Biceps', subMuscleGroup: 'Short Head' },
  'Hammer Curl':                              { muscleGroup: 'Biceps', subMuscleGroup: 'Brachialis' },
  'Cross-Body Hammer Curl':                   { muscleGroup: 'Biceps', subMuscleGroup: 'Brachialis' },
  'Spider Curl':                              { muscleGroup: 'Biceps', subMuscleGroup: 'Short Head' },
  'Barbell Curl':                             { muscleGroup: 'Biceps', subMuscleGroup: 'All Heads' },
  'Dumbbell Curl':                            { muscleGroup: 'Biceps', subMuscleGroup: 'All Heads' },
  'Machine Preacher Curl':                    { muscleGroup: 'Biceps', subMuscleGroup: 'Short Head' },
  'Supinated Dumbbell Curl':                  { muscleGroup: 'Biceps', subMuscleGroup: 'Short Head' },
  'Behind-Body Cable Curl':                   { muscleGroup: 'Biceps', subMuscleGroup: 'Long Head' },
  'Overhand Barbell Curl':                    { muscleGroup: 'Biceps', subMuscleGroup: 'Brachioradialis' },
  'Alternated Bicep 21\'s':                   { muscleGroup: 'Biceps', subMuscleGroup: 'All Heads' },
  'Single-Arm Machine Preacher Curl':         { muscleGroup: 'Biceps', subMuscleGroup: 'Short Head' },
  'N1-Style Cross-Body Cable Bicep Curl':     { muscleGroup: 'Biceps', subMuscleGroup: 'Short Head' },
  'Hammer Cheat Curl':                        { muscleGroup: 'Biceps', subMuscleGroup: 'Brachialis' },
  'EZ Bar Spider Curl':                       { muscleGroup: 'Biceps', subMuscleGroup: 'Short Head' },
  '1-Arm DB Preacher Curl':                   { muscleGroup: 'Biceps', subMuscleGroup: 'Short Head' },
  'A1: EZ-Bar Modified Bicep 21\'s':          { muscleGroup: 'Biceps', subMuscleGroup: 'All Heads' },
  'A2: Bicep Static Stretch (30s)':           { muscleGroup: 'Biceps', subMuscleGroup: 'Stretch' },
  'Alternating DB Curl':                      { muscleGroup: 'Biceps', subMuscleGroup: 'All Heads' },
  'Bottom-Half Preacher Curl':                { muscleGroup: 'Biceps', subMuscleGroup: 'Short Head' },
  'EZ-Bar Curl':                              { muscleGroup: 'Biceps', subMuscleGroup: 'All Heads' },
  'EZ-Bar Curl (Heavy)':                      { muscleGroup: 'Biceps', subMuscleGroup: 'All Heads' },

  // LEGS (Quads, Hamstrings, Glutes, Calves)
  'Squat':                                    { muscleGroup: 'Legs', subMuscleGroup: 'Quads' },
  'Leg Press':                                { muscleGroup: 'Legs', subMuscleGroup: 'Quads' },
  'Hack Squat':                               { muscleGroup: 'Legs', subMuscleGroup: 'Quads' },
  'Walking Lunge':                            { muscleGroup: 'Legs', subMuscleGroup: 'Quads' },
  'Leg Extension':                            { muscleGroup: 'Legs', subMuscleGroup: 'Quads' },
  'Bulgarian Split Squat':                    { muscleGroup: 'Legs', subMuscleGroup: 'Quads' },
  'Front Squat':                              { muscleGroup: 'Legs', subMuscleGroup: 'Quads' },
  'Goblet Squat':                             { muscleGroup: 'Legs', subMuscleGroup: 'Quads' },
  'Smith Machine Squat':                      { muscleGroup: 'Legs', subMuscleGroup: 'Quads' },
  'Pause Squat (Back off)':                   { muscleGroup: 'Legs', subMuscleGroup: 'Quads' },
  'Squat or Machine Squat':                   { muscleGroup: 'Legs', subMuscleGroup: 'Quads' },
  'Slow-Eccentric Leg Extension':             { muscleGroup: 'Legs', subMuscleGroup: 'Quads' },
  'Leg Press (Close Stance)':                 { muscleGroup: 'Legs', subMuscleGroup: 'Quads' },
  'Dumbbell Walking Lunge':                   { muscleGroup: 'Legs', subMuscleGroup: 'Quads' },
  
  'Stiff-Leg Deadlift':                       { muscleGroup: 'Legs', subMuscleGroup: 'Hamstrings' },
  'Seated Leg Curl':                          { muscleGroup: 'Legs', subMuscleGroup: 'Hamstrings' },
  'Lying Leg Curl':                           { muscleGroup: 'Legs', subMuscleGroup: 'Hamstrings' },
  'Romanian Deadlift':                        { muscleGroup: 'Legs', subMuscleGroup: 'Hamstrings' },
  'Single-Leg Leg Curl':                      { muscleGroup: 'Legs', subMuscleGroup: 'Hamstrings' },
  'Good Morning':                             { muscleGroup: 'Legs', subMuscleGroup: 'Hamstrings' },
  'Nordic Curl':                              { muscleGroup: 'Legs', subMuscleGroup: 'Hamstrings' },
  'Slow Seated Leg Curl (3 up, 3 down)':      { muscleGroup: 'Legs', subMuscleGroup: 'Hamstrings' },
  'Barbell RDL':                              { muscleGroup: 'Legs', subMuscleGroup: 'Hamstrings' },
  'Dumbbell RDL':                             { muscleGroup: 'Legs', subMuscleGroup: 'Hamstrings' },
  'Deadlift':                                 { muscleGroup: 'Legs', subMuscleGroup: 'Hamstrings' },

  'Hip Thrust':                               { muscleGroup: 'Legs', subMuscleGroup: 'Glutes' },
  'Cable Pull-Through':                       { muscleGroup: 'Legs', subMuscleGroup: 'Glutes' },
  'Glute-Ham Raise':                          { muscleGroup: 'Legs', subMuscleGroup: 'Glutes' },
  'Hip Abduction Machine':                    { muscleGroup: 'Legs', subMuscleGroup: 'Glutes' },
  'Glute Ham Raise':                          { muscleGroup: 'Legs', subMuscleGroup: 'Glutes' },
  
  'Standing Calf Raise':                      { muscleGroup: 'Legs', subMuscleGroup: 'Calves' },
  'Seated Calf Raise':                        { muscleGroup: 'Legs', subMuscleGroup: 'Calves' },
  'Leg Press Calf Raise':                     { muscleGroup: 'Legs', subMuscleGroup: 'Calves' },
  'A1. Standing Calf Raise + A2. Calf Stretch (30s)': { muscleGroup: 'Legs', subMuscleGroup: 'Calves' },
  'Leg Press Toe Press':                      { muscleGroup: 'Legs', subMuscleGroup: 'Calves' },
  'A1. Seated Calf Raise + A2. Calf Stretch (30s)': { muscleGroup: 'Legs', subMuscleGroup: 'Calves' },

  // CORE
  'LLPT Planks (Back Off AMRAP)':             { muscleGroup: 'Core', subMuscleGroup: 'Transverse Abs' },
  'Decline Crunch':                           { muscleGroup: 'Core', subMuscleGroup: 'Upper Abs' },
  'Hanging Leg Raise':                        { muscleGroup: 'Core', subMuscleGroup: 'Lower Abs' },
  'Cable Crunch':                             { muscleGroup: 'Core', subMuscleGroup: 'Upper Abs' },
  'Ab Wheel Rollout':                         { muscleGroup: 'Core', subMuscleGroup: 'All Abs' },
  'Pallof Press':                             { muscleGroup: 'Core', subMuscleGroup: 'Obliques' },
  'Corpse Crunch':                            { muscleGroup: 'Core', subMuscleGroup: 'Upper Abs' },
  'Roman Chair Leg Raise':                    { muscleGroup: 'Core', subMuscleGroup: 'Lower Abs' },
  'LLPT Plank':                               { muscleGroup: 'Core', subMuscleGroup: 'Transverse Abs' },
  'Decline Plate-Weighted Crunch':            { muscleGroup: 'Core', subMuscleGroup: 'Upper Abs' },
}

// ── Run ──
const filePath = './src/data/program.json'
const data = JSON.parse(readFileSync(filePath, 'utf8'))

let mapped = 0
let unmapped = 0
const unmappedNames = []

data.phases.forEach(phase => {
  phase.weeks.forEach(week => {
    week.days.forEach(day => {
      day.exercises.forEach(ex => {
        const entry = MAPPING[ex.name]
        if (entry) {
          ex.muscleGroup = entry.muscleGroup
          ex.subMuscleGroup = entry.subMuscleGroup
          mapped++
        } else {
          unmapped++
          if (!unmappedNames.includes(ex.name)) unmappedNames.push(ex.name)
        }
      })
    })
  })
})

writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')

console.log(`✅ Mapped: ${mapped} exercise instances`)
console.log(`❌ Unmapped: ${unmapped} instances`)
if (unmappedNames.length) {
  console.log('Unmapped exercises:')
  unmappedNames.forEach(n => console.log('  -', JSON.stringify(n)))
}
