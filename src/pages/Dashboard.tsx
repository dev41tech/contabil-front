import { useQuery } from '@tanstack/react-query'
import { useEmpresaDefault } from '@/hooks/useEmpresaDefault'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useCompetencia } from '@/contexts/CompetenciaContext'
import { useNavigate } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { api } from '@/lib/api'
import { useEmpresas } from '@/hooks/useEmpresas'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Building2, FileText, Zap, BookOpen, Loader2,
  TrendingUp, CheckCircle2, AlertCircle, Receipt, ClipboardCheck,
  ArrowRight, CalendarDays, CircleAlert, CircleCheck, Upload,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface ResumoStats {
  total_transacoes: number
  total_conciliados: number
  total_nao_conciliados: number
  total_registros: number
  total_notas: number
  total_comprovantes: number
  percentual_conciliacao: number
}

interface MesStats {
  mes: string
  transacoes: number
  registros: number
  comprovantes: number
  notas: number
}

interface AgenciaStats {
  agencia_id: string
  descricao: string
  conciliados: number
  nao_conciliados: number
}

interface StatsResponse {
  resumo: ResumoStats
  mensal: MesStats[]
  por_agencia: AgenciaStats[]
}

interface CarteiraItem {
  empresa_id: string
  razao_social: string
  transacoes_importadas: number
  pendentes: number
  classificadas: number
  erros: number
  ha_extrato_importado: boolean
  valor_total_pendente: number
}

interface CarteiraResponse {
  mes: string
  items: CarteiraItem[]
}

// ── utils ─────────────────────────────────────────────────────────────────────

function mesAbrev(mes: string) {
  const [year, m] = mes.split('-')
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${months[parseInt(m) - 1]}/${year.slice(2)}`
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ── componente principal ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { setEmpresa } = useEmpresa()
  const { competencia } = useCompetencia()
  const [statsEmpresa, setStatsEmpresa] = useEmpresaDefault()

  const { data: empresas = [], isLoading } = useEmpresas()

  const carteiraQuery = useQuery<CarteiraResponse>({
    queryKey: ['carteira', competencia],
    queryFn: () => api.get('/carteira', { params: { mes: competencia || undefined } }).then(r => r.data),
  })

  const { data: stats, isLoading: statsLoading } = useQuery<StatsResponse>({
    queryKey: ['stats', statsEmpresa],
    queryFn: () => api.get(`/empresas/${statsEmpresa}/stats?meses=12`).then(r => r.data),
    enabled: !!statsEmpresa,
  })

  const abrirTrabalho = (item: CarteiraItem) => {
    setEmpresa({ id: item.empresa_id, razao_social: item.razao_social })
    navigate(item.ha_extrato_importado ? '/neo' : '/extrato')
  }

  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Bem-vindo, {user?.nome}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Carteira operacional
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Prioridades de todas as empresas do escritório.</p>
          </div>
        </CardHeader>
        <CardContent>
          {carteiraQuery.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : carteiraQuery.isError ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-destructive"><AlertCircle className="h-5 w-5" />Não foi possível carregar a carteira desta competência.</div>
          ) : !carteiraQuery.data?.items.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma empresa encontrada nesta competência.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead><tr className="border-b text-muted-foreground"><th className="px-3 py-3 text-left">Empresa</th><th className="px-3 py-3 text-left">Situação</th><th className="px-3 py-3 text-right">Importadas</th><th className="px-3 py-3 text-right">Classificadas</th><th className="px-3 py-3 text-right">Pendências</th><th className="px-3 py-3 text-right">Valor pendente</th><th className="w-10" /></tr></thead>
                <tbody>
                  {carteiraQuery.data.items.map(item => (
                    <tr key={item.empresa_id} role="link" tabIndex={0} onClick={() => abrirTrabalho(item)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); abrirTrabalho(item) } }} className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                      <td className="px-3 py-3 font-medium">{item.razao_social}</td>
                      <td className="px-3 py-3"><CarteiraStatus item={item} /></td>
                      <td className="px-3 py-3 text-right tabular-nums">{item.transacoes_importadas.toLocaleString('pt-BR')}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{item.classificadas.toLocaleString('pt-BR')}</td>
                      <td className={`px-3 py-3 text-right tabular-nums ${item.pendentes ? 'font-semibold text-warning' : ''}`}>{item.pendentes.toLocaleString('pt-BR')}</td>
                      <td className={`px-3 py-3 text-right tabular-nums ${item.valor_total_pendente ? 'font-semibold' : 'text-muted-foreground'}`}>{formatCurrency(item.valor_total_pendente)}</td>
                      <td className="px-2 py-3"><ArrowRight className="h-4 w-4 text-muted-foreground" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {empresas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Nenhuma empresa cadastrada ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { to: '/extrato', icon: FileText, color: 'text-brand', title: 'Extrato OFX', desc: 'Importar e visualizar extratos' },
              { to: '/neo', icon: Zap, color: 'text-brand', title: 'NEO', desc: 'Conciliação automática' },
              { to: '/registros', icon: BookOpen, color: 'text-brand', title: 'Registros', desc: 'Lançamentos contábeis' },
            ].map(({ to, icon: Icon, color, title, desc }) => (
              <Card key={to} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(to)}>
                <CardContent className="flex items-center gap-4 p-6">
                  <Icon className={`h-8 w-8 ${color}`} />
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── Estatísticas ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Estatísticas
              </h2>
              <div className="w-64">
                <Select value={statsEmpresa} onValueChange={setStatsEmpresa}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.razao_social}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!statsEmpresa ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  Selecione uma empresa para ver as estatísticas
                </CardContent>
              </Card>
            ) : statsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : stats ? (
              <>
                {/* KPI Cards */}
                <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                  <KpiCard
                    icon={<FileText className="h-5 w-5 text-brand" />}
                    label="Transações"
                    value={stats.resumo.total_transacoes}
                  />
                  <KpiCard
                    icon={<CheckCircle2 className="h-5 w-5 text-success" />}
                    label="Conciliados"
                    value={stats.resumo.total_conciliados}
                    sub={`${stats.resumo.percentual_conciliacao}%`}
                    subColor="text-success"
                  />
                  <KpiCard
                    icon={<AlertCircle className="h-5 w-5 text-danger" />}
                    label="Não Conciliados"
                    value={stats.resumo.total_nao_conciliados}
                    subColor="text-danger"
                  />
                  <KpiCard
                    icon={<BookOpen className="h-5 w-5 text-brand" />}
                    label="Registros"
                    value={stats.resumo.total_registros}
                  />
                  <KpiCard
                    icon={<Receipt className="h-5 w-5 text-brand" />}
                    label="Notas Fiscais"
                    value={stats.resumo.total_notas}
                  />
                  <KpiCard
                    icon={<ClipboardCheck className="h-5 w-5 text-brand" />}
                    label="Comprovantes"
                    value={stats.resumo.total_comprovantes}
                  />
                </div>

                {/* Gráfico mensal */}
                {stats.mensal.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Atividade Mensal (últimos 12 meses)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart
                          data={stats.mensal.map(m => ({ ...m, mes: mesAbrev(m.mes) }))}
                          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="transacoes" name="Transações" fill="hsl(var(--s1))" radius={[2,2,0,0]} />
                          <Bar dataKey="registros" name="Registros" fill="hsl(var(--s2))" radius={[2,2,0,0]} />
                          <Bar dataKey="comprovantes" name="Comprovantes" fill="hsl(var(--s3))" radius={[2,2,0,0]} />
                          <Bar dataKey="notas" name="Notas Fiscais" fill="hsl(var(--s4))" radius={[2,2,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Conciliação por conta bancária */}
                {stats.por_agencia.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Conciliação por Conta Bancária</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {stats.por_agencia.map(ag => {
                        const total = ag.conciliados + ag.nao_conciliados
                        const pct = total > 0 ? Math.round((ag.conciliados / total) * 100) : 0
                        return (
                          <div key={ag.agencia_id} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium truncate max-w-[60%]">{ag.descricao}</span>
                              <span className="text-muted-foreground text-xs">
                                {ag.conciliados} concil. / {ag.nao_conciliados} pend. — {pct}%
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full bg-success rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>
                )}
              </>
            ) : null}
          </div>
        </>
      )}


    </div>
  )
}

function CarteiraStatus({ item }: { item: CarteiraItem }) {
  if (!item.ha_extrato_importado) return <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground"><Upload className="h-3.5 w-3.5" />Sem extrato importado</span>
  if (item.erros > 0) return <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/15 px-2.5 py-1 text-xs font-semibold text-danger"><CircleAlert className="h-3.5 w-3.5" />{item.erros.toLocaleString('pt-BR')} {item.erros === 1 ? 'erro' : 'erros'}{item.pendentes > 0 ? ` · ${item.pendentes.toLocaleString('pt-BR')} pendentes` : ''}</span>
  if (item.pendentes > 0) return <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-semibold text-warning"><CircleAlert className="h-3.5 w-3.5" />{item.pendentes.toLocaleString('pt-BR')} {item.pendentes === 1 ? 'pendência' : 'pendências'}</span>
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success"><CircleCheck className="h-3.5 w-3.5" />Tudo classificado</span>
}

// ── sub-componentes ───────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, subColor = 'text-muted-foreground',
}: {
  icon: React.ReactNode
  label: string
  value: number
  sub?: string
  subColor?: string
}) {
  return (
    <Card>
      <CardContent className="p-4 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          {icon}
          {label}
        </div>
        <p className="text-2xl font-bold">{value.toLocaleString('pt-BR')}</p>
        {sub && <p className={`text-xs font-medium ${subColor}`}>{sub}</p>}
      </CardContent>
    </Card>
  )
}
