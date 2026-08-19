import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import { extractApiError, formatCurrency, formatDate } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { AgenciaNeo, NeoGrupoPendencia, NeoPendenciasAgrupadas, NeoSimulacaoRegra, SelectOption } from './types'
import { agenciaLabel } from './types'

interface PendenciasGroupsProps {
  empresaId: string
  agenciaId: string
  mes: string
  agencias: AgenciaNeo[]
  contaOptions: SelectOption[]
  onTotalsChange?: (data: NeoPendenciasAgrupadas | undefined) => void
}

const numero = (value: number) => value.toLocaleString('pt-BR')

export function PendenciasGroups({ empresaId, agenciaId, mes, agencias, contaOptions, onTotalsChange }: PendenciasGroupsProps) {
  const qc = useQueryClient()
  const [granularidade, setGranularidade] = useState(3)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [grupoClassificar, setGrupoClassificar] = useState<NeoGrupoPendencia | null>(null)
  const [grupoRegra, setGrupoRegra] = useState<NeoGrupoPendencia | null>(null)
  const [contaId, setContaId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [historico, setHistorico] = useState('')
  const [historicoDebounced, setHistoricoDebounced] = useState('')
  const [regraAgenciaId, setRegraAgenciaId] = useState('')

  const params = useMemo(() => {
    const p = new URLSearchParams({ tokens: String(granularidade), limite_grupos: '50' })
    if (agenciaId !== 'todas') p.set('agencia_id', agenciaId)
    if (mes) p.set('mes', mes)
    return p.toString()
  }, [agenciaId, granularidade, mes])

  const pendenciasQuery = useQuery<NeoPendenciasAgrupadas>({
    queryKey: ['neo-pendencias-agrupadas', empresaId, agenciaId, mes, granularidade],
    queryFn: () => api.get(`/empresas/${empresaId}/neo/pendencias/agrupadas?${params}`).then(r => r.data),
    enabled: !!empresaId,
  })

  useEffect(() => onTotalsChange?.(pendenciasQuery.data), [onTotalsChange, pendenciasQuery.data])

  useEffect(() => {
    const timer = setTimeout(() => setHistoricoDebounced(historico.trim()), 450)
    return () => clearTimeout(timer)
  }, [historico])

  const simulacaoQuery = useQuery<NeoSimulacaoRegra>({
    queryKey: ['neo-simulacao-regra', empresaId, historicoDebounced, grupoRegra?.dc, regraAgenciaId, contaId],
    queryFn: () => api.post(`/empresas/${empresaId}/neo/pendencias/simular-regra`, {
      historico: historicoDebounced,
      dc: grupoRegra?.dc,
      agencia_id: regraAgenciaId,
      conta_id: contaId,
    }).then(r => r.data),
    enabled: !!grupoRegra && historicoDebounced.length >= 2 && !!regraAgenciaId && !!contaId,
    retry: false,
  })
  const simulacaoDesatualizada = historico.trim() !== historicoDebounced

  const invalidateNeo = () => {
    qc.invalidateQueries({ queryKey: ['neo-pendencias-agrupadas', empresaId] })
    qc.invalidateQueries({ queryKey: ['neo-decisoes', empresaId] })
    qc.invalidateQueries({ queryKey: ['neo-resumo', empresaId] })
    qc.invalidateQueries({ queryKey: ['extrato', empresaId] })
  }

  const classificarMutation = useMutation({
    mutationFn: () => api.post(`/empresas/${empresaId}/neo/pendencias/classificar-lote`, {
      transacao_ids: grupoClassificar?.transacao_ids ?? [],
      conta_id: contaId,
      descricao,
    }),
    onSuccess: ({ data }) => {
      const partes = [`${numero(data.classificadas)} classificadas`]
      if (data.ignoradas > 0) partes.push(`${numero(data.ignoradas)} já haviam sido processadas`)
      toast({ title: 'Lote classificado', description: `${partes.join(', ')}.`, variant: 'success' })
      setGrupoClassificar(null)
      invalidateNeo()
    },
    onError: (error: unknown) => toast({ title: 'Erro ao classificar o lote', description: extractApiError(error), variant: 'destructive' }),
  })

  const criarRegraMutation = useMutation({
    mutationFn: () => api.post(`/empresas/${empresaId}/neo/pendencias/criar-regra-e-aplicar`, {
      historico: historico.trim(),
      dc: grupoRegra?.dc,
      agencia_id: regraAgenciaId,
      conta_id: contaId,
      descricao,
      tipo: 'automatica',
      manter_historico: false,
      mes: mes || undefined,
    }),
    onSuccess: ({ data }) => {
      const resolvidas = data.resultado?.associadas ?? 0
      toast({
        title: 'Regra criada e aplicada',
        description: `${numero(resolvidas)} pendência${resolvidas === 1 ? '' : 's'} resolvida${resolvidas === 1 ? '' : 's'} agora.`,
        variant: 'success',
      })
      setGrupoRegra(null)
      invalidateNeo()
    },
    onError: (error: unknown) => toast({ title: 'Erro ao criar e aplicar a regra', description: extractApiError(error), variant: 'destructive' }),
  })

  function abrirClassificacao(grupo: NeoGrupoPendencia) {
    setContaId('')
    setDescricao(grupo.rotulo)
    setGrupoClassificar(grupo)
  }

  function abrirRegra(grupo: NeoGrupoPendencia) {
    setContaId('')
    setDescricao(grupo.rotulo)
    setHistorico(grupo.rotulo)
    setHistoricoDebounced(grupo.rotulo)
    setRegraAgenciaId(agenciaId !== 'todas' ? agenciaId : (grupo.agencia_ids[0] ?? ''))
    setGrupoRegra(grupo)
  }

  function toggleGrupo(key: string) {
    setExpandidos(atual => {
      const proximo = new Set(atual)
      proximo.has(key) ? proximo.delete(key) : proximo.add(key)
      return proximo
    })
  }

  if (!empresaId) return <p className="py-12 text-center text-muted-foreground">Selecione uma empresa para abrir a caixa de classificação.</p>

  if (pendenciasQuery.isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
  }

  if (pendenciasQuery.isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <div><p className="font-semibold">Não foi possível carregar as pendências.</p><p className="text-sm text-muted-foreground">A fila não foi alterada. Tente novamente.</p></div>
        <Button variant="outline" onClick={() => pendenciasQuery.refetch()}><RefreshCw className="h-4 w-4" />Tentar novamente</Button>
      </div>
    )
  }

  const dados = pendenciasQuery.data
  const grupos = dados?.grupos ?? []
  const escopoFiltrado = agenciaId !== 'todas' || !!mes

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 rounded-lg border bg-muted/30 p-4 md:flex-row md:items-center">
        <div>
          <Label htmlFor="granularidade">Agrupar por histórico</Label>
          <p className="text-xs text-muted-foreground">Início do histórico (mais amplo) ↔ mais específico</p>
        </div>
        <div className="flex min-w-[260px] items-center gap-3">
          <span className="text-xs font-medium">Amplo</span>
          <input
            id="granularidade"
            type="range"
            min={1}
            max={6}
            value={granularidade}
            onChange={event => setGranularidade(Number(event.target.value))}
            className="h-2 flex-1 cursor-pointer accent-primary"
            aria-label="Granularidade do agrupamento"
          />
          <span className="text-xs font-medium">Específico</span>
        </div>
      </div>

      {dados?.parcial && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Agrupando as <strong>{numero(dados.total_agrupadas)}</strong> pendências mais antigas de <strong>{numero(dados.total_pendentes)}</strong>. Os grupos abaixo representam apenas essa fatia da fila.
        </div>
      )}

      {grupos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-14 text-center">
          {escopoFiltrado ? (
            <><Sparkles className="h-9 w-9 text-muted-foreground" /><div><p className="font-semibold">Nenhuma pendência neste filtro</p><p className="text-sm text-muted-foreground">Altere a agência ou a competência para consultar outro escopo.</p></div></>
          ) : (
            <><CheckCircle2 className="h-10 w-10 text-green-600" /><div><p className="font-semibold text-green-800">Competência pronta para conferência</p><p className="text-sm text-muted-foreground">Não há pendências de classificação nesta empresa.</p></div></>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {grupos.map((grupo, index) => {
            const key = `${grupo.padrao}-${grupo.dc}-${index}`
            const expandido = expandidos.has(key)
            return (
              <Card key={key} className="overflow-hidden transition-shadow hover:shadow-sm">
                <CardContent className="p-0">
                  <button type="button" onClick={() => toggleGrupo(key)} className="flex w-full items-start gap-3 p-4 text-left md:items-center" aria-expanded={expandido}>
                    <ChevronDown className={cn('mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform md:mt-0', expandido && 'rotate-180')} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{grupo.rotulo}</p>
                        <Badge variant={grupo.dc === 'D' ? 'warning' : 'success'}>{grupo.dc === 'D' ? 'Débito' : 'Crédito'}</Badge>
                        {grupo.agencia_ids.length > 1 && <Badge variant="outline">{grupo.agencia_ids.length} agências</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                        <span><strong className="text-foreground">{numero(grupo.quantidade)}</strong> transações</span>
                        <span className="font-medium text-foreground">{formatCurrency(grupo.valor_total)}</span>
                        <span>{formatDate(grupo.data_inicio)}–{formatDate(grupo.data_fim)}</span>
                      </div>
                    </div>
                    <span className="hidden text-xs text-muted-foreground md:block">{expandido ? 'Ocultar variações' : 'Conferir variações'}</span>
                  </button>
                  {expandido && (
                    <div className="border-t bg-muted/20 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Variações encontradas neste grupo</p>
                      <ul className="space-y-1.5">
                        {grupo.amostras.map(amostra => <li key={amostra} className="rounded-md border bg-background px-3 py-2 text-sm font-mono">{amostra}</li>)}
                      </ul>
                      {grupo.agencia_ids.length > 1 && <p className="mt-3 text-xs text-amber-700">Este grupo reúne lançamentos de mais de uma agência. Confira o escopo antes de criar uma regra.</p>}
                      <div className="mt-4 flex flex-wrap justify-end gap-2">
                        <Button variant="outline" onClick={() => abrirClassificacao(grupo)}>Classificar estas {numero(grupo.quantidade)}</Button>
                        <Button onClick={() => abrirRegra(grupo)}><Sparkles className="h-4 w-4" />Criar regra e aplicar</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={!!grupoClassificar} onOpenChange={open => { if (!open) setGrupoClassificar(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Classificar {numero(grupoClassificar?.quantidade ?? 0)} transações</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">A classificação vale somente para as transações deste grupo e não cria uma regra.</p>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Conta contábil</Label><SearchableSelect value={contaId} onValueChange={setContaId} options={contaOptions} placeholder="Selecione a conta..." searchPlaceholder="Buscar conta..." /></div>
            <div className="space-y-1"><Label>Descrição</Label><Input value={descricao} onChange={event => setDescricao(event.target.value)} maxLength={500} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrupoClassificar(null)}>Cancelar</Button>
            <Button disabled={!contaId || descricao.trim().length < 2 || classificarMutation.isPending} onClick={() => classificarMutation.mutate()}>
              {classificarMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Classificar {numero(grupoClassificar?.transacao_ids.length ?? 0)} transações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!grupoRegra} onOpenChange={open => { if (!open) setGrupoRegra(null) }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Criar regra e aplicar</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {grupoRegra && grupoRegra.agencia_ids.length > 1 && agenciaId === 'todas' && (
              <div className="space-y-1">
                <Label>Agência da regra</Label>
                <Select value={regraAgenciaId} onValueChange={setRegraAgenciaId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a agência" /></SelectTrigger>
                  <SelectContent>{grupoRegra.agencia_ids.map(id => { const ag = agencias.find(item => item.id === id); return <SelectItem key={id} value={id}>{ag ? agenciaLabel(ag) : id}</SelectItem> })}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1"><Label>Histórico que ativa a regra</Label><Input value={historico} onChange={event => setHistorico(event.target.value)} maxLength={500} /><p className="text-xs text-muted-foreground">Encurte o texto para ampliar o alcance da regra. A prévia será atualizada enquanto você digita.</p></div>
            <div className="space-y-1"><Label>Conta contábil</Label><SearchableSelect value={contaId} onValueChange={setContaId} options={contaOptions} placeholder="Selecione a conta..." searchPlaceholder="Buscar conta..." /></div>
            <div className="space-y-1"><Label>Descrição</Label><Input value={descricao} onChange={event => setDescricao(event.target.value)} maxLength={500} /></div>

            {historico.trim().length >= 2 && contaId && regraAgenciaId && (
              <div className="rounded-lg border bg-muted/30 p-4" aria-live="polite">
                {simulacaoDesatualizada || simulacaoQuery.isFetching ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Calculando o impacto da regra...</div>
                ) : simulacaoQuery.isError ? (
                  <p className="text-sm text-destructive">Não foi possível calcular a prévia. Revise os campos ou tente novamente.</p>
                ) : simulacaoQuery.data ? (
                  <div className="space-y-3">
                    <p className="text-sm">Esta regra atinge <strong>{numero(simulacaoQuery.data.pendencias_atingidas)} pendências</strong> e <strong>{numero(simulacaoQuery.data.ja_contabilizadas_atingidas)} transações já contabilizadas</strong>.</p>
                    {simulacaoQuery.data.conflitos > 0 && (
                      <div className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><p className="text-sm"><strong>{numero(simulacaoQuery.data.conflitos)}</strong> delas {simulacaoQuery.data.conflitos === 1 ? 'foi classificada' : 'foram classificadas'} em outra conta.</p></div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrupoRegra(null)}>Cancelar</Button>
            <Button disabled={simulacaoDesatualizada || simulacaoQuery.isFetching || !simulacaoQuery.data || historico.trim().length < 2 || descricao.trim().length < 2 || !contaId || !regraAgenciaId || criarRegraMutation.isPending} onClick={() => criarRegraMutation.mutate()}>
              {criarRegraMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Criar regra e afetar {numero(simulacaoQuery.data?.pendencias_atingidas ?? 0)} pendências
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
