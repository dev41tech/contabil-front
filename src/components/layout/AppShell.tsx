import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { CalendarDays, Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { ThemeToggle } from './ThemeToggle'
import { useAuth } from '@/contexts/AuthContext'
import { useCompetencia } from '@/contexts/CompetenciaContext'
import { JobsIndicator } from '@/components/jobs/JobsIndicator'

function CompetenciaSelector() {
  const { competencia, setCompetencia } = useCompetencia()

  return (
    <div className="flex h-8 items-center gap-2 rounded-md border border-border-strong bg-input-bg px-3">
      <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
      <label htmlFor="competencia-global" className="sr-only">Competência global</label>
      <input
        id="competencia-global"
        type="month"
        value={competencia}
        onChange={event => setCompetencia(event.target.value)}
        className="tnum w-[122px] bg-transparent text-sm font-medium outline-none"
        title="Competência usada no Dashboard e nas pendências do NEO"
      />
    </div>
  )
}

function Perfil() {
  const { user } = useAuth()
  if (!user) return null

  const iniciais = (user.nome ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(parte => parte[0])
    .join('')
    .toUpperCase()

  return (
    <div className="flex items-center gap-2.5 border-l border-border pl-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/15 text-badge font-semibold text-brand">
        {iniciais || '—'}
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-semibold">{user.nome}</span>
        <span className="truncate text-xs text-muted-foreground">
          {user.role === 'admin' ? 'Administrador' : 'Operador'}
        </span>
      </span>
    </div>
  )
}

export function AppShell() {
  // Abaixo de lg a sidebar vira drawer. Acima, este estado não é consultado.
  const [menuAberto, setMenuAberto] = useState(false)

  return (
    <div className="flex h-screen bg-canvas">
      {menuAberto && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMenuAberto(false)}
          aria-hidden="true"
        />
      )}
      <Sidebar aberta={menuAberto} onFechar={() => setMenuAberto(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar de 60px, como no DS. O seletor de empresa saiu daqui e foi
            para a sidebar; aqui ficam só os controles de sessão. */}
        <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-border bg-topbar px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            aria-label="Abrir menu"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-accent hover:text-foreground lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <JobsIndicator />
          <CompetenciaSelector />
          <ThemeToggle />
          <Perfil />
        </header>
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-7">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
