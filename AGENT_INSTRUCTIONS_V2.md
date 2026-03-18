# Fitty — Agent Task Brief

_Last updated: March 2026_

---

## CONTEXT — READ THIS FIRST

This is a personal PPL workout tracker used by the owner and a small group of friends/family.
Each person has their own Supabase account. The app is built with React + Vite + Tailwind + Zustand + Supabase.

**The owner's core usage pattern:**

- Logs workouts daily on their phone
- Occasionally reviews history on a laptop or a different phone
- Needs all data to be there when they switch devices

**Two problems to solve:**

1. Sync is broken — data duplicates or disappears, it behaves unpredictably
2. No reliable backup — there is no safety net if something goes wrong

---

## RULE 0 — DO NOT BREAK WHAT WORKS

Before touching any file, read the existing implementation fully.
Do not remove working features. Do not rebuild what already exists.
The program.json, all utility files, all hooks, and the Zustand store structure must stay intact.
Only modify what this task explicitly asks you to change.

---

## TASK 2 — GOOGLE DRIVE BACKUP (one-tap, like FitNotes)

### What to build

A reliable safety net: one button exports all user data to Google Drive.
One button restores from the most recent backup file in Google Drive.
This is in addition to Supabase — it is a backup, not a replacement.

The owner specifically said they love Google Drive and want one-tap backup.

### Technical approach

Use the **Google Drive REST API v3** with **Google Identity Services** (OAuth 2.0 popup).
No server needed — this is a pure browser-side OAuth flow using the `gapi` client library.

**Files to create:**

- `src/lib/googleDrive.js` — all Google Drive API logic
- `src/components/DriveBackup.jsx` — the UI component
- Update `src/pages/SettingsPage.jsx` — add a "Google Drive Backup" section

**Environment variables to add to `.env` and Vercel:**

```
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

The agent must tell the user exactly how to get this value (see instructions below).

### How to get the Google OAuth Client ID (instruct the user to do this)

Add this to the top of the TASK output or as a comment block in `googleDrive.js`:

```
SETUP REQUIRED (one-time, done by the developer):
1. Go to https://console.cloud.google.com
2. Create a new project called "Fitty"
3. Go to APIs & Services → Enable APIs → enable "Google Drive API"
4. Go to APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
5. Application type: Web application
6. Authorised JavaScript origins: add https://your-vercel-domain.vercel.app AND http://localhost:5173
7. Copy the Client ID and add it to .env as VITE_GOOGLE_CLIENT_ID
8. Go to APIs & Services → OAuth consent screen → add your email as a test user
```

### `src/lib/googleDrive.js` — implement these functions

```js
// Load the Google Identity Services + GAPI scripts dynamically (only once)
export async function loadGoogleScripts() {}

// Open OAuth popup, get access token with Drive file scope
// Scope needed: https://www.googleapis.com/auth/drive.file
// (drive.file = only files created by this app, not the user's whole Drive)
export async function signInWithGoogle() {}

// Sign out / revoke token
export async function signOutGoogle() {}

// Upload a JSON backup file to a folder called "Fitty Backups" in the user's Drive
// File name format: fitty-backup-YYYY-MM-DD-HH-MM.json
// If the folder doesn't exist, create it first
// Returns the uploaded file's Drive ID
export async function uploadBackupToDrive(data, accessToken) {}

// List all backup files in the "Fitty Backups" folder, sorted newest first
// Returns array of { id, name, createdTime }
export async function listBackupFiles(accessToken) {}

// Download a specific backup file by Drive file ID
// Returns the parsed JSON object
export async function downloadBackupFromDrive(fileId, accessToken) {}

// Delete old backups — keep only the 10 most recent files
// Call this after every successful upload
export async function pruneOldBackups(accessToken) {}
```

### `src/components/DriveBackup.jsx` — the UI

States to handle:

- `idle` — shows "Backup to Google Drive" button
- `signing_in` — shows spinner, "Connecting to Google Drive…"
- `backing_up` — shows spinner, "Creating backup…"
- `success` — shows green checkmark, "Backed up successfully · file name · timestamp"
- `restoring` — shows spinner, "Restoring from backup…"
- `error` — shows red banner with the error message

Features:

- **Backup button**: signs in if not already, then uploads JSON of all data
- **Restore button**: shows a list of the last 10 backup files with dates, user picks one
- **Last backup timestamp**: persist to localStorage as `fitty_last_drive_backup`
  so it survives page refresh
- **Auto-backup toggle**: a toggle that, when on, triggers a Drive backup automatically
  after every successful `completeWorkout` call. Store preference in localStorage
  as `fitty_auto_drive_backup` (boolean)

The data to back up is exactly what `storage.exportData()` already returns.
The data to restore is passed into `storage.importData()` then `initializeStore()`.

### Update `src/pages/SettingsPage.jsx`

Add a new section called **"Google Drive Backup"** between "Training Preferences" and
"Program Settings". It should contain the `<DriveBackup />` component.

### Update `src/store/useWorkoutStore.js`

In `completeWorkout`, after the Supabase write succeeds, add:

```js
// Auto-backup to Drive if the user has enabled it
const autoDriveBackup =
  localStorage.getItem("fitty_auto_drive_backup") === "true";
if (autoDriveBackup) {
  // Fire and forget — do not await, do not block the completion flow
  import("../lib/googleDrive").then(
    ({ uploadBackupToDrive, signInWithGoogle }) => {
      signInWithGoogle()
        .then((token) => uploadBackupToDrive(storage.exportData(), token))
        .catch(console.error);
    },
  );
}
```

### Definition of done for Task 2

- [ ] `src/lib/googleDrive.js` exists with all five functions implemented
- [ ] `src/components/DriveBackup.jsx` exists with all states handled
- [ ] Backup button works: signs in → uploads JSON → shows success with file name
- [ ] Restore button works: lists files → user picks one → data restored → page reloads
- [ ] Auto-backup toggle works and persists across page refresh
- [ ] Last backup time shown in the UI
- [ ] Old backups pruned to last 10 after each upload
- [ ] The setup instructions for the OAuth Client ID are printed as a comment block at the
      top of `src/lib/googleDrive.js` so the developer knows what to do
- [ ] `npm run build` passes

---

## TASK 3 — CLEANER WORKOUT LOG UI (faster logging on mobile)

The current workout page has too many tabs, too many buttons, and too much nesting.
On a phone mid-workout, you need to log a set in 3 taps. Currently it takes more than that.

### Changes to `src/components/Workout/ExerciseCard.jsx`

**Remove the Track / History / Graph tab bar from the exercise card.**

Replace it with a single collapsed view:

- The card shows exercise name, muscle badge, sets × reps, RPE target
- The set rows (weight + reps + RPE inputs) are always visible — no tab needed
- History and Graph are moved to a small "expand" chevron at the bottom right of the card
  that opens an inline panel below the inputs (not a modal, not a tab)
- The expand panel shows the history list and the 1RM graph stacked vertically

This removes one tap per exercise (no longer need to ensure you're on the "Track" tab).

**Make set input rows larger and easier to tap:**

- Input height: minimum `py-2.5` (currently `py-1.5`)
- Font size: `text-base` (currently `text-sm`)
- The weight field should be wide enough to show 3 digits comfortably: `w-20` minimum
- The reps field: `w-16` minimum
- The RPE field: `w-14` minimum, make it optional visually (lighter placeholder, no label)

**Move secondary actions to a slide-out panel:**

The following buttons are rarely used during an actual workout and add visual noise:

- Swap Exercise
- Move Up / Move Down
- Schedule to another day
- Remove exercise

Move all of them into a `⋮` (three-dot) menu that appears as a small icon in the top-right
of each exercise card header. Tapping it opens a compact bottom sheet (not a full modal)
with these four options listed vertically. This cleans up the card header significantly.

**Rest timer button:**

- Replace the current "⏱ Rest (~2 min)" text button with a single icon button
  that is visually prominent — a circular button with a timer icon, 44×44px tap target
- Show the rest duration as a small label below the icon
- Keep the "+ Custom" option in the three-dot menu instead of inline

**Warm-up suggestion:**

- Collapse the warmup block by default. Show "▸ See warm-up suggestion" as a small
  expandable row. Most users skip warm-up sets — it should not take up permanent space.

**Progression suggestion banner:**

- Keep the green banner but reduce it to a single line with a dismiss ×
  Currently it can be 2-3 lines tall. Truncate to one line and let users expand if they
  want to read the full message.

**Session notes:**

- Move the session notes textarea to the very bottom of the page, below all exercise cards,
  inside a collapsed "Add session notes" row that expands on tap.
  Currently it always takes up space even when empty.

### Changes to `src/pages/WorkoutPage.jsx`

**Duration timer:**

- Move the elapsed time (MM:SS) from wherever it currently renders to the page header
  bar next to the workout label — show it as a small badge: `⏱ 24:13`
- It should not be a separate section — just an inline badge

**Complete Workout button:**

- Make it larger: full width, `py-4`, `text-base font-bold`
- Change colour to `bg-emerald-600` on active sessions (currently `bg-emerald-600` —
  confirm this is applied and visible)
- Add a subtle set-count summary next to the button: "12 sets logged"

**Rest timer floating bar:**

- The `RestTimerBar` component should stick to the bottom above the Complete button,
  not appear inline between exercise cards
- It should not push the exercise cards up — overlay the bottom of the page content

**Empty state (no exercises):**

- Currently a plain text message — make it a centered card with a large `+` button
  that opens the Add Exercise modal directly. Text: "No exercises yet — tap to add"

### Definition of done for Task 3

- [ ] No tab bar on ExerciseCard — inputs always visible
- [ ] History/Graph accessible via chevron expand, not tabs
- [ ] Secondary actions (swap, move, remove) are in a three-dot menu
- [ ] Input rows are min `py-2.5` and `text-base`
- [ ] Rest timer is a prominent icon button
- [ ] Warm-up suggestion is collapsed by default
- [ ] Progression banner fits on one line
- [ ] Session notes are collapsed by default
- [ ] Duration timer shown as inline badge in header
- [ ] Complete button is full width, `py-4`
- [ ] Rest timer bar overlays bottom, does not push content
- [ ] Empty state has a large add button
- [ ] `npm run build` passes

---

## TASK 4 — FITNOTES IMPORT (low priority, do last)

The user has a small amount of FitNotes data they may want to import. This is not critical
but nice to have.

### What FitNotes exports

FitNotes exports a `.zip` file containing a file called `FitNotes_Backup.csv` with this format:

```
Date,Exercise Category,Exercise Name,Reps,Weight (kg),Distance,Distance Unit,Time
2024-01-15,Chest,Bench Press,5,80,,
2024-01-15,Chest,Bench Press,5,80,,
2024-01-15,Chest,Bench Press,4,80,,
2024-01-15,Back,Lat Pulldown,10,60,,
```

One row per set. Multiple rows with the same date and exercise name = multiple sets.

### What to build

**`src/utils/fitnotesImport.js`** — a parser that:

1. Accepts the raw CSV string (the agent does not need to unzip — the user will extract
   the CSV manually and paste it or select the file)
2. Groups rows by date, then by exercise name
3. Maps FitNotes exercise categories to Fitty muscle groups using this mapping:

```js
const CATEGORY_TO_MUSCLE = {
  Chest: "Chest",
  Back: "Back",
  Shoulders: "Shoulders",
  Biceps: "Biceps",
  Triceps: "Triceps",
  Legs: "Legs",
  Calves: "Calves",
  Core: "Core",
  Cardio: "Full Body",
  Olympic: "Full Body",
  Other: "Full Body",
};
```

4. Converts each group into a `completedDay` object matching the existing Fitty format:

```js
{
  date: '2024-01-15T00:00:00.000Z',
  phaseId: 'imported',
  week: 1,
  dayIndex: 0,
  label: 'FitNotes Import',
  workout_name: 'FitNotes Import',
  exercises: [
    {
      exerciseId: 'fitnotes_bench_press',  // slugified exercise name
      name: 'Bench Press',
      muscleGroup: 'Chest',
      sets: [
        { setNumber: 1, weight: '80', reps: '5', rpe: '' },
        { setNumber: 2, weight: '80', reps: '5', rpe: '' },
        { setNumber: 3, weight: '80', reps: '4', rpe: '' },
      ]
    }
  ],
  sessionNotes: '',
  durationMinutes: null,
  prExercises: [],
}
```

5. Returns an array of these `completedDay` objects sorted by date ascending
6. Deduplicates against existing `completedDays` using the same key logic as `mergeCompletedDays`

**`src/pages/SettingsPage.jsx`** — add a "Import from FitNotes" row inside the
"Export & Data" section:

- A file input that accepts `.csv` files
- On file select, parse it and show a preview: "Found X workouts from DATE to DATE"
- A "Import X workouts" confirm button
- On confirm, merge the imported days into `completedDays` via the store and save

### Definition of done for Task 4

- [ ] `fitnotesImport.js` parses the CSV correctly
- [ ] Exercises are grouped by date and exercise name correctly
- [ ] Output matches the Fitty `completedDay` schema
- [ ] Duplicate dates are not imported twice
- [ ] Import UI shows a preview before committing
- [ ] `npm run build` passes

---

## EXECUTION ORDER

Run tasks in this order. Do not start the next task until `npm run build` passes for the current one.

```
Task 1 → Task 2 → Task 3 → Task 4
```

After all four tasks are complete, run `npm run build` one final time and fix any remaining
TypeScript / ESLint errors.

---

## THINGS TO NEVER DO

- Do not remove Supabase or the authentication system
- Do not delete or modify `src/data/program.json`
- Do not change the Zustand store's state shape (adding fields is fine, removing is not)
- Do not introduce new npm packages for Tasks 1 and 3 (use what is already installed)
- Task 2 may load `https://accounts.google.com/gsi/client` and
  `https://apis.google.com/js/api.js` dynamically via script tag injection — this is fine
- Do not use `localStorage.clear()` anywhere
- Do not show raw Supabase error codes or messages to the user

---

## ACCEPTANCE CRITERIA (overall)

When all four tasks are done, the following must be true:

1. User logs a workout on phone → opens app on laptop → workout is there. No duplicates.
2. User taps "Backup to Google Drive" in Settings → JSON file appears in their Drive.
3. User taps "Restore from Google Drive" → picks a file → data is restored.
4. On a fresh install on a new device, user logs in → sync pulls all their historical data.
5. If the network is down, workouts save locally and sync automatically when back online.
6. The workout page allows logging a set in 3 taps: weight field → reps field → next set.
7. `npm run build` produces zero errors.
