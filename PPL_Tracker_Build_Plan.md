# PPL Workout Tracker — Full Build Plan
## Jeff Nippard's Ultimate Push Pull Legs System (6x/Week)

---

## 1. Project Overview

Build a **responsive, offline-capable web app** that replaces the Excel sheet entirely. The user opens the site, sees today's workout automatically, logs their sets, and data is saved persistently. No manual week/day tracking needed.

**Program structure (from spreadsheet):**
- 3 Phases: Phase 1 (Base Hypertrophy), Phase 2, Phase 3
- Each phase = 6 weeks
- Each week = 6 workout days + 1 mandatory rest day
- Day order per week: Push #1 → Pull #1 → Legs #1 → Push #2 → Pull #2 → Legs #2 → Rest
- Each exercise has: Exercise Name, Warm-up Sets, Working Sets, Reps, Load (user fills), RPE, Rest, Substitution Option 1, Substitution Option 2, Notes

---

## 2. Tech Stack (Recommended)

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React (Vite) | Component-driven, fast dev |
| Styling | Tailwind CSS | Utility-first, mobile-friendly |
| State Management | Zustand | Lightweight, persistent |
| Local Persistence | localStorage + IndexedDB | No backend needed, offline support |
| Data Seeding | Static JSON file (generated from xlsx) | Embed all workout data at build time |
| Hosting | Vercel / Netlify (free tier) | Zero-config deploy |

> **No backend or database required.** Everything lives in the browser. Data can optionally be exported as JSON.

---

## 3. Data Model

### 3.1 Static Workout Data (Embedded JSON)

Pre-parse the Excel into a structured JSON file at build time. This is the read-only program template.

```json
{
  "phases": [
    {
      "id": "phase_1",
      "name": "Phase 1 - Base Hypertrophy (Moderate Volume, Moderate Intensity)",
      "weeks": [
        {
          "weekNumber": 1,
          "isSemiDeload": false,
          "days": [
            {
              "dayIndex": 0,
              "label": "Push #1",
              "type": "push",
              "isRest": false,
              "exercises": [
                {
                  "id": "p1_w1_d1_ex1",
                  "name": "Bench Press",
                  "warmupSets": "3+4",
                  "workingSets": 1,
                  "reps": "3-5",
                  "rpe": "8-9",
                  "rest": "~3-4 min",
                  "sub1": "DB Bench Press",
                  "sub2": "Machine Chest Press",
                  "notes": "Set up a comfortable arch, quick pause on the chest and explode up on each rep"
                }
              ]
            },
            {
              "dayIndex": 6,
              "label": "Rest Day",
              "type": "rest",
              "isRest": true,
              "exercises": []
            }
          ]
        }
      ]
    }
  ]
}
```

> **Note on RPE from spreadsheet:** Some RPE cells were stored as Excel date serials (e.g., `2022-08-09` = RPE `8-9`, `2022-09-10` = RPE `9-10`). Decode them during the JSON generation script: `8-9` and `9-10` are the actual RPE values.

### 3.2 User Progress Data (localStorage)

```json
{
  "programStart": "2025-03-01",
  "currentPhaseId": "phase_1",
  "currentWeek": 1,
  "currentDayIndex": 0,
  "completedDays": [
    {
      "date": "2025-03-01",
      "phaseId": "phase_1",
      "week": 1,
      "dayIndex": 0,
      "label": "Push #1",
      "exercises": [
        {
          "exerciseId": "p1_w1_d1_ex1",
          "sets": [
            { "setNumber": 1, "weight": 80, "reps": 5, "notes": "" }
          ]
        }
      ]
    }
  ]
}
```

---

## 4. App Structure & Pages

```
/                    → Dashboard (Today's Workout)
/workout             → Active workout logging screen
/history             → Past workouts log
/program             → Full program browser (read-only view of all weeks/phases)
/settings            → Set program start date, reset progress, export data
```

---

## 5. Feature Specifications

### 5.1 Auto Day/Week Tracking

**Logic:**
1. On first launch, prompt user to set their **program start date** (stored in localStorage).
2. Each completed workout advances to the next day automatically.
3. Rest day is skipped automatically (shown as a card, no logging needed).
4. Week advances after 6 workout days are completed (not calendar-based — program-progression based).
5. Phase advances after the last week of that phase is completed.

**Key rule:** Day advancement is triggered by the user clicking **"Complete Workout"**, not by the calendar date. This handles missed days, rest days, and travel gracefully.

```js
// Pseudocode for next day logic
function getNextDay(currentPhase, currentWeek, currentDayIndex) {
  const days = program[currentPhase].weeks[currentWeek].days;
  if (currentDayIndex + 1 < days.length) {
    return { week: currentWeek, dayIndex: currentDayIndex + 1 };
  } else {
    // Move to next week
    if (currentWeek + 1 < program[currentPhase].weeks.length) {
      return { week: currentWeek + 1, dayIndex: 0 };
    } else {
      // Move to next phase
      return { phase: nextPhase, week: 0, dayIndex: 0 };
    }
  }
}
```

### 5.2 Dashboard (Home Screen)

Displays:
- Current position badge: `Phase 1 · Week 2 · Day 3 of 6`
- Workout label: `Push #1`
- List of all exercises for today (collapsed by default, expandable)
- "Start Workout" CTA button
- If it's a rest day, show a rest card with a motivational message and "Mark Rest Day Done" button

### 5.3 Active Workout Screen

For each exercise, show a card with:

```
┌─────────────────────────────────────────┐
│ Bench Press                             │
│ Warm-up: 3+4 sets · Working: 1 set     │
│ Target Reps: 3-5 · RPE: 8-9           │
│ Rest: ~3-4 min                          │
│                                         │
│ Substitutions:                          │
│   Alt 1: DB Bench Press                 │
│   Alt 2: Machine Chest Press           │
│                                         │
│ Notes: Set up a comfortable arch...     │
│                                         │
│ LOG SETS:                               │
│  Set 1: [Weight: ___kg] [Reps: __]     │
│  + Add Set                              │
└─────────────────────────────────────────┘
```

**Features:**
- Add/remove sets per exercise (CRUD on sets)
- Edit weight and reps inline
- Notes field per exercise (optional)
- Swap exercise button → opens modal with Alt 1 / Alt 2 options
- Progress indicator at top: "3 / 7 exercises done"
- Floating "Complete Workout" button (sticky bottom)
- Auto-save every change to localStorage (no manual save needed)

### 5.4 CRUD Operations

| Action | Where | Behaviour |
|---|---|---|
| **Create** | Workout screen | Add extra sets to any exercise |
| **Read** | Dashboard, Workout screen | View all workout data |
| **Update** | Workout screen | Edit weight, reps, notes inline |
| **Delete** | Workout screen | Remove a set, or clear a logged workout |
| **Update** | History screen | Edit any past workout log |
| **Delete** | History screen | Delete a past workout entry |
| **Update** | Settings | Change program start date, swap active week |

### 5.5 History Screen

- Chronological list of completed workouts
- Each entry shows: date, phase, week, day label, exercises summary
- Tap to expand full set/rep log
- Edit and delete buttons per entry
- Filter by phase / workout type (push/pull/legs)

### 5.6 Program Browser

- Read-only view of entire program structure
- Navigate by Phase → Week → Day
- Useful for preview/planning ahead
- Highlight current position in the program

### 5.7 Settings

- **Set Start Date**: Allows retroactive start date entry
- **Jump to Week/Phase**: Manual override if user is resuming mid-program
- **Export Data**: Download all logs as JSON file
- **Import Data**: Restore from JSON backup
- **Reset Progress**: Clears all logs and resets to Week 1 Day 1

---

## 6. Auto-Save Strategy

> This directly solves the "I have to save every time or else the logs go off" problem.

- Use a **debounced auto-save** — every time the user types a weight or rep, save to localStorage after 500ms of inactivity.
- Show a subtle "Saved ✓" indicator after each save.
- On app load, rehydrate state from localStorage.
- Before tab close (`beforeunload` event), force a final save.
- Optionally, auto-export a JSON backup every 7 days to the user's Downloads folder.

---

## 7. Component Tree

```
App
├── Router
│   ├── DashboardPage
│   │   ├── CurrentDayBadge
│   │   ├── WorkoutPreviewCard
│   │   │   └── ExercisePreviewRow (×N)
│   │   └── StartWorkoutButton
│   │
│   ├── WorkoutPage
│   │   ├── WorkoutHeader (progress bar)
│   │   ├── ExerciseCard (×N)
│   │   │   ├── ExerciseInfo (name, sets, reps, RPE, rest)
│   │   │   ├── SubstitutionBadges
│   │   │   ├── NotesCollapsible
│   │   │   └── SetLogger
│   │   │       ├── SetRow (×N) [weight, reps, delete]
│   │   │       └── AddSetButton
│   │   └── CompleteWorkoutButton (sticky)
│   │
│   ├── HistoryPage
│   │   ├── WorkoutHistoryItem (×N)
│   │   │   └── ExerciseLogDetail (expanded)
│   │   └── FilterBar
│   │
│   ├── ProgramPage
│   │   ├── PhaseSelector
│   │   ├── WeekSelector
│   │   └── DayView (read-only)
│   │
│   └── SettingsPage
│       ├── StartDatePicker
│       ├── JumpToWeekSelector
│       ├── ExportButton
│       ├── ImportButton
│       └── ResetButton
│
└── GlobalComponents
    ├── BottomNavBar
    ├── AutoSaveIndicator
    └── Toast/Notifications
```

---

## 8. Data Seeding Script

Write a one-time Node.js script (`scripts/parse-xlsx.js`) that:
1. Reads `The_Ultimate_Push_Pull_Legs_System_-_6x.xlsx` using the `xlsx` npm package
2. Parses all 3 sheets (Phase 1, Phase 2, Phase 3)
3. Decodes RPE values (Excel date serials → actual RPE strings)
4. Structures data into the JSON schema defined in Section 3.1
5. Writes output to `src/data/program.json`

This JSON file is bundled into the app at build time — no runtime parsing of the Excel file needed.

**RPE Decoding Map (from observed Excel date serials):**
```js
const RPE_MAP = {
  "2022-08-09": "8-9",
  "2022-09-10": "9-10",
  "2022-12-15": "12-15", // This is actually a Reps value misread
};
```

---

## 9. Mobile-First UI Guidelines

- All tap targets minimum 44×44px
- Sticky bottom nav: Home · Workout · History · Program · Settings
- Exercise cards should be swipeable (swipe left to delete a set)
- Keyboard should push content up, not hide input fields (use `paddingBottom` tricks on iOS)
- Dark mode support from day one (Tailwind `dark:` variants)
- Keep workout logging one-handed friendly — large input fields

---

## 10. File/Folder Structure

```
ppl-tracker/
├── public/
├── src/
│   ├── data/
│   │   └── program.json          ← Generated by seed script
│   ├── store/
│   │   └── useWorkoutStore.js    ← Zustand store (progress + logs)
│   ├── components/
│   │   ├── ExerciseCard/
│   │   ├── SetLogger/
│   │   ├── WorkoutHeader/
│   │   └── BottomNav/
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── Workout.jsx
│   │   ├── History.jsx
│   │   ├── Program.jsx
│   │   └── Settings.jsx
│   ├── utils/
│   │   ├── progressTracker.js    ← Day/week advancement logic
│   │   └── storage.js            ← localStorage helpers
│   ├── App.jsx
│   └── main.jsx
├── scripts/
│   └── parse-xlsx.js             ← One-time data seeding script
├── package.json
└── vite.config.js
```

---

## 11. Implementation Order (Suggested Sprints)

### Sprint 1 — Foundation
1. Set up Vite + React + Tailwind
2. Write `parse-xlsx.js` and generate `program.json`
3. Set up Zustand store with localStorage persistence
4. Build progress tracking logic (`progressTracker.js`)

### Sprint 2 — Core Workout Flow
5. Dashboard page with today's workout display
6. Workout page with full exercise card layout
7. Set logging (add/edit/delete sets inline)
8. Auto-save on every change
9. "Complete Workout" → advance to next day

### Sprint 3 — Supporting Pages
10. History page with full CRUD on past logs
11. Settings page (start date, jump to week, reset)
12. Program browser (read-only)

### Sprint 4 — Polish
13. Mobile optimisation (iOS keyboard, touch targets)
14. Dark mode
15. Export/import JSON backup
16. PWA manifest + service worker (makes it installable on phone home screen)
17. Rest day handling with motivational UI

---

## 12. Key Edge Cases to Handle

| Edge Case | Solution |
|---|---|
| User misses a day | Day advancement is manual (tap "Complete") — missed days don't auto-skip |
| Week 6 is semi-deload | Flag `isSemiDeload: true` in JSON, show banner on dashboard |
| Exercises with superset notation (A1., A2.) | Group them visually with a connector line in the UI |
| RPE shown as a date in Excel | Decode via RPE_MAP during JSON seeding |
| Load column is always empty | It's a user-input field — pre-populate with previous session's weight if available |
| Phase transition | Show congratulations modal, auto-advance to Phase 2 Week 1 |
| Program completion (all 3 phases done) | Show completion screen, offer to restart or stay on Phase 3 |

---

## 13. Nice-to-Have Features (Post-MVP)

- Personal record (PR) detection — highlight when a new max weight is logged
- Rest timer with vibration alert
- Volume tracking charts (weekly sets per muscle group)
- Body weight log
- Notes per workout session (not just per exercise)
- Cloud sync via Supabase (if user wants cross-device access)

---

*This plan covers the full scope from data extraction to deployment. The agent should follow the sprint order and refer back to the Data Model (Section 3) and Feature Specifications (Section 5) for all implementation decisions.*
