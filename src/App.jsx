import { useEffect } from 'react'
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom'
import AuthProvider from './components/AuthProvider'
import ProtectedRoute from './components/ProtectedRoute'
import Header from './components/Header'
import MilestoneToastHost from './components/MilestoneToast'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'
import WorkoutPage from './pages/WorkoutPage'
import ExercisesPage from './pages/ExercisesPage'
import ProgramPage from './pages/ProgramPage'
import WorkoutBuilder from './pages/WorkoutBuilder'
import StatsPage from './pages/StatsPage'
import { supabase } from './lib/supabaseClient'
import { useWorkoutStore } from './store/useWorkoutStore'
import { flushSyncQueue } from './utils/syncQueue'

function useSyncQueueListener() {
  useEffect(() => {
    let disposed = false
    let realtimeChannel = null
    let realtimeDebounceId = null

    const flushAndUpdate = async () => {
      if (disposed) return

      const cleared = await flushSyncQueue()

      let remoteOk = true
      if (navigator.onLine) {
        const cloud = await useWorkoutStore.getState().syncFromCloud({ setSyncing: false })
        remoteOk = Boolean(cloud?.ok || cloud?.offline)
      }

      if (!disposed) {
        useWorkoutStore.getState().recomputeSyncStatus({ cleared, remoteOk })
      }
    }

    const scheduleRealtimeSync = () => {
      if (disposed || !navigator.onLine) return

      if (realtimeDebounceId) {
        window.clearTimeout(realtimeDebounceId)
      }

      realtimeDebounceId = window.setTimeout(() => {
        flushAndUpdate()
      }, 700)
    }

    const unsubscribeRealtime = () => {
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel)
        realtimeChannel = null
      }
    }

    const subscribeRealtime = (userId) => {
      unsubscribeRealtime()
      if (!userId) return

      const onRemoteMutation = () => {
        scheduleRealtimeSync()
      }

      realtimeChannel = supabase
        .channel(`fitty-sync-${userId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'user_progress',
          filter: `user_id=eq.${userId}`,
        }, onRemoteMutation)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'workout_logs',
          filter: `user_id=eq.${userId}`,
        }, onRemoteMutation)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'bodyweight_logs',
          filter: `user_id=eq.${userId}`,
        }, onRemoteMutation)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'program_customizations',
          filter: `user_id=eq.${userId}`,
        }, onRemoteMutation)
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            scheduleRealtimeSync()
          }
        })
    }

    const bootstrapRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (disposed) return
      subscribeRealtime(session?.user?.id || null)
    }

    // Attempt flush on mount if online
    if (navigator.onLine) {
      flushAndUpdate()
    }

    // Attempt flush when reconnecting
    const handleOnline = () => {
      flushAndUpdate()
    }

    const handleFocus = () => {
      if (navigator.onLine) {
        flushAndUpdate()
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        flushAndUpdate()
      }
    }

    const pollId = window.setInterval(() => {
      if (navigator.onLine) {
        flushAndUpdate()
      }
    }, 30000)

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      subscribeRealtime(session?.user?.id || null)

      if (session?.user && navigator.onLine) {
        flushAndUpdate()
      }
    })

    bootstrapRealtime()

    window.addEventListener('online', handleOnline)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      disposed = true
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.clearInterval(pollId)

      if (realtimeDebounceId) {
        window.clearTimeout(realtimeDebounceId)
      }

      unsubscribeRealtime()
      authSubscription.unsubscribe()
    }
  }, [])
}

function AppContent() {
  const initializeStore = useWorkoutStore((state) => state.initializeStore)

  useSyncQueueListener()

  useEffect(() => {
    initializeStore()
  }, [initializeStore])

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <Header />
      <MilestoneToastHost />
      <main>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workout"
            element={
              <ProtectedRoute>
                <WorkoutPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <HistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/exercises"
            element={
              <ProtectedRoute>
                <ExercisesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stats"
            element={
              <ProtectedRoute>
                <StatsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/program"
            element={
              <ProtectedRoute>
                <ProgramPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/builder"
            element={
              <ProtectedRoute>
                <WorkoutBuilder />
              </ProtectedRoute>
            }
          />
          <Route
            path="/program"
            element={
              <ProtectedRoute>
                <ProgramPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  )
}

export default App
