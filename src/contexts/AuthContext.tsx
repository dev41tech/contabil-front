import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

interface User {
  user_id: string   // backend retorna user_id (não id)
  email: string
  nome: string
  role: string
  tenant_id: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (tenant_id: string, email: string, senha: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me')
      setUser(data)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMe() }, [fetchMe])

  const login = async (tenant_id: string, email: string, senha: string) => {
    const { data } = await api.post('/auth/login', { tenant_id, email, senha })
    sessionStorage.setItem('csrf_token', data.csrf_token)
    await fetchMe()
  }

  const logout = async () => {
    try { await api.post('/auth/logout') } catch {}
    sessionStorage.removeItem('csrf_token')
    setUser(null)
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
