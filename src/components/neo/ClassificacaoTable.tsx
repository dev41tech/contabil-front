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
 * oferece Associar, classificada oferece Alterar.
 */
import { Loader2, Link2, BookOpen, Pencil, Undo2 } from 'lucide-react'
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
  historico: string
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
  onCriarRegra: (linha: LinhaClassificacao) => void
  onDesfazer: (linha: LinhaClassificacao) => void
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
  onCriarRegra,
  onDesfazer,
}: ClassificacaoTableProps) {
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
              <th className="w-28 px-2 py-3 text-left">Data</th>
              <th className="px-2 py-3 text-left">Histórico</th>
              <th className="w-8 px-2 py-3 text-center">D/C</th>
              <th className="w-32 px-2 py-3 text-right">Valor</th>
              <th className="w-28 px-2 py-3 text-center">Status</th>
              <th className="w-44 px-2 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map(linha => (
              <tr key={linha.key} className="border-b transition-colors hover:bg-muted/50">
                <td className="whitespace-nowrap px-2 py-2">
                  {linha.data ? formatDate(linha.data) : '—'}
                </td>
                <td className="max-w-sm px-2 py-2">
                  <div className="truncate" title={linha.historico}>{linha.historico || '-'}</div>
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
                      <>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onAssociar(linha)}>
                          <Link2 className="h-3 w-3" />Associar
                        </Button>
                        {/* Criar regra sai da linha porque a fila agrupada saiu:
                            sem isto, não haveria mais de onde nascer uma regra
                            a partir de um lançamento real. */}
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onCriarRegra(linha)}>
                          <BookOpen className="h-3 w-3" />Regra
                        </Button>
                      </>
                    )}
                    {/* Alterar e Desfazer dependem de lançamento VIGENTE. Uma
                        classificação já desfeita continua no log, e oferecer as
                        ações ali levaria a um 404. */}
                    {linha.status === 'associada' && linha.lancamentoId && (
                      <>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onAlterar(linha)}>
                          <Pencil className="h-3 w-3" />Alterar
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onDesfazer(linha)}>
                          <Undo2 className="h-3 w-3" />Desfazer
                        </Button>
                      </>
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
