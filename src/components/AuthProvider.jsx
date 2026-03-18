import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session with timeout to avoid hanging when offline
    const initAuthWithTimeout = async () => {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Auth init timeout')), 5000),
        )
        const sessionPromise = supabase.auth.getSession().then(({ data: { session } }) => session)
        const session = await Promise.race([sessionPromise, timeoutPromise])
        setSession(session)
      } catch (err) {
        // Offline or timeout — allow local-only mode
        console.warn('Auth init failed (offline?), continuing with local mode:', err?.message)
        setSession(null)
      } finally {
        setLoading(false)
      }
    }

    initAuthWithTimeout()

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription?.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
  }

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthProvider
