import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadPlayer(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadPlayer(session.user.id)
      else { setPlayer(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadPlayer(userId) {
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('auth_user_id', userId)
      .single()
    setPlayer(data || null)
    setLoading(false)
  }

  async function refreshPlayer() {
    if (!user) return
    await loadPlayer(user.id)
  }

  const isAdmin = player?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, player, isAdmin, loading, refreshPlayer }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
