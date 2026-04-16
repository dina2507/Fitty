# Fitty

Fitty is a modern strength training tracker focused on consistency, progression, and data reliability. It helps users follow structured workout programming, log training sessions quickly, track personal records, and analyze progress over time.

URL : https://fitty-three.vercel.app/

## Highlights

- Guided workout flow with day-by-day training structure
- Fast set logging for reps, weight, notes, and session details
- Personal record detection with milestone feedback
- Workout history with editing and trend visibility
- Built-in training tools (plate calculator, warm-up support, progression helpers)
- Local-first behavior with optional cloud sync architecture
- Google Drive backup and restore support

## Tech Stack

### Frontend

- React 18
- Vite 5
- React Router 6
- Zustand for state management
- Tailwind CSS

### Data and Integrations

- Supabase (PostgreSQL, Auth, row-level security)
- Supabase Realtime patterns + sync queue flow
- Google Drive API for backup/restore

### Visualization and Utilities

- Recharts (charts and trends)
- date-fns (date handling)
- jsPDF + jsPDF-AutoTable (PDF export)
- fflate (compression utilities)

## Core Product Areas

- Dashboard: daily focus, progress visibility, and status indicators
- Workout Session: active workout logging, set tracking, swaps, and completion flow
- Program: default plan + user-level customizations
- History: completed workout archive with edit/delete workflows
- Records and Stats: PR visibility, analytics, volume/trend insights
- Settings and Tools: preferences, backup controls, utilities

## Project Structure

```text
src/
  components/        Reusable UI and workout-specific components
  hooks/             Feature hooks (PR detection, timers, milestones)
  lib/               External service integration (Supabase, Google Drive)
  pages/             Route-level pages
  store/             Zustand global store and workout state logic
  utils/             Progression, export, analytics, and helper utilities
  data/              Program data used by the app
scripts/             Project utility scripts and SQL helper scripts
public/              Static assets, PWA manifest, and service worker
```

## Local Development Setup

### 1. Prerequisites

- Node.js 18+ (recommended)
- npm 9+ (or compatible package manager)
- Supabase project (if cloud features are enabled)
- Google Cloud OAuth client (for Drive backup)

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

Notes:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are required for Supabase integration.
- `VITE_GOOGLE_CLIENT_ID` is required only if you want Google Drive backup/restore.

### 4. Initialize database schema

Run the SQL in [supabase_schema.sql](supabase_schema.sql) using Supabase SQL Editor.

If needed for stable workout log sync behavior, also run migration SQL from [scripts/workout_logs_stable_sync_migration.sql](scripts/workout_logs_stable_sync_migration.sql).

### 5. Run the app

```bash
npm run dev
```

Open the local URL shown by Vite (typically `http://localhost:5173`).

## Available Scripts

- `npm run dev`: start development server
- `npm run build`: create production build
- `npm run preview`: preview production build locally

## Database Model (Summary)

The Supabase schema includes these primary tables:

- `user_progress`: current training position and app-level preferences
- `workout_logs`: completed workout sessions and metadata
- `custom_exercises`: user-defined exercise library
- `custom_workouts`: user-authored workout templates
- `bodyweight_logs`: bodyweight progression by date
- `program_customizations`: permanent program exercise swaps

All tables are configured with row-level security policies to scope data to each authenticated user.

## Sync, Reliability, and Backups

- Local-first operation ensures session continuity during connectivity issues
- Queue-based mutation flow supports deferred cloud sync
- Workout log timestamp handling supports safer conflict resolution
- Google Drive backup stores files in a folder named `Fitty Backups`

Current repository default:

- In `src/store/useWorkoutStore.js`, `CLOUD_SYNC_ENABLED` is currently set to `false` for local-first mode.
- Set it to `true` only after Supabase configuration and schema are verified.

## Build and Deployment

This project is configured for Vite-based deployment and includes [vercel.json](vercel.json) for Vercel environments.

Recommended deployment flow:

1. Push repository to your Git provider
2. Import project into Vercel
3. Set environment variables in Vercel project settings
4. Deploy and verify routing/auth/integration behavior

## Security and Privacy Notes

- Supabase row-level security policies protect user data isolation
- OAuth tokens for Drive integration are handled client-side for user-authorized actions
- Avoid committing `.env` files or sensitive credentials

## Suggested Future Improvements

- Add comprehensive automated tests (unit + integration + e2e)
- Add explicit API contracts and architecture diagrams
- Add CI checks for linting, tests, and build validation
- Add release notes and versioned changelog process

## Contributing

1. Create a feature branch
2. Make focused changes with clear commit messages
3. Validate local build and critical flows
4. Open a pull request with screenshots or test notes where relevant

## Author

Dinagar (24BDS0325)

## Acknowledgments

Built with React, Vite, Tailwind CSS, Supabase, and Google Drive APIs.
