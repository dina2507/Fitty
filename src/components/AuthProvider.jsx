import { createContext, useContext } from 'react'

const LOCAL_USER_KEY = 'ppl_tracker_local_user_id'

const AuthContext = createContext({
  session: null,
  user: null,
  loading: false,
  signOut: async () => {},
})

export function AuthProvider({ children }) {
  const getLocalUser = () => {
    let localUserId = localStorage.getItem(LOCAL_USER_KEY)
    if (!localUserId) {
      localUserId = `local_${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem(LOCAL_USER_KEY, localUserId)
    }

    return {
      id: localUserId,
      email: 'local@fitty.app',
    }
  }

  const signOut = async () => {
    // Local-first mode: no remote auth session to revoke.
  }

  const value = {
    session: null,
    user: getLocalUser(),
    loading: false,
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
