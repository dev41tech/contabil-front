import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { extractApiError } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { RegraForm, type RegraPayload } from '@/components/regras/RegraForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BookOpen, Building2, ChevronLeft, ChevronRight, Loader2, Plus, Search, ToggleLeft, ToggleRight, TrendingDown, TrendingUp, Zap } from 'lucide-react'
import { opcaoConta } from '@/lib/contas'

const TIPO_LABEL: Record<string, string> = {
  ativo: 'Ativo', passivo: 'Passivo', patrimonio_liquido: 'PL',
  receita: 'Receita', despesa: 'Despesa', custo: 'Custo', resultado: 'Resultado',
}
const PAGE_SIZE_REGRAS = 50

export function RegrasTab({ empresaId }: { empresaId: string }) {
  const qc = useQueryClient()
  const [openDialog, setOpenDialog] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [agenciaFiltro, setAgenciaFiltro] = useState('todas')
  const [apenasAtivas, setApenasAtivas] = useState(false)

  const buildQuery = () => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('page_size', String(PAGE_SIZE_REGRAS))
    if (apenasAtivas) p.set('apenas_ativas', 'true')
    if (agenciaFiltro !== 'todas') p.set('agencia_id', agenciaFiltro)
    return p.toString()
  }

  const { data: regraData, isLoading } = useQuery<any>({
    queryKey: ['regras', empresaId, page, agenciaFiltro, apenasAtivas],
    queryFn: () => api.get(`/empresas/${empresaId}/regras?${buildQuery()}`).then(r => r.data),
    enabled: !!empresaId,
  })

  const { data: contasRaw } = useQuery<any>({
    queryKey: ['plano-contas', empresaId],
    queryFn: () => api.get(`/empresas/${empresaId}/plano-contas`).then(r => r.data.items ?? r.data),
    enabled: !!empresaId,
  })
  const contas: any[] = Array.isArray(contasRaw) ? contasRaw : (contasRaw?.items ?? [])

  const { data: agencias = [] } = useQuery<any[]>({
    queryKey: ['agencias', empresaId, 'ativas'],
    queryFn: () => api.get(`/empresas/${empresaId}/agencias?apenas_ativas=true`).then(r => r.data.items ?? r.data),
    enabled: !!empresaId,
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativa }: { id: string; ativa: boolean }) =>
      api.patch(`/empresas/${empresaId}/regras/${id}`, { ativa }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['regras', empresaId] })
      toast({ title: 'Regra atualizada', variant: 'success' })
    },
    onError: (e: unknown) => toast({ title: 'Erro', description: extractApiError(e), variant: 'destructive' }),
  })

  const createMutation = useMutation({
    mutationFn: (d: RegraPayload) => api.post(`/empresas/${empresaId}/regras`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['regras', empresaId] })
      toast({ title: 'Regra criada com sucesso!', variant: 'success' })
      setOpenDialog(false)
    },
    onError: (e: unknown) => toast({ title: 'Erro ao criar regra', description: extractApiError(e), variant: 'destructive' }),
  })

  const allRegras: any[] = regraData?.items ?? []
  const total: number = regraData?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE_REGRAS)

  // Filtro local de texto (sobre os itens carregados na página)
  const regras = useMemo(() => {
    if (!search.trim()) return allRegras
    const q = search.toLowerCase()
    return allRegras.filter((r: any) =>
      (r.descricao ?? '').toLowerCase().includes(q) ||
      (r.historico ?? '').toLowerCase().includes(q) ||
      (r.conta_descricao ?? '').toLowerCase().includes(q) ||
      (r.conta_codigo ?? '').toLowerCase().includes(q)
    )
  }, [allRegras, search])

  const contaOptions = useMemo(
    () => contas.map((conta: any) => opcaoConta(conta)),
    [contas],
  )
  const agenciaOptions = useMemo(() =>
    agencias.map((agencia: any) => ({
      value: agencia.id,
      label: `${agencia.banco_sigla} — Ag ${agencia.agencia} / CC ${agencia.numero}${agencia.digito ? `-${agencia.digito}` : ''}`,
    })),
    [agencias],
  )

  return (
    <div className="space-y-4">
      {/* Barra de filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, padrão ou conta..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>

        <Select value={agenciaFiltro} onValueChange={v => { setAgenciaFiltro(v); setPage(1) }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todas as agências" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as agências</SelectItem>
            {agencias.map((a: any) => (
              <SelectItem key={a.id} value={a.id}>
                {a.banco_sigla} {a.agencia}/{a.numero}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          onClick={() => { setApenasAtivas(!apenasAtivas); setPage(1) }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${apenasAtivas ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-border text-muted-foreground hover:bg-muted/50'}`}
        >
          {apenasAtivas ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
          {apenasAtivas ? 'Só ativas' : 'Todas'}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{total} regra{total !== 1 ? 's' : ''}</span>
          <Button size="sm" onClick={() => setOpenDialog(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova Regra
          </Button>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : regras.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Zap className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-muted-foreground">
            {search ? 'Nenhuma regra encontrada para esta busca.' : 'Nenhuma regra cadastrada.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {regras.map((r: any) => (
            <div
              key={r.id}
              className={`p-4 rounded-lg border transition-colors hover:shadow-sm ${r.ativa ? 'bg-white' : 'bg-muted/30 opacity-70'}`}
            >
              <div className="flex items-start justify-between gap-3">
                {/* Lado esquerdo: info principal */}
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Linha 1: nome + badges */}
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="font-semibold text-sm truncate">{r.descricao}</span>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold ${r.dc === 'D' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {r.dc === 'D' ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                      {r.dc === 'D' ? 'Débito' : 'Crédito'}
                    </span>
                    {r.tipo === 'automatica' && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                        <Zap className="h-3 w-3" /> Auto
                      </span>
                    )}
                  </div>

                  {/* Linha 2: padrão */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="shrink-0">Padrão:</span>
                    <code className="bg-muted px-2 py-0.5 rounded font-mono text-foreground max-w-xs truncate">
                      {r.historico}
                    </code>
                  </div>

                  {/* Linha 3: conta + agência */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    {(r.conta_codigo || r.conta_descricao) && (
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-mono text-muted-foreground">{r.conta_codigo}</span>
                        {r.conta_descricao && (
                          <span className="text-foreground font-medium truncate max-w-[220px]">
                            {r.conta_descricao}
                          </span>
                        )}
                      </div>
                    )}
                    {r.agencia_descricao && (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">{r.agencia_descricao}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Lado direito: status + toggle */}
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={r.ativa ? 'success' : 'secondary'} className="text-xs">
                    {r.ativa ? 'Ativa' : 'Inativa'}
                  </Badge>
                  <button
                    onClick={() => toggleMutation.mutate({ id: r.id, ativa: !r.ativa })}
                    disabled={toggleMutation.isPending}
                    title={r.ativa ? 'Desativar regra' : 'Ativar regra'}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                  >
                    {r.ativa
                      ? <ToggleRight className="h-5 w-5 text-emerald-600" />
                      : <ToggleLeft className="h-5 w-5" />
                    }
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Página {page} de {totalPages} · {total} regras
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="icon"
              className="h-8 w-8"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = page <= 3 ? i + 1 : page - 2 + i
              if (p < 1 || p > totalPages) return null
              return (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="icon"
                  className="h-8 w-8 text-xs"
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              )
            })}
            <Button
              variant="outline" size="icon"
              className="h-8 w-8"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialog Nova Regra */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-2xl overflow-visible">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-500" /> Nova Regra de Categorização
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Defina um padrão de texto do extrato bancário e a conta contábil correspondente.
            </p>
          </DialogHeader>
          <RegraForm
            contas={contaOptions}
            agencia={{ mode: 'select', options: agenciaOptions }}
            editableFields={['descricao', 'historico', 'conta_id', 'agencia_id', 'dc']}
            isSubmitting={createMutation.isPending}
            onSubmit={data => createMutation.mutate(data)}
            onCancel={() => setOpenDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}



