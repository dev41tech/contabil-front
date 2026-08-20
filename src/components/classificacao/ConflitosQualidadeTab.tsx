import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Loader2, Scale } from 'lucide-react'
import { api } from '@/lib/api'
import { extractApiError } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface DivergenciaPorConta {
  conta_regra_id: string | null
  conta_regra_codigo: string | null
  conta_regra_descricao: string | null
  conta_contraparte_id: string | null
  conta_contraparte_codigo: string | null
  conta_contraparte_descricao: string | null
  quantidade: number
  valor_total: number
}

interface DivergenciaAmostra {
  decisao_id: string
  transacao_id: string
  historico: string
  valor: number
  origem_evidencia: string
  contraparte_id: string | null
  conta_regra_id: string | null
  conta_regra_codigo: string | null
  conta_regra_descricao: string | null
  conta_contraparte_id: string | null
  conta_contraparte_codigo: string | null
  conta_contraparte_descricao: string | null
}

interface DivergenciasResponse {
  total_avaliadas: number
  total_divergentes: number
  percentual_divergentes: number
  valor_total_divergente: number
  por_conta: DivergenciaPorConta[]
  amostra: DivergenciaAmostra[]
}

const formatCurrency = (value: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0)

const formatNumber = (value: number | null | undefined) => (value ?? 0).toLocaleString('pt-BR')

function contaLabel(codigo: string | null, descricao: string | null) {
  if (!codigo && !descricao) return 'Sem conta identificada'
  return [codigo, descricao].filter(Boolean).join(' — ')
}

export function ConflitosQualidadeTab({ empresaId }: { empresaId: string }) {
  const selectedEmpresa = empresaId
  const [mes, setMes] = useState('')
  const [agenciaId, setAgenciaId] = useState('todas')

  const { data: agencias = [] } = useQuery<any[]>({
    queryKey: ['agencias', selectedEmpresa],
    queryFn: () => api.get(`/empresas/${selectedEmpresa}/agencias`).then(response => response.data.items ?? response.data),
    enabled: !!selectedEmpresa,
  })

  const query = useQuery<DivergenciasResponse>({
    queryKey: ['neo-divergencias', selectedEmpresa, mes, agenciaId],
    queryFn: () => {
      const params = new URLSearchParams()
      if (mes) params.set('mes', mes)
      if (agenciaId !== 'todas') params.set('agencia_id', agenciaId)
      const suffix = params.size ? `?${params}` : ''
      return api.get(`/empresas/${selectedEmpresa}/neo/divergencias${suffix}`).then(response => response.data)
    },
    enabled: !!selectedEmpresa,
  })

  const porConta = useMemo(
    () => [...(query.data?.por_conta ?? [])].sort((a, b) => (b.valor_total ?? 0) - (a.valor_total ?? 0)),
    [query.data?.por_conta],
  )

  const data = query.data
  const semMedicao = data?.total_avaliadas === 0
  const semConflito = !!data && data.total_avaliadas > 0 && data.total_divergentes === 0

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[220px]">
              <Label className="mb-1 block">Conta bancária</Label>
              <Select value={agenciaId} onValueChange={setAgenciaId} disabled={!selectedEmpresa}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as contas bancárias</SelectItem>
                  {agencias.map((agencia: any) => (
                    <SelectItem key={agencia.id} value={agencia.id}>
                      {agencia.banco_sigla} — Ag {agencia.agencia} / CC {agencia.numero}{agencia.digito ? `-${agencia.digito}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[170px]">
              <Label className="mb-1 block">Competência</Label>
              <Input type="month" value={mes} onChange={event => setMes(event.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedEmpresa ? (
        <div className="rounded-lg border-2 border-dashed py-14 text-center text-sm text-muted-foreground">
          Selecione uma empresa para consultar a medição.
        </div>
      ) : query.isLoading ? (
        <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : query.isError ? (
        <Card className="border-destructive/40">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="mx-auto mb-2 h-7 w-7 text-destructive" />
            <p className="font-medium">Não foi possível carregar as divergências.</p>
            <p className="mt-1 text-sm text-muted-foreground">{extractApiError(query.error)}</p>
          </CardContent>
        </Card>
      ) : semMedicao ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Scale className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
            <p className="font-semibold">Ainda não há medição neste escopo.</p>
            <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
              O recurso é novo e precisa de execuções do NEO para acumular avaliações de divergência.
            </p>
          </CardContent>
        </Card>
      ) : semConflito ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Classificações avaliadas" value={formatNumber(data?.total_avaliadas)} />
            <MetricCard label="Classificações divergentes" value="0" />
            <MetricCard label="Percentual divergente" value="0%" />
            <MetricCard label="Valor total envolvido" value={formatCurrency(data?.valor_total_divergente)} featured />
          </div>
          <Card className="border-emerald-200 bg-emerald-50/60">
            <CardContent className="py-10 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-9 w-9 text-emerald-600" />
              <p className="font-semibold text-emerald-900">Nenhum conflito encontrado nas classificações medidas.</p>
              <p className="mt-1 text-sm text-emerald-700">{formatNumber(data?.total_avaliadas)} classificações foram avaliadas neste escopo.</p>
            </CardContent>
          </Card>
        </>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Classificações avaliadas" value={formatNumber(data.total_avaliadas)} />
            <MetricCard label="Classificações divergentes" value={formatNumber(data.total_divergentes)} />
            <MetricCard label="Percentual divergente" value={`${data.percentual_divergentes.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`} />
            <MetricCard label="Valor total envolvido" value={formatCurrency(data.valor_total_divergente)} featured />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-lg">Conflitos por par de contas</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead><tr className="border-b text-muted-foreground"><th className="px-2 py-3 text-left">Conta pela regra</th><th className="px-2 py-3 text-left">Conta pela contraparte</th><th className="px-2 py-3 text-right">Quantidade</th><th className="px-2 py-3 text-right">Valor</th></tr></thead>
                <tbody>{porConta.map((item, index) => <tr key={`${item.conta_regra_id}-${item.conta_contraparte_id}-${index}`} className="border-b last:border-0"><td className="px-2 py-3">{contaLabel(item.conta_regra_codigo, item.conta_regra_descricao)}</td><td className="px-2 py-3">{contaLabel(item.conta_contraparte_codigo, item.conta_contraparte_descricao)}</td><td className="px-2 py-3 text-right tabular-nums">{formatNumber(item.quantidade)}</td><td className="px-2 py-3 text-right font-medium tabular-nums">{formatCurrency(item.valor_total)}</td></tr>)}</tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Amostra para conferência</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              {data.amostra.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">A medição registrou conflitos, mas não retornou itens na amostra.</p> : (
                <table className="w-full min-w-[980px] text-sm">
                  <thead><tr className="border-b text-muted-foreground"><th className="px-2 py-3 text-left">Histórico</th><th className="px-2 py-3 text-left">Evidência</th><th className="px-2 py-3 text-left">Conta pela regra</th><th className="px-2 py-3 text-left">Conta pela contraparte</th><th className="px-2 py-3 text-right">Valor</th></tr></thead>
                  <tbody>{data.amostra.map(item => <tr key={item.decisao_id} className="border-b align-top last:border-0"><td className="max-w-[260px] px-2 py-3"><p className="break-words">{item.historico || '—'}</p><p className="mt-1 font-mono text-xs text-muted-foreground" title={item.transacao_id}>Transação {item.transacao_id}</p></td><td className="px-2 py-3">{item.origem_evidencia || '—'}</td><td className="px-2 py-3">{contaLabel(item.conta_regra_codigo, item.conta_regra_descricao)}</td><td className="px-2 py-3">{contaLabel(item.conta_contraparte_codigo, item.conta_contraparte_descricao)}</td><td className="px-2 py-3 text-right font-medium tabular-nums">{formatCurrency(item.valor)}</td></tr>)}</tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

function MetricCard({ label, value, featured = false }: { label: string; value: string; featured?: boolean }) {
  return (
    <Card className={featured ? 'border-amber-300 bg-amber-50' : undefined}>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`mt-1 font-bold tabular-nums ${featured ? 'text-3xl text-amber-900' : 'text-2xl'}`}>{value}</p>
      </CardContent>
    </Card>
  )
}
