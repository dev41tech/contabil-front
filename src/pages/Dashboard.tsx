import { useQuery } from '@tanstack/react-query'
import { useEmpresaDefault } from '@/hooks/useEmpresaDefault'
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

// ── utils ─────────────────────────────────────────────────────────────────────

function mesAbrev(mes: string) {
  const [year, m] = mes.split('-')
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${months[parseInt(m) - 1]}/${year.slice(2)}`
}

// ── componente principal ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [statsEmpresa, setStatsEmpresa] = useEmpresaDefault()

  const { data: empresas = [], isLoading } = useEmpresas()

  const { data: stats, isLoading: statsLoading } = useQuery<StatsResponse>({
    queryKey: ['stats', statsEmpresa],
    queryFn: () => api.get(`/empresas/${statsEmpresa}/stats?meses=12`).then(r => r.data),
    enabled: !!statsEmpresa,
  })

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
              { to: '/extrato', icon: FileText, color: 'text-blue-500', title: 'Extrato OFX', desc: 'Importar e visualizar extratos' },
              { to: '/neo', icon: Zap, color: 'text-yellow-500', title: 'NEO', desc: 'Conciliação automática' },
              { to: '/registros', icon: BookOpen, color: 'text-green-500', title: 'Registros', desc: 'Lançamentos contábeis' },
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
                    icon={<FileText className="h-5 w-5 text-blue-500" />}
                    label="Transações"
                    value={stats.resumo.total_transacoes}
                  />
                  <KpiCard
                    icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
                    label="Conciliados"
                    value={stats.resumo.total_conciliados}
                    sub={`${stats.resumo.percentual_conciliacao}%`}
                    subColor="text-green-600"
                  />
                  <KpiCard
                    icon={<AlertCircle className="h-5 w-5 text-red-500" />}
                    label="Não Conciliados"
                    value={stats.resumo.total_nao_conciliados}
                    subColor="text-red-600"
                  />
                  <KpiCard
                    icon={<BookOpen className="h-5 w-5 text-purple-500" />}
                    label="Registros"
                    value={stats.resumo.total_registros}
                  />
                  <KpiCard
                    icon={<Receipt className="h-5 w-5 text-orange-500" />}
                    label="Notas Fiscais"
                    value={stats.resumo.total_notas}
                  />
                  <KpiCard
                    icon={<ClipboardCheck className="h-5 w-5 text-teal-500" />}
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
                          <Bar dataKey="transacoes" name="Transações" fill="#3b82f6" radius={[2,2,0,0]} />
                          <Bar dataKey="registros" name="Registros" fill="#22c55e" radius={[2,2,0,0]} />
                          <Bar dataKey="comprovantes" name="Comprovantes" fill="#f97316" radius={[2,2,0,0]} />
                          <Bar dataKey="notas" name="Notas Fiscais" fill="#a855f7" radius={[2,2,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Conciliação por agência */}
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
                                className="h-full bg-green-500 rounded-full transition-all"
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
