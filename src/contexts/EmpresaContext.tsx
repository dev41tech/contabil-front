/**
 * Contexto global de empresa selecionada.
 * Persiste no localStorage para sobreviver a refreshes.
 * Todos os módulos leem a empresa padrão daqui.
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

interface EmpresaInfo {
  id: string
  razao_social: string
}

interface EmpresaContextType {
  empresa: EmpresaInfo | null
  setEmpresa: (e: EmpresaInfo | null) => void
}

const STORAGE_KEY = 'contabil:empresa_selecionada'

const EmpresaContext = createContext<EmpresaContextType | null>(null)

export function EmpresaProvider({ children }: { children: React.ReactNode }) {
  const [empresa, setEmpresaState] = useState<EmpresaInfo | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const setEmpresa = useCallback((e: EmpresaInfo | null) => {
    setEmpresaState(e)
    if (e) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(e))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  return (
    <EmpresaContext.Provider value={{ empresa, setEmpresa }}>
      {children}
    </EmpresaContext.Provider>
  )
}

export function useEmpresa() {
  const ctx = useContext(EmpresaContext)
  if (!ctx) throw new Error('useEmpresa deve ser usado dentro de EmpresaProvider')
  return ctx
}
