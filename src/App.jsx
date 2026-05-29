import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AuthProvider from './components/AuthProvider'
import ProtectedRoute from './components/ProtectedRoute'
import BottomTabBar from './components/BottomTabBar'
import MilestoneToastHost from './components/MilestoneToast'
import ErrorBoundary from './components/ErrorBoundary'
import { useWorkoutStore } from './store/useWorkoutStore'

// Critical path — loaded eagerly
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import ActiveWorkoutPage from './pages/ActiveWorkoutPage'
import SettingsPage from './pages/SettingsPage'

// Heavy pages — loaded on demand
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const StatsPage = lazy(() => import('./pages/StatsPage'))
const ExercisesPage = lazy(() => import('./pages/ExercisesPage'))
const PlanBuilderPage = lazy(() => import('./pages/PlanBuilderPage'))
const WorkoutToolsPage = lazy(() => import('./pages/WorkoutToolsPage'))
const PersonalRecordsPage = lazy(() => import('./pages/PersonalRecordsPage'))

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <span className="text-sm text-zinc-500">Loading…</span>
    </div>
  )
}

const route = (element) => (
  <ProtectedRoute>
    <ErrorBoundary>
      <Suspense fallback={<PageFallback />}>{element}</Suspense>
    </ErrorBoundary>
  </ProtectedRoute>
)

function AppContent() {
  const initializeStore = useWorkoutStore((state) => state.initializeStore)
  const [storageWarning, setStorageWarning] = useState(false)
  const location = useLocation()
  const hideNav = location.pathname === '/auth'

  useEffect(() => {
    initializeStore()
  }, [initializeStore])

  useEffect(() => {
    const handler = () => setStorageWarning(true)
    window.addEventListener('fitty:storage-quota-exceeded', handler)
    return () => window.removeEventListener('fitty:storage-quota-exceeded', handler)
  }, [])

  return (
    <div className="min-h-dvh bg-surface text-zinc-800">
      {storageWarning && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-danger px-4 py-2 text-center text-sm font-medium text-surface">
          Storage full — some data could not be saved. Free up space in{' '}
          <a href="/settings" className="underline">Settings</a>.
          <button
            type="button"
            onClick={() => setStorageWarning(false)}
            className="ml-3 opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
      <MilestoneToastHost />
      <main className={`mx-auto max-w-2xl px-4 pt-safe ${hideNav ? 'pb-8' : 'pb-28'}`}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={route(<HomePage />)} />
          <Route path="/workout" element={route(<ActiveWorkoutPage />)} />
          <Route path="/history" element={route(<HistoryPage />)} />
          <Route path="/exercises" element={route(<ExercisesPage />)} />
          <Route path="/stats" element={route(<StatsPage />)} />
          <Route path="/plans" element={route(<PlanBuilderPage />)} />
          <Route path="/settings" element={route(<SettingsPage />)} />
          <Route path="/tools" element={route(<WorkoutToolsPage />)} />
          <Route path="/records" element={route(<PersonalRecordsPage />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!hideNav && <BottomTabBar />}
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
