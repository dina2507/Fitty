# TASK1.md — Fitty Agent Task Brief
_Priority order: Task 1 → Task 2 → Task 3 → Task 4. Run `npm run build` after each task before moving on._

---

## RULE 0 — READ BEFORE TOUCHING ANY FILE

- Do not remove or rebuild anything that already works.
- Do not modify `src/data/program.json`.
- Do not change the shape of existing Zustand state (adding fields is fine).
- Do not introduce packages for tasks that can be solved with what is already installed.
- Every task ends with `npm run build` passing with zero errors.

---

## TASK 1 — CONVERT APP TO A PWA

The app must be installable on Android and iOS home screens, work offline, and load
instantly on repeat visits. This is the foundation everything else depends on.

### 1.1 — Service Worker (`public/sw.js`)

Replace the existing `public/sw.js` with a proper Workbox-style cache-first strategy.
The current one uses `addAll` on install which fails silently if any asset 404s.

Implement these caching strategies:

**Cache-first (shell assets — HTML, JS, CSS, icons):**
```
Cache name: fitty-shell-v1
On install: cache /index.html and /manifest.json
On fetch (navigate): serve index.html from cache, fall back to network
On fetch (JS/CSS): serve from cache first, update cache in background
```

**Network-first (API calls to Supabase or Google):**
```
If URL contains supabase.co or googleapis.com → always network-first, do not cache
```

**Stale-while-revalidate (static assets like fonts, images):**
```
Serve from cache immediately, refresh in background
```

**Cache cleanup on activate:**
```js
// Delete all caches that are not fitty-shell-v1
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== 'fitty-shell-v1').map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})
```

**Offline fallback:**
When a navigation request fails and there is no cache → serve `/index.html` from cache.
The app already handles missing data gracefully with localStorage, so this is enough.

### 1.2 — Web App Manifest (`public/manifest.json`)

Replace the existing manifest with this complete version:

```json
{
  "name": "Fitty — PPL Tracker",
  "short_name": "Fitty",
  "description": "Track your Push Pull Legs workouts",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#f4f4f5",
  "theme_color": "#18181b",
  "categories": ["health", "fitness"],
  "icons": [
    { "src": "/icons/icon-72.png",   "sizes": "72x72",   "type": "image/png" },
    { "src": "/icons/icon-96.png",   "sizes": "96x96",   "type": "image/png" },
    { "src": "/icons/icon-128.png",  "sizes": "128x128", "type": "image/png" },
    { "src": "/icons/icon-144.png",  "sizes": "144x144", "type": "image/png" },
    { "src": "/icons/icon-152.png",  "sizes": "152x152", "type": "image/png" },
    { "src": "/icons/icon-192.png",  "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-384.png",  "sizes": "384x384", "type": "image/png" },
    { "src": "/icons/icon-512.png",  "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "shortcuts": [
    {
      "name": "Start Workout",
      "short_name": "Workout",
      "url": "/workout",
      "icons": [{ "src": "/icons/icon-96.png", "sizes": "96x96" }]
    },
    {
      "name": "View History",
      "short_name": "History",
      "url": "/history",
      "icons": [{ "src": "/icons/icon-96.png", "sizes": "96x96" }]
    }
  ]
}
```

### 1.3 — Generate PWA Icons

Create a script `scripts/generate-icons.mjs` that generates all required icon sizes
from a single source image. Use the `sharp` package (add it as a dev dependency).

```js
// scripts/generate-icons.mjs
import sharp from 'sharp'
import { mkdir } from 'fs/promises'

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
const SOURCE = 'public/icon-source.png' // Agent: create a 512x512 dark zinc (#18181b)
                                          // square with white "F" lettermark as placeholder

await mkdir('public/icons', { recursive: true })
for (const size of SIZES) {
  await sharp(SOURCE).resize(size, size).toFile(`public/icons/icon-${size}.png`)
  console.log(`✓ icon-${size}.png`)
}
```

Run it once: `node scripts/generate-icons.mjs`

If `sharp` cannot be installed in the current environment, instead create placeholder
512×512 PNG icons at all required sizes programmatically using a canvas approach or
copy the existing `vite.svg` and note that the developer must replace with real icons.

### 1.4 — Register Service Worker (`src/main.jsx`)

The existing service worker registration in `src/main.jsx` wraps the register call in
`window load`. Keep that pattern but add an update prompt:

```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')

      // Notify user when a new version is available
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // A new version is ready — show a toast
            // Dispatch a custom event that a toast component can listen to
            window.dispatchEvent(new CustomEvent('sw-update-available'))
          }
        })
      })
    } catch (err) {
      if (import.meta.env.DEV) console.error('SW registration failed:', err)
    }
  })
}
```

Create a `src/components/UpdateToast.jsx` component that listens for `sw-update-available`
and shows a banner: "A new version of Fitty is available. [Refresh]"
The "Refresh" button calls `window.location.reload()`.
Add `<UpdateToast />` to `App.jsx` alongside `<MilestoneToastHost />`.

### 1.5 — iOS-specific meta tags (`index.html`)

Add these to the `<head>` of `index.html`:

```html
<!-- iOS PWA -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Fitty" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
<link rel="apple-touch-startup-image" href="/icons/icon-512.png" />

<!-- Android / theme -->
<meta name="mobile-web-app-capable" content="yes" />
<meta name="theme-color" content="#18181b" />
```

### Definition of done for Task 1
- [ ] `public/sw.js` implements cache-first for shell, network-first for API calls
- [ ] `public/manifest.json` has all 8 icon sizes and 2 shortcuts
- [ ] All icon files exist in `public/icons/`
- [ ] Service worker registers in `src/main.jsx` with update detection
- [ ] `<UpdateToast />` component exists and is wired into `App.jsx`
- [ ] iOS meta tags present in `index.html`
- [ ] Lighthouse PWA audit passes (installable, offline works)
- [ ] `npm run build` passes

---

## TASK 2 — FIX GOOGLE DRIVE PERSISTENT CONNECTION

### The problem

Google Identity Services (GIS) access tokens expire after 1 hour. The current
implementation calls `signInWithGoogle()` which triggers a popup. After a page reload,
the token is gone and the popup fires again. This is annoying.

### The solution

Use **GIS silent token refresh** combined with **localStorage token caching**.

GIS supports a `prompt: ''` (empty string) mode that attempts a silent refresh using
the browser's existing Google session cookie. If the user has already authorised the
app in a previous session, this succeeds silently with no popup.

### Changes to `src/lib/googleDrive.js`

**Token storage keys (localStorage):**
```js
const TOKEN_KEY   = 'fitty_gdrive_token'
const EXPIRY_KEY  = 'fitty_gdrive_expiry'
const EMAIL_KEY   = 'fitty_gdrive_email'
```

**Replace the current `signInWithGoogle` with this flow:**

```js
export async function getValidToken() {
  // 1. Check localStorage for a non-expired token
  const cached   = localStorage.getItem(TOKEN_KEY)
  const expiry   = Number(localStorage.getItem(EXPIRY_KEY) || 0)
  const hasTime  = expiry - Date.now() > 60_000  // at least 1 min remaining

  if (cached && hasTime) return cached

  // 2. Try silent refresh — no popup, uses existing Google session cookie
  try {
    const token = await requestTokenSilent()
    if (token) return token
  } catch { /* silent fail — fall through to popup */ }

  // 3. Fall back to popup only if silent refresh fails (first time or revoked)
  return requestTokenWithPopup()
}

async function requestTokenSilent() {
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.file',
      prompt: '',           // ← key: no popup, silent refresh
      callback: (response) => {
        if (response.error) return reject(response)
        storeToken(response)
        resolve(response.access_token)
      },
    })
    client.requestAccessToken()
  })
}

async function requestTokenWithPopup() {
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.file',
      prompt: 'select_account',
      callback: (response) => {
        if (response.error) return reject(response)
        storeToken(response)
        resolve(response.access_token)
      },
    })
    client.requestAccessToken()
  })
}

function storeToken(response) {
  const expiresIn = Number(response.expires_in || 3600)
  localStorage.setItem(TOKEN_KEY,  response.access_token)
  localStorage.setItem(EXPIRY_KEY, String(Date.now() + expiresIn * 1000))
}

export function clearDriveToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EXPIRY_KEY)
  localStorage.removeItem(EMAIL_KEY)
}
```

**Update every function in `googleDrive.js` that calls `signInWithGoogle()` to call
`getValidToken()` instead.** This means the DriveBackup component no longer needs to
pass a token around — each function fetches a valid token itself.

**Pre-warm the token on app load:**

In `src/lib/googleDrive.js`, export a `prewarmDriveToken` function:

```js
export async function prewarmDriveToken() {
  try {
    await loadGoogleScripts()
    await getValidToken()  // silent — no popup, just refreshes if needed
  } catch {
    // Not connected — that's fine, user will connect on first backup
  }
}
```

Call `prewarmDriveToken()` from `src/App.jsx` inside the `AppContent` `useEffect`
(alongside `initializeStore`). This runs silently on every page load and refreshes
the cached token before it expires, so the user never sees a popup mid-session.

### Update `src/components/DriveBackup.jsx`

- Remove the `accessToken` prop drilling — each action gets its token via `getValidToken()`
- Add a connected indicator: show the Google account email (stored in `EMAIL_KEY`) when
  connected. Format: small green dot + "Connected as user@gmail.com"
- Store the email when the token is obtained: in `requestTokenWithPopup` callback, also
  decode the JWT `id_token` or use `gapi.client.people` — simpler: store the email from
  the `hint` field or use `google.accounts.id.prompt` to get profile info.

  Simplest approach: after obtaining the token call:
  ```js
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  const info = await res.json()
  localStorage.setItem(EMAIL_KEY, info.email)
  ```

- "Disconnect" button: calls `clearDriveToken()` and clears the email display.

### Definition of done for Task 2
- [ ] After page reload, token is restored silently from localStorage — no popup
- [ ] After 1 hour, token is refreshed silently via GIS `prompt: ''`
- [ ] First-time connection still shows the Google account picker popup
- [ ] Connected email displayed in the DriveBackup component
- [ ] "Disconnect" button clears stored token
- [ ] `npm run build` passes

---

## TASK 3 — KEEP ONLY 5 MOST RECENT BACKUP FILES

### Change in `src/lib/googleDrive.js`

In the `pruneOldBackups` function, change the retention count from 10 to **5**.

The current implementation (or intended implementation) deletes files beyond 10.
Change the threshold:

```js
export async function pruneOldBackups(accessToken) {
  const KEEP = 5  // ← was 10, now 5

  const files = await listBackupFiles(accessToken)
  if (files.length <= KEEP) return

  // Delete everything beyond the 5 most recent
  const toDelete = files.slice(KEEP)  // files is already sorted newest-first
  await Promise.all(
    toDelete.map(file =>
      fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    )
  )
}
```

Always call `pruneOldBackups` immediately after a successful `uploadBackupToDrive`.
Make sure the `listBackupFiles` result is sorted **newest first** (by `createdTime`
descending) before slicing — add an explicit sort if not already there:

```js
files.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime))
```

### Update the UI copy in `src/components/DriveBackup.jsx`

Change any text that says "10 most recent" or "last 10 backups" to:
**"Your 5 most recent backups are kept. Older files are deleted automatically."**

### Definition of done for Task 3
- [ ] `KEEP` constant is 5 in `pruneOldBackups`
- [ ] Files list is sorted newest-first before slicing
- [ ] UI copy updated to say "5 most recent"
- [ ] After a backup, if more than 5 files exist in Drive they are deleted
- [ ] `npm run build` passes

---

## TASK 4 — REPLICATE FITNOTES FEATURES

Source pages studied:
- https://www.fitnotesapp.com/workout_tools/
- https://www.fitnotesapp.com/home_screen/
- https://www.fitnotesapp.com/progress_tracking/

Implement in this sub-order: 4A → 4B → 4C → 4D → 4E → 4F

---

### 4A — REST TIMER IMPROVEMENTS (Workout Tools)

The rest timer already exists. Extend it with these FitNotes features:

**Auto-start timer:**

Add a toggle in Settings called **"Auto-start rest timer after each set"** stored in
localStorage as `fitty_autostart_timer` (boolean, default false).

In `src/components/Workout/ExerciseCard.jsx`, in `handleSetFieldChange`, after a set
becomes "complete" (weight + reps both filled), check this preference:

```js
const autoStart = localStorage.getItem('fitty_autostart_timer') === 'true'
if (autoStart && !wasComplete && isComplete) {
  startTimer(parseRestSeconds(exercise.rest, restTimerDefault))
}
```

(This already partially exists — make sure the auto-start path is wired to the preference.)

**Sound alert:**

When the timer hits 0, play a short beep in addition to vibration.
Create `src/utils/timerSound.js`:

```js
let audioCtx = null

export function playTimerBeep() {
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    const oscillator = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    oscillator.connect(gain)
    gain.connect(audioCtx.destination)
    oscillator.frequency.value = 880   // A5 — distinct, not annoying
    oscillator.type = 'sine'
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8)
    oscillator.start(audioCtx.currentTime)
    oscillator.stop(audioCtx.currentTime + 0.8)
  } catch { /* AudioContext blocked — ignore */ }
}
```

Call `playTimerBeep()` from `useRestTimer.js` when `remainingSecs <= 0`, alongside
the existing vibration call.

Add a **Sound** toggle in Settings: `fitty_timer_sound` (boolean, default true).
Only call `playTimerBeep()` when this preference is true.

**Settings additions (add to SettingsPage inside "Training Preferences" section):**

```
[ ] Auto-start rest timer after logging a set    (toggle)
[ ] Rest timer sound alert                       (toggle, default on)
```

---

### 4B — SET CALCULATOR (Workout Tools → new feature)

FitNotes description: Enter a base weight + select a percentage → calculates the
target set weight. Tap "Select Max" to pull in your current PR for that exercise.
Tap "Round To Closest" to round to nearest 2.5 / 5 / 10. Tap "Add to Workout" to
create a set at the calculated weight.

**Create `src/components/SetCalculator.jsx`:**

Props: `{ exerciseName, onAddSet, onClose }`

```
UI layout (modal, bottom sheet on mobile):

  Title: "Set Calculator"

  [Base Weight input]   ← number, kg/lbs
  [Percentage select]   ← predefined list: 50%, 55%, 60%, 65%, 70%, 75%, 80%, 85%, 90%, 95%, 100%
                           + free-text input
  ─────────────────────────────
  Calculated weight: 82.5 kg    ← live, updates as user types
  ─────────────────────────────
  [Round to closest: 2.5 | 5 | 10]   ← three buttons, one selected at a time
  [Select Max]    ← pulls the PR max weight for exerciseName from completedDays
  [Add to Workout]  ← calls onAddSet({ weight: calculatedWeight, reps: '', rpe: '' })
```

**Logic:**
```js
const rawWeight = baseWeight * (percentage / 100)
const calculatedWeight = Math.round(rawWeight / roundTo) * roundTo
```

**Wire into `src/components/Workout/ExerciseCard.jsx`:**

Add a small "%" icon button in the exercise card action row (next to the rest timer
button). Tapping it opens the `SetCalculator` modal for that exercise.
`onAddSet` should call the existing `addSet(exercise.id)` then pre-fill the weight
in the new set row.

---

### 4C — ENHANCED 1RM CALCULATOR (Workout Tools → extend existing)

The 1RM Calculator already exists (inline in ExerciseCard). Extend it to also show
**2RM through 15RM estimates** like FitNotes does:

In `src/utils/oneRepMax.js`, add:

```js
// Returns estimated weight for N reps given a 1RM value
// Uses Epley formula inverted: weight = 1RM / (1 + N/30)
export function weightForReps(oneRM, targetReps) {
  if (targetReps === 1) return oneRM
  return Math.round((oneRM / (1 + targetReps / 30)) * 10) / 10
}

// Returns full RM table from 1 to 15
export function buildRMTable(weight, reps) {
  const oneRM = calculate1RM(weight, reps)
  if (!oneRM) return []
  return Array.from({ length: 15 }, (_, i) => ({
    reps: i + 1,
    weight: weightForReps(oneRM, i + 1),
  }))
}
```

**In the Exercise Overview / Graph panel** (wherever the 1RM chart already renders),
add a toggleable table below the chart:

```
[ Show RM Table ]  ← small text button

1RM   87.5 kg
2RM   83.3 kg
3RM   79.5 kg
...
15RM  58.2 kg
```

Show the row matching the user's most recent set's rep count in bold.

---

### 4D — PERSONAL RECORDS SCREEN (Progress Tracking)

FitNotes has Estimated and Actual personal records per exercise with a full 1RM–15RM table.

**Create `src/pages/PersonalRecordsPage.jsx`** (accessible from the Exercises page or
Stats page via a "Personal Records" button):

Layout:
```
Title: "Personal Records"

[Search bar — filter exercises]
[Sort: A–Z | Max Weight | Most Recent]

For each exercise that has at least one logged set:
  ┌─────────────────────────────────────┐
  │ Bench Press          [Chest badge]  │
  │ 1RM Est: 102.5 kg                   │
  │ Max weight logged: 95 kg × 3        │
  │ Last logged: 14 Mar 2026            │
  │                      [View →]       │
  └─────────────────────────────────────┘
```

Tapping "View →" opens an `ExerciseRecordDetail` bottom sheet or page showing:

**Tab 1 — Estimated:**
- Highest estimated 1RM across all logged sets (cap reps at 12 for accuracy, matching
  FitNotes recommendation)
- RM table from 1RM to 15RM built from `buildRMTable`

**Tab 2 — Actual:**
- List of actual best sets per rep count (1 rep → max weight logged at 1 rep, etc.)
- Up to 10 reps shown
- Each row: `{N} reps: {weight} kg — {date}`
- If a higher-rep set has equal or higher weight, it supersedes lower-rep records
  (FitNotes precedence rule)

**Data source:** Computed from `completedDays` in Zustand store. No new Supabase
table needed.

**Add route:** `src/App.jsx` → `/records` → `<ProtectedRoute><PersonalRecordsPage /></ProtectedRoute>`

**Add entry point:** In `src/pages/StatsPage.jsx` and `src/pages/ExercisesPage.jsx`,
add a "Personal Records" button that navigates to `/records`.

---

### 4E — EXERCISE STATISTICS (Progress Tracking → Stats tab)

FitNotes shows per-exercise stats for a chosen period: Workout, Week, Month, Year, All.

**Extend the Exercise Detail view** (already exists in `ExercisesPage.jsx` as a modal)
to include a **Stats tab** alongside History and Graph.

The Stats tab shows, for the selected period:

```
Period: [Week ▾]     Date: [Mar 2026 ▾]

Max Weight          95 kg         (14 Mar 2026 →)
Max Reps            8             (10 Mar 2026 →)
Total Volume        4,820 kg
Total Sets          12
Total Reps          89
Estimated 1RM       112.5 kg      (14 Mar 2026 →)
Avg Weight/Set      54.3 kg
Avg Reps/Set        7.4
Workouts            3
```

Period options: Workout | Week | Month | Year | All
Date picker adapts to period: for Week → week selector, for Month → month selector, etc.

Tapping a stat row that has a date navigates to that workout in History.

**Implementation:** Pure computation from `completedDays`. Filter by exercise name,
filter by date range, compute the metrics. No new pages — this is a new tab inside
the existing exercise detail bottom sheet / modal.

---

### 4F — EXERCISE GOALS (Progress Tracking → Goals tab)

FitNotes lets users set a weight target for an exercise and tracks progress toward it.

**Data model — add to localStorage** (key: `fitty_exercise_goals`):
```js
[
  {
    id: 'uuid',
    exerciseName: 'Bench Press',
    targetWeight: 100,   // kg
    targetReps: 1,       // optional
    createdAt: 'ISO date',
    achievedAt: null,    // ISO date when first surpassed, or null
  }
]
```

No new Supabase table. Goals are device-local. (Small enough data, risk of loss is low.)

**Extend the Exercise Detail view** with a **Goals tab:**

```
[+ Add Goal]

  Goal: 100 kg × 1
  Progress: 95 kg (95%)   ████████░░  95%
  Added: 10 Jan 2026
  Status: In progress

  Goal: 120 kg
  Progress: 95 kg (79%)   ████████░░  79%
  Status: In progress

  [Achieved goals — collapsed section]
    ✓ 80 kg × 1 — achieved 14 Feb 2026
```

**Add Goal form (bottom sheet):**
- Target weight (number input)
- Target reps (optional number input, default 1)
- Save button

**Auto-detect achievement:**
In `completeWorkout` (or on every app load in `initializeStore`), check all goals
against `completedDays`. If a set's weight ≥ goal's `targetWeight` and reps ≥
`targetReps`, set `achievedAt` to the date of that set and save.

Show a milestone toast (using the existing `enqueueMilestoneToasts` system) when a
goal is first achieved during a `completeWorkout` call. Use the icon 🎯 and label
"Goal Reached! {exerciseName} — {targetWeight}kg".

---

### 4G — WORKOUT COMMENT + SHARE (Home Screen)

**Comment a Workout:**
Each completed workout in `completedDays` already has a `sessionNotes` field.
Ensure the History page makes this prominently editable — a "Edit comment" button
on each workout card that opens a textarea, saves inline via `updateTodayWorkout`
or a new `updateCompletedDayNotes` store action for past workouts.

**Share a Workout:**

Add a "Share" button to each workout card in `HistoryPage.jsx`.
Tapping it generates a plain-text summary and calls the Web Share API:

```js
async function shareWorkout(day) {
  const lines = [
    `📅 ${new Date(day.date).toLocaleDateString()}`,
    `💪 ${day.label}`,
    `⏱ ${day.durationMinutes ? day.durationMinutes + ' min' : ''}`,
    '',
    ...(day.exercises || []).map(ex => {
      const sets = (ex.sets || [])
        .map(s => `  Set ${s.setNumber}: ${s.weight}kg × ${s.reps}`)
        .join('\n')
      return `${ex.name}\n${sets}`
    }),
    '',
    `Total Volume: ${Math.round(calculateWorkoutVolume(day.exercises))} kg`,
    '',
    'Logged with Fitty 💪',
  ]

  const text = lines.join('\n')

  if (navigator.share) {
    await navigator.share({ title: day.label, text })
  } else {
    await navigator.clipboard.writeText(text)
    // Show toast: "Workout copied to clipboard"
  }
}
```

**Copy a Workout:**

In `WorkoutPage.jsx`, add a "Copy from previous" option in the session header
(a small button: "📋 Copy workout"). This opens a date picker showing previous workout
dates. Selecting one populates `activeExercises` and `exerciseLog` with the sets from
that day as starting weights (weight pre-filled, reps cleared). The user then adjusts
and logs the actual reps for today.

---

### New files to create

```
src/pages/PersonalRecordsPage.jsx        ← Task 4D
src/components/SetCalculator.jsx         ← Task 4B
src/utils/timerSound.js                  ← Task 4A
src/components/UpdateToast.jsx           ← Task 1
scripts/generate-icons.mjs               ← Task 1
```

### Files to update

```
public/sw.js                             ← Task 1
public/manifest.json                     ← Task 1
index.html                               ← Task 1
src/main.jsx                             ← Task 1
src/App.jsx                              ← Task 1 (UpdateToast), Task 2 (prewarm)
src/lib/googleDrive.js                   ← Task 2, Task 3
src/components/DriveBackup.jsx           ← Task 2, Task 3
src/pages/SettingsPage.jsx               ← Task 2, Task 4A
src/utils/oneRepMax.js                   ← Task 4C
src/utils/workoutHelpers.js              ← minor additions
src/store/useWorkoutStore.js             ← Task 4F (goal achievement check)
src/pages/StatsPage.jsx                  ← Task 4D (link to /records)
src/pages/ExercisesPage.jsx              ← Task 4D, 4E, 4F (tabs in exercise detail)
src/pages/HistoryPage.jsx                ← Task 4G
src/pages/WorkoutPage.jsx                ← Task 4B (Set Calculator), 4G (Copy workout)
src/components/Workout/ExerciseCard.jsx  ← Task 4A (auto-start), 4B (% button)
src/hooks/useRestTimer.js                ← Task 4A (sound)
```

---

## EXECUTION ORDER

```
Task 1 (PWA)
  └─ npm run build ✓
Task 2 (Drive token persistence)
  └─ npm run build ✓
Task 3 (5-file prune)
  └─ npm run build ✓
Task 4A (Rest timer sound + auto-start)
  └─ npm run build ✓
Task 4B (Set Calculator)
  └─ npm run build ✓
Task 4C (RM Table)
  └─ npm run build ✓
Task 4D (Personal Records page)
  └─ npm run build ✓
Task 4E (Exercise Stats tab)
  └─ npm run build ✓
Task 4F (Exercise Goals)
  └─ npm run build ✓
Task 4G (Share + Copy workout)
  └─ npm run build ✓
```

---

## ACCEPTANCE CRITERIA

When all tasks are done:

1. App is installable on Android Chrome and iOS Safari from the browser prompt.
2. App loads offline (shows cached data, not a blank screen).
3. After page reload, Google Drive backup is connected silently — no popup.
4. Backup button creates a file in Google Drive; only 5 files ever exist in that folder.
5. Rest timer auto-starts after logging a set (if setting is on) and plays a beep.
6. Set Calculator opens from any exercise, calculates weight at a % of base, adds to workout.
7. Personal Records page shows estimated and actual rep maxes for every exercise.
8. Exercise detail has Stats tab with per-period metrics.
9. Exercise detail has Goals tab; goals auto-achieve when a matching set is logged.
10. Share button generates a readable workout summary and invokes the Web Share API.
11. `npm run build` produces zero errors.
