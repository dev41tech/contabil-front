import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Building2, CalendarDays, ChevronDown, Search } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useEmpresas } from '@/hooks/useEmpresas'
import { useCompetencia } from '@/contexts/CompetenciaContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function EmpresaSelector() {
  const { empresa, setEmpresa } = useEmpresa()
  const [search, setSearch] = useState('')

  const { data: empresas = [] } = useEmpresas()

  const filtered = empresas.filter((e: any) =>
    e.razao_social.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <DropdownMenu onOpenChange={(open) => { if (!open) setSearch('') }}>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border border-border bg-card hover:bg-accent transition-colors max-w-[260px]">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate font-medium">
            {empresa ? empresa.razao_social : 'Selecionar empresa'}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-auto" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-0">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-3 pt-2 pb-0">
          Empresa ativa em todos os módulos
        </DropdownMenuLabel>

        {/* Campo de busca */}
        {empresas.length > 5 && (
          <div className="flex items-center border-b px-3 py-1">
            <Search className="h-3.5 w-3.5 opacity-40 mr-2 shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar empresa..."
              className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onKeyDown={e => e.stopPropagation()} // evita fechar com Escape
            />
          </div>
        )}

        <DropdownMenuSeparator className="my-0" />

        {/* Lista rolável */}
        <div className="max-h-60 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <DropdownMenuItem disabled className="text-muted-foreground text-xs">
              Nenhuma empresa encontrada
            </DropdownMenuItem>
          )}
          {filtered.map((e: any) => (
            <DropdownMenuItem
              key={e.id}
              onClick={() => { setEmpresa({ id: e.id, razao_social: e.razao_social }); setSearch('') }}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2 w-full min-w-0">
                <div
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    empresa?.id === e.id ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                />
                <span className="truncate">{e.razao_social}</span>
              </div>
            </DropdownMenuItem>
          ))}
        </div>

        {empresa && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setEmpresa(null)}
              className="text-muted-foreground cursor-pointer text-xs"
            >
              Limpar seleção
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CompetenciaSelector() {
  const { competencia, setCompetencia } = useCompetencia()

  return (
    <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3">
      <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
      <label htmlFor="competencia-global" className="sr-only">Competência global</label>
      <input
        id="competencia-global"
        type="month"
        value={competencia}
        onChange={event => setCompetencia(event.target.value)}
        className="w-[132px] bg-transparent text-sm font-medium outline-none"
        title="Competência usada no Dashboard e nas pendências do NEO"
      />
    </div>
  )
}

export function AppShell() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-12 border-b bg-card flex items-center justify-end gap-2 px-6 shrink-0">
          <CompetenciaSelector />
          <EmpresaSelector />
        </header>
        {/* Conteúdo */}
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto py-6 px-8 max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
