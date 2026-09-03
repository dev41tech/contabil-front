import { Moon, Sun } from 'lucide-react'
import { useTema } from '@/contexts/ThemeContext'

/** Troca o tema do sistema inteiro — não de uma tela. */
export function ThemeToggle() {
  const { tema, alternar } = useTema()
  const escuro = tema === 'escuro'

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={escuro ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
      title={escuro ? 'Tema claro' : 'Tema escuro'}
      className="flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-accent hover:text-foreground"
    >
      {escuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
