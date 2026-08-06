import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/api'
import { formatDate, extractApiError } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Pagination } from '@/components/ui/pagination'
import { Zap, Loader2, Link2, BookOpen } from 'lucide-react'
import { useEmpresas } from '@/hooks/useEmpresas'

// ── Cores por resultado ────────────────────────────────────────────────────────
const RESULTADO_COLORS: Record<string, any> = {
  associada: 'success',
  sem_regra: 'warning',
  ambiguo: 'secondary',
  erro: 'destructive',
}

// ── Schemas de formulário ──────────────────────────────────────────────────────
const associarManualSchema = z.object({
  conta_id: z.string().uuid('Selecione uma conta'),
  descricao: z.string().min(2, 'Mínimo 2 caracteres').max(500),
})

const criarRegraSchema = z.object({
  conta_id: z.string().uuid('Selecione uma conta'),
  descricao: z.string().min(2, 'Mínimo 2 caracteres').max(500),
  historico: z.string().min(2).max(500),
  dc: z.enum(['D', 'C']),
  tipo: z.enum(['automatica', 'manual']),
  manter_historico: z.boolean(),
})

type AssociarManualForm = z.infer<typeof associarManualSchema>
type CriarRegraForm = z.infer<typeof criarRegraSchema>

// ── Componente ────────────────────────────────────────────────────────────────
export default function NeoPage() {
  const qc = useQueryClient()
  const [selectedEmpresa, setSelectedEmpresa] = useState('')
  const [processResult, setProcessResult] = useState<any>(null)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  // Estado dos modais
  const [associarDecisao, setAssociarDecisao] = useState<any>(null)
  const [criarRegraDecisao, setCriarRegraDecisao] = useState<any>(null)

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: empresas = [] } = useEmpresas()

  const { data: decisoes, isLoading } = useQuery<any>({
    queryKey: ['neo-decisoes', selectedEmpresa, page],
    queryFn: () =>
      api
        .get(`/empresas/${selectedEmpresa}/neo/decisoes?page=${page}&page_size=${PAGE_SIZE}`)
        .then(r => r.data),
    enabled: !!selectedEmpresa,
  })

  // Plano de contas para os modais (carregado quando empresa selecionada)
  const { data: planoConta = [] } = useQuery<any[]>({
    queryKey: ['plano-contas', selectedEmpresa],
    queryFn: () =>
      api
        .get(`/empresas/${selectedEmpresa}/plano-contas`)
        .then(r => r.data.items ?? r.data),
    enabled: !!selectedEmpresa,
  })

  // ── Mutations ────────────────────────────────────────────────────────────────
  const processMutation = useMutation({
    mutationFn: () => api.post(`/empresas/${selectedEmpresa}/neo/processar`, {}),
    onSuccess: (res) => {
      setProcessResult(res.data)
      qc.invalidateQueries({ queryKey: ['neo-decisoes', selectedEmpresa] })
      qc.invalidateQueries({ queryKey: ['extrato', selectedEmpresa] })
    },
    onError: (e: unknown) =>
      toast({ title: 'Erro ao processar NEO', description: extractApiError(e), variant: 'destructive' }),
  })

  const associarManualMutation = useMutation({
    mutationFn: ({ decisaoId, body }: { decisaoId: string; body: AssociarManualForm }) =>
      api.post(`/empresas/${selectedEmpresa}/neo/decisoes/${decisaoId}/associar-manual`, body),
    onSuccess: () => {
      toast({ title: 'Transação associada com sucesso!', variant: 'success' })
      setAssociarDecisao(null)
      qc.invalidateQueries({ queryKey: ['neo-decisoes', selectedEmpresa] })
      qc.invalidateQueries({ queryKey: ['extrato', selectedEmpresa] })
    },
    onError: (e: unknown) =>
      toast({ title: 'Erro ao associar', description: extractApiError(e), variant: 'destructive' }),
  })

  const criarRegraMutation = useMutation({
    mutationFn: (body: any) =>
      api.post(`/empresas/${selectedEmpresa}/regras`, body),
    onSuccess: () => {
      toast({ title: 'Regra criada com sucesso!', variant: 'success' })
      setCriarRegraDecisao(null)
    },
    onError: (e: unknown) =>
      toast({ title: 'Erro ao criar regra', description: extractApiError(e), variant: 'destructive' }),
  })

  // ── Formulários ───────────────────────────────────────────────────────────────
  const associarForm = useForm<AssociarManualForm>({
    resolver: zodResolver(associarManualSchema),
    defaultValues: { conta_id: '', descricao: '' },
  })

  const regraForm = useForm<CriarRegraForm>({
    resolver: zodResolver(criarRegraSchema),
    defaultValues: { conta_id: '', descricao: '', historico: '', dc: 'D', tipo: 'automatica', manter_historico: false },
  })

  function openAssociar(decisao: any) {
    associarForm.reset({ conta_id: '', descricao: decisao.transacao_descricao ?? '' })
    setAssociarDecisao(decisao)
  }

  function openCriarRegra(decisao: any) {
    regraForm.reset({
      conta_id: '',
      descricao: decisao.transacao_descricao ?? '',
      historico: decisao.transacao_descricao ?? '',
      dc: decisao.transacao_dc ?? 'D',
      tipo: 'automatica',
      manter_historico: false,
    })
    setCriarRegraDecisao(decisao)
  }

  function submitAssociar(data: AssociarManualForm) {
    associarManualMutation.mutate({ decisaoId: associarDecisao.id, body: data })
  }

  function submitCriarRegra(data: CriarRegraForm) {
    criarRegraMutation.mutate({
      ...data,
      agencia_id: criarRegraDecisao?.agencia_id,
    })
  }

  // ── Dados ────────────────────────────────────────────────────────────────────
  const items: any[] = decisoes?.items ?? []
  const total: number = decisoes?.total ?? 0

  const contaOptions = planoConta.map((c: any) => ({
    value: c.id,
    label: `${c.codigo ? c.codigo + ' — ' : ''}${c.descricao}`,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">NEO — Conciliação Automática</h1>
        <p className="text-muted-foreground">Aplica regras de categorização às transações pendentes</p>
      </div>

      {/* Controles */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <label className="text-sm font-medium mb-1 block">Empresa</label>
              <SearchableSelect
                value={selectedEmpresa}
                onValueChange={v => { setSelectedEmpresa(v); setProcessResult(null) }}
                options={empresas.map((e: any) => ({ value: e.id, label: e.razao_social }))}
                placeholder="Selecione a empresa"
                searchPlaceholder="Buscar empresa..."
              />
            </div>
            <Button
              onClick={() => processMutation.mutate()}
              disabled={!selectedEmpresa || processMutation.isPending}
              className="bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              {processMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processando...</>
              ) : (
                <><Zap className="h-4 w-4 mr-2" />Executar NEO</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultado do processamento */}
      {processResult && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800 text-lg">Resultado do Processamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Associadas', value: processResult.associadas },
                { label: 'Sem Regra', value: processResult.sem_regra },
                { label: 'Erros', value: processResult.erros },
                { label: 'Pendentes', value: processResult.total_pendentes },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <p className="text-2xl font-bold text-green-700">{value ?? 0}</p>
                  <p className="text-sm text-green-600">{label}</p>
                </div>
              ))}
            </div>
            {/* Auto-associations (Tasks 5 & 6) */}
            {(processResult.comprovantes_associados > 0 || processResult.notas_associadas > 0) && (
              <div className="mt-4 pt-4 border-t border-green-200 grid grid-cols-2 gap-4">
                {processResult.comprovantes_associados > 0 && (
                  <div className="text-center">
                    <p className="text-xl font-bold text-green-700">{processResult.comprovantes_associados}</p>
                    <p className="text-xs text-green-600">Comprovantes vinculados</p>
                  </div>
                )}
                {processResult.notas_associadas > 0 && (
                  <div className="text-center">
                    <p className="text-xl font-bold text-green-700">{processResult.notas_associadas}</p>
                    <p className="text-xs text-green-600">Notas fiscais vinculadas</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Histórico de decisões */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Decisões</CardTitle>
          <CardDescription>Últimas decisões do motor NEO</CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedEmpresa ? (
            <p className="text-muted-foreground text-center py-8">Selecione uma empresa</p>
          ) : isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma decisão registrada ainda.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-3 px-2 w-28">Data</th>
                      <th className="text-left py-3 px-2">Transação</th>
                      <th className="text-left py-3 px-2">Regra</th>
                      <th className="text-left py-3 px-2 max-w-[160px]">Motivo</th>
                      <th className="text-center py-3 px-2 w-24">Resultado</th>
                      <th className="text-center py-3 px-2 w-36">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((d: any) => (
                      <tr key={d.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="py-2 px-2 whitespace-nowrap text-xs text-muted-foreground">
                          {formatDate(d.processado_em)}
                        </td>
                        <td className="py-2 px-2 max-w-[200px] truncate">
                          {d.transacao_descricao ?? d.transacao_id}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">
                          {d.regra_descricao ?? d.regra_id ?? '—'}
                        </td>
                        <td
                          className="py-2 px-2 text-xs text-muted-foreground max-w-[160px] truncate"
                          title={d.motivo ?? ''}
                        >
                          {d.motivo ?? '—'}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Badge variant={RESULTADO_COLORS[d.resultado] ?? 'outline'}>
                            {d.resultado}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-center">
                          {d.resultado === 'sem_regra' && (
                            <div className="flex gap-1 justify-center">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs px-2"
                                title="Associar manualmente a uma conta"
                                onClick={() => openAssociar(d)}
                              >
                                <Link2 className="h-3 w-3 mr-1" />
                                Associar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs px-2"
                                title="Criar regra para esse padrão"
                                onClick={() => openCriarRegra(d)}
                              >
                                <BookOpen className="h-3 w-3 mr-1" />
                                Regra
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal: Associar manual */}
      <Dialog open={!!associarDecisao} onOpenChange={o => { if (!o) setAssociarDecisao(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Associar manualmente</DialogTitle>
          </DialogHeader>
          <form onSubmit={associarForm.handleSubmit(submitAssociar)} className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Transação: <span className="font-medium text-foreground">{associarDecisao?.transacao_descricao}</span>
              </p>
            </div>
            <div className="space-y-1">
              <Label>Conta contábil</Label>
              <SearchableSelect
                value={associarForm.watch('conta_id')}
                onValueChange={v => associarForm.setValue('conta_id', v, { shouldValidate: true })}
                options={contaOptions}
                placeholder="Selecione a conta..."
                searchPlaceholder="Buscar conta..."
                emptyText="Nenhuma conta encontrada."
              />
              {associarForm.formState.errors.conta_id && (
                <p className="text-xs text-destructive">{associarForm.formState.errors.conta_id.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input {...associarForm.register('descricao')} placeholder="Ex: Pagamento de fornecedor" />
              {associarForm.formState.errors.descricao && (
                <p className="text-xs text-destructive">{associarForm.formState.errors.descricao.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAssociarDecisao(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={associarManualMutation.isPending}>
                {associarManualMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Associar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Criar regra */}
      <Dialog open={!!criarRegraDecisao} onOpenChange={o => { if (!o) setCriarRegraDecisao(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar regra de categorização</DialogTitle>
          </DialogHeader>
          <form onSubmit={regraForm.handleSubmit(submitCriarRegra)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <Label>Conta contábil</Label>
                <SearchableSelect
                  value={regraForm.watch('conta_id')}
                  onValueChange={v => regraForm.setValue('conta_id', v, { shouldValidate: true })}
                  options={contaOptions}
                  placeholder="Selecione a conta..."
                  searchPlaceholder="Buscar conta..."
                />
                {regraForm.formState.errors.conta_id && (
                  <p className="text-xs text-destructive">{regraForm.formState.errors.conta_id.message}</p>
                )}
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Histórico (padrão de match)</Label>
                <Input
                  {...regraForm.register('historico')}
                  placeholder="Ex: PIX ENVIADO JOAO"
                />
                <p className="text-xs text-muted-foreground">
                  Texto do extrato que vai ativar esta regra (case-insensitive).
                </p>
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Descrição</Label>
                <Input {...regraForm.register('descricao')} placeholder="Ex: Compras no mercado" />
              </div>
              <div className="space-y-1">
                <Label>D/C</Label>
                <Select
                  value={regraForm.watch('dc')}
                  onValueChange={v => regraForm.setValue('dc', v as 'D' | 'C')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="D">D — Débito</SelectItem>
                    <SelectItem value="C">C — Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select
                  value={regraForm.watch('tipo')}
                  onValueChange={v => regraForm.setValue('tipo', v as 'automatica' | 'manual')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automatica">Automática</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCriarRegraDecisao(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={criarRegraMutation.isPending}>
                {criarRegraMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Criar regra
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
