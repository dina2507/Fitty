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
import { useWorkoutStore } from './store/useWorkoutStore'
import { flushSyncQueue, getSyncQueue } from './utils/syncQueue'

function useSyncQueueListener() {
  useEffect(() => {
    const applySyncStatus = (cleared, remoteOk = true) => {
      const pending = getSyncQueue().length

      if (!remoteOk && navigator.onLine) {
        useWorkoutStore.setState({ syncStatus: 'error' })
        return
      }

      if (cleared && pending === 0) {
        useWorkoutStore.setState({ syncStatus: 'saved' })
        return
      }

      if (!navigator.onLine) {
        useWorkoutStore.setState({ syncStatus: 'offline' })
      } else if (pending > 0) {
        useWorkoutStore.setState({ syncStatus: 'error' })
      }
    }

    const flushAndUpdate = async () => {
      const cleared = await flushSyncQueue()

      let remoteOk = true
      if (cleared && navigator.onLine) {
        const cloud = await useWorkoutStore.getState().syncFromCloud({ setSyncing: false })
        remoteOk = Boolean(cloud?.ok || cloud?.offline)
      }

      applySyncStatus(cleared, remoteOk)
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
    }, 45000)

    window.addEventListener('online', handleOnline)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.clearInterval(pollId)
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
