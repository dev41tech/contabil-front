import { Loader2, FileX2, Undo2, Link2, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Desfeita {
  lancamento_id: string
  transacao_id: string
  transacao_data: string | null
  transacao_descricao: string | null
  valor: number
  dc: string
  conta_descricao: string
  cancelado_em: string
  cancelado_por_nome: string | null
  motivo_cancelamento: string | null
  importacao_id: string | null
  importacao_arquivo: string | null
  lote_cancelado: boolean
  transacao_status: string | null
  decisao_atual_id: string | null
}

interface DesfeitasListProps {
  items: Desfeita[]
  total: number
  page: number
  pageSize: number
  isLoading: boolean
  onPageChange: (page: number) => void
  onAssociar: (decisao: { id: string; transacao_descricao: string | null }) => void
}

/**
 * Agrupa por lote apenas o que foi desfeito EM lote.
 *
 * Uma classificação desfeita sozinha, mesmo tendo vindo de um upload, aparece
 * solta — agrupá-la sob o arquivo sugeriria que o upload inteiro caiu, o que é
 * outra coisa. O backend distingue os dois casos com `lote_cancelado`.
 */
function agrupar(items: Desfeita[]) {
  const grupos: Array<{ chave: string; arquivo: string | null; itens: Desfeita[] }> = []
  for (const item of items) {
    const chave = item.lote_cancelado && item.importacao_id ? item.importacao_id : `avulso:${item.lancamento_id}`
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.chave === chave) {
      ultimo.itens.push(item)
    } else {
      grupos.push({
        chave,
        arquivo: item.lote_cancelado ? item.importacao_arquivo : null,
        itens: [item],
      })
    }
  }
  return grupos
}

function Linha({
  item,
  onAssociar,
}: {
  item: Desfeita
  onAssociar: DesfeitasListProps['onAssociar']
}) {
  // Desfazer só faz sentido para reclassificar, e caçar a transação entre
  // centenas de pendências seria atrito à toa. O botão some assim que ela
  // volta a ser classificada — oferecê-lo ali levaria a um 409.
  const podeReclassificar = item.transacao_status === 'pendente' && !!item.decisao_atual_id
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b py-2 text-sm last:border-b-0">
      <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
        {item.transacao_data ? formatDate(item.transacao_data) : '—'}
      </span>
      <span className="min-w-[180px] flex-1 truncate" title={item.transacao_descricao ?? ''}>
        {item.transacao_descricao ?? item.transacao_id}
      </span>
      <span className="truncate text-xs text-muted-foreground" title={item.conta_descricao}>
        {item.conta_descricao}
      </span>
      <span className={`w-28 shrink-0 text-right font-mono tabular-nums ${item.dc === 'D' ? 'text-red-600' : 'text-emerald-600'}`}>
        {item.dc === 'D' ? '-' : '+'}{formatCurrency(item.valor)}
      </span>
      <span className="w-36 shrink-0 text-right">
        {podeReclassificar ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() =>
              onAssociar({
                id: item.decisao_atual_id as string,
                transacao_descricao: item.transacao_descricao,
              })
            }
          >
            <Link2 className="h-3 w-3" />Classificar
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" />Já reclassificada
          </span>
        )}
      </span>
    </div>
  )
}

export function DesfeitasList({
  items,
  total,
  page,
  pageSize,
  isLoading,
  onPageChange,
  onAssociar,
}: DesfeitasListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Nenhuma classificação foi desfeita neste escopo.
      </p>
    )
  }

  const grupos = agrupar(items)

  return (
    <div className="space-y-4">
      {grupos.map(grupo => {
        const primeiro = grupo.itens[0]
        const emLote = grupo.arquivo !== null
        return (
          <div
            key={grupo.chave}
            className={emLote ? 'rounded-md border border-orange-200 bg-orange-50/50' : 'rounded-md border'}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2">
              {emLote ? (
                <>
                  <FileX2 className="h-4 w-4 shrink-0 text-orange-600" />
                  <span className="font-medium">Importação desfeita</span>
                  <span className="truncate font-mono text-xs text-muted-foreground" title={grupo.arquivo ?? ''}>
                    {grupo.arquivo}
                  </span>
                  {/* O contador precisa ver o tamanho do estrago sem contar linhas. */}
                  <Badge variant="outline">
                    {grupo.itens.length === 1 ? '1 lançamento' : `${grupo.itens.length} lançamentos`}
                  </Badge>
                </>
              ) : (
                <>
                  <Undo2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium">Classificação desfeita</span>
                </>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {formatDate(primeiro.cancelado_em)}
                {primeiro.cancelado_por_nome ? ` · ${primeiro.cancelado_por_nome}` : ''}
              </span>
            </div>
            {primeiro.motivo_cancelamento && (
              <p className="border-b px-3 py-1.5 text-xs text-muted-foreground">
                Motivo: {primeiro.motivo_cancelamento}
              </p>
            )}
            <div className="px-3">
              {grupo.itens.map(item => (
                <Linha key={item.lancamento_id} item={item} onAssociar={onAssociar} />
              ))}
            </div>
          </div>
        )
      })}
      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} />
    </div>
  )
}
