## PPL Tracker — Updated Full Build Plan

You are continuing development of a PPL Workout Tracker web app.
The following has already been completed:

- Vite + React + Tailwind project setup
- program.json loaded at src/data/program.json
- Zustand store with localStorage persistence
- progressTracker.js and storage.js utilities
- Basic pages: Dashboard, Workout, History, Settings
- Basic routing, exercise cards, set logging UI
- Export/import/reset in settings
- Production build verified

---

## WHAT CHANGES FROM THE ORIGINAL PLAN

The app is no longer just a "Jeff Nippard program tracker."
It is now a **complete personal workout management app** where:

- Jeff Nippard's PPL program is a **built-in template** the user can reference or use
- The user can **create their own custom workouts** from scratch
- The user can **edit any exercise** in any workout (name, sets, reps, RPE, rest, notes, muscle group)
- The user can **swap any exercise** with Jeff Nippard's substitutions OR their own custom exercise
- All workouts are **categorized by muscle group**
- Everything is saved to **Supabase** (cloud), not just localStorage

---

## TECH STACK

- React + Vite (already set up)
- Tailwind CSS (already set up)
- Zustand (already set up)
- React Router v6 (already set up)
- Supabase — Auth + PostgreSQL database (NEW)
- Vercel — hosting

---

## SUPABASE CREDENTIALS

VITE_SUPABASE_URL=https://hearehilalxcwjxjbtzh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlYXJlaGlsYWx4Y3dqeGpidHpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NjQzODMsImV4cCI6MjA4OTM0MDM4M30.hGvJs8wv7sogS7cUbAw8C2KH5v8rrIrblNaXvssiPJg

Store in .env at project root. Add .env to .gitignore.
Create src/lib/supabaseClient.js to initialize the Supabase client.

---

## SUPABASE DATABASE SCHEMA

Create all tables with Row Level Security (RLS) enabled.
RLS policy on every table: users can only SELECT/INSERT/UPDATE/DELETE their own rows
WHERE user_id = auth.uid()

---

### Table: user_progress
Tracks where the user is in the program.

- id: uuid, primary key, default gen_random_uuid()
- user_id: uuid, references auth.users, unique
- current_phase_id: text
- current_week: int
- current_day_index: int
- program_start: date
- updated_at: timestamp, default now()

---

### Table: workout_logs
One row per completed workout session.

- id: uuid, primary key, default gen_random_uuid()
- user_id: uuid, references auth.users
- date: date
- phase_id: text (e.g. "phase_1" or "custom")
- week_number: int
- day_index: int
- day_label: text (e.g. "Push #1" or custom name)
- workout_type: text (push / pull / legs / upper / lower / full_body / custom)
- exercises: jsonb (full set/rep log — see structure below)
- duration_minutes: int (optional, user can fill)
- notes: text (optional session notes)
- created_at: timestamp, default now()

exercises jsonb structure:
[
  {
    "exerciseId": "string",
    "name": "string",
    "muscleGroup": "string",
    "sets": [
      { "setNumber": 1, "weight": 80, "reps": 5, "rpe": 8, "notes": "" }
    ]
  }
]

---

### Table: custom_exercises
User-created exercise library.

- id: uuid, primary key, default gen_random_uuid()
- user_id: uuid, references auth.users
- name: text, not null
- muscle_group: text, not null
- secondary_muscles: text[] (array)
- equipment: text
- default_sets: int
- default_reps: text (e.g. "8-10")
- default_rpe: text
- default_rest: text
- notes: text
- created_at: timestamp, default now()

---

### Table: custom_workouts
User-created or modified workout templates.

- id: uuid, primary key, default gen_random_uuid()
- user_id: uuid, references auth.users
- name: text, not null (e.g. "My Push Day A")
- workout_type: text (push / pull / legs / upper / lower / full_body / custom)
- exercises: jsonb (ordered list of exercise templates)
- is_template: boolean, default false (true = saved as reusable template)
- created_at: timestamp, default now()
- updated_at: timestamp, default now()

exercises jsonb structure inside custom_workouts:
[
  {
    "exerciseId": "string (from custom_exercises or program.json id)",
    "name": "string",
    "muscleGroup": "string",
    "warmupSets": "string",
    "workingSets": number,
    "reps": "string",
    "rpe": "string",
    "rest": "string",
    "sub1": "string",
    "sub2": "string",
    "notes": "string",
    "isSuperset": boolean,
    "supersetGroup": "string or null"
  }
]

---

## MUSCLE GROUP CATEGORIES

Use these exact categories everywhere in the app:

Primary muscle groups:
- Chest
- Back
- Shoulders
- Biceps
- Triceps
- Quads
- Hamstrings
- Glutes
- Calves
- Core
- Full Body

Every exercise (from program.json AND custom_exercises) must have a muscle_group field.

Map Jeff Nippard exercises to muscle groups:
- Bench Press, Larsen Press, Arnold Press, Press-Around → Chest / Shoulders
- Lat Pulldown, Pull-Up, Row → Back
- Curl variations → Biceps
- Tricep variations → Triceps
- Squat, Leg Press, Lunge → Quads
- RDL, Deadlift, Leg Curl, Glute Ham Raise → Hamstrings / Glutes
- Calf Raise → Calves
- Crunch, Leg Raise → Core

Add a muscleGroup field to every exercise object in program.json
(update the existing file, do not replace it).

---

## AUTH

- Email + password sign up / login via Supabase Auth
- Show Auth page (Login / Sign Up toggle) before anything else if not logged in
- After login → redirect to Dashboard
- Logout button in Settings
- On first login ever → prompt user to set program start date
- Protect all routes — redirect to /auth if no session

---

## PAGES — FULL UPDATED SPEC

### 1. Auth Page (/auth)
- Toggle between Login and Sign Up
- Email + password fields
- Show error messages inline
- On success → redirect to /

---

### 2. Dashboard (/) — UPDATE EXISTING
Keep everything already built, plus add:
- Today's muscle groups being trained (e.g. "Chest · Shoulders · Triceps")
- Weekly volume summary: total sets per muscle group this week
- "Start from Jeff Nippard Program" vs "Start Custom Workout" option if no active program
- Sync status indicator (cloud saved / syncing / offline)

---

### 3. Workout Page (/workout) — UPDATE EXISTING
Keep everything already built, plus add:
- Muscle group tag on each exercise card (colored badge)
- Superset exercises visually grouped with a bracket/connector
- Swap Exercise button on each card:
  - Opens modal showing:
    - Jeff Nippard's Sub 1 and Sub 2 (if from program)
    - User's custom exercises filtered by same muscle group
    - Search bar to find any exercise
  - Selecting a swap replaces the exercise for this session only
    (does not modify the template)
- Rest timer: after logging a set, show a countdown timer
  based on the exercise's rest field. Vibrate on completion.
- Previous session weight shown as placeholder in weight input
  (pull from last workout_log for same exercise)
- Per-exercise notes field
- Session notes field at the bottom (saved to workout_logs.notes)
- Duration timer: show elapsed time since workout started
- On "Complete Workout": save full log to Supabase + advance day

---

### 4. History Page (/history) — UPDATE EXISTING
Keep everything already built, plus add:
- Filter by: All / Push / Pull / Legs / muscle group
- Each history card shows: date, workout name, muscle groups trained,
  total sets, total volume (weight × reps summed)
- Expand card to see full exercise/set/rep breakdown
- Edit past workout (opens edit modal, saves update to Supabase)
- Delete workout (with confirmation, deletes from Supabase)
- Personal Records section at top:
  Show highest weight ever logged per exercise
  Highlight with 🏆 badge when a PR is set during a workout

---

### 5. Exercises Page (/exercises) — NEW PAGE
A searchable library of all exercises.

Tabs:
- Jeff Nippard Program (read-only, from program.json)
- My Exercises (from custom_exercises table, full CRUD)

Features:
- Search by name
- Filter by muscle group
- Filter by equipment
- Each exercise card shows: name, muscle group, equipment, default sets/reps/RPE
- "Add Exercise" button → opens form to create new custom exercise
- Edit and delete on custom exercises
- Tap any exercise → see full details + exercise history
  (all past logged sets for that exercise, with weight/reps over time)

---

### 6. Program Page (/program) — UPDATE EXISTING
Keep read-only Jeff Nippard browser, plus add:
- "My Workouts" tab showing saved custom_workouts templates
- "Create Workout" button:
  Opens workout builder:
  - Name the workout
  - Select workout type (push/pull/legs/etc.)
  - Add exercises from library (search + filter by muscle group)
  - Set sets/reps/RPE/rest per exercise
  - Mark exercises as superset pairs
  - Save as template to custom_workouts table
- Edit and delete custom workout templates
- "Use This Workout Today" button on any template:
  Loads it into the active workout session

---

### 7. Stats Page (/stats) — NEW PAGE
Visual progress dashboard.

Charts (use Recharts library):
- Weekly Volume by Muscle Group (bar chart, last 8 weeks)
- Total Sets per Week (line chart)
- Personal Records over time per exercise (line chart)
- Workout frequency heatmap (GitHub-style calendar)
- Body weight log (if user wants to track — add optional input)

All data pulled from workout_logs in Supabase.

---

### 8. Settings Page (/settings) — UPDATE EXISTING
Keep everything already built, plus add:
- Account section: show logged-in email, logout button
- Weight unit preference: kg / lbs (stored in Supabase user_progress)
- Rest timer default duration (overridable per exercise)
- Notification preferences (rest timer vibration on/off)
- Export all data as JSON
- Import data from JSON (with merge or replace option)
- Reset program progress (with confirmation)
- Delete account option

---

## NAVIGATION

Update bottom nav to 6 items:
Home · Workout · History · Exercises · Program · Stats

Settings accessible via gear icon in top-right header.

---

## SYNC STRATEGY

- On every "Complete Workout": save to Supabase immediately
- On every custom exercise create/edit/delete: save to Supabase immediately
- On app load: fetch user_progress and last 30 workout_logs from Supabase
- Cache fetched data in localStorage for offline access
- If offline: queue writes to localStorage, sync when online
  (use navigator.onLine + window online/offline events)
- Show sync status in header: ☁️ Saved / 🔄 Syncing / 📴 Offline

---

## AUTO-SAVE RULES

- Debounced auto-save to localStorage every 500ms on any workout input
- Force-save on tab close (beforeunload event)
- Sync to Supabase on workout completion
- Never show a manual Save button anywhere in the workout flow

---

## PREVIOUS SESSION WEIGHT FEATURE

When the user opens a workout, for each exercise:
1. Query workout_logs in Supabase (or localStorage cache)
2. Find the most recent log entry that includes this exercise
3. Pre-fill the weight input placeholder with that previous weight
4. Show small text under the input: "Last time: 80kg × 5"

---

## PERSONAL RECORDS

On every workout completion:
1. Compare each logged set against all historical sets for that exercise
2. If new max weight (at any rep count) → flag as PR
3. Show 🏆 badge on the exercise card during the workout
4. Store PRs in workout_logs (add a pr_exercises: string[] field)
5. Show PR history in /exercises exercise detail view

---

## UPDATED FILE STRUCTURE

ppl-tracker/
├── public/
│   └── manifest.json
├── src/
│   ├── data/
│   │   └── program.json          ← update to add muscleGroup to every exercise
│   ├── lib/
│   │   └── supabaseClient.js     ← NEW
│   ├── store/
│   │   └── useWorkoutStore.js    ← update for Supabase sync
│   ├── components/
│   │   ├── ExerciseCard/
│   │   ├── SetLogger/
│   │   ├── WorkoutHeader/
│   │   ├── BottomNav/
│   │   ├── RestTimer/            ← NEW
│   │   ├── SwapExerciseModal/    ← NEW
│   │   ├── WorkoutBuilder/       ← NEW
│   │   ├── MuscleGroupBadge/     ← NEW
│   │   ├── PRBadge/              ← NEW
│   │   └── SyncIndicator/        ← NEW
│   ├── pages/
│   │   ├── AuthPage.jsx          ← NEW
│   │   ├── DashboardPage.jsx     ← update
│   │   ├── WorkoutPage.jsx       ← update
│   │   ├── HistoryPage.jsx       ← update
│   │   ├── ExercisesPage.jsx     ← NEW
│   │   ├── ProgramPage.jsx       ← update
│   │   ├── StatsPage.jsx         ← NEW
│   │   └── SettingsPage.jsx      ← update
│   ├── hooks/
│   │   ├── useSupabaseSync.js    ← NEW
│   │   ├── useRestTimer.js       ← NEW
│   │   └── usePRDetection.js     ← NEW
│   ├── utils/
│   │   ├── progressTracker.js    ← already built
│   │   ├── storage.js            ← already built
│   │   ├── muscleGroups.js       ← NEW: muscle group map + colors
│   │   └── volumeCalc.js         ← NEW: total volume calculations
│   ├── App.jsx                   ← update routes
│   └── main.jsx
├── .env
├── .gitignore
├── vercel.json
├── package.json
└── vite.config.js

---

## IMPLEMENTATION ORDER

### Sprint 1 — Supabase Foundation (do this first)
1. Create src/lib/supabaseClient.js
2. Build AuthPage with login/signup
3. Protect all routes (redirect to /auth if no session)
4. Create all Supabase tables with RLS as defined above
5. Update useWorkoutStore.js to sync user_progress to Supabase on changes
6. Add SyncIndicator component to header

### Sprint 2 — Muscle Groups + Exercise Library
7. Add muscleGroup field to every exercise in program.json
8. Create muscleGroups.js utility with color map per group
9. Add MuscleGroupBadge component
10. Build ExercisesPage with Jeff Nippard tab (read-only) and My Exercises tab (CRUD)
11. Wire custom_exercises CRUD to Supabase

### Sprint 3 — Enhanced Workout Page
12. Add muscle group badges to exercise cards
13. Build SwapExerciseModal (Jeff Nippard subs + custom exercise search)
14. Build RestTimer component with vibration
15. Add previous session weight placeholder logic
16. Add PR detection on workout completion (usePRDetection hook)
17. Add session notes field
18. Add duration timer

### Sprint 4 — Custom Workout Builder
19. Build WorkoutBuilder component (add exercises, set order, mark supersets)
20. Build Program page "My Workouts" tab
21. Wire custom_workouts CRUD to Supabase
22. "Use This Workout Today" flow

### Sprint 5 — History + Stats
23. Update History page with filters, volume display, PR badges
24. Build StatsPage with Recharts:
    - Weekly volume by muscle group (bar chart)
    - Total sets per week (line chart)
    - PR progress per exercise (line chart)
    - Workout frequency calendar heatmap
25. Wire all charts to workout_logs data from Supabase

### Sprint 6 — Polish + PWA
26. Update Settings page with all new options
27. Add offline queue + sync-on-reconnect logic
28. PWA manifest + service worker
29. iOS keyboard fix (paddingBottom on active input)
30. Dark mode audit across all new pages
31. vercel.json SPA redirect rules
32. Final production build test

---

## PACKAGES TO INSTALL

npm install @supabase/supabase-js recharts date-fns lucide-react

---

## VERCEL CONFIG

Add vercel.json at project root:
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}

Add these to Vercel project environment variables after deploy:
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY

---

## KEY RULES FOR THE AGENT

1. Never break what is already working — build on top of existing files
2. Jeff Nippard program.json is read-only reference data — never delete it
3. All user data (logs, custom exercises, custom workouts) goes to Supabase
4. localStorage is only a cache — Supabase is the source of truth
5. Every new page must work on mobile (test at 390px width)
6. Dark mode must work on every new component
7. No manual Save buttons anywhere — everything auto-saves