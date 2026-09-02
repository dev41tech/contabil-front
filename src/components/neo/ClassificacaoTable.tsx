/**
 * A tabela da tela de classificação — a MESMA para a fila e para o que já foi
 * classificado.
 *
 * O layout é o da tela de Extrato Bancário de propósito: data, histórico,
 * D/C, valor, status. São as mesmas transações vistas de outro ângulo, e duas
 * telas que apresentam a mesma coisa de formas diferentes obrigam o contador a
 * se reorientar a cada troca de aba.
 *
 * Antes eram dois componentes: uma lista agrupada por padrão bancário ("lotes")
 * e uma tabela de decisões escondida atrás de um "mostrar classificação
 * individual". O agrupamento resolvia muitas linhas de uma vez, mas escondia a
 * transação: para saber o que era cada uma, era preciso abrir o grupo.
 *
 * Uma linha, uma transação, e a ação à direita muda com o status: pendente
 * oferece Associar, classificada oferece Alterar. Só isso — criar regra é na
 * tela de Regras, e desfazer some junto: alterar já substitui o lançamento, e
 * era ele que o contador queria quase sempre que desfazia.
 */
import { Loader2, Link2, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { formatCurrency, formatDate } from '@/lib/utils'

export type StatusLinha = 'pendente' | 'associada' | 'erro'

export interface LinhaClassificacao {
  /** Chave de render. Decisão tem id próprio; pendência sem decisão usa a transação. */
  key: string
  transacaoId: string
  data?: string | null
  /**
   * O que a linha mostra. Na pendente é o texto do extrato; na classificada é
   * o histórico CONTÁBIL do lançamento — o que o contador escreveu ao
   * classificar. Sem isso, alterar a descrição não mudaria nada visível na
   * tela, e o campo pareceria não fazer nada.
   */
  historico: string
  /** Linha crua do banco, quando `historico` já é o contábil. Vai no tooltip. */
  historicoOriginal?: string | null
  valor?: number | string | null
  dc?: string | null
  status: StatusLinha
  /**
   * Segunda linha do histórico. Na classificada é a conta contábil; na
   * pendente é o aviso do motor (valor não confiável, contraparte ambígua) —
   * o texto que explica por que ela continua parada.
   */
  detalhe?: string | null
  agenciaId?: string | null
  /** Só a classificada com lançamento vigente pode ser alterada ou desfeita. */
  lancamentoId?: string | null
}

const STATUS: Record<StatusLinha, { rotulo: string; variant: 'success' | 'warning' | 'destructive' }> = {
  pendente: { rotulo: 'pendente', variant: 'warning' },
  associada: { rotulo: 'associada', variant: 'success' },
  erro: { rotulo: 'erro', variant: 'destructive' },
}

interface ClassificacaoTableProps {
  items: LinhaClassificacao[]
  total: number
  page: number
  pageSize: number
  isLoading: boolean
  isError: boolean
  emptyMessage: string
  onPageChange: (page: number) => void
  onRetry: () => void
  onAssociar: (linha: LinhaClassificacao) => void
  onAlterar: (linha: LinhaClassificacao) => void
  /**
   * Seleção múltipla. Só a fila de pendências liga isto: nas abas de
   * classificadas e desfeitas não existe ação em lote, e uma coluna de
   * marcação que não leva a lugar nenhum é promessa falsa.
   */
  selecionavel?: boolean
  selecionados?: Set<string>
  onAlternarSelecao?: (transacaoId: string) => void
  onAlternarPagina?: (idsDaPagina: string[]) => void
}

export function ClassificacaoTable({
  items,
  total,
  page,
  pageSize,
  isLoading,
  isError,
  emptyMessage,
  onPageChange,
  onRetry,
  onAssociar,
  onAlterar,
  selecionavel = false,
  selecionados,
  onAlternarSelecao,
  onAlternarPagina,
}: ClassificacaoTableProps) {
  const marcados = selecionados ?? new Set<string>()
  // Só entra na marcação da página o que dá para classificar. Marcar "todas" e
  // receber menos do que se contou é pior do que não oferecer a marcação.
  const idsSelecionaveis = items.filter(l => l.status !== 'associada').map(l => l.transacaoId)
  const todasMarcadas = idsSelecionaveis.length > 0 && idsSelecionaveis.every(id => marcados.has(id))
  const algumaMarcada = idsSelecionaveis.some(id => marcados.has(id))

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="font-medium">Não foi possível carregar as transações.</p>
        <p className="text-sm text-muted-foreground">Tente novamente em instantes.</p>
        <Button variant="outline" size="sm" onClick={onRetry}>Tentar novamente</Button>
      </div>
    )
  }

  if (items.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              {selecionavel && (
                <th className="w-8 px-2 py-3 text-center">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5"
                    checked={todasMarcadas}
                    ref={el => { if (el) el.indeterminate = !todasMarcadas && algumaMarcada }}
                    onChange={() => onAlternarPagina?.(idsSelecionaveis)}
                    aria-label="Selecionar as pendências desta página"
                    disabled={idsSelecionaveis.length === 0}
                  />
                </th>
              )}
              <th className="w-28 px-2 py-3 text-left">Data</th>
              <th className="px-2 py-3 text-left">Histórico</th>
              <th className="w-8 px-2 py-3 text-center">D/C</th>
              <th className="w-32 px-2 py-3 text-right">Valor</th>
              <th className="w-28 px-2 py-3 text-center">Status</th>
              <th className="w-32 px-2 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map(linha => (
              <tr
                key={linha.key}
                className={`border-b transition-colors hover:bg-muted/50 ${
                  selecionavel && marcados.has(linha.transacaoId) ? 'bg-muted/40' : ''
                }`}
              >
                {selecionavel && (
                  <td className="px-2 py-2 text-center">
                    {/* Linha já associada não é selecionável: o lote classifica
                        pendências, e oferecer a marcação aqui produziria um
                        "ignorado" silencioso na resposta. */}
                    {linha.status !== 'associada' && (
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5"
                        checked={marcados.has(linha.transacaoId)}
                        onChange={() => onAlternarSelecao?.(linha.transacaoId)}
                        aria-label={`Selecionar lançamento de ${linha.historico || 'sem histórico'}`}
                      />
                    )}
                  </td>
                )}
                <td className="whitespace-nowrap px-2 py-2">
                  {linha.data ? formatDate(linha.data) : '—'}
                </td>
                <td className="max-w-sm px-2 py-2">
                  <div
                    className="truncate"
                    title={linha.historicoOriginal && linha.historicoOriginal !== linha.historico
                      ? `${linha.historico}\n(extrato: ${linha.historicoOriginal})`
                      : linha.historico}
                  >
                    {linha.historico || '-'}
                  </div>
                  {linha.detalhe && (
                    <div className="truncate text-xs text-muted-foreground" title={linha.detalhe}>
                      {linha.detalhe}
                    </div>
                  )}
                </td>
                <td className="px-2 py-2 text-center">
                  {linha.dc ? (
                    <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${linha.dc === 'D' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {linha.dc}
                    </span>
                  ) : '—'}
                </td>
                {/* Mesmo tratamento do Extrato: sinal e cor pelo D/C, para a
                    leitura de uma tela servir na outra sem tradução. */}
                <td className={`whitespace-nowrap px-2 py-2 text-right font-mono ${linha.dc === 'D' ? 'text-red-600' : 'text-emerald-600'}`}>
                  {/* A API devolve Decimal, que chega como string em JSON. */}
                  {linha.valor == null ? '—' : `${linha.dc === 'D' ? '-' : '+'}${formatCurrency(Number(linha.valor))}`}
                </td>
                <td className="px-2 py-2 text-center">
                  <Badge variant={STATUS[linha.status].variant}>{STATUS[linha.status].rotulo}</Badge>
                </td>
                <td className="px-2 py-2">
                  <div className="flex justify-center gap-1">
                    {linha.status !== 'associada' && (
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onAssociar(linha)}>
                        <Link2 className="h-3 w-3" />Associar
                      </Button>
                    )}
                    {/* Alterar depende de lançamento VIGENTE. Uma classificação
                        já desfeita continua no log, e oferecer a ação ali
                        levaria a um 404. */}
                    {linha.status === 'associada' && linha.lancamentoId && (
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onAlterar(linha)}>
                        <Pencil className="h-3 w-3" />Alterar
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} />
    </>
  )
}
