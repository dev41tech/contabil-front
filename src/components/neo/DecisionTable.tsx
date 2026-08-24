import { Loader2, Link2, BookOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { formatCurrency, formatDate } from '@/lib/utils'

const RESULTADO_COLORS: Record<string, 'success' | 'warning' | 'secondary' | 'destructive' | 'outline'> = {
  associada: 'success',
  sem_regra: 'warning',
  ambiguo: 'secondary',
  erro: 'destructive',
}

interface DecisionTableProps {
  items: any[]
  total: number
  page: number
  pageSize: number
  isLoading: boolean
  isError: boolean
  emptyMessage: string
  onPageChange: (page: number) => void
  onRetry: () => void
  onAssociar: (decisao: any) => void
  onCriarRegra: (decisao: any) => void
}

export function DecisionTable({
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
  onCriarRegra,
}: DecisionTableProps) {
  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="font-medium">Não foi possível carregar as decisões.</p>
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
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="w-28 px-2 py-3 text-left">Data</th>
              <th className="px-2 py-3 text-left">Transação</th>
              <th className="w-28 px-2 py-3 text-right">Valor</th>
              <th className="w-20 px-2 py-3 text-center">D/C</th>
              <th className="px-2 py-3 text-left">Regra / Conta</th>
              <th className="w-36 px-2 py-3 text-left">Motivo</th>
              <th className="w-24 px-2 py-3 text-center">Resultado</th>
              <th className="w-36 px-2 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map(d => (
              <tr key={d.id} className="border-b transition-colors hover:bg-muted/50">
                {/* Data do LANÇAMENTO, não a do processamento. A coluna mostrava
                    `processado_em`, então todos os itens de um mesmo processamento
                    saíam com a mesma data — inútil para achar um lançamento. O
                    `title` guarda quando o motor decidiu, que ainda serve para
                    suporte. */}
                <td
                  className="whitespace-nowrap px-2 py-2 text-xs text-muted-foreground"
                  title={d.processado_em ? `Classificado em ${formatDate(d.processado_em)}` : undefined}
                >
                  {d.transacao_data ? formatDate(d.transacao_data) : '—'}
                </td>
                <td className="max-w-[200px] truncate px-2 py-2">{d.transacao_descricao ?? d.transacao_id}</td>
                <td className="whitespace-nowrap px-2 py-2 text-right font-mono">
                  {d.transacao_valor != null ? formatCurrency(d.transacao_valor) : '—'}
                </td>
                <td className="px-2 py-2 text-center">
                  <Badge variant="outline">{d.transacao_dc === 'D' ? 'Débito' : d.transacao_dc === 'C' ? 'Crédito' : '—'}</Badge>
                </td>
                <td className="max-w-[220px] px-2 py-2">
                  <div className="truncate text-muted-foreground" title={d.regra_descricao ?? ''}>{d.regra_descricao ?? d.regra_id ?? '—'}</div>
                  {(d.conta_codigo || d.conta_descricao) && (
                    <div className="truncate text-xs" title={[d.conta_codigo, d.conta_descricao].filter(Boolean).join(' — ')}>
                      {[d.conta_codigo, d.conta_descricao].filter(Boolean).join(' — ')}
                    </div>
                  )}
                </td>
                <td className="max-w-[144px] truncate px-2 py-2 text-xs text-muted-foreground" title={d.motivo ?? ''}>{d.motivo ?? '—'}</td>
                <td className="px-2 py-2 text-center"><Badge variant={RESULTADO_COLORS[d.resultado] ?? 'outline'}>{d.resultado}</Badge></td>
                <td className="px-2 py-2 text-center">
                  {d.resultado === 'sem_regra' && (
                    <div className="flex justify-center gap-1">
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onAssociar(d)}>
                        <Link2 className="h-3 w-3" />Associar
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onCriarRegra(d)}>
                        <BookOpen className="h-3 w-3" />Regra
                      </Button>
                    </div>
                  )}
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
