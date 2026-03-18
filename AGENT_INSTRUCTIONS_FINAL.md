# PPL Tracker — Agent Instructions (Final)

---

## RULE 0 — READ THIS ENTIRE FILE BEFORE WRITING A SINGLE LINE OF CODE
Do not start Sprint 1 until you have read all 7 sprints and every section below.
Understand the full scope before touching any file.

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
- Recharts — already installed
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
  dismissed_alerts jsonb default '[]',
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

### Table: achievements
```sql
create table achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  badge_id text not null,
  earned_at timestamp default now(),
  unique(user_id, badge_id)
);
alter table achievements enable row level security;
create policy "Users manage own achievements"
  on achievements for all using (user_id = auth.uid());
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

## EMPTY STATES

Every page must handle the case where there is no data yet.
Never show a blank white screen. Every empty state needs a message and a clear next action button.

- Dashboard with no workouts logged → show a "Let's get started" card with a Start Workout button
- History with no completed workouts → "No workouts yet. Complete your first workout to see it here."
- Stats with no data → "Log at least 2 workouts to see your stats." Show greyed-out placeholder charts
- Exercises with no custom exercises → "You haven't added any custom exercises yet." with an Add Exercise button
- Achievements with none earned → show all badges greyed out with a lock icon and what's needed to unlock each one
- Training Alerts with no alerts → do not show the alerts card at all on Dashboard

---

## LOADING STATES

Every page that fetches from Supabase must show a loading skeleton while data is being fetched.
Never show a blank screen or a spinner in the centre of the page.
Use Tailwind `animate-pulse` on placeholder rectangles that match the shape of the content that will load.
Show the skeleton immediately (0ms delay) — do not wait before showing it.

---

## ERROR HANDLING

All Supabase calls must be wrapped in try/catch. On any error:
- Show a toast notification: "Something went wrong. Your data is saved locally and will sync when the connection is restored."
- Never show a raw error message or error code to the user
- Never crash the page — fall back to localStorage data silently
- Log the full error to `console.error` in development only
- All localStorage fallbacks must be silent — the user should not notice anything failed

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
- Training Alerts card at top (only shown when there are active RPE trend alerts)
- If first-ever login and no program started → show two options:
  - "Follow Jeff Nippard PPL Program"
  - "Start a Custom Workout"

---

### Workout Page `/workout` — UPDATE EXISTING

Keep everything already built. Add:

**Per exercise card:**
- Muscle group badge (colored by muscle group)
- Progressive overload suggestion banner (green, dismissable per exercise)
- Superset grouping — A1/A2 exercises visually connected with a bracket line
- "Swap Exercise" button:
  - Opens modal with 3 tabs: Jeff Nippard Subs | Same Muscle Group | Search All
  - Selecting a swap replaces only for this session (does not modify template)
- "Last time: 80kg × 5" shown as placeholder text under weight input
  - Pull from most recent `workout_logs` entry for same exercise ID
- Set each row: weight input + reps input + RPE (optional) + delete button
- After logging any set → auto-start rest timer based on exercise rest field
- PR badge 🏆 on exercise card if current set exceeds all-time max for that exercise

**Rest timer (floating bottom bar):**
- Shows countdown when active
- Vibrates on completion (`navigator.vibrate([200, 100, 200])`)
- User can dismiss or add 30s
- Default duration from user's settings if exercise has no rest field

**Session level:**
- Duration timer in header — elapsed time since workout started (MM:SS)
- Session notes text area at bottom of page

**On "Complete Workout":**
- Run PR detection (compare all sets against `workout_logs` history)
- Run milestone checker
- Save full log to Supabase `workout_logs`
- Advance to next day
- Show completion modal with summary: exercises done, total volume, any PRs hit, any badges earned

---

### History Page `/history` — UPDATE EXISTING

Keep everything already built. Add:

- Month selector at top: `< March 2026 >` with Export PDF button
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
- Mini line chart: weight over time (use Recharts)
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
  - Drag to reorder exercises using `@dnd-kit`
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
2. Total Sets per Week (line chart, last 12 weeks)
3. PR Progress per Exercise (line chart — dropdown to select exercise)
4. Workout Frequency Heatmap (GitHub-style calendar grid, last 12 weeks)
5. Body Weight Log (optional daily input + trend line)

**Achievements section:**
- Grid of all badges
- Earned = full color + earned date below
- Unearned = greyed out + lock icon + what's needed to unlock
- Progress shown for count-based badges (e.g. "37 / 50 workouts")

---

### Settings Page `/settings` — UPDATE EXISTING

Keep everything already built. Add:

- Account section: show logged-in email, Logout button
- Weight unit preference: `kg` / `lbs` (saved to `user_progress.weight_unit`)
- Rest timer default: number input in seconds (saved to `user_progress.rest_timer_default`)
- Rest timer vibration: toggle on/off
- Export CSV: downloads zip with 3 CSV files
- Export PDF: downloads monthly report PDF (month selector)
- Import data: upload JSON, with choice to merge or replace
- Reset program progress: confirmation dialog
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
1. Search `workout_logs` cache for most recent log containing this exercise ID
2. Get the last set's weight from that log
3. Show as placeholder: `Last time: 80kg × 5` below the weight input field
4. Pre-fill weight input with that value

---

## PR DETECTION

On every "Complete Workout":
1. For each exercise, find the max weight logged in this session
2. Query all historical `workout_logs` for the same exercise
3. If session max > all-time max → it's a PR
4. Show 🏆 badge on that exercise card
5. Save list of PR exercise names to `workout_logs.pr_exercises`
6. Show PR exercises in the completion modal

---

## COMPLETE FILE STRUCTURE

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
│   │   └── useWorkoutStore.js        ← update: Supabase sync + milestone check
│   ├── components/
│   │   ├── Header.jsx                ← update: SyncIndicator + gear icon
│   │   ├── PhaseIndicator.jsx        ← existing
│   │   ├── DayCard.jsx               ← existing
│   │   ├── ExerciseCard.jsx          ← update: muscle badge, PR badge, swap, suggestion
│   │   ├── ProgressBar.jsx           ← existing
│   │   ├── RestTimer/                ← NEW
│   │   ├── SwapExerciseModal/        ← NEW
│   │   ├── WorkoutBuilder/           ← NEW
│   │   ├── MuscleGroupBadge/         ← NEW
│   │   ├── PRBadge/                  ← NEW
│   │   ├── SyncIndicator/            ← NEW
│   │   ├── PlateCalculator/          ← NEW
│   │   ├── CompletionModal/          ← NEW
│   │   ├── MilestoneBadge/           ← NEW
│   │   ├── MilestoneToast/           ← NEW
│   │   └── TrainingAlerts/           ← NEW
│   ├── hooks/
│   │   ├── useSupabaseSync.js        ← NEW
│   │   ├── useRestTimer.js           ← NEW
│   │   ├── usePRDetection.js         ← NEW
│   │   ├── usePrevWeight.js          ← NEW
│   │   └── useMilestones.js          ← NEW
│   ├── pages/
│   │   ├── AuthPage.jsx              ← NEW
│   │   ├── DashboardPage.jsx         ← update
│   │   ├── WorkoutPage.jsx           ← update
│   │   ├── HistoryPage.jsx           ← update
│   │   ├── ExercisesPage.jsx         ← NEW
│   │   ├── ProgramPage.jsx           ← update
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
│   │   ├── warmupSets.js             ← NEW
│   │   ├── progressionSuggestion.js  ← NEW (Sprint 7)
│   │   ├── rpeTrendAnalysis.js       ← NEW (Sprint 7)
│   │   ├── milestoneChecker.js       ← NEW (Sprint 7)
│   │   ├── csvExport.js              ← NEW (Sprint 7)
│   │   └── pdfExport.js              ← NEW (Sprint 7)
│   ├── App.jsx                       ← update routes
│   └── main.jsx                      ← existing (has ErrorBoundary)
├── .env
├── .gitignore
├── vercel.json
├── package.json
└── vite.config.js
```

---

## ALL PACKAGES TO INSTALL

```bash
npm install @supabase/supabase-js date-fns lucide-react @dnd-kit/core @dnd-kit/sortable fflate jspdf jspdf-autotable
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

## IMPLEMENTATION ORDER — ALL 7 SPRINTS

---

### Sprint 1 — Supabase Foundation

1. Create `.env` with Supabase credentials
2. Create `src/lib/supabaseClient.js`
3. Build `AuthPage.jsx` (login/signup toggle, inline errors, loading state on button)
4. Add route guard to `App.jsx` — redirect to `/auth` if no session
5. Create all tables in Supabase dashboard (copy SQL from schema section above)
6. Update `useWorkoutStore.js`:
   - On login: fetch `user_progress` from Supabase, sync to store
   - On workout complete: save to `workout_logs` in Supabase
7. Create `SyncIndicator` component, add to `Header.jsx`
8. Create `useSupabaseSync.js` hook (offline queue + flush on reconnect)
9. Run `npm run build` — fix any errors before Sprint 2

---

### Sprint 2 — Muscle Groups + Exercise Library

10. Add `muscleGroup` field to every exercise in `program.json`
11. Create `src/utils/muscleGroups.js` with color map (see colors below)
12. Create `MuscleGroupBadge` component
13. Build `ExercisesPage.jsx`:
    - Tab 1: Jeff Nippard exercises (read-only, from program.json)
    - Tab 2: My Exercises (CRUD via `custom_exercises` table)
    - Search + filter by muscle group
    - Exercise detail view with history chart
14. Add `/exercises` route to `App.jsx`
15. Update bottom nav to 6 items + gear icon in header
16. Run `npm run build` — fix any errors before Sprint 3

---

### Sprint 3 — Enhanced Workout Page

17. Add `MuscleGroupBadge` to `ExerciseCard`
18. Add `PRBadge` component
19. Build `SwapExerciseModal` (3 tabs: Jeff subs | same muscle | search all)
20. Build `RestTimer` component (countdown, vibrate, +30s, dismiss)
21. Build `usePrevWeight.js` hook — fetch last session weight per exercise
22. Build `usePRDetection.js` hook — detect PRs on completion
23. Show "Last time: 80kg × 5" placeholder in workout inputs
24. Add duration timer to workout header
25. Add session notes field to workout page
26. Build `CompletionModal` — shown after complete workout (volume, PRs, badges)
27. Add superset visual grouping (A1/A2 bracket connector line)
28. Run `npm run build` — fix any errors before Sprint 4

---

### Sprint 4 — Custom Workout Builder

29. Build `WorkoutBuilder` component:
    - Exercise picker (search + muscle group filter)
    - Drag-to-reorder using `@dnd-kit`
    - Superset pair toggle
    - Save to `custom_workouts`
30. Update `ProgramPage.jsx`:
    - "Jeff Nippard" tab (existing)
    - "My Workouts" tab — list + edit + delete + "Use Today"
    - "Create Workout" button → opens WorkoutBuilder
31. "Use This Workout Today" flow → load into workout session → navigate to `/workout`
32. Run `npm run build` — fix any errors before Sprint 5

---

### Sprint 5 — History + Stats

33. Update `HistoryPage.jsx`:
    - Month selector + Export PDF button
    - Filter bar
    - Volume + muscle group display per card
    - Edit modal (update Supabase)
    - PR section at top
34. Build `StatsPage.jsx`:
    - Weekly volume by muscle group (stacked bar)
    - Total sets per week (line chart)
    - PR progress per exercise (line chart + exercise dropdown)
    - Frequency heatmap (calendar grid)
    - Body weight log + trend line
    - Achievements grid (all badges, earned/unearned states)
35. Add `/stats` route
36. Run `npm run build` — fix any errors before Sprint 6

---

### Sprint 6 — Polish + PWA

37. Build `PlateCalculator` component (modal: enter weight → plate breakdown per side)
38. Build warm-up set generator (auto-calculate % ramp-up sets in workout page)
39. Add streak tracking to Dashboard (consecutive days with a logged workout)
40. Add 1RM calculator inline on exercise cards (Epley formula: weight × (1 + reps/30))
41. Update `SettingsPage.jsx` with all new options (weight unit, rest timer, vibration, delete account)
42. Add PWA `manifest.json` + service worker
43. Fix iOS keyboard: add `paddingBottom` to scroll container when input is focused
44. Dark mode audit on all new components — use Tailwind `dark:` variants throughout
45. Add `vercel.json`
46. Run `npm run build` — fix any errors before Sprint 7

---

### Sprint 7 — Intelligence + Export

---

#### Feature 1: Progressive Overload Suggestions

**Where it shows:** Workout page — green dismissable banner under each exercise name.

**Logic:**
1. When workout page loads, for each exercise fetch the last 2 sessions
   that included that exercise from `workout_logs`
2. Compare last session's top set against the session before it
3. Apply suggestion rules:
   - Last session hit TOP of rep range at RPE ≤ 8 →
     suggest adding weight: +2.5kg upper body, +5kg lower body
   - Last session hit TOP of rep range at RPE 9-10 →
     suggest same weight, aim for more reps
   - Last session did NOT hit top of rep range →
     suggest same weight, complete the reps first
   - First time doing this exercise → no suggestion shown
4. Display: `💡 Try 82.5kg today — you hit 80kg × 5 at RPE 8 last session`
5. User can dismiss per exercise (session state only, not persisted)

**New utility:** `src/utils/progressionSuggestion.js`
```js
// Input: array of past workout logs for this exercise (sorted newest first)
// Output: { suggest: boolean, message: string, recommendedWeight: number }
export function getProgressionSuggestion(exerciseHistory, repRange, bodyPart) {}
```

---

#### Feature 2: RPE Trend Alerts

**Where it shows:** Dashboard "Training Alerts" card + Exercise detail view in `/exercises`.

**Logic:**
1. For each exercise, look at the last 4 sessions where it was logged
2. Extract weight + RPE for the top set of each session
3. If same weight (±2.5kg) shows RPE increasing across 3+ consecutive sessions → alert
   Example: week 1 RPE 7 → week 2 RPE 8 → week 3 RPE 9 = alert triggered
4. Alert message: `⚠️ Your RPE on Bench Press has been climbing for 3 weeks
   at the same weight. Consider a deload set or reducing load by 10%.`
5. Dismiss button per alert — store dismissed IDs in `user_progress.dismissed_alerts`
6. Dashboard Training Alerts card: only shown when there are active (non-dismissed) alerts

**New utility:** `src/utils/rpeTrendAnalysis.js`
```js
// Input: array of past workout logs for this exercise (sorted newest first)
// Output: { hasAlert: boolean, message: string, severity: 'warning' | 'danger' }
export function analyzeRPETrend(exerciseHistory) {}
```

---

#### Feature 3: Milestone Badges

**Where it shows:** Stats page Achievements section + toast notification when earned.

**All badges:**

Workout count:
- 🏋️ `first_workout` — First Workout — complete 1 workout
- 🔥 `workouts_10` — 10 Workouts — complete 10 workouts
- 💪 `workouts_25` — 25 Workouts
- 🥇 `workouts_50` — 50 Workouts
- 🏆 `workouts_100` — 100 Workouts

Streaks:
- ⚡ `streak_7` — 7-Day Streak
- 🔥 `streak_14` — 14-Day Streak
- 👑 `streak_30` — 30-Day Streak
- 🦾 `streak_60` — 60-Day Streak

Strength (auto-detected from workout_logs):
- Bench Press: `bench_60kg`, `bench_80kg`, `bench_100kg`, `bench_120kg`
- Squat: `squat_80kg`, `squat_100kg`, `squat_120kg`, `squat_140kg`
- Deadlift: `deadlift_100kg`, `deadlift_120kg`, `deadlift_140kg`, `deadlift_160kg`
- Overhead Press: `ohp_40kg`, `ohp_60kg`, `ohp_80kg`

Program:
- 📅 `phase_1_complete` — Phase 1 Complete
- 📅 `phase_2_complete` — Phase 2 Complete
- 📅 `phase_3_complete` — Phase 3 Complete
- 🎯 `program_complete` — Full Program Done

**Check logic:**
- Run `checkMilestones()` after every "Complete Workout"
- For any newly earned badge: insert into `achievements` table + show toast

**Toast:** Full-screen overlay 2.5s (dismissable), badge icon large, badge name,
description, CSS confetti animation (no library — use keyframes only)

**New utility:** `src/utils/milestoneChecker.js`
```js
export const BADGES = [
  { id: 'first_workout', label: 'First Workout', icon: '🏋️',
    description: 'Completed your first workout', type: 'count', threshold: 1 },
  // ... all badges
];
export function checkMilestones(stats, alreadyEarned) {}
// returns array of newly earned badge IDs
```

**New hook:** `src/hooks/useMilestones.js`
- Fetches earned achievements from Supabase on app load
- Exposes `checkAndAward(stats)` called after every workout completion
- Triggers toast when new badges earned

---

#### Feature 4: Export to CSV

**Where it shows:** Settings page — "Export Data" section, downloads a zip file.

**Three CSV files inside the zip:**

File 1: `workout_history.csv`
```
Date, Workout, Phase, Week, Exercise, Muscle Group, Set, Weight (kg), Reps, RPE, Volume (kg)
```

File 2: `personal_records.csv`
```
Exercise, Muscle Group, Max Weight (kg), Reps at Max, Estimated 1RM, Date Achieved
```

File 3: `weekly_volume.csv`
```
Week Starting, Chest Sets, Back Sets, Shoulders Sets, Biceps Sets, Triceps Sets, Quads Sets, Hamstrings Sets, Glutes Sets, Calves Sets, Core Sets
```

**Implementation:**
- Pure JS — build CSV strings from `workout_logs` data already in memory
- Use `fflate` to zip all 3 files
- Trigger download: `URL.createObjectURL(new Blob(...))`
- Zip filename: `ppl-tracker-export-YYYY-MM-DD.zip`

**New utility:** `src/utils/csvExport.js`
```js
export function buildWorkoutHistoryCSV(workoutLogs) {}
export function buildPRsCSV(workoutLogs) {}
export function buildWeeklyVolumeCSV(workoutLogs) {}
export function downloadAsZip(files) {} // uses fflate
```

---

#### Feature 5: Training Log PDF

**Where it shows:** History page — "Export PDF" button next to month selector.
Also in Settings page — "Download Monthly Report" button.

**PDF contents:**
- Page 1 cover: app name, user email, month + year, total workouts,
  total volume, top PRs this month
- One section per workout day:
  - Date, workout label, duration
  - Table: Exercise | Sets | Weight | Reps | RPE | Volume
  - Session notes (if any)
- Last page monthly summary table:
  - Sets + volume per muscle group
  - PRs hit this month
  - Consistency score: (workouts completed ÷ workouts scheduled) × 100%

**Library:** `jspdf` + `jspdf-autotable` (already in install list)

**PDF styling:**
- Clean minimal layout — white background, dark text
- App name header on every page
- Page numbers in footer
- Muscle group color accents on section headers (use hex from `muscleGroups.js`)
- Alternating row shading on tables (very light gray on even rows)

**New utility:** `src/utils/pdfExport.js`
```js
// Input: workout_logs for selected month, userEmail, month, year
// Output: triggers PDF download
export function generateMonthlyPDF(workoutLogs, userEmail, month, year) {}
```

**Month selector:** `< March 2026 >` arrows in History page header
Show loading spinner on Export PDF button while generating (can take 1-2 seconds)

---

#### Sprint 7 — New files summary

New files:
```
src/utils/progressionSuggestion.js
src/utils/rpeTrendAnalysis.js
src/utils/milestoneChecker.js
src/utils/csvExport.js
src/utils/pdfExport.js
src/hooks/useMilestones.js
src/components/MilestoneBadge/
src/components/MilestoneToast/
src/components/TrainingAlerts/
```

Updated files:
```
src/pages/WorkoutPage.jsx       — progression suggestions + PR badges
src/pages/StatsPage.jsx         — achievements grid
src/pages/HistoryPage.jsx       — month selector + Export PDF button
src/pages/DashboardPage.jsx     — Training Alerts card
src/pages/SettingsPage.jsx      — Export CSV + Export PDF buttons
src/store/useWorkoutStore.js    — call checkMilestones() on workout complete
```

Run `npm run build` after all Sprint 7 features. Fix all errors.

---

## MUSCLE GROUP COLOR MAP

Use these in `src/utils/muscleGroups.js` and for PDF section headers:

```js
export const MUSCLE_COLORS = {
  Chest:       { bg: '#FDE8E8', text: '#C0392B' },
  Back:        { bg: '#E8F4FD', text: '#1A5276' },
  Shoulders:   { bg: '#FEF9E7', text: '#B7950B' },
  Biceps:      { bg: '#E8F8F5', text: '#0E6655' },
  Triceps:     { bg: '#F4ECF7', text: '#7D3C98' },
  Quads:       { bg: '#EBF5FB', text: '#1F618D' },
  Hamstrings:  { bg: '#FDF2E9', text: '#CA6F1E' },
  Glutes:      { bg: '#F8F9FA', text: '#717D7E' },
  Calves:      { bg: '#E9F7EF', text: '#1E8449' },
  Core:        { bg: '#FDEDEC', text: '#CB4335' },
  'Full Body': { bg: '#F2F3F4', text: '#2C3E50' },
};
```

---

## KEY RULES — APPLY TO EVERY TASK

1. Read this entire file before writing a single line of code
2. Never rebuild or overwrite anything in the "Already Built" section
3. Never delete `program.json` or modify its exercise list — only add `muscleGroup`
4. Supabase is the source of truth — localStorage is only a cache
5. Every new page must be mobile-first and work at 390px width
6. Dark mode must work on every new component — use Tailwind `dark:` variants
7. No manual Save buttons in the workout flow — everything auto-saves
8. All Supabase operations must have try/catch — never expose raw errors to the user
9. RLS must be enabled on all tables — users can only access their own data
10. Run `npm run build` after every sprint and fix all errors before the next sprint
11. Update `Completed_Tasks.md` after each sprint with exactly what was done
12. Every page must have a proper empty state and loading skeleton — never a blank screen
