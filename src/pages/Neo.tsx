import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { BookOpen, ChevronDown, Loader2, Zap } from 'lucide-react'
import { api } from '@/lib/api'
import { extractApiError } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { useEmpresas } from '@/hooks/useEmpresas'
import { useEmpresaDefault } from '@/hooks/useEmpresaDefault'
import { useJob, isJobFinished, isJobRunning, type Job } from '@/hooks/useJob'
import { useCompetencia } from '@/contexts/CompetenciaContext'
import { JobPollingError, JobProgress } from '@/components/jobs/JobProgress'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DecisionTable } from '@/components/neo/DecisionTable'
import { RegraForm, type RegraFormData } from '@/components/regras/RegraForm'
import { PendenciasGroups } from '@/components/neo/PendenciasGroups'
import type { AgenciaNeo, NeoPendenciasAgrupadas } from '@/components/neo/types'
import { agenciaLabel } from '@/components/neo/types'

const associarManualSchema = z.object({
  conta_id: z.string().uuid('Selecione uma conta'),
  descricao: z.string().min(2, 'Mínimo 2 caracteres').max(500),
})

type AssociarManualForm = z.infer<typeof associarManualSchema>
type NeoTab = 'pendencias' | 'classificadas' | 'erros'

const PAGE_SIZE = 20

export default function NeoPage() {
  const qc = useQueryClient()
  const [selectedEmpresa, setSelectedEmpresa] = useEmpresaDefault()
  const { competencia: mesFiltro } = useCompetencia()
  const [activeTab, setActiveTab] = useState<NeoTab>('pendencias')
  const [processResult, setProcessResult] = useState<any>(null)
  const [processJobId, setProcessJobId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [mostrarIndividuais, setMostrarIndividuais] = useState(false)
  const [associarDecisao, setAssociarDecisao] = useState<any>(null)
  const [criarRegraDecisao, setCriarRegraDecisao] = useState<any>(null)
  const [desfazerDecisao, setDesfazerDecisao] = useState<any>(null)
  const [motivoDesfazer, setMotivoDesfazer] = useState('')

  const [termoInput, setTermoInput] = useState('')
  const [termo, setTermo] = useState('')
  const [estrategiaFiltro, setEstrategiaFiltro] = useState('todas')
  const [dcFiltro, setDcFiltro] = useState('todos')
  const [agenciaFiltro, setAgenciaFiltro] = useState('todas')
  const [contaFiltro, setContaFiltro] = useState('todas')
  const [dataDeFiltro, setDataDeFiltro] = useState('')
  const [dataAteFiltro, setDataAteFiltro] = useState('')
  const [motivoInput, setMotivoInput] = useState('')
  const [motivo, setMotivo] = useState('')
  const [valorMinFiltro, setValorMinFiltro] = useState('')
  const [valorMaxFiltro, setValorMaxFiltro] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => { setTermo(termoInput); setPage(1) }, 400)
    return () => clearTimeout(timer)
  }, [termoInput])

  useEffect(() => {
    const timer = setTimeout(() => { setMotivo(motivoInput); setPage(1) }, 400)
    return () => clearTimeout(timer)
  }, [motivoInput])

  useEffect(() => setPage(1), [mesFiltro])

  const { data: empresas = [] } = useEmpresas()
  const { data: agencias = [] } = useQuery<AgenciaNeo[]>({
    // Contas encerradas continuam disponíveis porque os filtros também consultam histórico.
    queryKey: ['agencias', selectedEmpresa],
    queryFn: () => api.get(`/empresas/${selectedEmpresa}/agencias`).then(r => r.data.items ?? r.data),
    enabled: !!selectedEmpresa,
  })
  const { data: planoConta = [] } = useQuery<any[]>({
    queryKey: ['plano-contas', selectedEmpresa],
    queryFn: () => api.get(`/empresas/${selectedEmpresa}/plano-contas`).then(r => r.data.items ?? r.data),
    enabled: !!selectedEmpresa,
  })

  const contaOptions = useMemo(() => planoConta.map((conta: any) => ({
    value: conta.id,
    label: `${conta.codigo ? `${conta.codigo} — ` : ''}${conta.descricao}`,
  })), [planoConta])

  const scopeParams = useMemo(() => {
    const params = new URLSearchParams()
    if (agenciaFiltro !== 'todas') params.set('agencia_id', agenciaFiltro)
    if (mesFiltro) params.set('mes', mesFiltro)
    return params
  }, [agenciaFiltro, mesFiltro])

  const resumoPendencias = useQuery<NeoPendenciasAgrupadas>({
    queryKey: ['neo-resumo', selectedEmpresa, 'pendentes', agenciaFiltro, mesFiltro],
    queryFn: () => {
      const params = new URLSearchParams(scopeParams)
      params.set('tokens', '3')
      params.set('limite_grupos', '1')
      return api.get(`/empresas/${selectedEmpresa}/neo/pendencias/agrupadas?${params}`).then(r => r.data)
    },
    enabled: !!selectedEmpresa,
  })

  function useResumoDecisoes(resultado: 'associada' | 'erro') {
    return useQuery<number>({
      queryKey: ['neo-resumo', selectedEmpresa, resultado, agenciaFiltro, mesFiltro],
      queryFn: () => {
        const params = new URLSearchParams(scopeParams)
        params.set('page', '1')
        params.set('page_size', '1')
        params.set('resultado', resultado)
        return api.get(`/empresas/${selectedEmpresa}/neo/decisoes?${params}`).then(r => r.data.total ?? 0)
      },
      enabled: !!selectedEmpresa,
    })
  }

  const resumoClassificadas = useResumoDecisoes('associada')
  const resumoErros = useResumoDecisoes('erro')

  const resultadoTabela = mostrarIndividuais && activeTab === 'pendencias'
    ? 'sem_regra'
    : activeTab === 'classificadas' ? 'associada' : 'erro'

  const buildDecisoesParams = () => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('page_size', String(PAGE_SIZE))
    params.set('resultado', resultadoTabela)
    if (termo) params.set('termo', termo)
    if (estrategiaFiltro !== 'todas') params.set('estrategia', estrategiaFiltro)
    if (dcFiltro !== 'todos') params.set('dc', dcFiltro)
    if (agenciaFiltro !== 'todas') params.set('agencia_id', agenciaFiltro)
    if (contaFiltro !== 'todas') params.set('conta_id', contaFiltro)
    if (mesFiltro) params.set('mes', mesFiltro)
    // Data e competência se acumulam no backend: a competência é global e o
    // intervalo é um recorte dentro dela.
    if (dataDeFiltro) params.set('data_de', dataDeFiltro)
    if (dataAteFiltro) params.set('data_ate', dataAteFiltro)
    if (motivo) params.set('motivo', motivo)
    if (valorMinFiltro) params.set('valor_min', String(Number(valorMinFiltro)))
    if (valorMaxFiltro) params.set('valor_max', String(Number(valorMaxFiltro)))
    return params.toString()
  }

  const deveCarregarTabela = !!selectedEmpresa && (activeTab !== 'pendencias' || mostrarIndividuais)
  const decisoesQuery = useQuery<any>({
    queryKey: ['neo-decisoes', selectedEmpresa, resultadoTabela, page, termo, estrategiaFiltro, dcFiltro, agenciaFiltro, contaFiltro, mesFiltro, dataDeFiltro, dataAteFiltro, motivo, valorMinFiltro, valorMaxFiltro],
    queryFn: () => api.get(`/empresas/${selectedEmpresa}/neo/decisoes?${buildDecisoesParams()}`).then(r => r.data),
    enabled: deveCarregarTabela,
  })

  const processMutation = useMutation({
    mutationFn: () => api.post(`/empresas/${selectedEmpresa}/neo/processar`, {
      agencia_id: agenciaFiltro !== 'todas' ? agenciaFiltro : undefined,
      mes: mesFiltro || undefined,
    }),
    onSuccess: ({ data }) => {
      setProcessResult(null)
      setProcessJobId(data.id)
      qc.setQueryData(['job', selectedEmpresa, data.id], data as Job)
      qc.invalidateQueries({ queryKey: ['jobs', selectedEmpresa] })
    },
    onError: (error: unknown) => toast({ title: 'Erro ao processar NEO', description: extractApiError(error), variant: 'destructive' }),
  })

  const processJobQuery = useJob<any>(selectedEmpresa, processJobId)
  const processJob = processJobQuery.data

  useEffect(() => {
    if (!processJob || !isJobFinished(processJob.status)) return
    if (processJob.status !== 'falhou') setProcessResult(processJob.resultado)
    qc.invalidateQueries({ queryKey: ['neo-pendencias-agrupadas', selectedEmpresa] })
    qc.invalidateQueries({ queryKey: ['neo-decisoes', selectedEmpresa] })
    qc.invalidateQueries({ queryKey: ['neo-resumo', selectedEmpresa] })
    qc.invalidateQueries({ queryKey: ['extrato', selectedEmpresa] })
    qc.invalidateQueries({ queryKey: ['jobs', selectedEmpresa] })
  }, [processJob?.status, processJobId, qc, selectedEmpresa])

  const associarManualMutation = useMutation({
    mutationFn: ({ decisaoId, body }: { decisaoId: string; body: AssociarManualForm }) => api.post(`/empresas/${selectedEmpresa}/neo/decisoes/${decisaoId}/associar-manual`, body),
    onSuccess: () => {
      toast({ title: 'Transação associada com sucesso!', variant: 'success' })
      setAssociarDecisao(null)
      qc.invalidateQueries({ queryKey: ['neo-pendencias-agrupadas', selectedEmpresa] })
      qc.invalidateQueries({ queryKey: ['neo-decisoes', selectedEmpresa] })
      qc.invalidateQueries({ queryKey: ['neo-resumo', selectedEmpresa] })
      qc.invalidateQueries({ queryKey: ['extrato', selectedEmpresa] })
    },
    onError: (error: unknown) => toast({ title: 'Erro ao associar', description: extractApiError(error), variant: 'destructive' }),
  })

  const desfazerMutation = useMutation({
    mutationFn: ({ lancamentoId, motivo }: { lancamentoId: string; motivo: string }) =>
      api.post(`/empresas/${selectedEmpresa}/neo/lancamentos/${lancamentoId}/cancelar`, { motivo }),
    onSuccess: () => {
      toast({ title: 'Lançamento desfeito', description: 'A transação voltou para a fila de classificação.', variant: 'success' })
      setDesfazerDecisao(null)
      setMotivoDesfazer('')
      // O razão e o extrato mudam junto: a transação volta a pendente e as
      // partidas somem.
      qc.invalidateQueries({ queryKey: ['neo-pendencias-agrupadas', selectedEmpresa] })
      qc.invalidateQueries({ queryKey: ['neo-decisoes', selectedEmpresa] })
      qc.invalidateQueries({ queryKey: ['neo-resumo', selectedEmpresa] })
      qc.invalidateQueries({ queryKey: ['extrato', selectedEmpresa] })
    },
    onError: (error: unknown) => toast({ title: 'Não foi possível desfazer', description: extractApiError(error), variant: 'destructive' }),
  })

  const criarRegraMutation = useMutation({
    mutationFn: (body: RegraFormData) => api.post(`/empresas/${selectedEmpresa}/regras`, body),
    onSuccess: () => {
      toast({ title: 'Regra criada com sucesso!', variant: 'success' })
      setCriarRegraDecisao(null)
    },
    onError: (error: unknown) => toast({ title: 'Erro ao criar regra', description: extractApiError(error), variant: 'destructive' }),
  })

  const associarForm = useForm<AssociarManualForm>({ resolver: zodResolver(associarManualSchema), defaultValues: { conta_id: '', descricao: '' } })

  function openAssociar(decisao: any) {
    associarForm.reset({ conta_id: '', descricao: decisao.transacao_descricao ?? '' })
    setAssociarDecisao(decisao)
  }

  function openCriarRegra(decisao: any) {
    setCriarRegraDecisao(decisao)
  }

  const filtrosAtivos = !!termo || estrategiaFiltro !== 'todas' || dcFiltro !== 'todos' || contaFiltro !== 'todas' || !!valorMinFiltro || !!valorMaxFiltro || !!dataDeFiltro || !!dataAteFiltro || !!motivo
  function limparFiltrosTabela() {
    setTermoInput(''); setTermo(''); setMotivoInput(''); setMotivo(''); setEstrategiaFiltro('todas'); setDcFiltro('todos'); setContaFiltro('todas'); setDataDeFiltro(''); setDataAteFiltro(''); setValorMinFiltro(''); setValorMaxFiltro(''); setPage(1)
  }

  const empresaSelecionada = empresas.find((empresa: any) => empresa.id === selectedEmpresa)
  const agenciaSelecionada = agencias.find(agencia => agencia.id === agenciaFiltro)
  const escopo = [empresaSelecionada?.razao_social, agenciaFiltro === 'todas' ? 'Todas as agências' : agenciaSelecionada && agenciaLabel(agenciaSelecionada), mesFiltro || 'Todas as competências'].filter(Boolean)
  const escopoProcessamento = [agenciaFiltro !== 'todas' && agenciaSelecionada && agenciaLabel(agenciaSelecionada), mesFiltro].filter(Boolean).join(' · ')
  const items: any[] = decisoesQuery.data?.items ?? []
  const total = decisoesQuery.data?.total ?? 0
  const processWithAlerts = processJob?.status === 'concluido_com_alertas'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">NEO — Caixa de classificação</h1>
        <p className="text-muted-foreground">Resolva pendências repetidas em lote e acompanhe o que já foi classificado.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[240px] flex-1"><Label className="mb-1 block">Empresa</Label><SearchableSelect value={selectedEmpresa} onValueChange={value => { setSelectedEmpresa(value); setAgenciaFiltro('todas'); setContaFiltro('todas'); setProcessResult(null); setProcessJobId(null); setPage(1) }} options={empresas.map((empresa: any) => ({ value: empresa.id, label: empresa.razao_social }))} placeholder="Selecione a empresa" searchPlaceholder="Buscar empresa..." /></div>
            <div className="min-w-[190px]"><Label className="mb-1 block">Agência</Label><Select value={agenciaFiltro} onValueChange={value => { setAgenciaFiltro(value); setPage(1) }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as agências</SelectItem>{agencias.map(agencia => <SelectItem key={agencia.id} value={agencia.id}>{agenciaLabel(agencia)}</SelectItem>)}</SelectContent></Select></div>
            <Button onClick={() => processMutation.mutate()} disabled={!selectedEmpresa || processMutation.isPending || isJobRunning(processJob?.status)} className="bg-yellow-500 text-white hover:bg-yellow-600">
              {processMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Iniciando...</> : <><Zap className="h-4 w-4" />{escopoProcessamento ? `Processar ${escopoProcessamento}` : 'Executar NEO'}</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {processJob && !processJobQuery.pollingTimedOut && <JobProgress job={processJob} />}
      {isJobRunning(processJob?.status) && (processJobQuery.isError || processJobQuery.pollingTimedOut) && <JobPollingError timedOut={processJobQuery.pollingTimedOut} onRetry={processJobQuery.restartPolling} />}
      {processJob?.status === 'falhou' && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-medium">O processamento NEO falhou.</p>
          <p className="mt-1">{processJob.erro || 'O servidor não informou o motivo da falha.'}</p>
          <Button className="mt-3" variant="destructive" size="sm" onClick={() => processMutation.mutate()} disabled={processMutation.isPending}>
            Tentar novamente
          </Button>
        </div>
      )}

      {selectedEmpresa && (
        <div className="flex flex-col justify-between gap-2 rounded-lg border bg-card px-4 py-3 md:flex-row md:items-center">
          <p className="text-sm"><strong>{(resumoClassificadas.data ?? 0).toLocaleString('pt-BR')}</strong> classificadas <span className="text-muted-foreground">·</span> <strong>{(resumoPendencias.data?.total_pendentes ?? 0).toLocaleString('pt-BR')}</strong> pendentes <span className="text-muted-foreground">·</span> <strong>{(resumoErros.data ?? 0).toLocaleString('pt-BR')}</strong> erros</p>
          <p className="truncate text-xs text-muted-foreground" title={escopo.join(' · ')}>{escopo.join(' · ')}</p>
        </div>
      )}

      {processResult && (
        <Card className={processWithAlerts ? 'border-amber-300 bg-amber-50' : 'border-green-200 bg-green-50'}>
          <CardHeader><CardTitle className={processWithAlerts ? 'text-lg text-amber-900' : 'text-lg text-green-800'}>{processWithAlerts ? 'Processamento concluído com alertas' : 'Resultado do processamento'}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[
              ['Associadas', processResult.associadas], ['Sem regra', processResult.sem_regra], ['Erros', processResult.erros], ['Pendentes', processResult.total_pendentes],
            ].map(([label, value]) => <div key={label} className="text-center"><p className={`text-2xl font-bold ${processWithAlerts ? 'text-amber-800' : 'text-green-700'}`}>{value ?? 0}</p><p className={`text-sm ${processWithAlerts ? 'text-amber-700' : 'text-green-600'}`}>{label}</p></div>)}</div>
            {(processResult.comprovantes_associados > 0 || processResult.notas_associadas > 0) && <div className={`mt-4 grid grid-cols-2 gap-4 border-t pt-4 ${processWithAlerts ? 'border-amber-200' : 'border-green-200'}`}>{processResult.comprovantes_associados > 0 && <div className="text-center"><p className={`text-xl font-bold ${processWithAlerts ? 'text-amber-800' : 'text-green-700'}`}>{processResult.comprovantes_associados}</p><p className={`text-xs ${processWithAlerts ? 'text-amber-700' : 'text-green-600'}`}>Comprovantes vinculados</p></div>}{processResult.notas_associadas > 0 && <div className="text-center"><p className={`text-xl font-bold ${processWithAlerts ? 'text-amber-800' : 'text-green-700'}`}>{processResult.notas_associadas}</p><p className={`text-xs ${processWithAlerts ? 'text-amber-700' : 'text-green-600'}`}>Notas fiscais vinculadas</p></div>}</div>}
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={value => { setActiveTab(value as NeoTab); setMostrarIndividuais(false); setPage(1) }}>
        <TabsList className="grid h-auto w-full grid-cols-3 md:w-[520px]">
          <TabsTrigger value="pendencias">Pendências <span className="ml-1 text-xs">{resumoPendencias.data?.total_pendentes ?? 0}</span></TabsTrigger>
          <TabsTrigger value="classificadas">Classificadas <span className="ml-1 text-xs">{resumoClassificadas.data ?? 0}</span></TabsTrigger>
          <TabsTrigger value="erros">Erros <span className="ml-1 text-xs">{resumoErros.data ?? 0}</span></TabsTrigger>
        </TabsList>

        <TabsContent value="pendencias" className="mt-4 space-y-4">
          <PendenciasGroups empresaId={selectedEmpresa} agenciaId={agenciaFiltro} mes={mesFiltro} agencias={agencias} contaOptions={contaOptions} />
          {selectedEmpresa && (
            <Card>
              <button type="button" className="flex w-full items-center justify-between p-4 text-left" onClick={() => { setMostrarIndividuais(value => !value); setPage(1) }}>
                <div><p className="font-medium">Classificação individual</p><p className="text-sm text-muted-foreground">Associe uma transação isolada ou crie uma regra a partir dela.</p></div>
                <ChevronDown className={`h-5 w-5 transition-transform ${mostrarIndividuais ? 'rotate-180' : ''}`} />
              </button>
              {mostrarIndividuais && <CardContent className="border-t pt-4"><DecisionFilters termoInput={termoInput} setTermoInput={setTermoInput} estrategiaFiltro={estrategiaFiltro} setEstrategiaFiltro={setEstrategiaFiltro} dcFiltro={dcFiltro} setDcFiltro={setDcFiltro} contaFiltro={contaFiltro} setContaFiltro={setContaFiltro} contaOptions={contaOptions} dataDeFiltro={dataDeFiltro} setDataDeFiltro={setDataDeFiltro} dataAteFiltro={dataAteFiltro} setDataAteFiltro={setDataAteFiltro} motivoInput={motivoInput} setMotivoInput={setMotivoInput} valorMinFiltro={valorMinFiltro} setValorMinFiltro={setValorMinFiltro} valorMaxFiltro={valorMaxFiltro} setValorMaxFiltro={setValorMaxFiltro} filtrosAtivos={filtrosAtivos} limparFiltros={limparFiltrosTabela} setPage={setPage} /><DecisionTable items={items} total={total} page={page} pageSize={PAGE_SIZE} isLoading={decisoesQuery.isLoading} isError={decisoesQuery.isError} emptyMessage={filtrosAtivos ? 'Nenhuma pendência individual encontrada com esses filtros.' : 'Nenhuma pendência individual.'} onPageChange={setPage} onRetry={() => decisoesQuery.refetch()} onAssociar={openAssociar} onCriarRegra={openCriarRegra} onDesfazer={setDesfazerDecisao} /></CardContent>}
            </Card>
          )}
        </TabsContent>

        {(['classificadas', 'erros'] as NeoTab[]).map(tab => (
          <TabsContent key={tab} value={tab} className="mt-4 space-y-4">
            <Card><CardContent className="pt-6"><DecisionFilters termoInput={termoInput} setTermoInput={setTermoInput} estrategiaFiltro={estrategiaFiltro} setEstrategiaFiltro={setEstrategiaFiltro} dcFiltro={dcFiltro} setDcFiltro={setDcFiltro} contaFiltro={contaFiltro} setContaFiltro={setContaFiltro} contaOptions={contaOptions} dataDeFiltro={dataDeFiltro} setDataDeFiltro={setDataDeFiltro} dataAteFiltro={dataAteFiltro} setDataAteFiltro={setDataAteFiltro} motivoInput={motivoInput} setMotivoInput={setMotivoInput} valorMinFiltro={valorMinFiltro} setValorMinFiltro={setValorMinFiltro} valorMaxFiltro={valorMaxFiltro} setValorMaxFiltro={setValorMaxFiltro} filtrosAtivos={filtrosAtivos} limparFiltros={limparFiltrosTabela} setPage={setPage} /></CardContent></Card>
            <Card><CardHeader><CardTitle>{tab === 'classificadas' ? 'Transações classificadas' : 'Erros de processamento'}</CardTitle></CardHeader><CardContent><DecisionTable items={items} total={total} page={page} pageSize={PAGE_SIZE} isLoading={decisoesQuery.isLoading} isError={decisoesQuery.isError} emptyMessage={filtrosAtivos ? 'Nenhuma decisão encontrada com esses filtros.' : tab === 'classificadas' ? 'Nenhuma transação classificada neste escopo.' : 'Nenhum erro neste escopo.'} onPageChange={setPage} onRetry={() => decisoesQuery.refetch()} onAssociar={openAssociar} onCriarRegra={openCriarRegra} onDesfazer={setDesfazerDecisao} /></CardContent></Card>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!desfazerDecisao} onOpenChange={open => { if (!open) { setDesfazerDecisao(null); setMotivoDesfazer('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Desfazer lançamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Transação: <span className="font-medium text-foreground">{desfazerDecisao?.transacao_descricao}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              As duas partidas contábeis serão desfeitas e a transação volta para a fila
              de classificação. Notas e comprovantes vinculados ficam livres, não são
              excluídos.
            </p>
            <div className="space-y-1">
              <Label>Motivo</Label>
              {/* Obrigatório: a trilha de auditoria guarda quem desfez e por quê,
                  e sem o motivo ela vira uma lista de carimbos. */}
              <Input
                autoFocus
                placeholder="Ex.: lançado na conta errada"
                value={motivoDesfazer}
                onChange={event => setMotivoDesfazer(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setDesfazerDecisao(null); setMotivoDesfazer('') }}>Voltar</Button>
            <Button
              type="button"
              disabled={motivoDesfazer.trim().length < 3 || desfazerMutation.isPending}
              onClick={() => desfazerMutation.mutate({ lancamentoId: desfazerDecisao.lancamento_id, motivo: motivoDesfazer.trim() })}
            >
              {desfazerMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Desfazer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!associarDecisao} onOpenChange={open => { if (!open) setAssociarDecisao(null) }}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Associar manualmente</DialogTitle></DialogHeader><form onSubmit={associarForm.handleSubmit(data => associarManualMutation.mutate({ decisaoId: associarDecisao.id, body: data }))} className="space-y-4"><p className="text-sm text-muted-foreground">Transação: <span className="font-medium text-foreground">{associarDecisao?.transacao_descricao}</span></p><div className="space-y-1"><Label>Conta contábil</Label><SearchableSelect value={associarForm.watch('conta_id')} onValueChange={value => associarForm.setValue('conta_id', value, { shouldValidate: true })} options={contaOptions} placeholder="Selecione a conta..." searchPlaceholder="Buscar conta..." />{associarForm.formState.errors.conta_id && <p className="text-xs text-destructive">{associarForm.formState.errors.conta_id.message}</p>}</div><div className="space-y-1"><Label>Descrição</Label><Input {...associarForm.register('descricao')} />{associarForm.formState.errors.descricao && <p className="text-xs text-destructive">{associarForm.formState.errors.descricao.message}</p>}</div><DialogFooter><Button type="button" variant="outline" onClick={() => setAssociarDecisao(null)}>Cancelar</Button><Button type="submit" disabled={associarManualMutation.isPending}>{associarManualMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Associar</Button></DialogFooter></form></DialogContent>
      </Dialog>

      <Dialog open={!!criarRegraDecisao} onOpenChange={open => { if (!open) setCriarRegraDecisao(null) }}>
        <DialogContent className="max-w-lg overflow-visible">
          <DialogHeader><DialogTitle>Criar regra de categorização</DialogTitle></DialogHeader>
          {criarRegraDecisao && (
            <RegraForm
              contas={contaOptions}
              agencia={{ mode: 'fixed', id: criarRegraDecisao.agencia_id ?? '' }}
              initialValues={{
                descricao: criarRegraDecisao.transacao_descricao ?? '',
                historico: criarRegraDecisao.transacao_descricao ?? '',
                dc: criarRegraDecisao.transacao_dc === 'C' ? 'C' : 'D',
              }}
              editableFields={['descricao', 'historico', 'conta_id', 'dc']}
              isSubmitting={criarRegraMutation.isPending}
              onSubmit={data => criarRegraMutation.mutate(data)}
              onCancel={() => setCriarRegraDecisao(null)}
              submitLabel="Criar regra"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface DecisionFiltersProps {
  termoInput: string; setTermoInput: (value: string) => void
  estrategiaFiltro: string; setEstrategiaFiltro: (value: string) => void
  dcFiltro: string; setDcFiltro: (value: string) => void
  contaFiltro: string; setContaFiltro: (value: string) => void
  contaOptions: Array<{ value: string; label: string }>
  dataDeFiltro: string; setDataDeFiltro: (value: string) => void
  dataAteFiltro: string; setDataAteFiltro: (value: string) => void
  motivoInput: string; setMotivoInput: (value: string) => void
  valorMinFiltro: string; setValorMinFiltro: (value: string) => void
  valorMaxFiltro: string; setValorMaxFiltro: (value: string) => void
  filtrosAtivos: boolean; limparFiltros: () => void; setPage: (page: number) => void
}

function DecisionFilters(props: DecisionFiltersProps) {
  const update = (setter: (value: string) => void) => (value: string) => { setter(value); props.setPage(1) }
  return (
    <div className="mb-5 space-y-4">
      <div><Label className="mb-1 block">Buscar</Label><Input placeholder="Histórico do extrato ou descrição da regra" value={props.termoInput} onChange={event => props.setTermoInput(event.target.value)} /></div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[160px]"><Label className="mb-1 block">Estratégia</Label><Select value={props.estrategiaFiltro} onValueChange={update(props.setEstrategiaFiltro)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas</SelectItem><SelectItem value="exato">Texto exato</SelectItem><SelectItem value="substring">Contém o texto</SelectItem><SelectItem value="todas_palavras">Contém todas as palavras</SelectItem><SelectItem value="contraparte">Por CNPJ do favorecido</SelectItem><SelectItem value="manual">Associação manual</SelectItem></SelectContent></Select></div>
        <div className="min-w-[120px]"><Label className="mb-1 block">D/C</Label><Select value={props.dcFiltro} onValueChange={update(props.setDcFiltro)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="D">Débito</SelectItem><SelectItem value="C">Crédito</SelectItem></SelectContent></Select></div>
        <div className="min-w-[240px] flex-1"><Label className="mb-1 block">Conta contábil</Label><SearchableSelect value={props.contaFiltro} onValueChange={update(props.setContaFiltro)} options={[{ value: 'todas', label: 'Todas' }, ...props.contaOptions]} searchPlaceholder="Buscar conta..." /></div>
        <div className="w-[150px]"><Label className="mb-1 block">De</Label><Input type="date" value={props.dataDeFiltro} onChange={event => update(props.setDataDeFiltro)(event.target.value)} /></div>
        <div className="w-[150px]"><Label className="mb-1 block">Até</Label><Input type="date" value={props.dataAteFiltro} onChange={event => update(props.setDataAteFiltro)(event.target.value)} /></div>
        <div className="min-w-[180px] flex-1"><Label className="mb-1 block">Motivo</Label><Input placeholder="Por que parou na fila" value={props.motivoInput} onChange={event => props.setMotivoInput(event.target.value)} /></div>
        <div className="w-[140px]"><Label className="mb-1 block">Valor mínimo</Label><Input type="number" min="0" step="0.01" value={props.valorMinFiltro} onChange={event => { if (!event.target.value || Number(event.target.value) >= 0) update(props.setValorMinFiltro)(event.target.value) }} /></div>
        <div className="w-[140px]"><Label className="mb-1 block">Valor máximo</Label><Input type="number" min="0" step="0.01" value={props.valorMaxFiltro} onChange={event => { if (!event.target.value || Number(event.target.value) >= 0) update(props.setValorMaxFiltro)(event.target.value) }} /></div>
        {props.filtrosAtivos && <Button variant="ghost" size="sm" onClick={props.limparFiltros}>Limpar filtros</Button>}
      </div>
    </div>
  )
}

