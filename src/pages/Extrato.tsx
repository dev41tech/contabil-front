import { useEffect, useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useEmpresaDefault } from '@/hooks/useEmpresaDefault'
import { api } from '@/lib/api'
import { formatCurrency, formatDate, extractApiError } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ErroConsulta } from '@/components/ui/erro-consulta'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Pagination } from '@/components/ui/pagination'
import { Upload, Loader2, RefreshCw, AlertTriangle, Download, SlidersHorizontal } from 'lucide-react'
import { useEmpresas } from '@/hooks/useEmpresas'
import { useJob, isJobFinished, isJobRunning, type Job } from '@/hooks/useJob'
import { JobPollingError, JobProgress } from '@/components/jobs/JobProgress'

const STATUS_COLORS: Record<string, any> = {
  pendente: 'warning',
  conciliado: 'success',
  ignorado: 'secondary',
}

export default function ExtratoPage() {
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [selectedEmpresa, setSelectedEmpresa] = useEmpresaDefault(
    searchParams.get('empresa') ?? ''
  )
  const [selectedAgencia, setSelectedAgencia] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('todos')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [dcFiltro, setDcFiltro] = useState('todos')
  const [page, setPage] = useState(1)
  // Filtro ativo escondido é estado invisível: abre já aberto quando há um.
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const [pageSize, setPageSize] = useState(20)
  const [uploadJobId, setUploadJobId] = useState<string | null>(null)

  // Campos de texto e número usam debounce para não disparar uma request por
  // tecla — mesmo padrão de Notas.tsx.
  const [buscaInputs, setBuscaInputs] = useState({ historico: '', valorMin: '', valorMax: '' })
  const [busca, setBusca] = useState({ historico: '', valorMin: '', valorMax: '' })

  useEffect(() => {
    const t = setTimeout(() => { setBusca(buscaInputs); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [buscaInputs.historico, buscaInputs.valorMin, buscaInputs.valorMax])

  const filtrosAtivos =
    !!selectedAgencia || statusFiltro !== 'todos' || dcFiltro !== 'todos' ||
    !!dataInicio || !!dataFim || Object.values(busca).some(Boolean)

  const limparFiltros = () => {
    setSelectedAgencia('')
    setStatusFiltro('todos')
    setDcFiltro('todos')
    setDataInicio('')
    setDataFim('')
    setBuscaInputs({ historico: '', valorMin: '', valorMax: '' })
    setBusca({ historico: '', valorMin: '', valorMax: '' })
    setPage(1)
  }

  const { data: empresas = [] } = useEmpresas()

  const { data: agencias = [] } = useQuery<any[]>({
    // Lista completa, incluindo contas desativadas: este seletor filtra dado
    // histórico, e desativar uma conta preserva o histórico dela de propósito.
    // Restringir a ativas tornaria o extrato de uma conta encerrada inalcançável.
    queryKey: ['agencias', selectedEmpresa],
    queryFn: () => api.get(`/empresas/${selectedEmpresa}/agencias`).then(r => r.data.items ?? r.data),
    enabled: !!selectedEmpresa,
  })

  const buildParams = () => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('page_size', String(pageSize))
    if (selectedAgencia) params.set('agencia_id', selectedAgencia)
    if (statusFiltro !== 'todos') params.set('status', statusFiltro)
    if (dcFiltro !== 'todos') params.set('dc', dcFiltro)
    if (dataInicio) params.set('data_de', dataInicio)
    if (dataFim) params.set('data_ate', dataFim)
    if (busca.historico) params.set('historico', busca.historico)
    if (busca.valorMin) params.set('valor_min', busca.valorMin)
    if (busca.valorMax) params.set('valor_max', busca.valorMax)
    return params.toString()
  }

  const { data: extrato, isLoading, isError, error, refetch } = useQuery<any>({
    queryKey: ['extrato', selectedEmpresa, selectedAgencia, statusFiltro, dcFiltro, dataInicio, dataFim, busca, page, pageSize],
    queryFn: () => api.get(`/empresas/${selectedEmpresa}/extrato?${buildParams()}`).then(r => r.data),
    enabled: !!selectedEmpresa,
  })

  const [uploadError, setUploadError] = useState<string | null>(null)
  // Linhas que o backend recusou por o valor nao conferir com a linha do
  // extrato. Estado proprio, e nao toast, porque cada uma e um lancamento
  // que o contador vai ter que digitar a mao — some da tela e ele perde a
  // lista.
  const [rejeicoes, setRejeicoes] = useState<string[]>([])

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedAgencia) throw new Error('Selecione uma conta bancária primeiro')
      const form = new FormData()
      form.append('arquivo', file)
      return api.post(`/empresas/${selectedEmpresa}/extrato/importar?agencia_id=${selectedAgencia}`, form)
    },
    onSuccess: (res) => {
      setUploadError(null)
      setRejeicoes([])
      setUploadJobId(res.data.id)
      qc.setQueryData(['job', selectedEmpresa, res.data.id], res.data as Job)
      qc.invalidateQueries({ queryKey: ['jobs', selectedEmpresa] })
    },
    onError: (e: unknown) => {
      const apiMessage = extractApiError(e)
      const msg = apiMessage.toLowerCase().includes('openai')
        ? 'Não foi possível ler o arquivo automaticamente. Você pode preencher os dados manualmente ou acionar o suporte.'
        : apiMessage
      setUploadError(msg)
      toast({ title: 'Erro ao importar extrato', description: msg, variant: 'destructive' })
    },
  })

  const uploadJobQuery = useJob<any>(selectedEmpresa, uploadJobId)
  const uploadJob = uploadJobQuery.data

  useEffect(() => {
    if (!uploadJob || !isJobFinished(uploadJob.status)) return
    qc.invalidateQueries({ queryKey: ['jobs', selectedEmpresa] })
    if (uploadJob.status === 'falhou' || !uploadJob.resultado) return

    const d = uploadJob.resultado
    const tipo = d.tipo ?? 'Extrato'
    setRejeicoes(d.motivos_rejeicao ?? [])
    const partes = [
      `${d.importadas ?? 0} novas transações`,
      `${d.duplicadas ?? 0} duplicadas ignoradas`,
    ]
    if (d.rejeitadas) partes.push(`${d.rejeitadas} recusadas por valor inconsistente`)
    toast({
      title: `${tipo} importado${uploadJob.status === 'concluido_com_alertas' ? ' com ressalvas' : ' com sucesso'}!`,
      description: `${partes.join(', ')}.`,
      variant: uploadJob.status === 'concluido_com_alertas' ? 'default' : 'success',
    })
    setPage(1)
    qc.invalidateQueries({ queryKey: ['extrato'] })
  }, [uploadJob?.status, uploadJobId, qc, selectedEmpresa])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadMutation.mutate(file)
    e.target.value = ''
  }

  // Exporta as MESMAS linhas que a tela mostra — todos os filtros vão junto.
  // A paginação não entra: o relatório traz o período inteiro, não só a página
  // aberta.
  const exportMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(
        `/empresas/${selectedEmpresa}/exportacao/gerar`,
        {
          formato: 'xlsx',
          tipo: 'extrato',
          agencia_id: selectedAgencia || null,
          status: statusFiltro !== 'todos' ? statusFiltro : null,
          dc: dcFiltro !== 'todos' ? dcFiltro : null,
          data_de: dataInicio || null,
          data_ate: dataFim || null,
          historico: busca.historico || null,
          valor_min: busca.valorMin || null,
          valor_max: busca.valorMax || null,
        },
        { responseType: 'blob' },
      )
      return data
    },
    onSuccess: (blob: Blob) => {
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `extrato_${new Date().toISOString().slice(0, 10)}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    },
    onError: (e: unknown) => {
      toast({
        title: 'Erro ao exportar extrato',
        description: extractApiError(e),
        variant: 'destructive',
      })
    },
  })

  const items: any[] = extrato?.items ?? []
  const total: number = extrato?.total ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Extrato Bancário</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportMutation.mutate()}
            disabled={!selectedEmpresa || total === 0 || exportMutation.isPending}
            title={total === 0 ? 'Nenhuma transação para exportar' : 'Exporta as transações com os filtros atuais'}
          >
            {exportMutation.isPending
              ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              : <Download className="h-4 w-4 mr-2" />}
            Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={!selectedEmpresa}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Linha 1: empresa, conta bancária, importar */}
          <div className="flex gap-4 flex-wrap items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="text-sm font-medium mb-1 block" htmlFor="pages-extrato-empresa">Empresa</label>
              <SearchableSelect id="pages-extrato-empresa"
                value={selectedEmpresa}
                onValueChange={v => { setSelectedEmpresa(v); setSelectedAgencia(''); setUploadJobId(null); setRejeicoes([]); setPage(1) }}
                options={empresas.map((e: any) => ({ value: e.id, label: e.razao_social }))}
                placeholder="Selecione a empresa"
                searchPlaceholder="Buscar empresa..."
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="text-sm font-medium mb-1 block" htmlFor="pages-extrato-agencia">Conta bancária</label>
              <SearchableSelect id="pages-extrato-agencia"
                value={selectedAgencia}
                onValueChange={v => { setSelectedAgencia(v); setPage(1) }}
                options={[
                  { value: '', label: 'Todas as contas' },
                  ...agencias.map((a: any) => ({
                    value: a.id,
                    label: `${a.banco_sigla} ${a.agencia}/${a.numero}`,
                  })),
                ]}
                placeholder="Todas as contas"
                searchPlaceholder="Buscar conta..."
                disabled={!selectedEmpresa}
              />
            </div>
            <div className="flex flex-col items-start gap-1">
              <Button
                onClick={() => fileRef.current?.click()}
                disabled={!selectedEmpresa || !selectedAgencia || uploadMutation.isPending || isJobRunning(uploadJob?.status)}
              >
                {uploadMutation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Importando...</>
                  : <><Upload className="h-4 w-4 mr-2" />Importar OFX / PDF</>
                }
              </Button>
              {selectedEmpresa && !selectedAgencia && (
                <p className="text-xs text-muted-foreground">
                  Selecione uma conta bancária específica para importar
                </p>
              )}
              <input ref={fileRef} type="file" accept=".ofx,.OFX,.pdf,.PDF" className="hidden" onChange={handleFile} />
            </div>
          </div>

          {/* Banner de erro de upload */}
          {uploadError && (
            <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/15 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-warning">Falha ao processar o arquivo</p>
                <p className="text-warning mt-0.5">{uploadError}</p>
              </div>
              <button onClick={() => setUploadError(null)} className="text-warning/70 hover:text-warning shrink-0">✕</button>
            </div>
          )}

          {uploadJob && !uploadJobQuery.pollingTimedOut && <JobProgress job={uploadJob} />}
          {isJobRunning(uploadJob?.status) && (uploadJobQuery.isError || uploadJobQuery.pollingTimedOut) && <JobPollingError timedOut={uploadJobQuery.pollingTimedOut} onRetry={uploadJobQuery.restartPolling} />}
          {uploadJob?.status === 'falhou' && (
            <div className="flex items-start gap-3 rounded-lg border border-danger/40 bg-danger/15 p-3 text-sm text-danger">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">A importação falhou.</p>
                <p className="mt-0.5">{uploadJob.erro || 'O servidor não informou o motivo da falha.'}</p>
                <Button type="button" variant="destructive" size="sm" className="mt-3" onClick={() => fileRef.current?.click()}>
                  Escolher arquivo e tentar novamente
                </Button>
              </div>
            </div>
          )}

          {/* Linhas recusadas — cada uma precisa de lançamento manual, então o
              painel é persistente e traz o motivo de cada uma. */}
          {rejeicoes.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/15 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-warning">
                  {rejeicoes.length === 1
                    ? '1 linha não foi importada'
                    : `${rejeicoes.length} linhas não foram importadas`}
                </p>
                <p className="text-warning mt-0.5">
                  O valor lido não confere com a linha do extrato. Ficaram de fora para
                  não entrar na contabilidade com valor errado — lance manualmente ou
                  reimporte o arquivo em OFX.
                </p>
                <ul className="mt-2 space-y-1">
                  {rejeicoes.map((motivo, i) => (
                    <li key={i} className="text-xs text-warning break-words">• {motivo}</li>
                  ))}
                </ul>
              </div>
              <button onClick={() => setRejeicoes([])} className="text-warning/70 hover:text-warning shrink-0">✕</button>
            </div>
          )}

          {/* Linha 2: a busca fica sempre à mão; o resto entra atrás de Filtros. */}
          <div className="flex flex-wrap items-center gap-2.5 border-t pt-4">
            <Input
              compact
              className="max-w-md flex-1"
              placeholder="Buscar no histórico do banco"
              value={buscaInputs.historico}
              onChange={e => setBuscaInputs(s => ({ ...s, historico: e.target.value }))}
            />
            <Button variant="outline" size="sm" onClick={() => setFiltrosAbertos(a => !a)} aria-expanded={filtrosAbertos}>
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros
              {filtrosAtivos && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-brand" />}
            </Button>
            {filtrosAtivos && (
              <Button variant="ghost" size="sm" onClick={limparFiltros}>Limpar filtros</Button>
            )}
          </div>

          <div className={`flex flex-wrap items-end gap-4 rounded-md border border-border bg-surface-hover p-3 ${filtrosAbertos ? '' : 'hidden'}`}>
            <div className="min-w-[140px]">
              <label className="text-sm font-medium mb-1 block" htmlFor="pages-extrato-status">Status</label>
              <Select value={statusFiltro} onValueChange={v => { setStatusFiltro(v); setPage(1) }}>
                <SelectTrigger id="pages-extrato-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="conciliado">Conciliado</SelectItem>
                  <SelectItem value="ignorado">Ignorado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block" htmlFor="pages-extrato-de">De</label>
              <Input id="pages-extrato-de" type="date" value={dataInicio} onChange={e => { setDataInicio(e.target.value); setPage(1) }} className="w-40" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block" htmlFor="pages-extrato-ate">Até</label>
              <Input id="pages-extrato-ate" type="date" value={dataFim} onChange={e => { setDataFim(e.target.value); setPage(1) }} className="w-40" />
            </div>
            <div className="min-w-[120px]">
              <label className="text-sm font-medium mb-1 block" htmlFor="pages-extrato-d-c">D/C</label>
              <Select value={dcFiltro} onValueChange={v => { setDcFiltro(v); setPage(1) }}>
                <SelectTrigger id="pages-extrato-d-c"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="D">Débito</SelectItem>
                  <SelectItem value="C">Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* O valor gravado é sempre positivo — o sinal mora em D/C. A faixa,
                portanto, é sobre o módulo do lançamento, e o rótulo diz isso. */}
            <div>
              <label className="text-sm font-medium mb-1 block" htmlFor="pages-extrato-valor-de">Valor de</label>
              <Input id="pages-extrato-valor-de"
                type="number" min="0" step="0.01" placeholder="0,00"
                value={buscaInputs.valorMin}
                onChange={e => setBuscaInputs(s => ({ ...s, valorMin: e.target.value }))}
                className="w-32"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block" htmlFor="pages-extrato-ate-2">até</label>
              <Input id="pages-extrato-ate-2"
                type="number" min="0" step="0.01" placeholder="0,00"
                value={buscaInputs.valorMax}
                onChange={e => setBuscaInputs(s => ({ ...s, valorMax: e.target.value }))}
                className="w-32"
              />
            </div>
            <div className="min-w-[110px]">
              <label className="text-sm font-medium mb-1 block" htmlFor="pages-extrato-por-pagina">Por página</label>
              <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1) }}>
                <SelectTrigger id="pages-extrato-por-pagina"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {/* O backend aceita de 1 a 200; 200 é o teto de lá. */}
                  {[20, 50, 100, 200].map(n => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transações {total > 0 && <span className="text-base font-normal text-muted-foreground">({total} total)</span>}</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedEmpresa ? (
            <p className="text-muted-foreground text-center py-8">Selecione uma empresa para ver as transações</p>
          ) : isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : isError ? (
            <ErroConsulta erro={error} contexto="as transações" onTentarDeNovo={() => refetch()} />
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {filtrosAtivos
                ? 'Nenhuma transação encontrada com esses filtros.'
                : 'Nenhuma transação encontrada. Importe um arquivo OFX ou PDF.'}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-3 px-2 w-28">Data</th>
                      <th className="text-left py-3 px-2">Histórico</th>
                      <th className="text-center py-3 px-2 w-8">D/C</th>
                      <th className="text-right py-3 px-2 w-32">Valor</th>
                      <th className="text-right py-3 px-2 w-32">Saldo</th>
                      <th className="text-center py-3 px-2 w-28">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((t: any) => (
                      <tr key={t.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="py-2 px-2 whitespace-nowrap text-sm">
                          {formatDate(t.data)}
                        </td>
                        <td className="py-2 px-2 max-w-sm truncate text-sm" title={t.historico || undefined}>
                          {t.historico || '-'}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${t.dc === 'D' ? 'bg-danger/15 text-danger' : 'bg-success/15 text-success'}`}>
                            {t.dc}
                          </span>
                        </td>
                        <td className={`py-2 px-2 text-right font-mono text-sm ${t.dc === 'D' ? 'text-danger' : 'text-success'}`}>
                          {t.dc === 'D' ? '-' : '+'}{formatCurrency(t.valor)}
                        </td>
                        {/* Saldo da conta após o lançamento, como impresso no extrato.
                            É dado de conferência, não movimento — por isso discreto.
                            Nulo quando a origem não informa (OFX não traz saldo). */}
                        <td
                          className={`py-2 px-2 text-right font-mono text-sm ${
                            t.saldo_apos == null
                              ? 'text-muted-foreground'
                              : t.saldo_apos < 0
                                ? 'text-danger'
                                : 'text-muted-foreground'
                          }`}
                          title={t.saldo_apos == null ? 'O arquivo importado não informa saldo' : undefined}
                        >
                          {t.saldo_apos == null ? '—' : formatCurrency(t.saldo_apos)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Badge variant={STATUS_COLORS[t.status] ?? 'outline'}>{t.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
