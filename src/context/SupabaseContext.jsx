import { createContext, useContext, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const SupabaseContext = createContext(null)

export function SupabaseProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = chưa check xong
  const [user,    setUser]    = useState(null)

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setSession(null)
      setUser(null)
      return
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error('[SupabaseContext] getSession error:', error)
      const s = data?.session ?? null
      setSession(s)
      setUser(s?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <SupabaseContext.Provider value={{ session, user, loading: session === undefined }}>
      {children}
    </SupabaseContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(SupabaseContext)
  if (!ctx) throw new Error('useAuth() phải dùng bên trong <SupabaseProvider>')
  return ctx
}
