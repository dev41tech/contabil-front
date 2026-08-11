import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { useEmpresaDefault } from '@/hooks/useEmpresaDefault'
import { useEmpresas } from '@/hooks/useEmpresas'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Upload,
  Loader2,
  Scale,
  AlertTriangle,
  Download,
  ChevronDown,
  ChevronRight,
  Search,
  FileSpreadsheet,
} from 'lucide-react'
import {
  concilproService,
  type Arquivo,
  type Resumo,
  type Fornecedor,
  type FornecedorDetalhado,
  type ConciliacaoFifoItem,
  type Divergencia,
} from '@/lib/concilpro-api'

// ─── Cores de status ──────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<string, any> = {
  QUITADO: 'success',
  EM_ABERTO: 'warning',
  ADIANTADO: 'secondary',
  // Sem movimento não é bom nem ruim — é ausência de fato. Fica neutro para não
  // competir visualmente com o que exige ação.
  SEM_MOVIMENTO: 'outline',
  PAGO: 'success',
  PARCIAL: 'warning',
  PENDENTE: 'destructive',
}

/** Rótulos em PT-BR. Sem isso o badge mostra o enum cru ("SEM MOVIMENTO"). */
const STATUS_LABEL: Record<string, string> = {
  QUITADO: 'Quitado',
  EM_ABERTO: 'Em aberto',
  ADIANTADO: 'Adiantado',
  SEM_MOVIMENTO: 'Sem movimento',
  PAGO: 'Pago',
  PARCIAL: 'Parcial',
  PENDENTE: 'Pendente',
}

const rotuloStatus = (status: string) =>
  STATUS_LABEL[status?.toUpperCase()] ?? status

const SEVERIDADE_VARIANT: Record<string, any> = {
  CRITICA: 'destructive',
  ALTA: 'destructive',
  MEDIA: 'warning',
  BAIXA: 'secondary',
}

// ─── Sub-componente: Modal FIFO ───────────────────────────────────────────────

function ModalFifo({
  empresaId,
  fornecedorId,
  open,
  onClose,
}: {
  empresaId: string
  fornecedorId: number | null
  open: boolean
  onClose: () => void
}) {
  const [expandido, setExpandido] = useState<number | null>(null)

  const { data: fifo = [], isLoading } = useQuery<ConciliacaoFifoItem[]>({
    queryKey: ['concilpro-fifo', empresaId, fornecedorId],
    queryFn: () => concilproService.obterConciliacaoFifo(empresaId, fornecedorId!),
    enabled: open && !!empresaId && fornecedorId !== null,
  })

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conciliação FIFO — Detalhe</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : fifo.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Sem dados FIFO.</p>
        ) : (
          <div className="space-y-2">
            {fifo.map((item, i) => (
              <div key={i} className="border rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                  onClick={() => setExpandido(expandido === i ? null : i)}
                >
                  <div className="flex items-center gap-3">
                    {expandido === i
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <div>
                      <p className="text-sm font-medium">{item.historico}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.numero_nf && `NF ${item.numero_nf} · `}
                        {item.data_lancamento ? formatDate(item.data_lancamento) : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-sm font-mono">{formatCurrency(item.valor_total)}</p>
                    <Badge variant={STATUS_VARIANT[item.status.toUpperCase()] ?? 'outline'} className="text-xs mt-0.5">
                      {item.status}
                    </Badge>
                  </div>
                </button>

                {expandido === i && item.pagamentos.length > 0 && (
                  <div className="border-t bg-muted/30 px-4 py-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Pagamentos aplicados:</p>
                    {item.pagamentos.map((p, j) => (
                      <div key={j} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                        <div>
                          <span className="text-muted-foreground mr-2">
                            {p.data_pagamento ? formatDate(p.data_pagamento) : '—'}
                          </span>
                          <span>{p.historico}</span>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <span className="text-emerald-600 font-mono">{formatCurrency(p.valor_pago)}</span>
                          <span className="text-muted-foreground ml-2">
                            saldo: {formatCurrency(p.saldo_restante)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Sub-componente: Modal Fornecedor ─────────────────────────────────────────

function ModalFornecedor({
  empresaId,
  fornecedor,
  open,
  onClose,
}: {
  empresaId: string
  fornecedor: Fornecedor | null
  open: boolean
  onClose: () => void
}) {
  const [fifoOpen, setFifoOpen] = useState(false)

  const { data, isLoading } = useQuery<FornecedorDetalhado>({
    queryKey: ['concilpro-fornecedor', empresaId, fornecedor?.id],
    queryFn: () => concilproService.obterFornecedorDetalhado(empresaId, fornecedor!.id),
    enabled: open && !!empresaId && fornecedor !== null,
  })

  return (
    <>
      <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {fornecedor?.nome_fornecedor}
              {fornecedor?.divergencia_calculo && (
                <Badge variant="destructive" className="ml-2 text-xs">Divergência</Badge>
              )}
            </DialogTitle>
            {/* Reduzido primeiro, para bater com a coluna "Conta" da tabela. */}
            <p className="text-xs text-muted-foreground">
              Conta <span className="font-mono">{fornecedor?.codigo_conta}</span>
              {' · '}
              <span className="font-mono">{fornecedor?.conta_contabil}</span>
            </p>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : data ? (
            <div className="space-y-4">
              {/* Resumo financeiro */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total Compras (C)', value: data.fornecedor.total_credito, color: 'text-foreground' },
                  { label: 'Total Pagamentos (D)', value: data.fornecedor.total_debito, color: 'text-emerald-600' },
                  { label: 'Valor a Pagar', value: data.fornecedor.valor_a_pagar, color: 'text-red-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={`text-sm font-bold font-mono mt-1 ${color}`}>{formatCurrency(value)}</p>
                  </div>
                ))}
              </div>

              <Tabs defaultValue="pendentes">
                <div className="flex items-center justify-between">
                  <TabsList>
                    <TabsTrigger value="pendentes">
                      Compras Pendentes
                      {data.compras_pendentes.length > 0 && (
                        <span className="ml-1.5 rounded-full bg-warning/20 text-warning-foreground px-1.5 text-xs">
                          {data.compras_pendentes.length}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="lancamentos">
                      Todos os Lançamentos ({data.todos_lancamentos.length})
                    </TabsTrigger>
                  </TabsList>
                  <Button variant="outline" size="sm" onClick={() => setFifoOpen(true)}>
                    Ver FIFO
                  </Button>
                </div>

                {/* Tab: compras pendentes */}
                <TabsContent value="pendentes" className="mt-3">
                  {data.compras_pendentes.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6 text-sm">Nenhuma compra pendente.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="text-left py-2 px-2">Data</th>
                            <th className="text-left py-2 px-2">NF</th>
                            <th className="text-left py-2 px-2">Histórico</th>
                            <th className="text-right py-2 px-2">Total</th>
                            <th className="text-right py-2 px-2">Pago</th>
                            <th className="text-right py-2 px-2">Saldo</th>
                            <th className="text-center py-2 px-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.compras_pendentes.map(c => (
                            <tr key={c.id} className="border-b hover:bg-muted/40">
                              <td className="py-1.5 px-2 whitespace-nowrap text-xs">{formatDate(c.data_lancamento)}</td>
                              <td className="py-1.5 px-2 text-xs">{c.numero_nf ?? '—'}</td>
                              <td className="py-1.5 px-2 max-w-[200px] truncate text-xs">{c.historico}</td>
                              <td className="py-1.5 px-2 text-right font-mono text-xs">{formatCurrency(c.valor_total)}</td>
                              <td className="py-1.5 px-2 text-right font-mono text-xs text-emerald-600">{formatCurrency(c.valor_pago_parcial)}</td>
                              <td className="py-1.5 px-2 text-right font-mono text-xs text-red-600">{formatCurrency(c.valor_saldo)}</td>
                              <td className="py-1.5 px-2 text-center">
                                <Badge variant={STATUS_VARIANT[c.status_pagamento] ?? 'outline'} className="text-xs">
                                  {rotuloStatus(c.status_pagamento)}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>

                {/* Tab: todos os lançamentos */}
                <TabsContent value="lancamentos" className="mt-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2 px-2">Data</th>
                          <th className="text-left py-2 px-2">Histórico</th>
                          <th className="text-left py-2 px-2">Tipo</th>
                          <th className="text-right py-2 px-2">Débito</th>
                          <th className="text-right py-2 px-2">Crédito</th>
                          <th className="text-right py-2 px-2">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.todos_lancamentos.map(l => (
                          <tr key={l.id} className="border-b hover:bg-muted/40">
                            <td className="py-1.5 px-2 whitespace-nowrap text-xs">{formatDate(l.data)}</td>
                            <td className="py-1.5 px-2 max-w-[200px] truncate text-xs">{l.historico}</td>
                            <td className="py-1.5 px-2">
                              <Badge variant="outline" className="text-xs">
                                {l.tipo_operacao}
                              </Badge>
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-xs text-red-600">
                              {l.valor_debito > 0 ? formatCurrency(l.valor_debito) : '—'}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-xs text-emerald-600">
                              {l.valor_credito > 0 ? formatCurrency(l.valor_credito) : '—'}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-xs">{formatCurrency(l.saldo_apos)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ModalFifo
        empresaId={empresaId}
        fornecedorId={fornecedor?.id ?? null}
        open={fifoOpen}
        onClose={() => setFifoOpen(false)}
      />
    </>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ConcilProPage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const { data: empresas = [] } = useEmpresas()
  const [selectedEmpresa, setSelectedEmpresa] = useEmpresaDefault()

  const [arquivoSelecionado, setArquivoSelecionado] = useState<number | null>(null)
  const [statusFiltro, setStatusFiltro] = useState('todos')
  const [busca, setBusca] = useState('')
  const [fornecedorModal, setFornecedorModal] = useState<Fornecedor | null>(null)
  const [abaAtiva, setAbaAtiva] = useState('fornecedores')

  // Poll de status enquanto PROCESSANDO
  const [pollingId, setPollingId] = useState<number | null>(null)

  // Troca de empresa: nada do arquivo/aba anterior faz sentido para a nova empresa.
  useEffect(() => {
    setArquivoSelecionado(null)
    setPollingId(null)
    setAbaAtiva('fornecedores')
  }, [selectedEmpresa])

  // ── Lista de arquivos ─────────────────────────────────────────────────────
  const { data: arquivos = [], isLoading: loadingArquivos } = useQuery<Arquivo[]>({
    queryKey: ['concilpro-arquivos', selectedEmpresa],
    queryFn: () => concilproService.listarArquivos(selectedEmpresa),
    enabled: !!selectedEmpresa,
    refetchInterval: pollingId !== null ? 4_000 : false,
  })

  // Auto-seleciona o mais recente e para polling quando CONCLUIDO
  useEffect(() => {
    if (!arquivos.length) return
    const mais_recente = arquivos[0]
    if (!arquivoSelecionado) setArquivoSelecionado(mais_recente.id)
    if (pollingId !== null && mais_recente.status !== 'PROCESSANDO') {
      setPollingId(null)
      qc.invalidateQueries({ queryKey: ['concilpro-resumo', selectedEmpresa] })
      qc.invalidateQueries({ queryKey: ['concilpro-fornecedores', selectedEmpresa] })
    }
  }, [arquivos])

  // ── Resumo / stats ────────────────────────────────────────────────────────
  const { data: resumo } = useQuery<Resumo>({
    queryKey: ['concilpro-resumo', selectedEmpresa, arquivoSelecionado],
    queryFn: () => concilproService.obterResumo(selectedEmpresa, arquivoSelecionado!),
    enabled: !!selectedEmpresa && !!arquivoSelecionado,
  })

  // ── Lista de fornecedores ─────────────────────────────────────────────────
  const { data: fornecedores = [], isLoading: loadingFornecedores } = useQuery<Fornecedor[]>({
    queryKey: ['concilpro-fornecedores', selectedEmpresa, arquivoSelecionado, statusFiltro],
    queryFn: () => concilproService.listarFornecedores(
      selectedEmpresa,
      arquivoSelecionado!,
      statusFiltro === 'todos' ? undefined : statusFiltro,
    ),
    enabled: !!selectedEmpresa && !!arquivoSelecionado,
  })

  // ── Divergências ──────────────────────────────────────────────────────────
  const { data: divergencias = [] } = useQuery<Divergencia[]>({
    queryKey: ['concilpro-divergencias', selectedEmpresa, arquivoSelecionado],
    queryFn: () => concilproService.listarDivergencias(selectedEmpresa, arquivoSelecionado!),
    enabled: !!selectedEmpresa && !!arquivoSelecionado,
  })

  // ── Upload ────────────────────────────────────────────────────────────────
  const uploadMutation = useMutation({
    mutationFn: (file: File) => concilproService.uploadArquivo(selectedEmpresa, file),
    onSuccess: (res) => {
      toast({ title: 'Arquivo enviado!', description: 'Processamento iniciado…', variant: 'success' })
      setArquivoSelecionado(res.arquivo_id)
      setPollingId(res.arquivo_id)
      qc.invalidateQueries({ queryKey: ['concilpro-arquivos', selectedEmpresa] })
    },
    onError: () => toast({ title: 'Erro ao enviar arquivo', variant: 'destructive' }),
  })

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadMutation.mutate(file)
    e.target.value = ''
  }

  // ── Filtro local ──────────────────────────────────────────────────────────
  const fornecedoresFiltrados = fornecedores.filter(f =>
    f.nome_fornecedor.toLowerCase().includes(busca.toLowerCase()) ||
    f.conta_contabil.includes(busca) ||
    f.codigo_conta.includes(busca)
  )

  const arqAtual = arquivos.find(a => a.id === arquivoSelecionado)
  const processando = arqAtual?.status === 'PROCESSANDO'
  const est = resumo?.estatisticas

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Scale className="h-7 w-7 text-primary" />
            CONCILPRO
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Conciliação inteligente de fornecedores — Razão de Contas a Pagar
          </p>
        </div>

      </div>

      {/* Seletor de empresa */}
      <Card>
        <CardContent className="pt-6">
          <label className="text-sm font-medium mb-1 block">Empresa</label>
          <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
            <SelectTrigger className="max-w-xs"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
            <SelectContent>
              {empresas.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.razao_social}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {!selectedEmpresa ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center py-8">Selecione uma empresa para começar.</p>
          </CardContent>
        </Card>
      ) : (
      <>
      {/* Controles: upload + seletor de arquivo */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end flex-wrap">
            {/* Upload */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Importar Razão</label>
              <Button
                onClick={() => fileRef.current?.click()}
                disabled={uploadMutation.isPending || processando}
              >
                {uploadMutation.isPending || processando
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{processando ? 'Processando…' : 'Enviando…'}</>
                  : <><Upload className="h-4 w-4 mr-2" />Enviar Razão de Fornecedores</>
                }
              </Button>
              {/* Prefira XLSX: a planilha declara o que o PDF obriga a inferir
                  (célula tipada, coluna nomeada, sem paginação), entao o parsing
                  e deterministico e nao usa IA. */}
              <p className="text-xs text-muted-foreground">
                Aceita <strong>Excel (.xlsx)</strong> ou PDF do Razão de Fornecedores.
                Prefira Excel quando o sistema contábil permitir — a leitura é mais precisa.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.XLSX,.xls,.XLS,.pdf,.PDF,.zip,.ZIP"
                className="hidden"
                onChange={handleFile}
              />
            </div>

            {/* Seletor de arquivo */}
            {arquivos.length > 0 && (
              <div className="flex-1 min-w-[240px]">
                <label className="text-sm font-medium mb-1 block">Arquivo analisado</label>
                <Select
                  value={arquivoSelecionado?.toString() ?? ''}
                  onValueChange={v => { setArquivoSelecionado(Number(v)); setAbaAtiva('fornecedores') }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um arquivo…" />
                  </SelectTrigger>
                  <SelectContent>
                    {arquivos.map(a => (
                      <SelectItem key={a.id} value={a.id.toString()}>
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${a.status === 'CONCLUIDO' ? 'bg-emerald-500' : a.status === 'ERRO' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                          <span className="truncate max-w-[300px]">{a.nome_arquivo}</span>
                          <span className="text-muted-foreground text-xs shrink-0">
                            {formatDate(a.created_at)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Exports */}
            {arquivoSelecionado && !processando && (
              <div className="flex gap-2 flex-wrap">
                {[
                  { tipo: 'completo', label: 'Completo' },
                  { tipo: 'em_aberto', label: 'Em Aberto' },
                  { tipo: 'divergencias', label: 'Divergências' },
                ].map(({ tipo, label }) => (
                  <Button
                    key={tipo}
                    variant="outline"
                    size="sm"
                    onClick={() => concilproService.exportarExcel(selectedEmpresa, arquivoSelecionado, tipo as any)}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-1" />
                    {label}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => concilproService.exportarLancamentosImportacao(selectedEmpresa, arquivoSelecionado)}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1" />
                  Layout Importação Contábil
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Aguardando processamento */}
      {processando && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-6 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">Processando arquivo…</p>
              <p className="text-sm text-amber-700">
                Isso pode levar alguns minutos dependendo do tamanho do arquivo.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards de resumo */}
      {est && !processando && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Fornecedores', value: est.total_fornecedores, suffix: '', color: 'text-foreground' },
            { label: 'Quitados', value: est.fornecedores_quitados, suffix: '', color: 'text-emerald-600' },
            { label: 'Em Aberto', value: est.fornecedores_em_aberto, suffix: '', color: 'text-amber-600' },
            // Contas sem lançamento no período. Card próprio porque não são
            // quitadas — juntá-las mascararia quantas contas de fato fecharam.
            { label: 'Sem Movimento', value: est.fornecedores_sem_movimento ?? 0, suffix: '', color: 'text-muted-foreground' },
            { label: 'Valor a Pagar', value: formatCurrency(est.valor_total_a_pagar), suffix: '', color: 'text-red-600' },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardHeader className="pb-2">
                <CardDescription>{label}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Conteúdo principal: tabs */}
      {arquivoSelecionado && !processando && (
        <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
          <TabsList>
            <TabsTrigger value="fornecedores">
              Fornecedores
              {fornecedores.length > 0 && (
                <span className="ml-1.5 text-xs text-muted-foreground">({fornecedores.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="divergencias">
              Divergências
              {divergencias.length > 0 && (
                <Badge variant="destructive" className="ml-1.5 text-xs h-4 px-1">
                  {divergencias.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tab fornecedores */}
          <TabsContent value="fornecedores" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Busca */}
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, conta…"
                      value={busca}
                      onChange={e => setBusca(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  {/* Filtro de status */}
                  <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="EM_ABERTO">Em aberto</SelectItem>
                      <SelectItem value="QUITADO">Quitado</SelectItem>
                      <SelectItem value="ADIANTADO">Adiantado</SelectItem>
                      <SelectItem value="SEM_MOVIMENTO">Sem movimento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {loadingFornecedores ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : fornecedoresFiltrados.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    Nenhum fornecedor encontrado.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-3 px-2">Fornecedor</th>
                          <th className="text-left py-3 px-2 w-32">Conta</th>
                          <th className="text-right py-3 px-2 w-32">Total Compras</th>
                          <th className="text-right py-3 px-2 w-32">Total Pago</th>
                          <th className="text-right py-3 px-2 w-32">A Pagar</th>
                          <th className="text-center py-3 px-2 w-28">NFs Pend.</th>
                          <th className="text-center py-3 px-2 w-28">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fornecedoresFiltrados.map(f => (
                          <tr
                            key={f.id}
                            className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => setFornecedorModal(f)}
                          >
                            <td className="py-2.5 px-2">
                              <div className="flex items-center gap-2">
                                {f.divergencia_calculo && (
                                  <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                                )}
                                <span className="font-medium truncate max-w-[220px]">{f.nome_fornecedor}</span>
                              </div>
                            </td>
                            {/* Codigo reduzido (1667), nao a classificacao completa
                                (2.1.3.01.0002): e por ele que a conta e procurada no
                                dia a dia. As duas continuam no export em Excel. */}
                            <td className="py-2.5 px-2 text-xs font-mono text-muted-foreground">{f.codigo_conta}</td>
                            <td className="py-2.5 px-2 text-right font-mono text-xs">{formatCurrency(f.total_credito)}</td>
                            <td className="py-2.5 px-2 text-right font-mono text-xs text-emerald-600">{formatCurrency(f.total_debito)}</td>
                            <td className="py-2.5 px-2 text-right font-mono text-xs text-red-600 font-semibold">
                              {f.valor_a_pagar > 0 ? formatCurrency(f.valor_a_pagar) : '—'}
                            </td>
                            <td className="py-2.5 px-2 text-center text-xs">
                              {f.qtd_nfs_pendentes > 0 ? (
                                <span className="text-amber-600 font-medium">{f.qtd_nfs_pendentes}</span>
                              ) : '—'}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <Badge variant={STATUS_VARIANT[f.status_pagamento] ?? 'outline'} className="text-xs">
                                {rotuloStatus(f.status_pagamento)}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab divergências */}
          <TabsContent value="divergencias" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Divergências Contábeis</CardTitle>
                <CardDescription>
                  Inconsistências detectadas na conciliação (tolerância ±R$ 0,02)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {divergencias.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    ✓ Nenhuma divergência detectada.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-3 px-2">Tipo</th>
                          <th className="text-left py-3 px-2">Descrição</th>
                          <th className="text-right py-3 px-2 w-32">Diferença</th>
                          <th className="text-center py-3 px-2 w-28">Severidade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {divergencias.map(d => (
                          <tr key={d.id} className="border-b hover:bg-muted/50">
                            <td className="py-2.5 px-2 text-xs font-mono">{d.tipo}</td>
                            <td className="py-2.5 px-2 text-xs">{d.descricao}</td>
                            <td className="py-2.5 px-2 text-right font-mono text-xs text-red-600">
                              {formatCurrency(d.diferenca)}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <Badge variant={SEVERIDADE_VARIANT[d.severidade] ?? 'outline'} className="text-xs">
                                {d.severidade}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Modal de detalhe do fornecedor */}
      <ModalFornecedor
        empresaId={selectedEmpresa}
        fornecedor={fornecedorModal}
        open={!!fornecedorModal}
        onClose={() => setFornecedorModal(null)}
      />
      </>
      )}
    </div>
  )
}
