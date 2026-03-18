import { createContext, useContext } from 'react'

const AuthContext = createContext({
  session: null,
  user: null,
  loading: false,
  signOut: async () => {},
})

export function AuthProvider({ children }) {
  const signOut = async () => {
    // Local-first mode: no remote auth session to revoke.
  }

  const value = {
    session: null,
    user: null,
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
