// Script to add muscleGroup field to every exercise in program.json
// Run with: node scripts/add-muscle-groups.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mapping: exercise name → muscle group
const EXERCISE_MUSCLE_MAP = {
  // CHEST
  'Bench Press': 'Chest',
  'Bench Press (Top Set)': 'Chest',
  'Bench Press (Back Off AMRAP)': 'Chest',
  'Larsen Press': 'Chest',
  'Close-Grip Barbell Incline Press': 'Chest',
  'High-Incline Smith Machine Press': 'Chest',
  'Low Incline DB Press': 'Chest',
  'A1. Press-Around': 'Chest',
  'Bent-Over Cable Pec Flye': 'Chest',
  'Cable Crossover Ladder': 'Chest',
  'Diamond Push Up': 'Chest',
  'Med-Ball Close Grip Push Up': 'Chest',
  'Weighted Dip': 'Chest',
  'A2. Pec Static Stretch 30s': 'Chest',

  // SHOULDERS
  'Standing Dumbbell Arnold Press': 'Shoulders',
  'Machine Shoulder Press': 'Shoulders',
  'Seated DB Shoulder Press': 'Shoulders',
  'Cross-Body Cable Y-Raise (Side Delt)': 'Shoulders',
  'Eccentric-Accentuated Cable Lateral Raise, Constant-Tension Cable Lateral Raise': 'Shoulders',
  'Plate Front Raise': 'Shoulders',
  'Egyptian Cable Lateral Raise': 'Shoulders',
  'Machine Lateral Raise': 'Shoulders',
  'Machine Lateral Raise (+ Myoreps)': 'Shoulders',
  'A1: Lean-In Constant Tension DB Lateral Raise': 'Shoulders',
  'A2: Side Delt Static Stretch (30s)': 'Shoulders',

  // BACK
  'Lat Pulldown (Feeder Sets)': 'Back',
  'Lat Pulldown (Failure Set)': 'Back',
  'Omni-Grip Machine Chest-Supported Row': 'Back',
  'A1. Bottom-Half DB Lat Pullover': 'Back',
  'A2. Lat Static Stretch 30s': 'Back',
  'Omni-Direction Face Pull': 'Back',
  '1-Arm Half-Kneeling Lat Pulldown': 'Back',
  '1-Arm Half Kneeling Lat Pulldown': 'Back',
  'Pull-Up (1 AMRAP set)': 'Back',
  'Pull-Up': 'Back',
  'Wide-Grip Pull-Up': 'Back',
  'Kroc Row': 'Back',
  'Cable Shrug-In': 'Back',
  'Reverse Pec Deck': 'Back',
  'Rope Facepull': 'Back',
  'Pendlay Row': 'Back',
  'SLOW Barbell Row (3 up, 3 down)': 'Back',
  'Close-Grip Seated Cable Row': 'Back',
  'Wide-Grip Cable Row': 'Back',
  'Machine Low Row': 'Back',
  'Machine Shrug': 'Back',
  'Omni-Grip Lat Pulldown': 'Back',
  'Neutral-Grip Lat Pulldown': 'Back',

  // BICEPS
  'EZ-Bar Curl': 'Biceps',
  'EZ-Bar Curl (Heavy)': 'Biceps',
  'Bottom-Half Preacher Curl': 'Biceps',
  'N1-Style Cross-Body Cable Bicep Curl': 'Biceps',
  'Alternating DB Curl': 'Biceps',
  'Bayesian Cable Curl': 'Biceps',
  'Hammer Cheat Curl': 'Biceps',
  '1-Arm DB Preacher Curl': 'Biceps',
  'A1: EZ-Bar Modified Bicep 21\'s': 'Biceps',
  'A2: Bicep Static Stretch (30s)': 'Biceps',

  // TRICEPS
  'Squeeze-Only Triceps Pressdown + Stretch-Only Overhead Triceps Extension': 'Triceps',
  'N1-Style Cross-Body Triceps Extension': 'Triceps',
  'Floor Skull Crusher (Heavy)': 'Triceps',
  'Overhead Cable Triceps Extension': 'Triceps',
  'Overhead Triceps Extension': 'Triceps',
  'Triceps Pressdown': 'Triceps',
  'Cable Triceps Kickback': 'Triceps',
  '1-Arm Bottom-Half Overhead Cable Tricep Extensions': 'Triceps',

  // QUADS
  'Squat': 'Quads',
  'Squat or Machine Squat': 'Quads',
  'Pause Squat (Back off)': 'Quads',
  'Front Squat': 'Quads',
  'Hack Squat': 'Quads',
  'Leg Press': 'Quads',
  'Walking Lunge': 'Quads',
  'Dumbbell Walking Lunge': 'Quads',
  'Leg Extension': 'Quads',
  'Slow-Eccentric Leg Extension': 'Quads',

  // HAMSTRINGS
  'Barbell RDL': 'Hamstrings',
  'Dumbbell RDL': 'Hamstrings',
  'Stiff-Leg Deadlift': 'Hamstrings',
  'Seated Leg Curl': 'Hamstrings',
  'Slow Seated Leg Curl (3 up, 3 down)': 'Hamstrings',
  'Lying Leg Curl': 'Hamstrings',

  // GLUTES
  'Deadlift': 'Glutes',
  'Glute Ham Raise': 'Glutes',

  // CALVES
  'Leg Press Toe Press': 'Calves',
  'Seated Calf Raise': 'Calves',
  'Standing Calf Raise': 'Calves',

  // CORE
  'Decline Plate-Weighted Crunch': 'Core',
  'Roman Chair Leg Raise': 'Core',
  'Cable Crunch': 'Core',
  'Corpse Crunch': 'Core',
  'LLPT Plank': 'Core',
};

const programPath = path.join(__dirname, '..', 'program.json');
const data = JSON.parse(fs.readFileSync(programPath, 'utf8'));

let total = 0;
let mapped = 0;
const unmapped = new Set();

data.phases.forEach(phase => {
  phase.weeks.forEach(week => {
    week.days.forEach(day => {
      day.exercises.forEach(exercise => {
        total++;
        const group = EXERCISE_MUSCLE_MAP[exercise.name];
        if (group) {
          exercise.muscleGroup = group;
          mapped++;
        } else {
          unmapped.add(exercise.name);
          if (day.type === 'push') exercise.muscleGroup = 'Chest';
          else if (day.type === 'pull') exercise.muscleGroup = 'Back';
          else if (day.type === 'legs') exercise.muscleGroup = 'Quads';
          else exercise.muscleGroup = 'Full Body';
        }
      });
    });
  });
});

fs.writeFileSync(programPath, JSON.stringify(data, null, 2));

console.log(`Done! Processed ${total} exercises, mapped ${mapped} directly.`);
if (unmapped.size > 0) {
  console.log(`\nUsed fallback for ${unmapped.size} name(s):`);
  [...unmapped].forEach(n => console.log(`  - "${n}"`));
}
