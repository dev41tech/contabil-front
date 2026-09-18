import { useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react'
import { api } from '@/lib/api'
import { extractApiError, formatCurrency, formatDate } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface LinhaRazao { data: string; valor: string; historico: string; lote: string; contrapartida: string }
interface LinhaExtrato { transacao_id: string; data: string; valor: string; historico: string }
interface LinhaSispag { data: string; valor: string; tipo: string; favorecido: string; documento: string }
interface Grupo {
  tipo: string; razao: LinhaRazao[]; extrato: LinhaExtrato[]; diferenca: string
  // Lote do SISPAG: pago pelo banco, sem lançamento no razão.
  sispag_faltando?: LinhaSispag[]
}
interface ResumoDia {
  data: string
  lancamentos_razao: number; lancamentos_extrato: number
  movimento_razao: string; movimento_extrato: string; diferenca: string
  pendencias: number; data_diferente: number; aplicacao_sem_extrato: number
}
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
  por_dia?: ResumoDia[]
  sispag_usado?: boolean
}

const ROTULOS: Record<string, string> = {
  LOTE_SISPAG: 'Lote do SISPAG',
  LOTE_SISPAG_DIVERGENTE: 'Lote do SISPAG com pagamento fora do razão',
  LOTE_DO_DIA: 'Lote do dia',
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
  LOTE_SISPAG_DIVERGENTE: 'warning',
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
  const sispagRef = useRef<HTMLInputElement>(null)
  const [agenciaId, setAgenciaId] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [sispag, setSispag] = useState<File | null>(null)
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null)
  const [filtro, setFiltro] = useState<string>('todos')
  const [dia, setDia] = useState<string | null>(null)
  const [soDiasComDiferenca, setSoDiasComDiferenca] = useState(true)

  const { data: agencias = [] } = useQuery<any[]>({
    // Inclui as inativas: o razão de uma conta encerrada continua conciliável.
    queryKey: ['agencias', empresaId],
    queryFn: () => api.get(`/empresas/${empresaId}/agencias`).then(r => r.data.items ?? r.data),
    enabled: !!empresaId,
  })

  const enviar = (formato: 'json' | 'xlsx') => {
    const form = new FormData()
    form.append('arquivo', arquivo!)
    if (sispag) form.append('sispag', sispag)
    return api.post(
      `/empresas/${empresaId}/concilpro/razao-extrato?agencia_id=${agenciaId}&formato=${formato}`,
      form,
      formato === 'xlsx' ? { responseType: 'blob' } : undefined,
    )
  }

  const conciliar = useMutation({
    mutationFn: () => enviar('json').then(r => r.data as Relatorio),
    onMutate: () => setRelatorio(null),
    onSuccess: data => { setRelatorio(data); setFiltro('todos'); setDia(null) },
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
  // O dia escolhido filtra tudo abaixo: tipos e lista de pendências.
  const doDia = (relatorio?.pendencias ?? []).filter(
    g => !dia || [...g.razao, ...g.extrato].some(l => l.data === dia),
  )
  const contagem = doDia.reduce<Record<string, number>>((acc, g) => {
    acc[g.tipo] = (acc[g.tipo] ?? 0) + 1
    return acc
  }, {})
  const pendencias = doDia.filter(g => filtro === 'todos' || g.tipo === filtro)
  const dias = (relatorio?.por_dia ?? []).filter(
    d => !soDiasComDiferenca || Number(d.diferenca) !== 0 || d.pendencias > 0,
  )

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

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="razao-extrato-sispag">
                SISPAG <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <div className="flex gap-1">
                <Button variant="outline" onClick={() => sispagRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  {sispag ? sispag.name : 'Consulta de pagamentos'}
                </Button>
                {sispag && (
                  <Button variant="ghost" size="icon" aria-label="Remover SISPAG"
                    onClick={() => { setSispag(null); setRelatorio(null) }}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <input
                id="razao-extrato-sispag"
                ref={sispagRef}
                type="file"
                accept=".xlsx,.XLSX,.xls,.XLS"
                className="hidden"
                onChange={e => { setSispag(e.target.files?.[0] ?? null); setRelatorio(null); e.target.value = '' }}
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
            Com a consulta de pagamentos do SISPAG, os lotes do Itaú (TED e crédito em conta) são
            separados pagamento a pagamento.
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

          {(relatorio.por_dia?.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por dia</CardTitle>
                <CardDescription>
                  Clique num dia para ver só as pendências daquela data.
                </CardDescription>
                <label className="flex items-center gap-2 text-sm pt-1 cursor-pointer w-fit">
                  <input
                    type="checkbox"
                    checked={soDiasComDiferenca}
                    onChange={e => setSoDiasComDiferenca(e.target.checked)}
                  />
                  Só dias com diferença ou pendência
                </label>
              </CardHeader>
              <CardContent>
                {dias.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Todos os dias conferem.</p>
                ) : (
                  <div className="overflow-x-auto max-h-80 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-card">
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2 px-2">Data</th>
                          <th className="text-right py-2 px-2">Razão</th>
                          <th className="text-right py-2 px-2">Extrato</th>
                          <th className="text-right py-2 px-2">Diferença</th>
                          <th className="text-right py-2 px-2">Pendências</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dias.map(d => {
                          const diferente = Number(d.diferenca) !== 0
                          return (
                            <tr
                              key={d.data}
                              onClick={() => setDia(dia === d.data ? null : d.data)}
                              aria-selected={dia === d.data}
                              className={`border-b cursor-pointer hover:bg-muted/50 ${dia === d.data ? 'bg-muted' : ''}`}
                            >
                              <td className="py-2 px-2 font-mono whitespace-nowrap">{formatDate(d.data)}</td>
                              <td className="py-2 px-2 text-right font-mono whitespace-nowrap">
                                {formatCurrency(Number(d.movimento_razao))}
                                <span className="block text-xs text-muted-foreground">{d.lancamentos_razao} lanç.</span>
                              </td>
                              <td className="py-2 px-2 text-right font-mono whitespace-nowrap">
                                {formatCurrency(Number(d.movimento_extrato))}
                                <span className="block text-xs text-muted-foreground">{d.lancamentos_extrato} lanç.</span>
                              </td>
                              <td className={`py-2 px-2 text-right font-mono whitespace-nowrap ${diferente ? 'text-warning font-semibold' : ''}`}>
                                {formatCurrency(Number(d.diferenca))}
                                {d.data_diferente > 0 && (
                                  <span className="block text-xs font-normal text-muted-foreground">
                                    {d.data_diferente} casado(s) em outro dia
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-right">{d.pendencias || '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                Pendências
                {dia && (
                  <Button size="sm" variant="secondary" onClick={() => setDia(null)}>
                    {formatDate(dia)} <X className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </CardTitle>
              <div className="flex gap-2 flex-wrap pt-2">
                <Button size="sm" variant={filtro === 'todos' ? 'default' : 'outline'} onClick={() => setFiltro('todos')}>
                  Todas ({doDia.length})
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
                <p className="text-sm text-muted-foreground text-center py-6">
                  {dia
                    ? `Nenhuma pendência em ${formatDate(dia)}. A diferença do dia vem de lançamento casado em outra data.`
                    : 'Nenhuma pendência. Razão e extrato conferem.'}
                </p>
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
                      {pendencias.map((g, i) => ehLote(g) ? <LinhaLote key={i} grupo={g} /> : (
                        <tr key={i} className="border-b align-top">
                          <td className="py-2 px-2"><Badge variant={VARIANTE[g.tipo] ?? 'outline'}>{ROTULOS[g.tipo] ?? g.tipo}</Badge></td>
                          <td className="py-2 px-2 space-y-1">
                            {g.razao.length === 0 && <span className="text-muted-foreground">—</span>}
                            {g.razao.map((l, j) => (
                              <div key={j}>
                                <span className="font-mono whitespace-nowrap">{formatDate(l.data)} · {formatCurrency(Number(l.valor))}</span>
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
                                <span className="font-mono whitespace-nowrap">{formatDate(l.data)} · {formatCurrency(Number(l.valor))}</span>
                                <span className="block text-xs">{l.historico}</span>
                              </div>
                            ))}
                            {(g.sispag_faltando?.length ?? 0) > 0 && (
                              <div className="mt-2 rounded border border-warning/40 p-2">
                                <p className="text-xs font-medium text-warning">Pago no banco, sem lançamento no razão:</p>
                                {g.sispag_faltando!.map((p, j) => (
                                  <p key={j} className="text-xs">
                                    <span className="font-mono whitespace-nowrap">{formatCurrency(Number(p.valor))}</span>
                                    {' · '}{p.favorecido}{p.documento ? ` (${p.documento})` : ''} · {p.tipo}
                                  </p>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right font-mono whitespace-nowrap">{formatCurrency(Number(g.diferenca))}</td>
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

// Lote (vários lançamentos de um lado, ou pagamento do SISPAG faltando) não cabe
// nas colunas da tabela: 23 lançamentos empilhados escondiam o que importa, que
// é o pagamento sem par. Aqui ele vem primeiro, e a composição fica recolhida.
function ehLote(g: Grupo) {
  return g.razao.length + g.extrato.length > 3 || (g.sispag_faltando?.length ?? 0) > 0
}

const soma = (linhas: { valor: string }[]) => linhas.reduce((s, l) => s + Number(l.valor), 0)
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

function LinhaLote({ grupo: g }: { grupo: Grupo }) {
  const faltando = g.sispag_faltando ?? []
  const data = (g.extrato[0] ?? g.razao[0])?.data
  const diferenca = Number(g.diferenca)

  return (
    <tr className="border-b">
      <td colSpan={4} className="py-3 px-2">
        <div className="rounded-md border p-3 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={VARIANTE[g.tipo] ?? 'outline'}>{ROTULOS[g.tipo] ?? g.tipo}</Badge>
              {data && <span className="font-mono text-sm">{formatDate(data)}</span>}
            </div>
            <span className={`font-mono font-semibold whitespace-nowrap ${diferenca !== 0 ? 'text-warning' : ''}`}>
              Diferença {formatCurrency(diferenca)}
            </span>
          </div>

          {faltando.length > 0 && (
            <div role="alert" className="rounded-md border border-warning/40 bg-warning/15 p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-warning">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {faltando.length === 1
                  ? 'Pago pelo banco neste lote, sem lançamento no razão'
                  : `${faltando.length} pagamentos do lote feitos pelo banco, sem lançamento no razão`}
              </p>
              <ul className="mt-2 space-y-1">
                {faltando.map((p, j) => (
                  <li key={j} className="flex items-baseline justify-between gap-4 text-sm">
                    <span>
                      <span className="font-medium">{p.favorecido}</span>
                      <span className="text-muted-foreground">
                        {p.documento ? ` · ${p.documento}` : ''} · {p.tipo}
                      </span>
                    </span>
                    <span className="font-mono font-semibold whitespace-nowrap">{formatCurrency(Number(p.valor))}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Extrato · {plural(g.extrato.length, 'linha', 'linhas')}</p>
              <p className="font-mono whitespace-nowrap">{formatCurrency(soma(g.extrato))}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Razão · {plural(g.razao.length, 'lançamento', 'lançamentos')}</p>
              <p className="font-mono whitespace-nowrap">{formatCurrency(soma(g.razao))}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Razão − extrato</p>
              <p className={`font-mono whitespace-nowrap ${diferenca !== 0 ? 'text-warning font-semibold' : ''}`}>
                {formatCurrency(diferenca)}
              </p>
            </div>
          </div>

          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground">
              Ver a composição ({plural(g.extrato.length, 'linha', 'linhas')} do extrato,{' '}
              {plural(g.razao.length, 'lançamento', 'lançamentos')} do razão)
            </summary>
            <div className="grid gap-4 lg:grid-cols-[2fr_3fr] mt-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Extrato</p>
                <table className="w-full text-sm">
                  <tbody>
                    {g.extrato.map((l, j) => (
                      <tr key={j} className="border-b last:border-0">
                        <td className="py-1 pr-2 font-mono whitespace-nowrap">{formatDate(l.data)}</td>
                        <td className="py-1 pr-2">{l.historico}</td>
                        <td className="py-1 text-right font-mono whitespace-nowrap">{formatCurrency(Number(l.valor))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Razão</p>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {g.razao.map((l, j) => (
                        <tr key={j} className="border-b last:border-0">
                          <td className="py-1 pr-2">{l.historico}</td>
                          <td className="py-1 pr-2 text-xs text-muted-foreground whitespace-nowrap">
                            Lote {l.lote || '—'}{l.contrapartida ? ` · ${l.contrapartida}` : ''}
                          </td>
                          <td className="py-1 text-right font-mono whitespace-nowrap">{formatCurrency(Number(l.valor))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </details>
        </div>
      </td>
    </tr>
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
