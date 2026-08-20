import React, { createContext, useContext, useState } from 'react'

interface CompetenciaContextType {
  competencia: string
  setCompetencia: (competencia: string) => void
}

const CompetenciaContext = createContext<CompetenciaContextType | null>(null)

function competenciaAtual() {
  const hoje = new Date()
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
}

export function CompetenciaProvider({ children }: { children: React.ReactNode }) {
  const [competencia, setCompetencia] = useState(competenciaAtual)

  return (
    <CompetenciaContext.Provider value={{ competencia, setCompetencia }}>
      {children}
    </CompetenciaContext.Provider>
  )
}

export function useCompetencia() {
  const context = useContext(CompetenciaContext)
  if (!context) throw new Error('useCompetencia deve ser usado dentro de CompetenciaProvider')
  return context
}
