import React, { createContext, useContext, useEffect, useState } from 'react'

type Tema = 'claro' | 'escuro'

interface ThemeContextType {
  tema: Tema
  setTema: (tema: Tema) => void
  alternar: () => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

const STORAGE_KEY = 'contabil-core:tema'

/**
 * Tema do sistema inteiro, não de uma tela.
 *
 * O DS do Connect é dark-first, então escuro é o padrão — e o index.html já
 * nasce com class="dark" para não piscar branco antes deste provider montar.
 * A escolha do usuário vence o padrão e sobrevive ao reload.
 */
function temaInicial(): Tema {
  try {
    const salvo = window.localStorage.getItem(STORAGE_KEY)
    if (salvo === 'claro' || salvo === 'escuro') return salvo
  } catch {
    // localStorage pode estar bloqueado (janela anônima, política do browser);
    // cair no padrão é melhor que quebrar o app na primeira linha.
  }
  return 'escuro'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaInicial)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'escuro')
    try {
      window.localStorage.setItem(STORAGE_KEY, tema)
    } catch {
      // idem: sem persistência, o tema ainda vale nesta sessão.
    }
  }, [tema])

  const alternar = () => setTema(atual => (atual === 'escuro' ? 'claro' : 'escuro'))

  return (
    <ThemeContext.Provider value={{ tema, setTema, alternar }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTema() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTema deve ser usado dentro de ThemeProvider')
  return context
}
