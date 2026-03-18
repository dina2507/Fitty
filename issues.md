# Sync Issues Audit

Generated: 2026-03-18
Scope: Sync read/write paths, queue processing, cloud pull behavior, and UI sync status.

## Findings (ordered by severity)

1. Critical: Workout history can duplicate across devices because local and remote keys do not match.
- Keying logic uses remote row id when present: [src/store/useWorkoutStore.js#L71](src/store/useWorkoutStore.js#L71)
- Local completed workouts are saved without id: [src/store/useWorkoutStore.js#L1099](src/store/useWorkoutStore.js#L1099)
- Merge by key then preserves both entries: [src/store/useWorkoutStore.js#L83](src/store/useWorkoutStore.js#L83)
- Impact: Same workout can appear twice after cloud pull.

2. Critical: Cloud pull is skipped whenever queue flush is not fully cleared.
- App only pulls from cloud when queue is fully cleared: [src/App.jsx#L25](src/App.jsx#L25)
- Same gating in header sync: [src/components/SyncIndicator.jsx#L59](src/components/SyncIndicator.jsx#L59)
- Same gating in Settings sync: [src/pages/SettingsPage.jsx#L392](src/pages/SettingsPage.jsx#L392)
- Impact: One stuck queued mutation can block fresh mobile changes from appearing on laptop.

3. High: Queue processing can deadlock on a permanent failing job and block newer jobs.
- Flush loop stops at first failed job: [src/utils/syncQueue.js#L188](src/utils/syncQueue.js#L188)
- Remaining queue is saved as-is: [src/utils/syncQueue.js#L200](src/utils/syncQueue.js#L200)
- Impact: Later valid jobs may never run until first bad job is fixed.

4. High: Event listeners are added inside initializeStore without robust lifecycle cleanup.
- Adds visibility listener in store init path: [src/store/useWorkoutStore.js#L633](src/store/useWorkoutStore.js#L633)
- Adds online listener in store init path: [src/store/useWorkoutStore.js#L640](src/store/useWorkoutStore.js#L640)
- initializeStore is called by import flow too: [src/store/useWorkoutStore.js#L1395](src/store/useWorkoutStore.js#L1395)
- Impact: Repeated init can add duplicated listeners and repeated sync calls.

5. High: Remote deletions are not fully propagated for bodyweight and customizations.
- Bodyweight cloud pull only applies when remote list length > 0: [src/store/useWorkoutStore.js#L524](src/store/useWorkoutStore.js#L524)
- Customizations are merged local-first and do not remove deleted remote keys: [src/store/useWorkoutStore.js#L533](src/store/useWorkoutStore.js#L533)
- Impact: Deleting data on one device may not delete it on another.

6. High: user_progress schema mismatch still exists between SQL schema and app payload.
- SQL schema lacks these columns in user_progress: [supabase_schema.sql#L7](supabase_schema.sql#L7)
- App writes/reads weight_unit, rest_timer_default, dismissed_alerts: [src/store/useWorkoutStore.js#L243](src/store/useWorkoutStore.js#L243), [src/store/useWorkoutStore.js#L479](src/store/useWorkoutStore.js#L479)
- Impact: Preference sync is inconsistent unless DB schema is migrated.

7. Medium: syncStatus can report saved even when some cloud dataset pulls fail.
- Error flag is tied to workout logs only: [src/store/useWorkoutStore.js#L514](src/store/useWorkoutStore.js#L514)
- Bodyweight/customization null fetch paths do not flip status error: [src/store/useWorkoutStore.js#L524](src/store/useWorkoutStore.js#L524), [src/store/useWorkoutStore.js#L531](src/store/useWorkoutStore.js#L531)
- Status is set from hasRemoteError only: [src/store/useWorkoutStore.js#L542](src/store/useWorkoutStore.js#L542)
- Impact: UI can show synced while some data is stale.

8. Medium: Several cloud write paths bypass offline queue entirely.
- History edit/delete writes directly to Supabase: [src/pages/HistoryPage.jsx#L323](src/pages/HistoryPage.jsx#L323), [src/pages/HistoryPage.jsx#L391](src/pages/HistoryPage.jsx#L391)
- Custom exercises/workouts are direct-only writes: [src/pages/ExercisesPage.jsx#L253](src/pages/ExercisesPage.jsx#L253), [src/pages/ExercisesPage.jsx#L260](src/pages/ExercisesPage.jsx#L260), [src/pages/ExercisesPage.jsx#L273](src/pages/ExercisesPage.jsx#L273), [src/pages/ProgramPage.jsx#L45](src/pages/ProgramPage.jsx#L45), [src/pages/WorkoutBuilder.jsx#L459](src/pages/WorkoutBuilder.jsx#L459)
- Impact: Offline edits fail instead of queueing, causing divergence.

9. Medium: History edit/delete targets logs by date (not stable row id), which is ambiguous.
- Date-only matching for delete: [src/pages/HistoryPage.jsx#L323](src/pages/HistoryPage.jsx#L323)
- Date-only matching for update: [src/pages/HistoryPage.jsx#L391](src/pages/HistoryPage.jsx#L391)
- Impact: Multiple workouts on same date can update/delete wrong row.

10. Medium: Cloud pull calls can overlap and race.
- Unused store-level lock variable indicates intended dedupe not applied: [src/store/useWorkoutStore.js#L10](src/store/useWorkoutStore.js#L10)
- Frequent triggers from focus/visibility/polling: [src/App.jsx#L43](src/App.jsx#L43), [src/App.jsx#L55](src/App.jsx#L55)
- Impact: Concurrent pulls can apply stale patches out of order.

11. Low: Settings pending queue count is not live-updated.
- Queue count initialized once: [src/pages/SettingsPage.jsx#L61](src/pages/SettingsPage.jsx#L61)
- No storage/focus listeners in Settings page for queue count updates.
- Impact: Queue count display can be stale while debugging sync.

## Assumptions

1. Cross-device expectation is near-real-time visibility for workouts, progress, bodyweight, and customizations.
2. Multiple workouts on one date are possible.
3. Queue may include historical payloads from earlier schema versions.
