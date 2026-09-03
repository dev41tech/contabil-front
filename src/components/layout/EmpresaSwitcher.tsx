import { useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useEmpresas } from '@/hooks/useEmpresas'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/** Iniciais da razão social, para o quadradinho do gatilho. */
function iniciais(razaoSocial: string) {
  const palavras = razaoSocial.trim().split(/\s+/).filter(p => p.length > 2)
  return (palavras.slice(0, 2).map(p => p[0]).join('') || razaoSocial.slice(0, 2)).toUpperCase()
}

/**
 * Empresa ativa em todos os módulos. Fica logo abaixo do nome do sistema na
 * sidebar — antes vivia na topbar, longe do conteúdo que ela governa.
 */
export function EmpresaSwitcher() {
  const { empresa, setEmpresa } = useEmpresa()
  const [search, setSearch] = useState('')

  const { data: empresas = [] } = useEmpresas()

  const filtered = empresas.filter((e: any) =>
    e.razao_social.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <DropdownMenu onOpenChange={open => { if (!open) setSearch('') }}>
      <DropdownMenuTrigger asChild>
        <button className="flex h-8 w-full items-center gap-2 rounded-md bg-surface-hover px-2 text-sm transition-colors hover:bg-accent">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-brand/15 text-[11px] font-semibold text-brand">
            {empresa ? iniciais(empresa.razao_social) : '—'}
          </span>
          <span className="min-w-0 flex-1 truncate text-left font-medium">
            {empresa ? empresa.razao_social : 'Selecionar empresa'}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72 p-0">
        <DropdownMenuLabel className="px-3 pb-0 pt-2 text-xs font-normal text-muted-foreground">
          Empresa ativa em todos os módulos
        </DropdownMenuLabel>

        {empresas.length > 5 && (
          <div className="flex items-center border-b px-3 py-1">
            <Search className="mr-2 h-3.5 w-3.5 shrink-0 opacity-40" />
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

        <div className="scroll-y max-h-60 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              Nenhuma empresa encontrada
            </DropdownMenuItem>
          )}
          {filtered.map((e: any) => (
            <DropdownMenuItem
              key={e.id}
              onClick={() => { setEmpresa({ id: e.id, razao_social: e.razao_social }); setSearch('') }}
              className="cursor-pointer"
            >
              <div className="flex w-full min-w-0 items-center gap-2">
                <div
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    empresa?.id === e.id ? 'bg-brand' : 'bg-muted-foreground/30'
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
              className="cursor-pointer text-xs text-muted-foreground"
            >
              Limpar seleção
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
