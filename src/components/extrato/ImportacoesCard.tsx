import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, FileX2, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { formatDate, extractApiError } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ImportacoesCardProps {
  empresaId: string
  agenciaId?: string
}

/**
 * Uploads de extrato e o desfazer de cada um.
 *
 * Existe porque "subi o arquivo errado" não tinha saída pela tela: dava para
 * importar, não para desimportar. Desfazer aqui remove as transações daquele
 * arquivo e, nas que já tinham sido classificadas, cancela o lançamento antes —
 * senão sobrariam partidas no razão sem transação que as explicasse.
 */
export function ImportacoesCard({ empresaId, agenciaId }: ImportacoesCardProps) {
  const qc = useQueryClient()
  const [alvo, setAlvo] = useState<any>(null)
  const [motivo, setMotivo] = useState('')

  const { data, isLoading } = useQuery<any>({
    queryKey: ['extrato-importacoes', empresaId, agenciaId],
    queryFn: () => {
      const params = new URLSearchParams({ page_size: '20' })
      if (agenciaId) params.set('agencia_id', agenciaId)
      return api.get(`/empresas/${empresaId}/extrato/importacoes?${params}`).then(r => r.data)
    },
    enabled: !!empresaId,
  })

  const cancelar = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      api.post(`/empresas/${empresaId}/extrato/importacoes/${id}/cancelar`, { motivo }),
    onSuccess: (res) => {
      const d = res.data
      toast({
        title: 'Importação desfeita',
        description:
          `${d.transacoes_removidas} transações removidas` +
          (d.lancamentos_cancelados
            ? `, ${d.lancamentos_cancelados} com lançamento cancelado.`
            : '.'),
        variant: 'success',
      })
      setAlvo(null)
      setMotivo('')
      qc.invalidateQueries({ queryKey: ['extrato-importacoes', empresaId] })
      qc.invalidateQueries({ queryKey: ['extrato', empresaId] })
      // A fila do NEO e a aba Desfeitas mudam junto.
      qc.invalidateQueries({ queryKey: ['neo-decisoes', empresaId] })
      qc.invalidateQueries({ queryKey: ['neo-desfeitas', empresaId] })
      qc.invalidateQueries({ queryKey: ['neo-resumo', empresaId] })
      qc.invalidateQueries({ queryKey: ['neo-pendencias-agrupadas', empresaId] })
    },
    onError: (e: unknown) =>
      toast({
        title: 'Não foi possível desfazer',
        description: extractApiError(e),
        variant: 'destructive',
      }),
  })

  const items = data?.items ?? []

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Arquivos importados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum arquivo importado ainda.
            </p>
          ) : (
            <div className="divide-y">
              {items.map((imp: any) => (
                <div key={imp.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                  <span className="min-w-[160px] flex-1 truncate font-mono text-xs" title={imp.nome_arquivo}>
                    {imp.nome_arquivo}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(imp.created_at)}</span>
                  {/* `transacoes_ativas` diverge de `importadas` assim que alguma
                      linha é removida — mostrar os dois evita a pergunta
                      "importou 89, por que só tem 74?". */}
                  <Badge variant="outline" className="tabular-nums">
                    {imp.transacoes_ativas} de {imp.importadas}
                  </Badge>
                  {imp.rejeitadas > 0 && (
                    <Badge variant="warning" className="tabular-nums">
                      {imp.rejeitadas} recusadas
                    </Badge>
                  )}
                  {imp.cancelada_em ? (
                    <span className="flex items-center gap-1 text-xs text-orange-700">
                      <FileX2 className="h-3.5 w-3.5" />
                      Desfeita em {formatDate(imp.cancelada_em)}
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={imp.transacoes_ativas === 0}
                      title={
                        imp.transacoes_ativas === 0
                          ? 'Este arquivo não tem mais transações no sistema'
                          : 'Remove as transações que vieram deste arquivo'
                      }
                      onClick={() => setAlvo(imp)}
                    >
                      <Trash2 className="h-3 w-3" />Desfazer
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!alvo} onOpenChange={open => { if (!open) { setAlvo(null); setMotivo('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Desfazer importação</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Arquivo: <span className="font-mono text-foreground">{alvo?.nome_arquivo}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              As <strong>{alvo?.transacoes_ativas}</strong> transações deste arquivo serão
              removidas. As que já estiverem classificadas têm o lançamento contábil
              desfeito antes, e aparecem na aba <strong>Desfeitas</strong> do NEO.
              Notas e comprovantes vinculados ficam livres, não são excluídos.
            </p>
            <div className="space-y-1">
              <Label>Motivo</Label>
              <Input
                autoFocus
                placeholder="Ex.: arquivo do mês errado"
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setAlvo(null); setMotivo('') }}>
              Voltar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={motivo.trim().length < 3 || cancelar.isPending}
              onClick={() => cancelar.mutate({ id: alvo.id, motivo: motivo.trim() })}
            >
              {cancelar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Desfazer importação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
