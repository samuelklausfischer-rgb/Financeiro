import React, { createContext, useContext, useState, useEffect } from 'react'
import type { User as SupabaseAuthUser } from '@supabase/supabase-js'
import { mockProfiles } from '@/lib/mock-data'
import { getSupabase, isMockBackend } from '@/lib/supabase/client'

interface User {
  id: string
  name: string
  email: string
  perfil: 'financeiro' | 'gestor' | 'administrador'
  ativo: boolean
  avatarUrl?: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function isMock() {
  return isMockBackend()
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const mapSupabaseUser = (
    authUser: SupabaseAuthUser,
    profile?: {
      id: string
      email: string
      name: string | null
      perfil: 'financeiro' | 'gestor' | 'administrador'
      ativo: boolean
      avatar_url: string | null
    } | null,
  ): User => {
    return {
      id: authUser.id,
      name: profile?.name || authUser.user_metadata?.name || authUser.email || 'Usuário',
      email: profile?.email || authUser.email || '',
      perfil: profile?.perfil || 'financeiro',
      ativo: profile?.ativo ?? true,
      avatarUrl: profile?.avatar_url || undefined,
    }
  }

  const loadUserProfile = async (authUser: SupabaseAuthUser | null) => {
    if (!authUser) {
      setUser(null)
      return
    }

    const supabase = getSupabase()
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, name, perfil, ativo, avatar_url')
      .eq('id', authUser.id)
      .maybeSingle()

    setUser(mapSupabaseUser(authUser, profile))
  }

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (isMock()) {
          setUser(mockProfiles[0] as User)
          setIsLoading(false)
          return
        }

        const supabase = getSupabase()
        const {
          data: { session },
        } = await supabase.auth.getSession()

        await loadUserProfile(session?.user ?? null)
      } catch (error) {
        console.error('Auth initialization error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()

    if (isMock()) {
      return
    }

    const supabase = getSupabase()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadUserProfile(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = async (email: string, password: string) => {
    setIsLoading(true)

    try {
      if (isMock()) {
        if (email === 'teste@teste.com' && password === 'teste@teste') {
          setUser(mockProfiles[0] as User)
          return
        }

        if (email === 'samuelklausfischer@hotmail.com') {
          setUser(mockProfiles[1] as User)
          return
        }

        throw new Error('Email ou senha inválidos.')
      }

      const supabase = getSupabase()
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Login error:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    if (isMock()) {
      setUser(null)
      return
    }

    void getSupabase().auth.signOut()
    setUser(null)
  }

  return React.createElement(
    AuthContext.Provider,
    { value: { user, isLoading, login, logout } },
    children,
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
