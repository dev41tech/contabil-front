import { useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { api } from '@/lib/api'
import { extractApiError, formatCurrency, formatDate } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface LinhaRazao { data: string; valor: string; historico: string; lote: string; contrapartida: string }
interface LinhaExtrato { transacao_id: string; data: string; valor: string; historico: string }
interface Grupo { tipo: string; razao: LinhaRazao[]; extrato: LinhaExtrato[]; diferenca: string }
interface Relatorio {
  resumo: {
    empresa: string; conta_razao: string; conta_bancaria: string
    periodo_inicio: string; periodo_fim: string
    lancamentos_razao: number; lancamentos_extrato: number
    conciliados: number; pendencias: number
    movimento_razao: string; movimento_extrato: string; diferenca: string
    diferenca_explicada: boolean
    abertura: LinhaRazao[]
    aplicacao_sem_extrato?: number
  }
  avisos: string[]
  conciliados_por_tipo: Record<string, number>
  pendencias: Grupo[]
  // Aplicação automática do razão que o extrato não traz (internet banking).
  // Não conferida: fica fora das pendências, com aviso.
  aplicacao_sem_extrato?: LinhaRazao[]
}

const ROTULOS: Record<string, string> = {
  DUPLICIDADE_RAZAO: 'Possível duplicidade no razão',
  DUPLICIDADE_EXTRATO: 'Possível duplicidade no extrato',
  VALOR_DIVERGENTE: 'Valor divergente',
  SO_RAZAO: 'Só no razão',
  SO_EXTRATO: 'Só no extrato',
  CONCILIADO: 'Conciliado',
  DATA_DIFERENTE: 'Data diferente',
  AGRUPADO: 'Agrupado',
}

const VARIANTE: Record<string, any> = {
  DUPLICIDADE_RAZAO: 'warning',
  DUPLICIDADE_EXTRATO: 'warning',
  VALOR_DIVERGENTE: 'warning',
  SO_RAZAO: 'destructive',
  SO_EXTRATO: 'destructive',
}

/**
 * Razão da conta banco × extrato já importado no sistema.
 *
 * Só relata: nada é gravado nem ajustado. Mesmo relatório RAZÃO que a aba de
 * fornecedores recebe, mas por outro caminho — sem FIFO, sem criar fornecedor.
 */
export default function RazaoExtratoTab({ empresaId }: { empresaId: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [agenciaId, setAgenciaId] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null)
  const [filtro, setFiltro] = useState<string>('todos')

  const { data: agencias = [] } = useQuery<any[]>({
    // Inclui as inativas: o razão de uma conta encerrada continua conciliável.
    queryKey: ['agencias', empresaId],
    queryFn: () => api.get(`/empresas/${empresaId}/agencias`).then(r => r.data.items ?? r.data),
    enabled: !!empresaId,
  })

  const enviar = (formato: 'json' | 'xlsx') => {
    const form = new FormData()
    form.append('arquivo', arquivo!)
    return api.post(
      `/empresas/${empresaId}/concilpro/razao-extrato?agencia_id=${agenciaId}&formato=${formato}`,
      form,
      formato === 'xlsx' ? { responseType: 'blob' } : undefined,
    )
  }

  const conciliar = useMutation({
    mutationFn: () => enviar('json').then(r => r.data as Relatorio),
    onMutate: () => setRelatorio(null),
    onSuccess: data => { setRelatorio(data); setFiltro('todos') },
    onError: (e: unknown) =>
      toast({ title: 'Não foi possível conciliar', description: extractApiError(e), variant: 'destructive' }),
  })

  const exportar = useMutation({
    mutationFn: () => enviar('xlsx'),
    onSuccess: res => {
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      const r = relatorio?.resumo
      a.href = url
      a.download = `conciliacao_${r?.conta_razao.split(' ')[0] ?? 'conta'}_${r?.periodo_inicio.slice(0, 7) ?? ''}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    },
    onError: (e: unknown) =>
      toast({ title: 'Não foi possível exportar', description: extractApiError(e), variant: 'destructive' }),
  })

  const r = relatorio?.resumo
  const contagem = (relatorio?.pendencias ?? []).reduce<Record<string, number>>((acc, g) => {
    acc[g.tipo] = (acc[g.tipo] ?? 0) + 1
    return acc
  }, {})
  const pendencias = (relatorio?.pendencias ?? []).filter(g => filtro === 'todos' || g.tipo === filtro)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Razão × Extrato</CardTitle>
          <CardDescription>
            Envie o razão contábil de uma conta bancária (Excel ou PDF). Ele é cruzado com o extrato já importado
            desta conta no mesmo período, e o sistema aponta as pendências. Nada é alterado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end flex-wrap">
            <div className="min-w-[260px]">
              <label className="text-sm font-medium mb-1 block" htmlFor="razao-extrato-conta">Conta bancária</label>
              <Select value={agenciaId} onValueChange={v => { setAgenciaId(v); setRelatorio(null) }}>
                <SelectTrigger id="razao-extrato-conta"><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                <SelectContent>
                  {agencias.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.banco_sigla} {a.agencia}/{a.numero}{a.ativa === false ? ' (inativa)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="razao-extrato-arquivo">Razão da conta</label>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                {arquivo ? arquivo.name : 'Escolher arquivo'}
              </Button>
              <input
                id="razao-extrato-arquivo"
                ref={fileRef}
                type="file"
                accept=".xlsx,.XLSX,.xls,.XLS,.pdf,.PDF"
                className="hidden"
                onChange={e => { setArquivo(e.target.files?.[0] ?? null); setRelatorio(null); e.target.value = '' }}
              />
            </div>

            <Button onClick={() => conciliar.mutate()} disabled={!agenciaId || !arquivo || conciliar.isPending}>
              {conciliar.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Conciliando…</> : 'Conciliar'}
            </Button>

            {relatorio && (
              <Button variant="outline" onClick={() => exportar.mutate()} disabled={exportar.isPending}>
                {exportar.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                Exportar planilha
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            O razão precisa ser de uma única conta, e o extrato do período já precisa estar importado.
          </p>
        </CardContent>
      </Card>

      {relatorio && r && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {r.conta_razao} · {formatDate(r.periodo_inicio)} a {formatDate(r.periodo_fim)}
              </CardTitle>
              <CardDescription>{r.conta_bancaria}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <Numero rotulo="Lançamentos no razão" valor={r.lancamentos_razao} />
                <Numero rotulo="Lançamentos no extrato" valor={r.lancamentos_extrato} />
                <Numero rotulo="Conciliados" valor={r.conciliados} />
                <Numero rotulo="Pendências" valor={r.pendencias} destaque={r.pendencias > 0} />
                <Numero rotulo="Movimento do razão" valor={formatCurrency(Number(r.movimento_razao))} />
                <Numero rotulo="Movimento do extrato" valor={formatCurrency(Number(r.movimento_extrato))} />
                <Numero rotulo="Diferença" valor={formatCurrency(Number(r.diferenca))} destaque={Number(r.diferenca) !== 0} />
                <div>
                  <p className="text-xs text-muted-foreground">As pendências explicam a diferença?</p>
                  {r.diferenca_explicada
                    ? <p className="flex items-center gap-1 font-semibold text-success"><CheckCircle2 className="h-4 w-4" />Sim</p>
                    : <p className="flex items-center gap-1 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" />Não — revisar</p>}
                </div>
              </div>

              {r.abertura.map((a, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  Abertura do período, fora das pendências: {formatDate(a.data)} · {a.historico} · {formatCurrency(Number(a.valor))}
                </p>
              ))}

              {relatorio.avisos.map((aviso, i) => (
                <p key={i} role="alert" className="flex items-start gap-2 text-sm text-warning">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{aviso}
                </p>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pendências</CardTitle>
              <div className="flex gap-2 flex-wrap pt-2">
                <Button size="sm" variant={filtro === 'todos' ? 'default' : 'outline'} onClick={() => setFiltro('todos')}>
                  Todas ({relatorio.pendencias.length})
                </Button>
                {Object.entries(contagem).map(([tipo, n]) => (
                  <Button key={tipo} size="sm" variant={filtro === tipo ? 'default' : 'outline'} onClick={() => setFiltro(tipo)}>
                    {ROTULOS[tipo] ?? tipo} ({n})
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {pendencias.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma pendência. Razão e extrato conferem.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 px-2">Tipo</th>
                        <th className="text-left py-2 px-2">Razão</th>
                        <th className="text-left py-2 px-2">Extrato</th>
                        <th className="text-right py-2 px-2">Diferença</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendencias.map((g, i) => (
                        <tr key={i} className="border-b align-top">
                          <td className="py-2 px-2"><Badge variant={VARIANTE[g.tipo] ?? 'outline'}>{ROTULOS[g.tipo] ?? g.tipo}</Badge></td>
                          <td className="py-2 px-2 space-y-1">
                            {g.razao.length === 0 && <span className="text-muted-foreground">—</span>}
                            {g.razao.map((l, j) => (
                              <div key={j}>
                                <span className="font-mono">{formatDate(l.data)} · {formatCurrency(Number(l.valor))}</span>
                                <span className="block text-xs">{l.historico}</span>
                                <span className="block text-xs text-muted-foreground">
                                  Lote {l.lote || '—'}{l.contrapartida ? ` · Contrapartida ${l.contrapartida}` : ''}
                                </span>
                              </div>
                            ))}
                          </td>
                          <td className="py-2 px-2 space-y-1">
                            {g.extrato.length === 0 && <span className="text-muted-foreground">—</span>}
                            {g.extrato.map((l, j) => (
                              <div key={j}>
                                <span className="font-mono">{formatDate(l.data)} · {formatCurrency(Number(l.valor))}</span>
                                <span className="block text-xs">{l.historico}</span>
                              </div>
                            ))}
                          </td>
                          <td className="py-2 px-2 text-right font-mono">{formatCurrency(Number(g.diferenca))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {(relatorio.aplicacao_sem_extrato?.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Aplicação automática não conferida ({relatorio.aplicacao_sem_extrato!.length})
                </CardTitle>
                <CardDescription>
                  O extrato importado não traz estes lançamentos do razão. Eles ficam fora das pendências:
                  confira no extrato consolidado ou no relatório de aplicações do banco.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <details>
                  <summary className="cursor-pointer text-sm text-muted-foreground">Ver lançamentos</summary>
                  <div className="overflow-x-auto mt-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2 px-2">Data</th>
                          <th className="text-left py-2 px-2">Histórico</th>
                          <th className="text-left py-2 px-2">Lote</th>
                          <th className="text-left py-2 px-2">Contrapartida</th>
                          <th className="text-right py-2 px-2">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relatorio.aplicacao_sem_extrato!.map((l, i) => (
                          <tr key={i} className="border-b">
                            <td className="py-2 px-2 font-mono">{formatDate(l.data)}</td>
                            <td className="py-2 px-2">{l.historico}</td>
                            <td className="py-2 px-2">{l.lote || '—'}</td>
                            <td className="py-2 px-2">{l.contrapartida || '—'}</td>
                            <td className="py-2 px-2 text-right font-mono">{formatCurrency(Number(l.valor))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function Numero({ rotulo, valor, destaque = false }: { rotulo: string; valor: string | number; destaque?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className={`tnum font-semibold ${destaque ? 'text-warning' : ''}`}>{valor}</p>
    </div>
  )
}
