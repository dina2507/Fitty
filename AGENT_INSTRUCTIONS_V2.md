# PPL Tracker — Agent Instructions V2

---

## WHAT IS ALREADY BUILT — DO NOT REBUILD ANY OF THIS

The following is fully complete and working. Build on top of it. Never overwrite or recreate it.

### Project Setup
- React + Vite + Tailwind + PostCSS configured
- `package.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`
- `.gitignore`, `index.html`, `public/index.html`
- `src/main.jsx`, `src/App.jsx`, `src/index.css`

### Data
- `src/data/program.json` — full Jeff Nippard PPL program data (all 3 phases)

### Utilities
- `src/utils/storage.js` — localStorage helpers
- `src/utils/progressTracker.js` — next-day traversal, rest-day skipping, phase advancement
- `src/utils/dayTheme.js` — day-type theming

### Store
- `src/store/useWorkoutStore.js` — Zustand store with:
  - localStorage persistence
  - workout completion + auto-advance
  - skip-day flow
  - manual day jump
  - export / import / reset actions
  - saved-progress validation guards

### Components
- `src/components/Header.jsx`
- `src/components/PhaseIndicator.jsx`
- `src/components/DayCard.jsx`
- `src/components/ExerciseCard.jsx` — with Track, History, Graph tabs + estimated 1RM chart (Recharts)
- `src/components/ProgressBar.jsx`

### Pages and Routes
- `src/pages/DashboardPage.jsx` — phase/week/day display, weekly plan cards, progress bar, calendar modal
- `src/pages/WorkoutPage.jsx` — exercise rendering, weight/reps/effort/notes inputs, complete + skip actions, rest-day UI
- `src/pages/HistoryPage.jsx` — completed workout list, delete entries
- `src/pages/SettingsPage.jsx` — start date, export/import/reset
- Routes: `/`, `/workout`, `/history`, `/settings`, fallback → `/`

### Other
- `CalendarModal` — shows scheduled/completed days from Dashboard
- Global `ErrorBoundary` in `main.jsx`
- Duplicate workout log prevention (safe load + update for same day)
- Production build verified (`npm run build`)
- Dev server verified (`npm run dev`)

---

## TECH STACK

- React + Vite (done)
- Tailwind CSS (done)
- Zustand (done)
- React Router v6 (done)
- Supabase — Auth + PostgreSQL (NEW — add now)
- Recharts — already used for 1RM graph
- Vercel — hosting

---

## SUPABASE CREDENTIALS

```
VITE_SUPABASE_URL=https://hearehilalxcwjxjbtzh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlYXJlaGlsYWx4Y3dqeGpidHpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NjQzODMsImV4cCI6MjA4OTM0MDM4M30.hGvJs8wv7sogS7cUbAw8C2KH5v8rrIrblNaXvssiPJg
```

- Store in `.env` at project root
- Add `.env` to `.gitignore`
- Create `src/lib/supabaseClient.js` to initialize the Supabase client

---

## SUPABASE DATABASE SCHEMA

Enable Row Level Security (RLS) on ALL tables.
RLS policy on every table: `user_id = auth.uid()` for SELECT, INSERT, UPDATE, DELETE.

---

### Table: user_progress
```sql
create table user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users unique not null,
  current_phase_id text,
  current_week int,
  current_day_index int,
  program_start date,
  weight_unit text default 'kg',
  rest_timer_default int default 120,
  updated_at timestamp default now()
);
```

---

### Table: workout_logs
```sql
create table workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  date date not null,
  phase_id text,
  week_number int,
  day_index int,
  day_label text,
  workout_type text,
  exercises jsonb,
  duration_minutes int,
  notes text,
  pr_exercises text[],
  created_at timestamp default now()
);
```

exercises jsonb structure:
```json
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
```

---

### Table: custom_exercises
```sql
create table custom_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  muscle_group text not null,
  secondary_muscles text[],
  equipment text,
  default_sets int,
  default_reps text,
  default_rpe text,
  default_rest text,
  notes text,
  created_at timestamp default now()
);
```

---

### Table: custom_workouts
```sql
create table custom_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  workout_type text,
  exercises jsonb,
  is_template boolean default false,
  created_at timestamp default now(),
  updated_at timestamp default now()
);
```

exercises jsonb structure inside custom_workouts:
```json
[
  {
    "exerciseId": "string",
    "name": "string",
    "muscleGroup": "string",
    "warmupSets": "string",
    "workingSets": 2,
    "reps": "8-10",
    "rpe": "8-9",
    "rest": "~2-3 min",
    "sub1": "string",
    "sub2": "string",
    "notes": "string",
    "isSuperset": false,
    "supersetGroup": null
  }
]
```

---

## MUSCLE GROUP CATEGORIES

Use these exact values everywhere (badges, filters, DB, JSON):

```
Chest | Back | Shoulders | Biceps | Triceps |
Quads | Hamstrings | Glutes | Calves | Core | Full Body
```

Add `muscleGroup` field to every exercise in `src/data/program.json` using this map:
- Bench Press, Larsen Press, Press-Around, Pec Flye, Push Up variations → `Chest`
- Arnold Press, Lateral Raise, Front Raise, Face Pull, Y-Raise → `Shoulders`
- Lat Pulldown, Pull-Up, Row variations, Pullover → `Back`
- Shrug → `Back`
- Curl variations, Preacher Curl → `Biceps`
- Tricep Pressdown, Skull Crusher, Tricep Extension, Diamond Push Up → `Triceps`
- Squat, Leg Press, Lunge, Step-Up → `Quads`
- RDL, Deadlift, Leg Curl, Glute Ham Raise, Hip Thrust → `Hamstrings`
- Calf Raise → `Calves`
- Crunch, Leg Raise → `Core`

---

## AUTH

- Email + password via Supabase Auth
- `src/pages/AuthPage.jsx` — Login / Sign Up toggle, inline error messages
- Protect ALL routes — redirect to `/auth` if no active session
- After login → redirect to `/`
- On very first login (no `user_progress` row exists) → prompt user to set program start date
- Logout button in Settings page

---

## COMPLETE PAGE SPECIFICATIONS

---

### Auth Page `/auth` — NEW

- Toggle between Login and Sign Up
- Email + password fields
- Show Supabase error messages inline (e.g. "Invalid credentials")
- On success → redirect to `/`
- Show loading state on submit button

---

### Dashboard `/` — UPDATE EXISTING

Keep everything already built. Add:

- Today's muscle groups being trained (e.g. `Chest · Shoulders · Triceps`)
- Weekly volume summary — total sets per muscle group this week (compact badge row)
- Sync status indicator in header: `☁️ Saved` / `🔄 Syncing` / `📴 Offline`
- If first-ever login and no program started → show two options:
  - "Follow Jeff Nippard PPL Program"
  - "Start a Custom Workout"

---

### Workout Page `/workout` — UPDATE EXISTING

Keep everything already built. Add:

**Per exercise card:**
- Muscle group badge (colored by muscle group)
- Superset grouping — A1/A2 exercises visually connected with a bracket line
- "Swap Exercise" button:
  - Opens modal with 3 tabs: Jeff Nippard Subs | Same Muscle Group | Search All
  - Selecting a swap replaces only for this session (does not modify template)
- "Last time: 80kg × 5" shown as placeholder text under weight input
  - Pull from most recent `workout_logs` entry for same exercise ID
- Set each row: weight input + reps input + RPE (optional) + delete button
- After logging any set → auto-start rest timer based on exercise rest field

**Rest timer (floating bottom bar):**
- Shows countdown when active
- Vibrates on completion (`navigator.vibrate([200, 100, 200])`)
- User can dismiss or add 30s
- Default duration from user's settings if exercise has no rest field

**Session level:**
- Duration timer in header — elapsed time since workout started (MM:SS)
- Session notes text area at bottom of page
- PR badge 🏆 on exercise card if current set exceeds all-time max for that exercise

**On "Complete Workout":**
- Run PR detection (compare all sets against `workout_logs` history)
- Save full log to Supabase `workout_logs`
- Advance to next day
- Show completion modal with summary: exercises done, total volume, any PRs hit

---

### History Page `/history` — UPDATE EXISTING

Keep everything already built. Add:

- Filter bar: `All` / `Push` / `Pull` / `Legs` / muscle group pills
- Each workout card shows:
  - Date, workout label, muscle groups trained (badges)
  - Total sets count, total volume (kg × reps summed)
- Expand card → full exercise/set/rep breakdown
- Edit button → opens edit modal (update `workout_logs` in Supabase)
- Delete button → confirm dialog → delete from Supabase
- PR section at top of page:
  - Shows current all-time max weight per exercise (highest ever logged)
  - Highlight with 🏆 badge

---

### Exercises Page `/exercises` — NEW

Searchable exercise library.

**Two tabs:**

Tab 1: Jeff Nippard Program (read-only)
- All exercises from `program.json`
- Search by name
- Filter by muscle group
- Filter by equipment
- Each card: name, muscle group badge, default sets/reps/RPE

Tab 2: My Exercises (full CRUD via `custom_exercises` table)
- Same search and filter
- "Add Exercise" button → form modal:
  - Name (required)
  - Muscle group (required, dropdown)
  - Secondary muscles (multi-select)
  - Equipment (text)
  - Default sets, reps, RPE, rest
  - Notes
- Edit and delete on each custom exercise
- Save to Supabase immediately

**Tap any exercise → Exercise Detail view:**
- Full exercise info
- All past logged sets pulled from `workout_logs` (filter by exercise name)
- Mini line chart: weight over time (reuse Recharts already installed)
- PR badge showing all-time max

---

### Program Page `/program` — UPDATE EXISTING

Keep Jeff Nippard read-only browser. Add:

**New "My Workouts" tab:**
- List of saved `custom_workouts` templates
- "Create Workout" button → opens Workout Builder:
  - Name the workout (text input)
  - Select workout type (push / pull / legs / upper / lower / full body / custom)
  - Add exercises from library (search + filter by muscle group)
  - Set warmup sets, working sets, reps, RPE, rest per exercise
  - Drag to reorder exercises
  - Mark two exercises as a superset pair (checkbox)
  - Save → writes to `custom_workouts` in Supabase
- Edit and delete custom workout templates
- "Use This Workout Today" button:
  - Loads template exercises into active workout session
  - Navigates to `/workout`

---

### Stats Page `/stats` — NEW

All data pulled from `workout_logs` in Supabase.

**Charts using Recharts:**

1. Weekly Volume by Muscle Group (stacked bar chart, last 8 weeks)
   - X axis: week labels
   - Y axis: total sets
   - Each bar segment = one muscle group (use muscle group colors)

2. Total Sets per Week (line chart, last 12 weeks)

3. PR Progress per Exercise (line chart)
   - Dropdown to select exercise
   - X axis: date
   - Y axis: max weight logged that session

4. Workout Frequency Heatmap (GitHub-style calendar grid)
   - Last 12 weeks shown
   - Color intensity = number of sets that day
   - Gray = rest day or no workout

5. Body Weight Log (optional)
   - Input field: "Log today's weight (kg)"
   - Saves to a `body_weight` column in `user_progress` as jsonb array
   - Line chart of weight over time

---

### Settings Page `/settings` — UPDATE EXISTING

Keep everything already built. Add:

- Account section: show logged-in email, Logout button
- Weight unit preference: `kg` / `lbs` (saved to `user_progress.weight_unit`)
- Rest timer default: number input in seconds (saved to `user_progress.rest_timer_default`)
- Rest timer vibration: toggle on/off
- Export all data: download `workout_logs` + `custom_exercises` + `custom_workouts` as JSON
- Import data: upload JSON, with choice to merge or replace
- Reset program progress: confirmation dialog → clears `user_progress` + `workout_logs`
- Delete account: confirmation dialog → deletes all user data + Supabase auth account

---

## NAVIGATION — UPDATE

Bottom nav: 6 items
```
Home | Workout | History | Exercises | Program | Stats
```

Settings: gear icon in top-right corner of header (not in bottom nav)

---

## SYNC STRATEGY

- `localStorage` = local cache for offline use
- Supabase = source of truth for all user data
- On app load:
  1. Check Supabase session
  2. Fetch `user_progress` from Supabase → sync to Zustand store
  3. Fetch last 30 `workout_logs` → cache in localStorage
- On workout completion → save to Supabase immediately
- On custom exercise / workout CRUD → save to Supabase immediately
- If offline (`navigator.onLine === false`):
  - Save to localStorage only
  - Queue the write
  - On `window online` event → flush queue to Supabase
- Sync status shown in header

---

## AUTO-SAVE RULES

- Debounce auto-save to `localStorage` 500ms after any workout input change
- Force-save to `localStorage` on `beforeunload` event
- Sync to Supabase only on workout completion (not on every keystroke)
- Never show a manual Save button in the workout flow

---

## PREVIOUS SESSION WEIGHT

When workout page loads, for each exercise:
1. Search `workout_logs` cache (localStorage) for most recent log containing this exercise ID
2. Get the last set's weight from that log
3. Show as placeholder: `Last time: 80kg × 5` below the weight input field
4. Pre-fill weight input with that value

---

## PR DETECTION

On every "Complete Workout":
1. For each exercise in the session, find the max weight logged in this session
2. Query all historical `workout_logs` for the same exercise
3. If session max > all-time max → it's a PR
4. Show 🏆 badge on that exercise card
5. Save list of PR exercise names to `workout_logs.pr_exercises`
6. Show PR exercises in the completion modal

---

## NEW UTILITY FILES TO CREATE

```
src/utils/muscleGroups.js     — muscle group list, color map, icon map
src/utils/volumeCalc.js       — total volume calculation (weight × reps per set)
src/utils/prDetection.js      — PR detection logic
src/utils/plateCalc.js        — plate calculator (weight → plate breakdown)
src/utils/warmupSets.js       — warm-up set % calculator
```

### muscleGroups.js color map:
```js
export const MUSCLE_COLORS = {
  Chest:       { bg: '#FDE8E8', text: '#C0392B' },
  Back:        { bg: '#E8F4FD', text: '#1A5276' },
  Shoulders:   { bg: '#FEF9E7', text: '#B7950B' },
  Biceps:      { bg: '#E8F8F5', text: '#0E6655' },
  Triceps:     { bg: '#F4ECF7', text: '#7D3C98' },
  Quads:       { bg: '#EBF5FB', text: '#1F618D' },
  Hamstrings:  { bg: '#FDF2E9', text: '#CA6F1E' },
  Glutes:      { bg: '#FDFEFE', text: '#717D7E' },
  Calves:      { bg: '#E9F7EF', text: '#1E8449' },
  Core:        { bg: '#FDEDEC', text: '#CB4335' },
  'Full Body': { bg: '#F2F3F4', text: '#2C3E50' },
};
```

---

## NEW COMPONENTS TO CREATE

```
src/components/RestTimer/         — floating countdown bar, vibrate on end, +30s, dismiss
src/components/SwapExerciseModal/ — 3 tabs: Jeff subs | same muscle | search all
src/components/WorkoutBuilder/    — exercise picker, drag reorder, superset pairs
src/components/MuscleGroupBadge/  — colored pill with muscle group name
src/components/PRBadge/           — 🏆 badge shown on exercise card
src/components/SyncIndicator/     — ☁️/🔄/📴 in header
src/components/PlateCalculator/   — modal: enter weight → see plate breakdown
src/components/CompletionModal/   — shown after "Complete Workout"
```

---

## NEW HOOKS TO CREATE

```
src/hooks/useSupabaseSync.js   — offline queue, flush on reconnect
src/hooks/useRestTimer.js      — countdown timer state, vibrate
src/hooks/usePRDetection.js    — compare current sets against history
src/hooks/usePrevWeight.js     — fetch previous session weight per exercise
```

---

## NEW PAGES TO CREATE

```
src/pages/AuthPage.jsx          — login / sign up
src/pages/ExercisesPage.jsx     — exercise library + CRUD
src/pages/StatsPage.jsx         — charts and analytics
```

---

## UPDATED FILE STRUCTURE

```
ppl-tracker/
├── public/
│   └── manifest.json
├── src/
│   ├── data/
│   │   └── program.json              ← update: add muscleGroup to every exercise
│   ├── lib/
│   │   └── supabaseClient.js         ← NEW
│   ├── store/
│   │   └── useWorkoutStore.js        ← update: add Supabase sync
│   ├── components/
│   │   ├── Header.jsx                ← update: add SyncIndicator + gear icon
│   │   ├── PhaseIndicator.jsx        ← existing
│   │   ├── DayCard.jsx               ← existing
│   │   ├── ExerciseCard.jsx          ← update: add muscle badge, PR badge, swap button
│   │   ├── ProgressBar.jsx           ← existing
│   │   ├── RestTimer/                ← NEW
│   │   ├── SwapExerciseModal/        ← NEW
│   │   ├── WorkoutBuilder/           ← NEW
│   │   ├── MuscleGroupBadge/         ← NEW
│   │   ├── PRBadge/                  ← NEW
│   │   ├── SyncIndicator/            ← NEW
│   │   ├── PlateCalculator/          ← NEW
│   │   └── CompletionModal/          ← NEW
│   ├── hooks/
│   │   ├── useSupabaseSync.js        ← NEW
│   │   ├── useRestTimer.js           ← NEW
│   │   ├── usePRDetection.js         ← NEW
│   │   └── usePrevWeight.js          ← NEW
│   ├── pages/
│   │   ├── AuthPage.jsx              ← NEW
│   │   ├── DashboardPage.jsx         ← update
│   │   ├── WorkoutPage.jsx           ← update
│   │   ├── HistoryPage.jsx           ← update
│   │   ├── ExercisesPage.jsx         ← NEW
│   │   ├── ProgramPage.jsx           ← update: add My Workouts tab + builder
│   │   ├── StatsPage.jsx             ← NEW
│   │   └── SettingsPage.jsx          ← update
│   ├── utils/
│   │   ├── storage.js                ← existing
│   │   ├── progressTracker.js        ← existing
│   │   ├── dayTheme.js               ← existing
│   │   ├── muscleGroups.js           ← NEW
│   │   ├── volumeCalc.js             ← NEW
│   │   ├── prDetection.js            ← NEW
│   │   ├── plateCalc.js              ← NEW
│   │   └── warmupSets.js             ← NEW
│   ├── App.jsx                       ← update: add new routes
│   └── main.jsx                      ← existing (has ErrorBoundary)
├── .env                              ← Supabase credentials
├── .gitignore
├── vercel.json
├── package.json
└── vite.config.js
```

---

## PACKAGES TO INSTALL

```bash
npm install @supabase/supabase-js date-fns lucide-react @dnd-kit/core @dnd-kit/sortable
```

Note: `recharts` is already installed.

---

## VERCEL CONFIG

Create `vercel.json` at project root:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Add to Vercel project environment variables after deploy:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## IMPLEMENTATION ORDER — SPRINT BY SPRINT

### Sprint 1 — Supabase Foundation
1. Create `.env` with Supabase credentials
2. Create `src/lib/supabaseClient.js`
3. Build `AuthPage.jsx` (login/signup toggle, error handling)
4. Add route guard to `App.jsx` — redirect to `/auth` if no session
5. Create all 4 Supabase tables with RLS (run SQL in Supabase dashboard)
6. Update `useWorkoutStore.js`:
   - On login: fetch `user_progress` from Supabase, sync to store
   - On workout complete: save to `workout_logs` in Supabase
7. Create `SyncIndicator` component, add to `Header.jsx`
8. Create `useSupabaseSync.js` hook (offline queue + flush on reconnect)

### Sprint 2 — Muscle Groups + Exercise Library
9. Add `muscleGroup` field to every exercise in `program.json`
10. Create `src/utils/muscleGroups.js` with color map
11. Create `MuscleGroupBadge` component
12. Build `ExercisesPage.jsx`:
    - Tab 1: Jeff Nippard exercises (read-only, from program.json)
    - Tab 2: My Exercises (CRUD via `custom_exercises` table)
    - Search + filter by muscle group
    - Exercise detail view with history chart
13. Add `/exercises` route to `App.jsx`
14. Update bottom nav to 6 items

### Sprint 3 — Enhanced Workout Page
15. Add `MuscleGroupBadge` to `ExerciseCard`
16. Add `PRBadge` component
17. Build `SwapExerciseModal`
18. Build `RestTimer` component (countdown, vibrate, +30s, dismiss)
19. Build `usePrevWeight.js` hook — fetch last session weight per exercise
20. Build `usePRDetection.js` hook — detect PRs on completion
21. Show "Last time: 80kg × 5" placeholder in workout inputs
22. Add duration timer to workout header
23. Add session notes field to workout page
24. Build `CompletionModal` — shown after complete workout
25. Add superset visual grouping (A1/A2 bracket)

### Sprint 4 — Custom Workout Builder
26. Build `WorkoutBuilder` component:
    - Exercise picker (search + muscle group filter)
    - Drag-to-reorder using `@dnd-kit`
    - Superset pair toggle
    - Save to `custom_workouts`
27. Update `ProgramPage.jsx`:
    - "Jeff Nippard" tab (existing)
    - "My Workouts" tab — list + edit + delete + "Use Today"
    - "Create Workout" button → opens WorkoutBuilder
28. "Use This Workout Today" flow → load into workout session

### Sprint 5 — History + Stats
29. Update `HistoryPage.jsx`:
    - Filter bar
    - Volume + muscle group display per card
    - Edit modal (update Supabase)
    - PR section at top
30. Build `StatsPage.jsx`:
    - Weekly volume by muscle group (stacked bar chart)
    - Total sets per week (line chart)
    - PR progress per exercise (line chart with exercise dropdown)
    - Frequency heatmap (calendar grid)
    - Body weight log + trend line
31. Add `/stats` route

### Sprint 6 — Pro Features + Polish
32. Build `PlateCalculator` component (modal, triggered from workout weight input)
33. Build warm-up set generator (auto-calculate % ramp-up sets)
34. Add streak tracking to Dashboard (consecutive workout days)
35. Add 1RM calculator inline on exercise cards (Epley formula)
36. Update `SettingsPage.jsx` with all new options
37. Add PWA manifest + service worker
38. Fix iOS keyboard — `paddingBottom` on scroll container when input is focused
39. Dark mode audit on all new components
40. Add `vercel.json`
41. Final production build test

---

## KEY RULES — READ BEFORE EVERY TASK

1. Never rebuild or overwrite anything in the "Already Built" section above
2. Never delete `program.json` or modify its exercise list — only add `muscleGroup` field
3. Supabase is the source of truth — localStorage is only a cache
4. Every new page must be mobile-first and work at 390px width
5. Dark mode must work on every new component — use Tailwind `dark:` variants
6. No manual Save buttons in the workout flow — everything auto-saves
7. All Supabase operations must have try/catch error handling
8. RLS must be enabled on all tables — users can only access their own data
9. Test every Sprint by running `npm run build` before moving to the next Sprint
10. Update `Completed_Tasks.md` after each Sprint with what was done
