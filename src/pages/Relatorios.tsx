import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useEmpresaDefault } from '@/hooks/useEmpresaDefault'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Printer, TrendingUp, BookOpen, Landmark } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEmpresas } from '@/hooks/useEmpresas'

// ── Tipos ──────────────────────────────────────────────────────────────────────

type Tab = 'dre' | 'balancete' | 'livro_caixa'

interface DRELinha {
  conta_id: string; codigo: string; descricao: string; tipo: string
  debitos: number; creditos: number; saldo: number
}
interface DREGrupo {
  tipo: string; label: string; linhas: DRELinha[]; total: number
}
interface DREResponse {
  empresa_id: string; data_de: string | null; data_ate: string | null
  grupos: DREGrupo[]
  total_receitas: number; total_custos: number; total_despesas: number
  resultado_liquido: number
}

interface BalanceteLinha {
  conta_id: string; codigo: string; descricao: string; tipo: string; nivel: number
  debitos: number; creditos: number; saldo_devedor: number; saldo_credor: number
}
interface BalanceteResponse {
  empresa_id: string; data_de: string | null; data_ate: string | null
  linhas: BalanceteLinha[]
  total_debitos: number; total_creditos: number
  total_saldo_devedor: number; total_saldo_credor: number
}

interface LancCaixa {
  data: string; historico: string; dc: string; valor: number; saldo_acumulado: number
}
interface AgenciaCaixa {
  agencia_id: string; descricao: string; saldo_inicial: number; saldo_final: number
  total_debitos: number; total_creditos: number; lancamentos: LancCaixa[]
}
interface LivroCaixaResponse {
  empresa_id: string; data_de: string | null; data_ate: string | null
  agencias: AgenciaCaixa[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(val: number) {
  return formatCurrency(val)
}

function buildQuery(dataInicio: string, dataFim: string): string {
  const p = new URLSearchParams()
  if (dataInicio) p.set('data_de', new Date(dataInicio).toISOString())
  if (dataFim) {
    const d = new Date(dataFim)
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999)
      p.set('data_ate', d.toISOString())
    }
  }
  return p.toString() ? '?' + p.toString() : ''
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function DREView({ data }: { data: DREResponse }) {
  const isPositivo = data.resultado_liquido >= 0

  return (
    <div className="space-y-6">
      {/* Resultado resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-success/40 bg-success/15">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Receitas</p>
            <p className="text-lg font-bold text-success">{fmt(data.total_receitas)}</p>
          </CardContent>
        </Card>
        <Card className="border-warning/40 bg-warning/15">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Custos</p>
            <p className="text-lg font-bold text-warning">{fmt(data.total_custos)}</p>
          </CardContent>
        </Card>
        <Card className="border-danger/40 bg-danger/15">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Despesas</p>
            <p className="text-lg font-bold text-danger">{fmt(data.total_despesas)}</p>
          </CardContent>
        </Card>
        <Card className={cn(
          'border-2',
          isPositivo
            ? 'border-success/60 bg-success/15'
            : 'border-danger/60 bg-danger/15'
        )}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Resultado Líquido</p>
            <p className={cn('text-lg font-bold', isPositivo ? 'text-success' : 'text-danger')}>
              {fmt(data.resultado_liquido)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela por grupo */}
      {data.grupos.map(grupo => (
        <div key={grupo.tipo}>
          <div className="flex items-center justify-between px-4 py-2 bg-muted rounded-t-md">
            <span className="font-semibold text-sm">{grupo.label}</span>
            <span className="font-bold text-sm">{fmt(grupo.total)}</span>
          </div>
          <div className="border rounded-b-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 text-xs text-muted-foreground w-24">Código</th>
                  <th className="text-left px-3 py-2 text-xs text-muted-foreground">Descrição</th>
                  <th className="text-right px-3 py-2 text-xs text-muted-foreground w-32">Débitos</th>
                  <th className="text-right px-3 py-2 text-xs text-muted-foreground w-32">Créditos</th>
                  <th className="text-right px-3 py-2 text-xs text-muted-foreground w-32">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {grupo.linhas.map((linha, i) => (
                  <tr key={linha.conta_id} className={cn('border-t', i % 2 === 0 ? '' : 'bg-muted/20')}>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{linha.codigo}</td>
                    <td className="px-3 py-2">{linha.descricao}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{fmt(linha.debitos)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{fmt(linha.creditos)}</td>
                    <td className={cn('px-3 py-2 text-right font-medium', linha.saldo >= 0 ? 'text-success' : 'text-danger')}>
                      {fmt(linha.saldo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {data.grupos.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nenhum lançamento encontrado no período.
        </div>
      )}
    </div>
  )
}

function BalanceteView({ data }: { data: BalanceteResponse }) {
  return (
    <div className="space-y-4">
      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-3 py-2 text-xs text-muted-foreground w-24">Código</th>
              <th className="text-left px-3 py-2 text-xs text-muted-foreground">Descrição</th>
              <th className="text-left px-3 py-2 text-xs text-muted-foreground w-28">Tipo</th>
              <th className="text-right px-3 py-2 text-xs text-muted-foreground w-32">Débitos</th>
              <th className="text-right px-3 py-2 text-xs text-muted-foreground w-32">Créditos</th>
              <th className="text-right px-3 py-2 text-xs text-muted-foreground w-32">Sd. Devedor</th>
              <th className="text-right px-3 py-2 text-xs text-muted-foreground w-32">Sd. Credor</th>
            </tr>
          </thead>
          <tbody>
            {data.linhas.map((linha, i) => (
              <tr key={linha.conta_id} className={cn('border-t', i % 2 === 0 ? '' : 'bg-muted/20')}>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground" style={{ paddingLeft: `${((linha.nivel ?? 1) - 1) * 16 + 12}px` }}>
                  {linha.codigo}
                </td>
                <td className={cn('px-3 py-2', linha.nivel === 1 && 'font-semibold')}>{linha.descricao}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground capitalize">{linha.tipo.replace('_', ' ')}</td>
                <td className="px-3 py-2 text-right">{fmt(linha.debitos)}</td>
                <td className="px-3 py-2 text-right">{fmt(linha.creditos)}</td>
                <td className="px-3 py-2 text-right font-medium">{linha.saldo_devedor > 0 ? fmt(linha.saldo_devedor) : '—'}</td>
                <td className="px-3 py-2 text-right font-medium">{linha.saldo_credor > 0 ? fmt(linha.saldo_credor) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 bg-muted font-bold">
              <td colSpan={3} className="px-3 py-2 text-sm">Totais</td>
              <td className="px-3 py-2 text-right">{fmt(data.total_debitos)}</td>
              <td className="px-3 py-2 text-right">{fmt(data.total_creditos)}</td>
              <td className="px-3 py-2 text-right">{fmt(data.total_saldo_devedor)}</td>
              <td className="px-3 py-2 text-right">{fmt(data.total_saldo_credor)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {data.linhas.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nenhuma conta encontrada.
        </div>
      )}
    </div>
  )
}

function LivroCaixaView({ data }: { data: LivroCaixaResponse }) {
  if (data.agencias.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Nenhuma agência/conta bancária cadastrada.
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {data.agencias.map(agencia => (
        <div key={agencia.agencia_id}>
          <div className="flex items-center justify-between px-4 py-2 bg-muted rounded-t-md">
            <div>
              <span className="font-semibold text-sm">{agencia.descricao}</span>
            </div>
            <div className="flex gap-6 text-xs text-muted-foreground">
              <span>Saldo Inicial: <strong className="text-foreground">{fmt(agencia.saldo_inicial)}</strong></span>
              <span>Saldo Final: <strong className={cn(agencia.saldo_final >= 0 ? 'text-success' : 'text-danger')}>{fmt(agencia.saldo_final)}</strong></span>
            </div>
          </div>
          <div className="border rounded-b-md overflow-hidden">
            {agencia.lancamentos.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Sem movimentações no período.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs text-muted-foreground w-32">Data</th>
                    <th className="text-left px-3 py-2 text-xs text-muted-foreground">Histórico</th>
                    <th className="text-center px-3 py-2 text-xs text-muted-foreground w-16">D/C</th>
                    <th className="text-right px-3 py-2 text-xs text-muted-foreground w-32">Valor</th>
                    <th className="text-right px-3 py-2 text-xs text-muted-foreground w-32">Saldo Acum.</th>
                  </tr>
                </thead>
                <tbody>
                  {agencia.lancamentos.map((lanc, i) => (
                    <tr key={i} className={cn('border-t', i % 2 === 0 ? '' : 'bg-muted/20')}>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(lanc.data)}</td>
                      <td className="px-3 py-2 truncate max-w-xs">{lanc.historico}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded', lanc.dc === 'C' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger')}>
                          {lanc.dc}
                        </span>
                      </td>
                      <td className={cn('px-3 py-2 text-right font-medium', lanc.dc === 'C' ? 'text-success' : 'text-danger')}>
                        {fmt(lanc.valor)}
                      </td>
                      <td className={cn('px-3 py-2 text-right', lanc.saldo_acumulado >= 0 ? 'text-foreground' : 'text-danger')}>
                        {fmt(lanc.saldo_acumulado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted font-semibold text-xs">
                    <td colSpan={3} className="px-3 py-2">Totais do período</td>
                    <td className="px-3 py-2 text-right text-danger">{fmt(agencia.total_debitos)} D</td>
                    <td className="px-3 py-2 text-right text-success">{fmt(agencia.total_creditos)} C</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Página Principal ───────────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const [selectedEmpresa, setSelectedEmpresa] = useEmpresaDefault()
  const [activeTab, setActiveTab] = useState<Tab>('dre')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [fetchParams, setFetchParams] = useState({ empresa: '', dataDe: '', dataAte: '' })
  const printRef = useRef<HTMLDivElement>(null)

  const { data: empresas = [] } = useEmpresas()

  const isReady = !!fetchParams.empresa

  // DRE
  const { data: dreData, isFetching: dreLoading } = useQuery<DREResponse>({
    queryKey: ['relatorio-dre', fetchParams],
    queryFn: () => {
      const qs = buildQuery(fetchParams.dataDe, fetchParams.dataAte)
      return api.get(`/empresas/${fetchParams.empresa}/relatorios/dre${qs}`).then(r => r.data)
    },
    enabled: isReady && activeTab === 'dre',
  })

  // Balancete
  const { data: balanceteData, isFetching: balanceteLoading } = useQuery<BalanceteResponse>({
    queryKey: ['relatorio-balancete', fetchParams],
    queryFn: () => {
      const qs = buildQuery(fetchParams.dataDe, fetchParams.dataAte)
      return api.get(`/empresas/${fetchParams.empresa}/relatorios/balancete${qs}`).then(r => r.data)
    },
    enabled: isReady && activeTab === 'balancete',
  })

  // Livro Caixa
  const { data: caixaData, isFetching: caixaLoading } = useQuery<LivroCaixaResponse>({
    queryKey: ['relatorio-livro-caixa', fetchParams],
    queryFn: () => {
      const qs = buildQuery(fetchParams.dataDe, fetchParams.dataAte)
      return api.get(`/empresas/${fetchParams.empresa}/relatorios/livro-caixa${qs}`).then(r => r.data)
    },
    enabled: isReady && activeTab === 'livro_caixa',
  })

  const isLoading = dreLoading || balanceteLoading || caixaLoading

  function handleGerar() {
    if (!selectedEmpresa) return
    setFetchParams({ empresa: selectedEmpresa, dataDe: dataInicio, dataAte: dataFim })
  }

  function handleImprimir() {
    window.print()
  }

  const tabs: { id: Tab; label: string; icon: typeof TrendingUp }[] = [
    { id: 'dre', label: 'DRE', icon: TrendingUp },
    { id: 'balancete', label: 'Balancete de Verificação', icon: BookOpen },
    { id: 'livro_caixa', label: 'Livro Caixa', icon: Landmark },
  ]

  const empresaLabel = empresas.find((e: any) => e.id === fetchParams.empresa)?.razao_social ?? ''

  return (
    <div className="p-6 space-y-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Relatórios Financeiros</h1>
          <p className="text-sm text-muted-foreground mt-0.5">DRE, Balancete de Verificação e Livro Caixa</p>
        </div>
        {isReady && (
          <Button variant="outline" onClick={handleImprimir} className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card className="print:hidden">
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Empresa *</Label>
              <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.razao_social}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Início</Label>
              <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Fim</Label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
            </div>
            <Button onClick={handleGerar} disabled={!selectedEmpresa} className="w-full">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Gerar Relatório
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      {isReady && (
        <>
          <div className="flex border-b gap-1 print:hidden">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Área de impressão — id usado pelo CSS @media print */}
          <div id="relatorio-print-area" ref={printRef}>

          {/* Cabeçalho visível só na impressão */}
          <div className="print:block hidden mb-4 border-b pb-3">
            <h2 className="text-xl font-bold">
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
            {empresaLabel && <p className="text-sm text-muted-foreground">{empresaLabel}</p>}
            {(fetchParams.dataDe || fetchParams.dataAte) && (
              <p className="text-xs text-muted-foreground">
                Período: {fetchParams.dataDe || '—'} até {fetchParams.dataAte || '—'}
              </p>
            )}
          </div>
            {isLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && activeTab === 'dre' && dreData && (
              <DREView data={dreData} />
            )}

            {!isLoading && activeTab === 'balancete' && balanceteData && (
              <BalanceteView data={balanceteData} />
            )}

            {!isLoading && activeTab === 'livro_caixa' && caixaData && (
              <LivroCaixaView data={caixaData} />
            )}
          </div> {/* fecha #relatorio-print-area */}
        </>
      )}

      {!isReady && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <TrendingUp className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground text-sm">Selecione uma empresa e clique em <strong>Gerar Relatório</strong></p>
        </div>
      )}

      {/* Print styles — visibility approach: torna tudo invisível e reexibe só a área do relatório */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #relatorio-print-area,
          #relatorio-print-area * {
            visibility: visible;
          }
          #relatorio-print-area {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            padding: 24px;
          }
        }
      `}</style>
    </div>
  )
}
