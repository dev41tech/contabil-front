import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, SlidersHorizontal, Zap } from 'lucide-react'
import { api } from '@/lib/api'
import { extractApiError } from '@/lib/utils'
import { opcaoConta } from '@/lib/contas'
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
import { ClassificacaoTable, type LinhaClassificacao } from '@/components/neo/ClassificacaoTable'
import { DesfeitasList } from '@/components/neo/DesfeitasList'
import type { AgenciaNeo, SelectOption } from '@/components/neo/types'
import { agenciaLabel } from '@/components/neo/types'

const associarManualSchema = z.object({
  conta_id: z.string().uuid('Selecione uma conta'),
  descricao: z.string().min(2, 'Mínimo 2 caracteres').max(500),
})

type AssociarManualForm = z.infer<typeof associarManualSchema>
type NeoTab = 'pendencias' | 'classificadas' | 'erros' | 'desfeitas'

const PAGE_SIZE = 20

export default function NeoPage() {
  const qc = useQueryClient()
  const [selectedEmpresa, setSelectedEmpresa] = useEmpresaDefault()
  const { competencia: mesFiltro } = useCompetencia()
  const [activeTab, setActiveTab] = useState<NeoTab>('pendencias')
  const [processResult, setProcessResult] = useState<any>(null)
  const [processJobId, setProcessJobId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [associarLinha, setAssociarLinha] = useState<LinhaClassificacao | null>(null)
  const [alterarLinha, setAlterarLinha] = useState<LinhaClassificacao | null>(null)
  const [motivoAlterar, setMotivoAlterar] = useState('Reclassificação')

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
  // Seleção múltipla da fila. Guarda `transacao_id` porque é o que o endpoint
  // de lote recebe — guardar a chave de render obrigaria a traduzir na hora do
  // envio, e é lá que um engano vira lançamento na conta errada.
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [loteAberto, setLoteAberto] = useState(false)
  const [loteConta, setLoteConta] = useState('')
  const [loteDescricao, setLoteDescricao] = useState('')
  const [criarRegra, setCriarRegra] = useState(true)
  const [regraHistorico, setRegraHistorico] = useState('')

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

  // Rótulo pelo NÚMERO da conta, com a classificação embaixo — igual à tela de
  // Plano de Contas, que é de onde o contador conhece a conta (`lib/contas`).
  const contaOptions = useMemo(
    () => planoConta.map((conta: any) => opcaoConta(conta)),
    [planoConta],
  )

  const scopeParams = useMemo(() => {
    const params = new URLSearchParams()
    if (agenciaFiltro !== 'todas') params.set('agencia_id', agenciaFiltro)
    if (mesFiltro) params.set('mes', mesFiltro)
    return params
  }, [agenciaFiltro, mesFiltro])

  // Conta a fila inteira do escopo, independente dos filtros da tabela: o
  // número na aba responde "quanto falta", não "quanto casa com o filtro".
  const resumoPendencias = useQuery<number>({
    queryKey: ['neo-resumo', selectedEmpresa, 'pendentes', agenciaFiltro, mesFiltro],
    queryFn: () => {
      const params = new URLSearchParams(scopeParams)
      params.set('page', '1')
      params.set('page_size', '1')
      return api.get(`/empresas/${selectedEmpresa}/neo/pendencias?${params}`).then(r => r.data.total ?? 0)
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

  const desfeitasQuery = useQuery<any>({
    queryKey: ['neo-desfeitas', selectedEmpresa, page],
    queryFn: () =>
      api
        .get(`/empresas/${selectedEmpresa}/neo/desfeitas?page=${page}&page_size=${PAGE_SIZE}`)
        .then(r => r.data),
    enabled: !!selectedEmpresa && activeTab === 'desfeitas',
  })

  const resumoClassificadas = useResumoDecisoes('associada')
  const resumoErros = useResumoDecisoes('erro')

  const resultadoTabela = activeTab === 'classificadas' ? 'associada' : 'erro'

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

  const deveCarregarTabela =
    !!selectedEmpresa && (activeTab === 'classificadas' || activeTab === 'erros')
  const decisoesQuery = useQuery<any>({
    queryKey: ['neo-decisoes', selectedEmpresa, resultadoTabela, page, termo, estrategiaFiltro, dcFiltro, agenciaFiltro, contaFiltro, mesFiltro, dataDeFiltro, dataAteFiltro, motivo, valorMinFiltro, valorMaxFiltro],
    queryFn: () => api.get(`/empresas/${selectedEmpresa}/neo/decisoes?${buildDecisoesParams()}`).then(r => r.data),
    enabled: deveCarregarTabela,
  })

  const buildPendenciasParams = () => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('page_size', String(PAGE_SIZE))
    if (termo) params.set('termo', termo)
    if (dcFiltro !== 'todos') params.set('dc', dcFiltro)
    if (agenciaFiltro !== 'todas') params.set('agencia_id', agenciaFiltro)
    if (mesFiltro) params.set('mes', mesFiltro)
    if (dataDeFiltro) params.set('data_de', dataDeFiltro)
    if (dataAteFiltro) params.set('data_ate', dataAteFiltro)
    if (valorMinFiltro) params.set('valor_min', String(Number(valorMinFiltro)))
    if (valorMaxFiltro) params.set('valor_max', String(Number(valorMaxFiltro)))
    return params.toString()
  }

  // A fila sai de `/neo/pendencias`, que parte da TRANSAÇÃO. A consulta de
  // decisões esconderia a transação recém-importada que o motor ainda não
  // olhou — justo a que mais precisa aparecer depois de um upload.
  const pendenciasQuery = useQuery<any>({
    queryKey: ['neo-pendencias', selectedEmpresa, page, termo, dcFiltro, agenciaFiltro, mesFiltro, dataDeFiltro, dataAteFiltro, valorMinFiltro, valorMaxFiltro],
    queryFn: () => api.get(`/empresas/${selectedEmpresa}/neo/pendencias?${buildPendenciasParams()}`).then(r => r.data),
    enabled: !!selectedEmpresa && activeTab === 'pendencias',
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
    qc.invalidateQueries({ queryKey: ['neo-pendencias', selectedEmpresa] })
    qc.invalidateQueries({ queryKey: ['neo-decisoes', selectedEmpresa] })
    qc.invalidateQueries({ queryKey: ['neo-resumo', selectedEmpresa] })
    qc.invalidateQueries({ queryKey: ['extrato', selectedEmpresa] })
    qc.invalidateQueries({ queryKey: ['jobs', selectedEmpresa] })
  }, [processJob?.status, processJobId, qc, selectedEmpresa])

  const classificarLoteMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/empresas/${selectedEmpresa}/neo/pendencias/classificar-lote`, {
        transacao_ids: [...selecionados],
        conta_id: loteConta,
        descricao: loteDescricao,
        // `null` = a regra vale para todos os bancos. É o padrão pedido pelo
        // escritório: quase toda regra independe do banco.
        regra: criarRegra ? { historico: regraHistorico, agencia_id: null, aplicar_nos_semelhantes: true } : undefined,
      })
      return data
    },
    onSuccess: (data: any) => {
      const partes = [`${data.classificadas} classificado(s)`]
      if (data.regra_criada) partes.push('regra criada')
      if (data.semelhantes_classificados) partes.push(`${data.semelhantes_classificados} semelhante(s) alcançado(s)`)
      // Bloqueadas não são sucesso silencioso: a linha existe, está pendente, e
      // foi recusada por um motivo que o contador precisa ler.
      if (data.bloqueadas) partes.push(`${data.bloqueadas} recusado(s)`)
      toast({
        title: 'Lote classificado',
        description: partes.join(' · '),
        // Só é 'success' quando NADA foi recusado. Lote com bloqueio vira
        // toast neutro, e cada recusa sai no seu próprio toast com o motivo —
        // marcar como sucesso um lote parcial esconde o que precisa de ação.
        variant: data.bloqueadas ? 'default' : 'success',
      })
      if (data.bloqueios?.length) {
        data.bloqueios.slice(0, 3).forEach((b: any) =>
          toast({ title: 'Lançamento recusado', description: b.motivo, variant: 'destructive' }))
      }
      setLoteAberto(false)
      setSelecionados(new Set())
      qc.invalidateQueries({ queryKey: ['neo-pendencias', selectedEmpresa] })
      qc.invalidateQueries({ queryKey: ['neo-decisoes', selectedEmpresa] })
      qc.invalidateQueries({ queryKey: ['neo-resumo', selectedEmpresa] })
      qc.invalidateQueries({ queryKey: ['extrato', selectedEmpresa] })
      qc.invalidateQueries({ queryKey: ['regras', selectedEmpresa] })
    },
    onError: (error: unknown) => toast({ title: 'Não foi possível classificar o lote', description: extractApiError(error), variant: 'destructive' }),
  })

  // Prévia do alcance da regra. Só roda com a caixa marcada e um texto de pelo
  // menos dois caracteres, que é o mínimo que o backend aceita.
  const previaRegra = useQuery<any>({
    queryKey: ['neo-previa-regra', selectedEmpresa, regraHistorico, loteConta],
    queryFn: () => api.post(`/empresas/${selectedEmpresa}/neo/pendencias/simular-regra`, {
      historico: regraHistorico,
      dc: linhasPendencias.find(l => selecionados.has(l.transacaoId))?.dc ?? 'D',
      agencia_id: null,
      conta_id: loteConta,
    }).then(r => r.data),
    enabled: loteAberto && criarRegra && regraHistorico.trim().length >= 2 && !!loteConta,
  })

  // Classifica pela TRANSAÇÃO, não pela decisão: linha recém-importada não tem
  // decisão para associar, e o endpoint de lote já encerra a decisão aberta
  // quando existe. Um caminho só para os dois casos.
  const associarManualMutation = useMutation({
    mutationFn: ({ transacaoId, body }: { transacaoId: string; body: AssociarManualForm }) =>
      api.post(`/empresas/${selectedEmpresa}/neo/pendencias/classificar-lote`, {
        transacao_ids: [transacaoId],
        conta_id: body.conta_id,
        descricao: body.descricao,
      }).then(r => {
        const bloqueio = r.data?.bloqueios?.[0]
        // O backend recusa transação com valor não confiável e explica por quê.
        // Tratar como sucesso deixaria a tela dizendo "associada" sem lançamento.
        if (bloqueio) throw new Error(bloqueio.motivo)
        if (!r.data?.classificadas) {
          throw new Error('A transação saiu da fila enquanto a tela estava aberta. Atualize e tente de novo.')
        }
        return r.data
      }),
    onSuccess: () => {
      toast({ title: 'Transação associada com sucesso!', variant: 'success' })
      setAssociarLinha(null)
      qc.invalidateQueries({ queryKey: ['neo-pendencias', selectedEmpresa] })
      qc.invalidateQueries({ queryKey: ['neo-decisoes', selectedEmpresa] })
      // A aba Desfeitas também muda: a linha reclassificada troca o botão
      // "Classificar" por "Já reclassificada". Sem isto o botão continuaria
      // ali, e o segundo clique responderia 409.
      qc.invalidateQueries({ queryKey: ['neo-desfeitas', selectedEmpresa] })
      qc.invalidateQueries({ queryKey: ['neo-resumo', selectedEmpresa] })
      qc.invalidateQueries({ queryKey: ['extrato', selectedEmpresa] })
    },
    onError: (error: unknown) => toast({ title: 'Não foi possível associar', description: extractApiError(error), variant: 'destructive' }),
  })

  // Alterar = desfazer o lançamento e criar outro na conta escolhida. Não há
  // "editar lançamento" no backend, e é assim que tem de ser: partida
  // contábil não se muda no lugar, se cancela e se relança — a trilha de
  // auditoria guarda os dois passos.
  const alterarMutation = useMutation({
    mutationFn: async ({ linha, body, motivo }: { linha: LinhaClassificacao; body: AssociarManualForm; motivo: string }) => {
      await api.post(`/empresas/${selectedEmpresa}/neo/lancamentos/${linha.lancamentoId}/cancelar`, { motivo })
      const { data } = await api.post(`/empresas/${selectedEmpresa}/neo/pendencias/classificar-lote`, {
        transacao_ids: [linha.transacaoId],
        conta_id: body.conta_id,
        descricao: body.descricao,
      })
      const bloqueio = data?.bloqueios?.[0]
      if (bloqueio) throw new Error(`Lançamento desfeito, mas a nova conta não foi aplicada: ${bloqueio.motivo}`)
      if (!data?.classificadas) {
        throw new Error('Lançamento desfeito, mas a nova conta não foi aplicada. A transação está na fila de pendências.')
      }
      return data
    },
    onSuccess: () => {
      toast({ title: 'Classificação alterada', description: 'O lançamento anterior foi desfeito e um novo foi criado.', variant: 'success' })
      setAlterarLinha(null)
      qc.invalidateQueries({ queryKey: ['neo-pendencias', selectedEmpresa] })
      qc.invalidateQueries({ queryKey: ['neo-decisoes', selectedEmpresa] })
      qc.invalidateQueries({ queryKey: ['neo-desfeitas', selectedEmpresa] })
      qc.invalidateQueries({ queryKey: ['neo-resumo', selectedEmpresa] })
      qc.invalidateQueries({ queryKey: ['extrato', selectedEmpresa] })
    },
    onError: (error: unknown) => toast({ title: 'Não foi possível alterar', description: extractApiError(error), variant: 'destructive' }),
  })

  const liberarMutation = useMutation({
    mutationFn: (transacaoId: string) =>
      api.post(`/empresas/${selectedEmpresa}/neo/transacoes/${transacaoId}/liberar-automatico`),
    onSuccess: () => {
      toast({
        title: 'Transação liberada',
        description: 'As regras voltam a valer para ela na próxima execução do NEO.',
        variant: 'success',
      })
      qc.invalidateQueries({ queryKey: ['neo-desfeitas', selectedEmpresa] })
      qc.invalidateQueries({ queryKey: ['neo-pendencias', selectedEmpresa] })
    },
    onError: (error: unknown) =>
      toast({ title: 'Não foi possível liberar', description: extractApiError(error), variant: 'destructive' }),
  })

  const associarForm = useForm<AssociarManualForm>({ resolver: zodResolver(associarManualSchema), defaultValues: { conta_id: '', descricao: '' } })

  // A seleção é uma fotografia da página. Trocar de página, de aba ou de
  // filtro muda o que está embaixo dela, e manter as marcas classificaria
  // linhas que o contador não está mais vendo.
  useEffect(() => { setSelecionados(new Set()) }, [
    activeTab, page, termo, dcFiltro, agenciaFiltro, mesFiltro,
    dataDeFiltro, dataAteFiltro, valorMinFiltro, valorMaxFiltro,
  ])

  function alternarSelecao(transacaoId: string) {
    setSelecionados(atual => {
      const proximo = new Set(atual)
      if (proximo.has(transacaoId)) proximo.delete(transacaoId)
      else proximo.add(transacaoId)
      return proximo
    })
  }

  function alternarPagina(idsDaPagina: string[]) {
    setSelecionados(atual => {
      const todasMarcadas = idsDaPagina.length > 0 && idsDaPagina.every(id => atual.has(id))
      const proximo = new Set(atual)
      idsDaPagina.forEach(id => { if (todasMarcadas) proximo.delete(id); else proximo.add(id) })
      return proximo
    })
  }

  async function abrirLote() {
    setLoteConta('')
    setLoteDescricao('')
    setCriarRegra(true)
    setRegraHistorico('')
    setLoteAberto(true)
    // O texto que une as linhas vem do backend, que usa a MESMA normalização
    // do motor. Deduzir aqui obrigaria a reimplementá-la em TypeScript, e a
    // prévia passaria a mentir sobre o que a regra faz depois.
    try {
      const { data } = await api.post(`/empresas/${selectedEmpresa}/neo/pendencias/sugerir-regra`, {
        transacao_ids: [...selecionados],
      })
      setRegraHistorico(data.historico_sugerido ?? '')
      setLoteDescricao(data.historico_sugerido ?? '')
      if (data.dc_misturado) setCriarRegra(false)
    } catch {
      // Sugestão é conveniência: sem ela o contador digita o texto. Falhar aqui
      // não pode impedir a classificação, que é o que ele veio fazer.
    }
  }

  function openAssociar(linha: LinhaClassificacao) {
    associarForm.reset({ conta_id: '', descricao: linha.historico ?? '' })
    setAssociarLinha(linha)
  }

  function openAlterar(linha: LinhaClassificacao) {
    associarForm.reset({ conta_id: '', descricao: linha.historico ?? '' })
    setMotivoAlterar('Reclassificação')
    setAlterarLinha(linha)
  }

  // A aba Desfeitas trabalha com o item dela, não com a linha da tabela.
  function openAssociarDesfeita(item: any) {
    associarForm.reset({ conta_id: '', descricao: item.transacao_descricao ?? '' })
    setAssociarLinha({
      key: item.lancamento_id,
      transacaoId: item.transacao_id,
      historico: item.transacao_descricao ?? '',
      status: 'pendente',
      data: item.transacao_data,
      valor: item.valor,
      dc: item.dc,
    })
  }

  const filtrosAtivos = !!termo || estrategiaFiltro !== 'todas' || dcFiltro !== 'todos' || contaFiltro !== 'todas' || !!valorMinFiltro || !!valorMaxFiltro || !!dataDeFiltro || !!dataAteFiltro || !!motivo
  function limparFiltrosTabela() {
    setTermoInput(''); setTermo(''); setMotivoInput(''); setMotivo(''); setEstrategiaFiltro('todas'); setDcFiltro('todos'); setContaFiltro('todas'); setDataDeFiltro(''); setDataAteFiltro(''); setValorMinFiltro(''); setValorMaxFiltro(''); setPage(1)
  }

  // O motor sempre escreve "Nenhuma regra encontrada para '...' (dc=X)"; o que
  // interessa na tela é o que vem DEPOIS disso — o aviso de valor não
  // confiável, a contraparte ambígua. Repetir a frase genérica em toda linha
  // seria ruído que esconde o aviso de verdade.
  const avisoDaFila = (motivo?: string | null): string | null => {
    if (!motivo) return null
    const resto = motivo.replace(/^Nenhuma regra encontrada para [\s\S]*?\(dc=[DC]\)\.?\s*/i, '').trim()
    return resto || null
  }

  const linhasPendencias: LinhaClassificacao[] = (pendenciasQuery.data?.items ?? []).map((p: any) => ({
    key: p.transacao_id,
    transacaoId: p.transacao_id,
    data: p.data,
    historico: p.historico,
    valor: p.valor,
    dc: p.dc,
    status: 'pendente',
    detalhe: avisoDaFila(p.motivo),
    agenciaId: p.agencia_id,
  }))

  const linhasDecisoes: LinhaClassificacao[] = (decisoesQuery.data?.items ?? []).map((d: any) => ({
    key: d.id,
    transacaoId: d.transacao_id,
    data: d.transacao_data,
    // Na classificada, o que a tela mostra é o histórico contábil — é ele que
    // o Alterar edita. A linha do banco fica no tooltip, como evidência.
    historico: d.lancamento_historico ?? d.transacao_descricao ?? d.transacao_id,
    historicoOriginal: d.transacao_descricao,
    valor: d.transacao_valor,
    dc: d.transacao_dc,
    status: d.resultado === 'associada' ? 'associada' : d.resultado === 'erro' ? 'erro' : 'pendente',
    detalhe: [d.conta_codigo, d.conta_descricao].filter(Boolean).join(' — ') || d.motivo || null,
    agenciaId: d.agencia_id,
    lancamentoId: d.lancamento_id,
  }))

  const empresaSelecionada = empresas.find((empresa: any) => empresa.id === selectedEmpresa)
  const agenciaSelecionada = agencias.find(agencia => agencia.id === agenciaFiltro)
  const escopo = [empresaSelecionada?.razao_social, agenciaFiltro === 'todas' ? 'Todas as agências' : agenciaSelecionada && agenciaLabel(agenciaSelecionada), mesFiltro || 'Todas as competências'].filter(Boolean)
  const escopoProcessamento = [agenciaFiltro !== 'todas' && agenciaSelecionada && agenciaLabel(agenciaSelecionada), mesFiltro].filter(Boolean).join(' · ')
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
          <p className="text-sm"><strong>{(resumoClassificadas.data ?? 0).toLocaleString('pt-BR')}</strong> classificadas <span className="text-muted-foreground">·</span> <strong>{(resumoPendencias.data ?? 0).toLocaleString('pt-BR')}</strong> pendentes <span className="text-muted-foreground">·</span> <strong>{(resumoErros.data ?? 0).toLocaleString('pt-BR')}</strong> erros</p>
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

      <Tabs value={activeTab} onValueChange={value => { setActiveTab(value as NeoTab); setPage(1) }}>
        <TabsList>
          <TabsTrigger value="pendencias">Pendências <span className="ml-1 text-xs">{resumoPendencias.data ?? 0}</span></TabsTrigger>
          <TabsTrigger value="classificadas">Classificadas <span className="ml-1 text-xs">{resumoClassificadas.data ?? 0}</span></TabsTrigger>
          <TabsTrigger value="erros">Erros <span className="ml-1 text-xs">{resumoErros.data ?? 0}</span></TabsTrigger>
          <TabsTrigger value="desfeitas">Desfeitas <span className="ml-1 text-xs">{desfeitasQuery.data?.total ?? 0}</span></TabsTrigger>
        </TabsList>

        <TabsContent value="pendencias" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Fila de classificação</CardTitle></CardHeader>
            <CardContent>
              {/* Sem Estratégia, Conta e Motivo: pendência não tem estratégia
                  nem conta, e o motivo já aparece embaixo do histórico. */}
              <DecisionFilters termoInput={termoInput} setTermoInput={setTermoInput} estrategiaFiltro={estrategiaFiltro} setEstrategiaFiltro={setEstrategiaFiltro} dcFiltro={dcFiltro} setDcFiltro={setDcFiltro} contaFiltro={contaFiltro} setContaFiltro={setContaFiltro} contaOptions={contaOptions} dataDeFiltro={dataDeFiltro} setDataDeFiltro={setDataDeFiltro} dataAteFiltro={dataAteFiltro} setDataAteFiltro={setDataAteFiltro} motivoInput={motivoInput} setMotivoInput={setMotivoInput} valorMinFiltro={valorMinFiltro} setValorMinFiltro={setValorMinFiltro} valorMaxFiltro={valorMaxFiltro} setValorMaxFiltro={setValorMaxFiltro} filtrosAtivos={filtrosAtivos} limparFiltros={limparFiltrosTabela} setPage={setPage} apenasFiltrosDeTransacao />
              {selecionados.size > 0 && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/50 px-3 py-2">
                  <span className="text-sm font-medium">
                    {selecionados.size} lançamento{selecionados.size > 1 ? 's' : ''} selecionado{selecionados.size > 1 ? 's' : ''}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setSelecionados(new Set())}>Limpar seleção</Button>
                    <Button size="sm" onClick={abrirLote}>Classificar selecionados</Button>
                  </div>
                </div>
              )}
              <ClassificacaoTable
                items={linhasPendencias}
                total={pendenciasQuery.data?.total ?? 0}
                page={page}
                pageSize={PAGE_SIZE}
                isLoading={pendenciasQuery.isLoading}
                isError={pendenciasQuery.isError}
                emptyMessage={filtrosAtivos ? 'Nenhuma pendência com esses filtros.' : 'Nenhuma transação pendente neste escopo.'}
                onPageChange={setPage}
                onRetry={() => pendenciasQuery.refetch()}
                onAssociar={openAssociar}
                onAlterar={openAlterar}
                selecionavel
                selecionados={selecionados}
                onAlternarSelecao={alternarSelecao}
                onAlternarPagina={alternarPagina}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="desfeitas" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Classificações desfeitas</CardTitle>
            </CardHeader>
            <CardContent>
              <DesfeitasList
                items={desfeitasQuery.data?.items ?? []}
                total={desfeitasQuery.data?.total ?? 0}
                page={page}
                pageSize={PAGE_SIZE}
                isLoading={desfeitasQuery.isLoading}
                onPageChange={setPage}
                onAssociar={openAssociarDesfeita}
                onLiberar={id => liberarMutation.mutate(id)}
                liberandoId={liberarMutation.isPending ? (liberarMutation.variables as string) : null}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {(['classificadas', 'erros'] as NeoTab[]).map(tab => (
          <TabsContent key={tab} value={tab} className="mt-4 space-y-4">
            <Card><CardContent className="pt-6"><DecisionFilters termoInput={termoInput} setTermoInput={setTermoInput} estrategiaFiltro={estrategiaFiltro} setEstrategiaFiltro={setEstrategiaFiltro} dcFiltro={dcFiltro} setDcFiltro={setDcFiltro} contaFiltro={contaFiltro} setContaFiltro={setContaFiltro} contaOptions={contaOptions} dataDeFiltro={dataDeFiltro} setDataDeFiltro={setDataDeFiltro} dataAteFiltro={dataAteFiltro} setDataAteFiltro={setDataAteFiltro} motivoInput={motivoInput} setMotivoInput={setMotivoInput} valorMinFiltro={valorMinFiltro} setValorMinFiltro={setValorMinFiltro} valorMaxFiltro={valorMaxFiltro} setValorMaxFiltro={setValorMaxFiltro} filtrosAtivos={filtrosAtivos} limparFiltros={limparFiltrosTabela} setPage={setPage} /></CardContent></Card>
            <Card><CardHeader><CardTitle>{tab === 'classificadas' ? 'Transações classificadas' : 'Erros de processamento'}</CardTitle></CardHeader><CardContent><ClassificacaoTable items={linhasDecisoes} total={total} page={page} pageSize={PAGE_SIZE} isLoading={decisoesQuery.isLoading} isError={decisoesQuery.isError} emptyMessage={filtrosAtivos ? 'Nenhuma decisão encontrada com esses filtros.' : tab === 'classificadas' ? 'Nenhuma transação classificada neste escopo.' : 'Nenhum erro neste escopo.'} onPageChange={setPage} onRetry={() => decisoesQuery.refetch()} onAssociar={openAssociar} onAlterar={openAlterar} /></CardContent></Card>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={loteAberto} onOpenChange={setLoteAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Classificar {selecionados.size} lançamento{selecionados.size > 1 ? 's' : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Conta contábil</Label>
              <SearchableSelect value={loteConta} onValueChange={setLoteConta} options={contaOptions} placeholder="Selecione a conta..." searchPlaceholder="Buscar conta..." />
            </div>
            <div className="space-y-1">
              <Label>Histórico contábil</Label>
              <Input value={loteDescricao} onChange={e => setLoteDescricao(e.target.value)} />
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="h-3.5 w-3.5" checked={criarRegra} onChange={e => setCriarRegra(e.target.checked)} />
                Criar regra e aplicar nos semelhantes
              </label>
              {criarRegra && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Texto em comum às linhas selecionadas. Os próximos lançamentos que contiverem
                    este texto passam a cair sozinhos nesta conta.
                  </p>
                  <Input value={regraHistorico} onChange={e => setRegraHistorico(e.target.value)} placeholder="Texto que dispara a regra" />
                  {previaRegra.isFetching && <p className="text-xs text-muted-foreground">Medindo o alcance…</p>}
                  {previaRegra.data && (
                    <div className="space-y-1 text-xs">
                      <p className="text-muted-foreground">
                        Atinge <span className="font-semibold text-foreground">{previaRegra.data.pendencias_atingidas.quantidade}</span> pendência(s)
                        {' e '}<span className="font-semibold text-foreground">{previaRegra.data.ja_contabilizadas_atingidas.quantidade}</span> já contabilizada(s).
                      </p>
                      {previaRegra.data.conflitos.quantidade > 0 && (
                        // O número que decide se a regra deve nascer: quantas
                        // já foram classificadas em OUTRA conta. Sem ele, criar
                        // regra é apostar.
                        <p className="text-amber-700">
                          {previaRegra.data.conflitos.quantidade} já classificada(s) em outra conta — confira antes de criar.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLoteAberto(false)}>Cancelar</Button>
            <Button
              onClick={() => classificarLoteMutation.mutate()}
              disabled={
                classificarLoteMutation.isPending ||
                !loteConta ||
                loteDescricao.trim().length < 2 ||
                (criarRegra && regraHistorico.trim().length < 2)
              }
            >
              {classificarLoteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {criarRegra ? 'Classificar e criar regra' : 'Classificar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!associarLinha} onOpenChange={open => { if (!open) setAssociarLinha(null) }}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Associar manualmente</DialogTitle></DialogHeader><form onSubmit={associarForm.handleSubmit(data => associarManualMutation.mutate({ transacaoId: associarLinha!.transacaoId, body: data }))} className="space-y-4">
            <p className="text-sm text-muted-foreground">Transação: <span className="font-medium text-foreground">{associarLinha?.historico}</span></p>
            <div className="space-y-1">
              <Label>Conta contábil</Label>
              <SearchableSelect value={associarForm.watch('conta_id')} onValueChange={value => associarForm.setValue('conta_id', value, { shouldValidate: true })} options={contaOptions} placeholder="Selecione a conta..." searchPlaceholder="Buscar conta..." />
              {associarForm.formState.errors.conta_id && <p className="text-xs text-destructive">{associarForm.formState.errors.conta_id.message}</p>}
            </div>
            <div className="space-y-1">
              {/* É o texto que vai para o razão como histórico do lançamento —
                  e é o que a coluna Histórico passa a mostrar. */}
              <Label>Histórico contábil</Label>
              <Input {...associarForm.register('descricao')} />
              {associarForm.formState.errors.descricao && <p className="text-xs text-destructive">{associarForm.formState.errors.descricao.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAssociarLinha(null)}>Cancelar</Button>
              <Button type="submit" disabled={associarManualMutation.isPending}>{associarManualMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Associar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!alterarLinha} onOpenChange={open => { if (!open) setAlterarLinha(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Alterar classificação</DialogTitle></DialogHeader>
          <form onSubmit={associarForm.handleSubmit(data => alterarMutation.mutate({ linha: alterarLinha!, body: data, motivo: motivoAlterar.trim() || 'Reclassificação' }))} className="space-y-4">
            <p className="text-sm text-muted-foreground">Transação: <span className="font-medium text-foreground">{alterarLinha?.historico}</span></p>
            {/* Dizer o que vai acontecer de verdade: não existe "editar
                lançamento". O par de partidas é cancelado e outro é criado, e
                os dois passos ficam na trilha de auditoria. */}
            <p className="text-sm text-muted-foreground">
              O lançamento atual — <span className="font-medium text-foreground">{alterarLinha?.detalhe ?? 'conta atual'}</span> — será desfeito e um novo será criado na conta escolhida.
            </p>
            <div className="space-y-1">
              <Label>Nova conta contábil</Label>
              <SearchableSelect value={associarForm.watch('conta_id')} onValueChange={value => associarForm.setValue('conta_id', value, { shouldValidate: true })} options={contaOptions} placeholder="Selecione a conta..." searchPlaceholder="Buscar conta..." />
              {associarForm.formState.errors.conta_id && <p className="text-xs text-destructive">{associarForm.formState.errors.conta_id.message}</p>}
            </div>
            <div className="space-y-1">
              {/* É o texto que vai para o razão como histórico do lançamento —
                  e é o que a coluna Histórico passa a mostrar. */}
              <Label>Histórico contábil</Label>
              <Input {...associarForm.register('descricao')} />
              {associarForm.formState.errors.descricao && <p className="text-xs text-destructive">{associarForm.formState.errors.descricao.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Motivo</Label>
              <Input value={motivoAlterar} onChange={event => setMotivoAlterar(event.target.value)} placeholder="Ex.: conta errada na classificação anterior" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAlterarLinha(null)}>Cancelar</Button>
              <Button type="submit" disabled={alterarMutation.isPending}>{alterarMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Alterar</Button>
            </DialogFooter>
          </form>
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
  contaOptions: SelectOption[]
  dataDeFiltro: string; setDataDeFiltro: (value: string) => void
  dataAteFiltro: string; setDataAteFiltro: (value: string) => void
  motivoInput: string; setMotivoInput: (value: string) => void
  valorMinFiltro: string; setValorMinFiltro: (value: string) => void
  valorMaxFiltro: string; setValorMaxFiltro: (value: string) => void
  filtrosAtivos: boolean; limparFiltros: () => void; setPage: (page: number) => void
  /** Fila de pendências: sem estratégia, conta e motivo — nenhum deles existe
   *  antes de a transação ser classificada. */
  apenasFiltrosDeTransacao?: boolean
}

function DecisionFilters(props: DecisionFiltersProps) {
  const update = (setter: (value: string) => void) => (value: string) => { setter(value); props.setPage(1) }
  // Abre já aberto quando há filtro valendo: filtro ativo escondido é estado
  // invisível, e a pessoa fica sem entender por que a lista está curta.
  const [aberto, setAberto] = useState(props.filtrosAtivos)
  return (
    <div className="mb-5 space-y-3">
      <div className="flex items-center gap-2.5">
        <Input
          compact
          className="max-w-md flex-1"
          placeholder={props.apenasFiltrosDeTransacao ? 'Buscar no histórico do extrato' : 'Buscar no histórico ou na descrição da regra'}
          value={props.termoInput}
          onChange={event => props.setTermoInput(event.target.value)}
        />
        <Button variant="outline" size="sm" onClick={() => setAberto(a => !a)} aria-expanded={aberto}>
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
          {props.filtrosAtivos && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-brand" />}
        </Button>
        {props.filtrosAtivos && <Button variant="ghost" size="sm" onClick={props.limparFiltros}>Limpar filtros</Button>}
      </div>
      <div className={`flex flex-wrap items-end gap-4 rounded-md border border-border bg-surface-hover p-3 ${aberto ? '' : 'hidden'}`}>
        {!props.apenasFiltrosDeTransacao && <div className="min-w-[160px]"><Label className="mb-1 block">Estratégia</Label><Select value={props.estrategiaFiltro} onValueChange={update(props.setEstrategiaFiltro)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas</SelectItem><SelectItem value="exato">Texto exato</SelectItem><SelectItem value="substring">Contém o texto</SelectItem><SelectItem value="todas_palavras">Contém todas as palavras</SelectItem><SelectItem value="contraparte">Por CNPJ do favorecido</SelectItem><SelectItem value="manual">Associação manual</SelectItem></SelectContent></Select></div>}
        <div className="min-w-[120px]"><Label className="mb-1 block">D/C</Label><Select value={props.dcFiltro} onValueChange={update(props.setDcFiltro)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="D">Débito</SelectItem><SelectItem value="C">Crédito</SelectItem></SelectContent></Select></div>
        {!props.apenasFiltrosDeTransacao && <div className="min-w-[240px] flex-1"><Label className="mb-1 block">Conta contábil</Label><SearchableSelect value={props.contaFiltro} onValueChange={update(props.setContaFiltro)} options={[{ value: 'todas', label: 'Todas' }, ...props.contaOptions]} searchPlaceholder="Buscar conta..." /></div>}
        <div className="w-[150px]"><Label className="mb-1 block">De</Label><Input type="date" value={props.dataDeFiltro} onChange={event => update(props.setDataDeFiltro)(event.target.value)} /></div>
        <div className="w-[150px]"><Label className="mb-1 block">Até</Label><Input type="date" value={props.dataAteFiltro} onChange={event => update(props.setDataAteFiltro)(event.target.value)} /></div>
        {!props.apenasFiltrosDeTransacao && <div className="min-w-[180px] flex-1"><Label className="mb-1 block">Motivo</Label><Input placeholder="Por que parou na fila" value={props.motivoInput} onChange={event => props.setMotivoInput(event.target.value)} /></div>}
        <div className="w-[140px]"><Label className="mb-1 block">Valor mínimo</Label><Input type="number" min="0" step="0.01" value={props.valorMinFiltro} onChange={event => { if (!event.target.value || Number(event.target.value) >= 0) update(props.setValorMinFiltro)(event.target.value) }} /></div>
        <div className="w-[140px]"><Label className="mb-1 block">Valor máximo</Label><Input type="number" min="0" step="0.01" value={props.valorMaxFiltro} onChange={event => { if (!event.target.value || Number(event.target.value) >= 0) update(props.setValorMaxFiltro)(event.target.value) }} /></div>
      </div>
    </div>
  )
}

