import { useEffect, useState } from 'react'
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
import WorkoutToolsPage from './pages/WorkoutToolsPage'
import PersonalRecordsPage from './pages/PersonalRecordsPage'
import { useWorkoutStore } from './store/useWorkoutStore'
import ErrorBoundary from './components/ErrorBoundary'

function AppContent() {
  const initializeStore = useWorkoutStore((state) => state.initializeStore)
  const [storageWarning, setStorageWarning] = useState(false)

  useEffect(() => {
    initializeStore()
  }, [initializeStore])

  useEffect(() => {
    const handler = () => setStorageWarning(true)
    window.addEventListener('fitty:storage-quota-exceeded', handler)
    return () => window.removeEventListener('fitty:storage-quota-exceeded', handler)
  }, [])

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      {storageWarning && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 px-4 py-2 text-center text-sm font-medium text-white">
          Storage full — some data could not be saved. Go to{' '}
          <a href="/settings" className="underline">Settings</a> to free up space.
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
      <Header />
      <MilestoneToastHost />
      <main>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <DashboardPage />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/workout"
            element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <WorkoutPage />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <HistoryPage />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/exercises"
            element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <ExercisesPage />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/stats"
            element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <StatsPage />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/program"
            element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <ProgramPage />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/builder"
            element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <WorkoutBuilder />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <SettingsPage />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/tools"
            element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <WorkoutToolsPage />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/records"
            element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <PersonalRecordsPage />
                </ErrorBoundary>
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
