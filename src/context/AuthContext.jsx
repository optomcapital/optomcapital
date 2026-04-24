import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { getCurrentUser, onAuthStateChange, signIn, signOut } from '../lib/supabase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function init() {
      try {
        const currentUser = await getCurrentUser()
        if (active) setUser(currentUser)
      } catch {
        if (active) setUser(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    init()

    const { data } = onAuthStateChange((nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)
    })

    return () => {
      active = false
      data?.subscription?.unsubscribe?.()
    }
  }, [])

  const value = useMemo(() => {
    return {
      user,
      session,
      loading,
      async login(email, password) {
        try {
          setLoading(true)
          const data = await signIn(email, password)
          setSession(data.session)
          setUser(data.user)
        } catch (e) {
          toast.error(e?.message || 'Unable to sign in')
          throw e
        } finally {
          setLoading(false)
        }
      },
      async logout() {
        try {
          await signOut()
          setSession(null)
          setUser(null)
        } catch (e) {
          toast.error(e?.message || 'Unable to sign out')
        }
      },
    }
  }, [user, session, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
