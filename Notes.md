# Completed Tasks

_Last updated: 2026-03-18_

This file lists tasks completed so far for the PPL Workout Tracker build.

## 1. Project Setup and Tooling

- [x] Initialized React + Vite project structure
- [x] Added project manifest and scripts in `package.json`
- [x] Configured Vite in `vite.config.js`
- [x] Configured Tailwind in `tailwind.config.js`
- [x] Configured PostCSS in `postcss.config.js`
- [x] Added `.gitignore`
- [x] Added root app entry file `index.html` for Vite builds
- [x] Added `public/index.html`

## 2. Base App Bootstrap

- [x] Added React entry point in `src/main.jsx`
- [x] Added global styles and Tailwind directives in `src/index.css`
- [x] Created app shell in `src/App.jsx`

## 3. Program Data Integration

- [x] Added workout program data file `src/data/program.json`
- [x] Synced full dataset from root `program.json` into `src/data/program.json`

## 4. Persistence and Progression Utilities

- [x] Implemented storage utility in `src/utils/storage.js`
- [x] Implemented progression utility in `src/utils/progressTracker.js`
- [x] Added robust next-day traversal across day/week/phase with rest-day skipping
- [x] Added day-type theme utility in `src/utils/dayTheme.js`

## 5. Zustand Store and Data Flow

- [x] Implemented global workout store in `src/store/useWorkoutStore.js`
- [x] Implemented store initialization from localStorage
- [x] Implemented workout completion flow and auto-advance
- [x] Implemented skip-day flow
- [x] Implemented manual day jump
- [x] Implemented export/import/reset actions
- [x] Added saved-progress validation guards

## 6. Shared UI Components

- [x] Created `src/components/Header.jsx`
- [x] Created `src/components/PhaseIndicator.jsx`
- [x] Created `src/components/DayCard.jsx`
- [x] Created `src/components/ExerciseCard.jsx`
- [x] Created `src/components/ProgressBar.jsx`

## 7. App Pages and Routing

- [x] Added dashboard page `src/pages/DashboardPage.jsx`
- [x] Added workout page `src/pages/WorkoutPage.jsx`
- [x] Added history page `src/pages/HistoryPage.jsx`
- [x] Added settings page `src/pages/SettingsPage.jsx`
- [x] Wired routes: `/`, `/workout`, `/history`, `/settings`
- [x] Added fallback route redirect to `/`

## 8. Dashboard Features Completed

- [x] Current phase/week/day display
- [x] Weekly plan cards with day jump action
- [x] Weekly workout progress bar
- [x] Quick actions for workout and history navigation

## 9. Workout Logging Features Completed

- [x] Exercise detail rendering per day
- [x] Per-exercise input fields (weight, reps, effort, notes)
- [x] Complete workout action
- [x] Skip day action
- [x] Rest-day handling UI

## 10. History and Settings Features Completed

- [x] Completed workout list rendering
- [x] Delete completed workout entries
- [x] Program start date update in settings
- [x] Export progress data to JSON text
- [x] Import progress data from JSON text
- [x] Reset program progress

## 11. Validation and Build Status

- [x] Installed dependencies with `npm install`
- [x] Verified production build with `npm run build`
- [x] Verified local startup with `npm run dev`

## 12. Sprint 3 - Enhanced Workout Page

- [x] Integrated PR detection into active workout flow (live per-exercise PR state)
- [x] Added PR badge rendering on workout exercise cards
- [x] Reworked Swap Exercise modal to 3 tabs: Jeff Subs, Same Muscle, Search All
- [x] Enabled rest timer +30 seconds action and connected dismiss/skip behavior
- [x] Updated previous-weight hook to fetch latest logged set per active exercise
- [x] Added auto-prefill for blank weight inputs from last session values
- [x] Displayed `Last time: weight x reps` hints directly under workout weight inputs
- [x] Added/validated running session duration timer in workout header
- [x] Kept session notes in workout flow and persisted notes/duration/PR metadata on save
- [x] Wired completion modal before final save with volume, set count, and PR summary
- [x] Added superset visual grouping treatment with A1/A2 tags and connector styling
- [x] Verified Sprint 3 build success with `npm run build`

## 13. Sprint 4 - Custom Workout Builder

- [x] Kept Exercise Picker with search + muscle-group filtering for program/custom exercise sources
- [x] Implemented drag-to-reorder in `WorkoutBuilder` using `@dnd-kit` (`DndContext` + `SortableContext` + `useSortable`)
- [x] Added drag handle UI and maintained manual up/down controls as fallback
- [x] Preserved and improved superset pair toggle behavior for exercise pairs
- [x] Hardened builder template load/save flows with error-safe async handling
- [x] Kept Program page dual tabs (`Jeff Nippard` / `My Workouts`) and custom template CRUD
- [x] Kept and confirmed `Create Workout` -> `/builder` flow
- [x] Kept and confirmed `Use This Workout Today` flow -> loads template in store -> navigates to `/workout`
- [x] Verified Sprint 4 build success with `npm run build`

## 14. Sprint 5 - History + Stats

- [x] Updated `HistoryPage` with month selector (`< Month Year >`) and `Export PDF` action
- [x] Added top PR leaderboard section showing all-time max per exercise with highlight badge
- [x] Added filter bar for workout type (`All/Push/Pull/Legs`) plus muscle-group filter pills
- [x] Expanded workout cards now show date, type, muscle badges, total sets, and total volume summary
- [x] Added edit workflow via modal (set/rep/RPE + notes) and saved updates to local cache + Supabase
- [x] Added delete workflow with confirmation and Supabase deletion sync
- [x] Built full `StatsPage` charts:
- [x] Weekly Volume by Muscle Group (stacked bar, last 8 weeks)
- [x] Total Sets per Week (line chart, last 12 weeks)
- [x] PR Progress per Exercise (dropdown + dual line chart)
- [x] Workout Frequency Heatmap (GitHub-style, last 12 weeks)
- [x] Body Weight Log input + trend line
- [x] Added Achievements grid with earned/locked states and count/streak progress indicators
- [x] Confirmed `/stats` route is already wired and protected in `App.jsx`
- [x] Verified Sprint 5 build success with `npm run build`

## 15. Pre-Sprint 6 UX Polish (History + Stats)

- [x] Polished `HistoryPage` month navigation with disabled future-month navigation + `This Month` shortcut
- [x] Improved `HistoryPage` filter UX with active-filter status and one-tap `Clear Filters`
- [x] Added `HistoryPage` monthly summary stat cards (sessions, sets, volume) for faster scanning
- [x] Enhanced `HistoryPage` empty state with clear next actions (`This Month`, reset filters, start workout)
- [x] Added `HistoryPage` session-notes block in expanded workout details for better context recall
- [x] Added top KPI cards to `StatsPage` (sessions, total volume, avg sets/week, best streak)
- [x] Improved `StatsPage` chart readability via shorter week labels + refined tooltip styling
- [x] Added richer `StatsPage` empty state CTA (`Start a Workout`)
- [x] Improved `StatsPage` heatmap and bodyweight sections with concise contextual summaries
- [x] Enhanced `StatsPage` achievements panel with earned count and progress bars on count/streak badges
- [x] Verified post-polish build success with `npm run build`

## 16. Sprint 6 - Polish + PWA

- [x] Added `PlateCalculator` modal component and integrated it into `WorkoutPage`
- [x] Added plate breakdown utility in `src/utils/plateCalc.js` with kg/lbs support
- [x] Added warm-up set generator utility in `src/utils/warmupSets.js`
- [x] Integrated warm-up suggestions into workout exercise cards based on first set or previous session weight
- [x] Added inline estimated 1RM display on workout set rows (Epley formula)
- [x] Added Dashboard streak tracking card (current streak + best streak)
- [x] Expanded store + local persistence with Sprint 6 preferences:
- [x] `weightUnit` (`kg`/`lbs`)
- [x] `restTimerDefault` (seconds)
- [x] `restTimerVibration` (toggle)
- [x] Synced `weight_unit` and `rest_timer_default` to Supabase `user_progress`
- [x] Updated rest timer hook to respect vibration preference
- [x] Updated rest timer behavior to use user default when exercise rest is not specified
- [x] Added iOS keyboard-safe bottom padding behavior on `WorkoutPage` when inputs are focused
- [x] Upgraded `SettingsPage` with:
- [x] Weight unit preference controls
- [x] Rest timer default input
- [x] Rest vibration toggle
- [x] Delete account flow (user-data deletion + sign-out; auth deletion attempted where admin access is available)
- [x] Added service worker file at `public/sw.js`
- [x] Registered service worker in `src/main.jsx`
- [x] Added dark mode variants to new Sprint 6 UI surfaces (plate calculator, warm-up card, rest bar, streak card, settings additions)
- [x] Verified Sprint 6 build success with `npm run build`

## 17. Sprint 7 - Intelligence + Reporting

- [x] Added progression recommendation engine in `src/utils/progressionSuggestion.js`
- [x] Added RPE trend analysis utility in `src/utils/rpeTrendAnalysis.js`
- [x] Added milestone definitions/checker in `src/utils/milestoneChecker.js`
- [x] Added CSV export utilities + zip download in `src/utils/csvExport.js`
- [x] Added monthly PDF report generator in `src/utils/pdfExport.js`
- [x] Added milestone awarding hook in `src/hooks/useMilestones.js`
- [x] Added milestone toast host component in `src/components/MilestoneToast/index.jsx`
- [x] Added reusable milestone badge card in `src/components/MilestoneBadge/index.jsx`
- [x] Added training alerts panel component in `src/components/TrainingAlerts/index.jsx`
- [x] Extended store + persistence for dismissed training alerts and milestone toast queue
- [x] Mounted global milestone toast host in `src/App.jsx`
- [x] Integrated progression suggestions into workout exercise cards (with dismiss support)
- [x] Added milestone award checks on workout completion in `src/pages/WorkoutPage.jsx`
- [x] Added RPE trend alerts to dashboard and exercise detail flows
- [x] Upgraded `HistoryPage` export flow to use shared monthly PDF report generator
- [x] Added `SettingsPage` analytics exports (CSV zip + month-selectable PDF report)
- [x] Updated `StatsPage` achievements grid to use reusable milestone badge cards with earned-date display
- [x] Verified Sprint 7 build success with `npm run build`
- [x] Fixed PDF export runtime issue by updating jsPDF constructor import in report utility
- [x] Added direct Excel-compatible CSV export actions in `HistoryPage` (monthly) and `SettingsPage` (all workouts)
