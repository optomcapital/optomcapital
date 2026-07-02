import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  challengeAndVerifyMfaFactor,
  getCurrentUser,
  getMfaAssuranceLevel,
  listMfaFactors,
  onAuthStateChange,
  signIn,
  signOut,
} from '../lib/supabase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mfaPending, setMfaPending] = useState(false)
  const [mfaFactorId, setMfaFactorId] = useState(null)

  async function refreshMfaStatus() {
    try {
      const aal = await getMfaAssuranceLevel()
      if (aal.currentLevel === 'aal1' && aal.nextLevel === 'aal2') {
        const factors = await listMfaFactors()
        const factor = factors.find((f) => f.status === 'verified') || factors[0] || null
        setMfaFactorId(factor?.id || null)
        setMfaPending(true)
      } else {
        setMfaFactorId(null)
        setMfaPending(false)
      }
    } catch {
      setMfaFactorId(null)
      setMfaPending(false)
    }
  }

  useEffect(() => {
    let active = true

    async function init() {
      try {
        const currentUser = await getCurrentUser()
        if (active) setUser(currentUser)
        if (active && currentUser) await refreshMfaStatus()
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
      mfaPending,
      async login(email, password) {
        try {
          setLoading(true)
          const data = await signIn(email, password)
          setSession(data.session)
          setUser(data.user)
          await refreshMfaStatus()
        } catch (e) {
          toast.error(e?.message || 'Unable to sign in')
          throw e
        } finally {
          setLoading(false)
        }
      },
      async verifyMfa(code) {
        try {
          await challengeAndVerifyMfaFactor(mfaFactorId, code)
          setMfaPending(false)
        } catch (e) {
          toast.error(e?.message || 'Invalid authentication code')
          throw e
        }
      },
      async logout() {
        try {
          await signOut()
          setSession(null)
          setUser(null)
          setMfaPending(false)
          setMfaFactorId(null)
        } catch (e) {
          toast.error(e?.message || 'Unable to sign out')
        }
      },
    }
  }, [user, session, loading, mfaPending, mfaFactorId])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
