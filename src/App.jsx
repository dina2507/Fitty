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

function AppContent() {
  const initializeStore = useWorkoutStore((state) => state.initializeStore)

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
