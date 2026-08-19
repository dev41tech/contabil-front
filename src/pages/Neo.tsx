import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/api'
import { formatCurrency, formatDate, extractApiError } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Pagination } from '@/components/ui/pagination'
import { Zap, Loader2, Link2, BookOpen } from 'lucide-react'
import { useEmpresas } from '@/hooks/useEmpresas'
import { useEmpresaDefault } from '@/hooks/useEmpresaDefault'

// ── Cores por resultado ────────────────────────────────────────────────────────
const RESULTADO_COLORS: Record<string, any> = {
  associada: 'success',
  sem_regra: 'warning',
  ambiguo: 'secondary',
  erro: 'destructive',
}

// ── Schemas de formulário ──────────────────────────────────────────────────────
const associarManualSchema = z.object({
  conta_id: z.string().uuid('Selecione uma conta'),
  descricao: z.string().min(2, 'Mínimo 2 caracteres').max(500),
})

const criarRegraSchema = z.object({
  conta_id: z.string().uuid('Selecione uma conta'),
  descricao: z.string().min(2, 'Mínimo 2 caracteres').max(500),
  historico: z.string().min(2).max(500),
  dc: z.enum(['D', 'C']),
  tipo: z.enum(['automatica', 'manual']),
  manter_historico: z.boolean(),
})

type AssociarManualForm = z.infer<typeof associarManualSchema>
type CriarRegraForm = z.infer<typeof criarRegraSchema>

// ── Componente ────────────────────────────────────────────────────────────────
export default function NeoPage() {
  const qc = useQueryClient()
  const [selectedEmpresa, setSelectedEmpresa] = useEmpresaDefault()
  const [processResult, setProcessResult] = useState<any>(null)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  // Estado dos modais
  const [associarDecisao, setAssociarDecisao] = useState<any>(null)
  const [criarRegraDecisao, setCriarRegraDecisao] = useState<any>(null)

  // Busca e filtros (item 4 do PDF de feedback dos contadores)
  const [termoInput, setTermoInput] = useState('')
  const [termo, setTermo] = useState('')
  const [resultadoFiltro, setResultadoFiltro] = useState('todos')
  const [estrategiaFiltro, setEstrategiaFiltro] = useState('todas')
  const [dcFiltro, setDcFiltro] = useState('todos')
  const [agenciaFiltro, setAgenciaFiltro] = useState('todas')
  const [contaFiltro, setContaFiltro] = useState('todas')
  const [mesFiltro, setMesFiltro] = useState('')
  const [valorMinFiltro, setValorMinFiltro] = useState('')
  const [valorMaxFiltro, setValorMaxFiltro] = useState('')

  useEffect(() => {
    const t = setTimeout(() => { setTermo(termoInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [termoInput])

  const filtrosAtivos =
    !!termo || resultadoFiltro !== 'todos' || estrategiaFiltro !== 'todas' ||
    dcFiltro !== 'todos' || agenciaFiltro !== 'todas' || contaFiltro !== 'todas' ||
    !!mesFiltro || !!valorMinFiltro || !!valorMaxFiltro

  const limparFiltros = () => {
    setTermoInput(''); setTermo('')
    setResultadoFiltro('todos'); setEstrategiaFiltro('todas')
    setDcFiltro('todos'); setAgenciaFiltro('todas'); setContaFiltro('todas')
    setMesFiltro(''); setValorMinFiltro(''); setValorMaxFiltro(''); setPage(1)
  }

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: empresas = [] } = useEmpresas()

  const { data: agencias = [] } = useQuery<any[]>({
    // Lista completa, incluindo contas desativadas: este seletor filtra dado
    // histórico, e desativar uma conta preserva o histórico dela de propósito.
    // Restringir a ativas tornaria o extrato de uma conta encerrada inalcançável.
    queryKey: ['agencias', selectedEmpresa],
    queryFn: () => api.get(`/empresas/${selectedEmpresa}/agencias`).then(r => r.data.items ?? r.data),
    enabled: !!selectedEmpresa,
  })

  const buildDecisoesParams = () => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('page_size', String(PAGE_SIZE))
    if (termo) p.set('termo', termo)
    if (resultadoFiltro !== 'todos') p.set('resultado', resultadoFiltro)
    if (estrategiaFiltro !== 'todas') p.set('estrategia', estrategiaFiltro)
    if (dcFiltro !== 'todos') p.set('dc', dcFiltro)
    if (agenciaFiltro !== 'todas') p.set('agencia_id', agenciaFiltro)
    if (contaFiltro !== 'todas') p.set('conta_id', contaFiltro)
    if (mesFiltro) p.set('mes', mesFiltro)
    if (valorMinFiltro) p.set('valor_min', String(Number(valorMinFiltro)))
    if (valorMaxFiltro) p.set('valor_max', String(Number(valorMaxFiltro)))
    return p.toString()
  }

  const { data: decisoes, isLoading } = useQuery<any>({
    queryKey: ['neo-decisoes', selectedEmpresa, page, termo, resultadoFiltro, estrategiaFiltro, dcFiltro, agenciaFiltro, contaFiltro, mesFiltro, valorMinFiltro, valorMaxFiltro],
    queryFn: () =>
      api
        .get(`/empresas/${selectedEmpresa}/neo/decisoes?${buildDecisoesParams()}`)
        .then(r => r.data),
    enabled: !!selectedEmpresa,
  })

  // Plano de contas para os modais e para o filtro por conta (carregado quando empresa selecionada)
  const { data: planoConta = [] } = useQuery<any[]>({
    queryKey: ['plano-contas', selectedEmpresa],
    queryFn: () =>
      api
        .get(`/empresas/${selectedEmpresa}/plano-contas`)
        .then(r => r.data.items ?? r.data),
    enabled: !!selectedEmpresa,
  })

  // ── Mutations ────────────────────────────────────────────────────────────────
  const processMutation = useMutation({
    mutationFn: () => api.post(`/empresas/${selectedEmpresa}/neo/processar`, {
      agencia_id: agenciaFiltro !== 'todas' ? agenciaFiltro : undefined,
      mes: mesFiltro || undefined,
    }),
    onSuccess: (res) => {
      setProcessResult(res.data)
      qc.invalidateQueries({ queryKey: ['neo-decisoes', selectedEmpresa] })
      qc.invalidateQueries({ queryKey: ['extrato', selectedEmpresa] })
    },
    onError: (e: unknown) =>
      toast({ title: 'Erro ao processar NEO', description: extractApiError(e), variant: 'destructive' }),
  })

  const associarManualMutation = useMutation({
    mutationFn: ({ decisaoId, body }: { decisaoId: string; body: AssociarManualForm }) =>
      api.post(`/empresas/${selectedEmpresa}/neo/decisoes/${decisaoId}/associar-manual`, body),
    onSuccess: () => {
      toast({ title: 'Transação associada com sucesso!', variant: 'success' })
      setAssociarDecisao(null)
      qc.invalidateQueries({ queryKey: ['neo-decisoes', selectedEmpresa] })
      qc.invalidateQueries({ queryKey: ['extrato', selectedEmpresa] })
    },
    onError: (e: unknown) =>
      toast({ title: 'Erro ao associar', description: extractApiError(e), variant: 'destructive' }),
  })

  const criarRegraMutation = useMutation({
    mutationFn: (body: any) =>
      api.post(`/empresas/${selectedEmpresa}/regras`, body),
    onSuccess: () => {
      toast({ title: 'Regra criada com sucesso!', variant: 'success' })
      setCriarRegraDecisao(null)
    },
    onError: (e: unknown) =>
      toast({ title: 'Erro ao criar regra', description: extractApiError(e), variant: 'destructive' }),
  })

  // ── Formulários ───────────────────────────────────────────────────────────────
  const associarForm = useForm<AssociarManualForm>({
    resolver: zodResolver(associarManualSchema),
    defaultValues: { conta_id: '', descricao: '' },
  })

  const regraForm = useForm<CriarRegraForm>({
    resolver: zodResolver(criarRegraSchema),
    defaultValues: { conta_id: '', descricao: '', historico: '', dc: 'D', tipo: 'automatica', manter_historico: false },
  })

  function openAssociar(decisao: any) {
    associarForm.reset({ conta_id: '', descricao: decisao.transacao_descricao ?? '' })
    setAssociarDecisao(decisao)
  }

  function openCriarRegra(decisao: any) {
    regraForm.reset({
      conta_id: '',
      descricao: decisao.transacao_descricao ?? '',
      historico: decisao.transacao_descricao ?? '',
      dc: decisao.transacao_dc ?? 'D',
      tipo: 'automatica',
      manter_historico: false,
    })
    setCriarRegraDecisao(decisao)
  }

  function submitAssociar(data: AssociarManualForm) {
    associarManualMutation.mutate({ decisaoId: associarDecisao.id, body: data })
  }

  function submitCriarRegra(data: CriarRegraForm) {
    criarRegraMutation.mutate({
      ...data,
      agencia_id: criarRegraDecisao?.agencia_id,
    })
  }

  // ── Dados ────────────────────────────────────────────────────────────────────
  const items: any[] = decisoes?.items ?? []
  const total: number = decisoes?.total ?? 0

  const contaOptions = planoConta.map((c: any) => ({
    value: c.id,
    label: `${c.codigo ? c.codigo + ' — ' : ''}${c.descricao}`,
  }))

  const agenciaProcessamento = agencias.find((ag: any) => ag.id === agenciaFiltro)
  const agenciaProcessamentoLabel = agenciaFiltro === 'todas'
    ? ''
    : agenciaProcessamento?.descricao ?? (agenciaProcessamento
      ? `${agenciaProcessamento.banco_sigla} ${agenciaProcessamento.agencia}/${agenciaProcessamento.numero}`
      : 'agência selecionada')
  const escopoProcessamento = [agenciaProcessamentoLabel, mesFiltro].filter(Boolean).join(' · ')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">NEO — Conciliação Automática</h1>
        <p className="text-muted-foreground">Aplica regras de categorização às transações pendentes</p>
      </div>

      {/* Controles */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <label className="text-sm font-medium mb-1 block">Empresa</label>
              <SearchableSelect
                value={selectedEmpresa}
                onValueChange={v => {
                  setSelectedEmpresa(v)
                  setAgenciaFiltro('todas')
                  setContaFiltro('todas')
                  setProcessResult(null)
                  setPage(1)
                }}
                options={empresas.map((e: any) => ({ value: e.id, label: e.razao_social }))}
                placeholder="Selecione a empresa"
                searchPlaceholder="Buscar empresa..."
              />
            </div>
            <Button
              onClick={() => processMutation.mutate()}
              disabled={!selectedEmpresa || processMutation.isPending}
              className="bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              {processMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processando...</>
              ) : (
                <><Zap className="h-4 w-4 mr-2" />{escopoProcessamento ? `Processar ${escopoProcessamento}` : 'Executar NEO'}</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultado do processamento */}
      {processResult && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800 text-lg">Resultado do Processamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Associadas', value: processResult.associadas },
                { label: 'Sem Regra', value: processResult.sem_regra },
                { label: 'Erros', value: processResult.erros },
                { label: 'Pendentes', value: processResult.total_pendentes },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <p className="text-2xl font-bold text-green-700">{value ?? 0}</p>
                  <p className="text-sm text-green-600">{label}</p>
                </div>
              ))}
            </div>
            {/* Auto-associations (Tasks 5 & 6) */}
            {(processResult.comprovantes_associados > 0 || processResult.notas_associadas > 0) && (
              <div className="mt-4 pt-4 border-t border-green-200 grid grid-cols-2 gap-4">
                {processResult.comprovantes_associados > 0 && (
                  <div className="text-center">
                    <p className="text-xl font-bold text-green-700">{processResult.comprovantes_associados}</p>
                    <p className="text-xs text-green-600">Comprovantes vinculados</p>
                  </div>
                )}
                {processResult.notas_associadas > 0 && (
                  <div className="text-center">
                    <p className="text-xl font-bold text-green-700">{processResult.notas_associadas}</p>
                    <p className="text-xs text-green-600">Notas fiscais vinculadas</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Busca e filtros (item 4 do PDF de feedback dos contadores) */}
      {selectedEmpresa && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Buscar</label>
              <Input
                placeholder="Histórico do extrato ou descrição da regra"
                value={termoInput}
                onChange={e => setTermoInput(e.target.value)}
              />
            </div>
            <div className="flex gap-4 flex-wrap items-end">
              <div className="min-w-[130px]">
                <label className="text-sm font-medium mb-1 block">Resultado</label>
                <Select value={resultadoFiltro} onValueChange={v => { setResultadoFiltro(v); setPage(1) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="associada">Associada</SelectItem>
                    <SelectItem value="sem_regra">Sem Regra</SelectItem>
                    <SelectItem value="erro">Erro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[140px]">
                <label className="text-sm font-medium mb-1 block">Estratégia</label>
                <Select value={estrategiaFiltro} onValueChange={v => { setEstrategiaFiltro(v); setPage(1) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="exato">Texto exato</SelectItem>
                    <SelectItem value="substring">Contém o texto</SelectItem>
                    <SelectItem value="todas_palavras">Contém todas as palavras</SelectItem>
                    <SelectItem value="contraparte">Por CNPJ do favorecido</SelectItem>
                    <SelectItem value="manual">Associação manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[110px]">
                <label className="text-sm font-medium mb-1 block">D/C</label>
                <Select value={dcFiltro} onValueChange={v => { setDcFiltro(v); setPage(1) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="D">Débito</SelectItem>
                    <SelectItem value="C">Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[180px]">
                <label className="text-sm font-medium mb-1 block">Agência</label>
                <Select value={agenciaFiltro} onValueChange={v => { setAgenciaFiltro(v); setPage(1) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {agencias.map((ag: any) => (
                      <SelectItem key={ag.id} value={ag.id}>
                        {ag.descricao ?? `${ag.banco_sigla} ${ag.agencia}/${ag.numero}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[220px]">
                <label className="text-sm font-medium mb-1 block">Conta contábil</label>
                <SearchableSelect
                  value={contaFiltro}
                  onValueChange={v => { setContaFiltro(v); setPage(1) }}
                  options={[{ value: 'todas', label: 'Todas' }, ...contaOptions]}
                  placeholder="Todas"
                  searchPlaceholder="Buscar conta..."
                />
              </div>
              <div className="min-w-[130px]">
                <label className="text-sm font-medium mb-1 block">Competência</label>
                <Input
                  type="month"
                  value={mesFiltro}
                  onChange={e => { setMesFiltro(e.target.value); setPage(1) }}
                />
              </div>
              <div className="min-w-[130px]">
                <label className="text-sm font-medium mb-1 block">Valor mínimo</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="R$ 0,00"
                  value={valorMinFiltro}
                  onChange={e => {
                    if (!e.target.value || Number(e.target.value) >= 0) setValorMinFiltro(e.target.value)
                    setPage(1)
                  }}
                />
              </div>
              <div className="min-w-[130px]">
                <label className="text-sm font-medium mb-1 block">Valor máximo</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="R$ 0,00"
                  value={valorMaxFiltro}
                  onChange={e => {
                    if (!e.target.value || Number(e.target.value) >= 0) setValorMaxFiltro(e.target.value)
                    setPage(1)
                  }}
                />
              </div>
              {filtrosAtivos && (
                <Button variant="ghost" size="sm" onClick={limparFiltros}>Limpar filtros</Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico de decisões */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Decisões</CardTitle>
          <CardDescription>Últimas decisões do motor NEO</CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedEmpresa ? (
            <p className="text-muted-foreground text-center py-8">Selecione uma empresa</p>
          ) : isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-muted-foreground">
                {filtrosAtivos ? 'Nenhuma decisão encontrada com esses filtros.' : 'Nenhuma decisão registrada ainda.'}
              </p>
              {filtrosAtivos && <Button variant="outline" size="sm" onClick={limparFiltros}>Limpar filtros</Button>}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-3 px-2 w-28">Data</th>
                      <th className="text-left py-3 px-2">Transação</th>
                      <th className="text-right py-3 px-2 w-28">Valor</th>
                      <th className="text-center py-3 px-2 w-20">D/C</th>
                      <th className="text-left py-3 px-2">Regra / Conta</th>
                      <th className="text-left py-3 px-2 w-36">Motivo</th>
                      <th className="text-center py-3 px-2 w-24">Resultado</th>
                      <th className="text-center py-3 px-2 w-36">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((d: any) => (
                      <tr key={d.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="py-2 px-2 whitespace-nowrap text-xs text-muted-foreground">
                          {formatDate(d.processado_em)}
                        </td>
                        <td className="py-2 px-2 max-w-[200px] truncate">
                          {d.transacao_descricao ?? d.transacao_id}
                        </td>
                        <td className="py-2 px-2 text-right font-mono whitespace-nowrap">
                          {d.transacao_valor != null ? formatCurrency(d.transacao_valor) : '—'}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Badge variant="outline">
                            {d.transacao_dc === 'D' ? 'Débito' : d.transacao_dc === 'C' ? 'Crédito' : '—'}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 max-w-[220px]">
                          <div className="truncate text-muted-foreground" title={d.regra_descricao ?? ''}>
                            {d.regra_descricao ?? d.regra_id ?? '—'}
                          </div>
                          {(d.conta_codigo || d.conta_descricao) && (
                            <div className="truncate text-xs" title={[d.conta_codigo, d.conta_descricao].filter(Boolean).join(' — ')}>
                              {[d.conta_codigo, d.conta_descricao].filter(Boolean).join(' — ')}
                            </div>
                          )}
                        </td>
                        <td
                          className="py-2 px-2 text-xs text-muted-foreground max-w-[144px] truncate"
                          title={d.motivo ?? ''}
                        >
                          {d.motivo ?? '—'}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Badge variant={RESULTADO_COLORS[d.resultado] ?? 'outline'}>
                            {d.resultado}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-center">
                          {d.resultado === 'sem_regra' && (
                            <div className="flex gap-1 justify-center">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs px-2"
                                title="Associar manualmente a uma conta"
                                onClick={() => openAssociar(d)}
                              >
                                <Link2 className="h-3 w-3 mr-1" />
                                Associar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs px-2"
                                title="Criar regra para esse padrão"
                                onClick={() => openCriarRegra(d)}
                              >
                                <BookOpen className="h-3 w-3 mr-1" />
                                Regra
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal: Associar manual */}
      <Dialog open={!!associarDecisao} onOpenChange={o => { if (!o) setAssociarDecisao(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Associar manualmente</DialogTitle>
          </DialogHeader>
          <form onSubmit={associarForm.handleSubmit(submitAssociar)} className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Transação: <span className="font-medium text-foreground">{associarDecisao?.transacao_descricao}</span>
              </p>
            </div>
            <div className="space-y-1">
              <Label>Conta contábil</Label>
              <SearchableSelect
                value={associarForm.watch('conta_id')}
                onValueChange={v => associarForm.setValue('conta_id', v, { shouldValidate: true })}
                options={contaOptions}
                placeholder="Selecione a conta..."
                searchPlaceholder="Buscar conta..."
                emptyText="Nenhuma conta encontrada."
              />
              {associarForm.formState.errors.conta_id && (
                <p className="text-xs text-destructive">{associarForm.formState.errors.conta_id.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input {...associarForm.register('descricao')} placeholder="Ex: Pagamento de fornecedor" />
              {associarForm.formState.errors.descricao && (
                <p className="text-xs text-destructive">{associarForm.formState.errors.descricao.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAssociarDecisao(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={associarManualMutation.isPending}>
                {associarManualMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Associar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Criar regra */}
      <Dialog open={!!criarRegraDecisao} onOpenChange={o => { if (!o) setCriarRegraDecisao(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar regra de categorização</DialogTitle>
          </DialogHeader>
          <form onSubmit={regraForm.handleSubmit(submitCriarRegra)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <Label>Conta contábil</Label>
                <SearchableSelect
                  value={regraForm.watch('conta_id')}
                  onValueChange={v => regraForm.setValue('conta_id', v, { shouldValidate: true })}
                  options={contaOptions}
                  placeholder="Selecione a conta..."
                  searchPlaceholder="Buscar conta..."
                />
                {regraForm.formState.errors.conta_id && (
                  <p className="text-xs text-destructive">{regraForm.formState.errors.conta_id.message}</p>
                )}
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Histórico (padrão de match)</Label>
                <Input
                  {...regraForm.register('historico')}
                  placeholder="Ex: PIX ENVIADO JOAO"
                />
                <p className="text-xs text-muted-foreground">
                  Texto do extrato que vai ativar esta regra (case-insensitive).
                </p>
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Descrição</Label>
                <Input {...regraForm.register('descricao')} placeholder="Ex: Compras no mercado" />
              </div>
              <div className="space-y-1">
                <Label>D/C</Label>
                <Select
                  value={regraForm.watch('dc')}
                  onValueChange={v => regraForm.setValue('dc', v as 'D' | 'C')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="D">D — Débito</SelectItem>
                    <SelectItem value="C">C — Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select
                  value={regraForm.watch('tipo')}
                  onValueChange={v => regraForm.setValue('tipo', v as 'automatica' | 'manual')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automatica">Automática</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCriarRegraDecisao(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={criarRegraMutation.isPending}>
                {criarRegraMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Criar regra
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
