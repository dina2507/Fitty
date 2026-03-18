import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import { useWorkoutStore } from '../store/useWorkoutStore'

function ProgramPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('jeff')
  const [customWorkouts, setCustomWorkouts] = useState([])
  const [loading, setLoading] = useState(false)
  
  const loadCustomWorkoutTemplate = useWorkoutStore(state => state.loadCustomWorkoutTemplate)
  const planDisplayName = useWorkoutStore(state => state.planDisplayName)
  const program = useWorkoutStore(state => state.program)
  const navigate = useNavigate()

  useEffect(() => {
    if (user && activeTab === 'custom') {
      fetchCustomWorkouts()
    }
  }, [user, activeTab])

  const fetchCustomWorkouts = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('custom_workouts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      if (data) setCustomWorkouts(data)
    } catch (error) {
      console.error('Failed to fetch custom workouts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this workout template?')) return
    try {
      const { error } = await supabase.from('custom_workouts').delete().eq('id', id)
      if (error) throw error
      setCustomWorkouts(prev => prev.filter(w => w.id !== id))
    } catch (error) {
      console.error('Failed to delete custom workout:', error)
    }
  }

  const handleUseToday = (workout) => {
    loadCustomWorkoutTemplate(workout)
    navigate('/workout')
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Programs & Workouts</h1>
          <p className="mt-1 text-sm text-zinc-500">View {planDisplayName} and your custom templates</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-zinc-200 p-1">
        <button 
          onClick={() => setActiveTab('jeff')} 
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'jeff' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
        >
          {planDisplayName}
        </button>
        <button 
          onClick={() => setActiveTab('custom')} 
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'custom' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
        >
          My Workouts
        </button>
      </div>

      {/* Program View (Read Only) */}
      {activeTab === 'jeff' && (
        <div className="grid gap-6">
          {program.phases.map(phase => (
            <div key={phase.id} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold text-zinc-900">{phase.name}</h2>
              <p className="mt-1 text-sm text-zinc-600">{phase.description}</p>
              
              <div className="mt-4 grid gap-4">
                {phase.weeks.map(week => (
                  <div key={week.weekNumber} className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
                    <h3 className="font-semibold text-zinc-900">Week {week.weekNumber}</h3>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {week.days.map(day => (
                        <div key={day.dayIndex} className="rounded border border-zinc-200 bg-white p-3 shadow-sm">
                          <p className="font-medium text-zinc-900">Day {day.dayIndex}: {day.label}</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {day.isRest ? 'Rest Day' : `${day.exercises.length} exercises`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Custom Workouts View */}
      {activeTab === 'custom' && (
        <div className="grid gap-4">
          <Link 
            to="/builder"
            className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 justify-self-start flex items-center gap-2"
          >
            + Create Workout
          </Link>

          {loading ? (
            <p className="py-8 text-center text-sm text-zinc-500">Loading your workouts...</p>
          ) : customWorkouts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center mt-4">
              <p className="text-zinc-500">You haven't created any custom workouts yet.</p>
              <p className="text-sm text-zinc-400 mt-1">Tap the button above to build your first template.</p>
            </div>
          ) : (
            <div className="grid gap-3 mt-2 sm:grid-cols-2">
              {customWorkouts.map(workout => (
                <div key={workout.id} className="rounded-xl border border-zinc-200 bg-white shadow-sm flex flex-col overflow-hidden">
                  <div className="p-4 flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-zinc-900">{workout.name}</h3>
                      {workout.workout_type && (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-emerald-700">
                          {workout.workout_type.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-zinc-500">
                      {workout.exercises?.length || 0} exercises
                    </p>
                  </div>
                  <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-3 flex items-center justify-between">
                    <button
                      onClick={() => handleUseToday(workout)}
                      disabled={!workout.exercises?.length}
                      className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-sm hover:shadow active:scale-95"
                    >
                      Use This Workout Today
                    </button>
                    <div className="flex gap-1">
                      <Link to={`/builder?edit=${workout.id}`} className="rounded p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700" title="Edit template">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                      </Link>
                      <button onClick={() => handleDelete(workout.id)} className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600" title="Delete template">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ProgramPage
