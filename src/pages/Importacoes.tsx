import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, FileX2, Inbox, Loader2, Trash2, Upload } from 'lucide-react'
import { api } from '@/lib/api'
import { formatDate, extractApiError } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Importacao {
  id: string
  nome_arquivo: string
  created_at: string
  importadas: number
  transacoes_ativas: number
  rejeitadas: number
  cancelada_em: string | null
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

/** "2026-03-14T…" -> { chave: "2026-03", titulo: "Março de 2026" } */
function competenciaDoUpload(createdAt: string) {
  const d = new Date(createdAt)
  const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  return { chave, titulo: `${MESES[d.getMonth()]} de ${d.getFullYear()}` }
}

function extensao(nomeArquivo: string) {
  const parte = nomeArquivo.split('.').pop() ?? ''
  return parte.toUpperCase().slice(0, 4)
}

/**
 * Todo arquivo que entrou no sistema, num módulo só.
 *
 * Isto morava dentro do Extrato, como mais um card acima da tabela de
 * transações — e disputava a tela justamente com o que a pessoa foi ali ver.
 * Aqui os uploads ficam agrupados por mês, com o que cada arquivo trouxe e o
 * desfazer de cada um; o Extrato voltou a ser só os lançamentos.
 *
 * Hoje lista os arquivos de extrato bancário, que é o que a API expõe
 * (/empresas/{id}/extrato/importacoes). Cartão e aplicações vão precisar de
 * endpoints equivalentes para entrarem aqui.
 */
export default function ImportacoesPage() {
  const { empresa } = useEmpresa()
  const empresaId = empresa?.id ?? ''
  const qc = useQueryClient()

  const [alvo, setAlvo] = useState<Importacao | null>(null)
  const [motivo, setMotivo] = useState('')
  const [busca, setBusca] = useState('')

  const { data, isLoading, isError, refetch } = useQuery<{ items: Importacao[] }>({
    queryKey: ['extrato-importacoes', empresaId],
    queryFn: () =>
      api.get(`/empresas/${empresaId}/extrato/importacoes?page_size=100`).then(r => r.data),
    enabled: !!empresaId,
  })

  const cancelar = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      api.post(`/empresas/${empresaId}/extrato/importacoes/${id}/cancelar`, { motivo }),
    onSuccess: res => {
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

  const grupos = useMemo(() => {
    const items = (data?.items ?? []).filter(imp =>
      imp.nome_arquivo.toLowerCase().includes(busca.trim().toLowerCase())
    )
    const porMes = new Map<string, { titulo: string; arquivos: Importacao[] }>()
    for (const imp of items) {
      const { chave, titulo } = competenciaDoUpload(imp.created_at)
      if (!porMes.has(chave)) porMes.set(chave, { titulo, arquivos: [] })
      porMes.get(chave)!.arquivos.push(imp)
    }
    return [...porMes.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([chave, grupo]) => ({ chave, ...grupo }))
  }, [data, busca])

  const total = data?.items?.length ?? 0

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.01em]">Importações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todo arquivo que entrou no sistema, o que ele trouxe e o que já virou lançamento.
          </p>
        </div>
        <Button asChild>
          <Link to="/extrato">
            <Upload className="h-4 w-4" />
            Importar OFX / PDF
          </Link>
        </Button>
      </div>

      {!empresaId ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Selecione uma empresa na barra lateral para ver os arquivos importados.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Barra de ferramentas */}
          <div className="flex items-center gap-2.5">
            <Input
              compact
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome do arquivo"
              className="max-w-md"
            />
            <span className="tnum ml-auto text-sm text-muted-foreground">
              {total} {total === 1 ? 'arquivo' : 'arquivos'}
            </span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <p className="text-sm text-destructive">Não foi possível carregar os arquivos importados.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar de novo</Button>
              </CardContent>
            </Card>
          ) : grupos.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Inbox className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {busca ? 'Nenhum arquivo com esse nome.' : 'Nenhum arquivo importado ainda.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-5">
              {grupos.map(grupo => (
                <section key={grupo.chave}>
                  <div className="mb-2.5 flex items-baseline gap-2">
                    <h2 className="text-base font-semibold">{grupo.titulo}</h2>
                    <span className="tnum text-badge text-muted-foreground">
                      {grupo.arquivos.length} {grupo.arquivos.length === 1 ? 'arquivo' : 'arquivos'}
                    </span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {grupo.arquivos.map(imp => (
                      <ArquivoCard key={imp.id} imp={imp} onDesfazer={() => setAlvo(imp)} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {/* Desfazer a importação inteira */}
      <Dialog open={!!alvo} onOpenChange={aberto => { if (!aberto) { setAlvo(null); setMotivo('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desfazer importação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Arquivo: <span className="font-mono text-foreground">{alvo?.nome_arquivo}</span>
            </p>
            <p>
              As <strong className="tnum">{alvo?.transacoes_ativas}</strong> transações deste arquivo serão
              removidas. As que já tinham sido classificadas têm o lançamento cancelado antes — senão
              sobrariam partidas no razão sem transação que as explicasse.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="motivo-desfazer">Motivo</Label>
              <Input
                id="motivo-desfazer"
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Ex.: arquivo do mês errado"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAlvo(null); setMotivo('') }}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={cancelar.isPending || motivo.trim().length < 3}
              onClick={() => alvo && cancelar.mutate({ id: alvo.id, motivo: motivo.trim() })}
            >
              {cancelar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Desfazer importação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ArquivoCard({ imp, onDesfazer }: { imp: Importacao; onDesfazer: () => void }) {
  const desfeita = !!imp.cancelada_em
  const semTransacoes = imp.transacoes_ativas === 0

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={extensao(imp.nome_arquivo) === 'OFX' ? 'info' : 'outline'} className="gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          {extensao(imp.nome_arquivo)}
        </Badge>
        {desfeita ? (
          <Badge variant="secondary" className="gap-1.5">
            <FileX2 className="h-3.5 w-3.5" />
            Desfeita em {formatDate(imp.cancelada_em!)}
          </Badge>
        ) : imp.rejeitadas > 0 ? (
          <Badge variant="warning" className="tnum">{imp.rejeitadas} recusadas</Badge>
        ) : (
          <Badge variant="success">Concluída</Badge>
        )}
      </div>

      <p className="truncate font-mono text-sm" title={imp.nome_arquivo}>{imp.nome_arquivo}</p>

      {/* transacoes_ativas diverge de importadas assim que alguma linha é
          removida — mostrar os dois evita a pergunta "importou 89, por que só
          tem 74?". */}
      <div className="grid grid-cols-3 gap-2 border-y border-border py-3">
        <div>
          <p className="tnum text-card-title font-semibold leading-tight">{imp.importadas}</p>
          <p className="text-xs text-muted-foreground">Importadas</p>
        </div>
        <div>
          <p className="tnum text-card-title font-semibold leading-tight">{imp.transacoes_ativas}</p>
          <p className="text-xs text-muted-foreground">No sistema</p>
        </div>
        <div>
          <p className={`tnum text-card-title font-semibold leading-tight ${imp.rejeitadas ? 'text-warning' : ''}`}>
            {imp.rejeitadas}
          </p>
          <p className="text-xs text-muted-foreground">Recusadas</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs text-muted-foreground">Enviado em {formatDate(imp.created_at)}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button asChild variant="outline" size="xs">
            <Link to="/extrato">Ver lançamentos</Link>
          </Button>
          {!desfeita && (
            <Button
              variant="destructive"
              size="xs"
              disabled={semTransacoes}
              title={
                semTransacoes
                  ? 'Este arquivo não tem mais transações no sistema'
                  : 'Remove as transações que vieram deste arquivo'
              }
              onClick={onDesfazer}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Desfazer
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
