import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEmpresaDefault } from '@/hooks/useEmpresaDefault'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/api'
import { formatCurrency, formatDate, extractApiError } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Loader2, Pencil, Trash2, TrendingUp, TrendingDown, PiggyBank, Ban, RotateCcw } from 'lucide-react'
import { useEmpresas } from '@/hooks/useEmpresas'

const TIPOS_APLICACAO = [
  { value: 'cdb', label: 'CDB' },
  { value: 'poupanca', label: 'Poupança' },
  { value: 'fundo', label: 'Fundo de Investimento' },
  { value: 'tesouro_direto', label: 'Tesouro Direto' },
  { value: 'lci_lca', label: 'LCI/LCA' },
  { value: 'outros', label: 'Outros' },
]
const TIPO_LABEL: Record<string, string> = Object.fromEntries(TIPOS_APLICACAO.map(t => [t.value, t.label]))

const aplicacaoSchema = z.object({
  instituicao: z.string().min(2, 'Mínimo 2 caracteres'),
  tipo: z.string().min(1, 'Selecione o tipo'),
  descricao: z.string().optional(),
  valor_aplicado: z.coerce.number().positive('Valor deve ser positivo'),
  data_aplicacao: z.string().min(1, 'Data obrigatória'),
  valor_atual: z.coerce.number().optional(),
  data_vencimento: z.string().optional(),
  agencia_id: z.string().optional(),
  observacao: z.string().optional(),
})
type AplicacaoForm = z.infer<typeof aplicacaoSchema>

const valorAtualSchema = z.object({
  valor_atual: z.coerce.number().min(0, 'Valor não pode ser negativo'),
})
type ValorAtualForm = z.infer<typeof valorAtualSchema>

export default function AplicacoesFinanceirasPage() {
  const qc = useQueryClient()
  const [selectedEmpresa, setSelectedEmpresa] = useEmpresaDefault()
  const [apenasAtivas, setApenasAtivas] = useState(false)
  const [openCreate, setOpenCreate] = useState(false)
  const [editValor, setEditValor] = useState<any | null>(null)
  const [deleteAplicacao, setDeleteAplicacao] = useState<any | null>(null)

  const { data: empresas = [] } = useEmpresas()

  const { data: agencias = [] } = useQuery<any[]>({
    queryKey: ['agencias', selectedEmpresa],
    queryFn: () => api.get(`/empresas/${selectedEmpresa}/agencias`).then(r => r.data.items ?? r.data),
    enabled: !!selectedEmpresa,
  })

  const { data, isLoading } = useQuery<any>({
    queryKey: ['aplicacoes-financeiras', selectedEmpresa, apenasAtivas],
    queryFn: () => api.get(`/empresas/${selectedEmpresa}/aplicacoes-financeiras?apenas_ativas=${apenasAtivas}`).then(r => r.data),
    enabled: !!selectedEmpresa,
  })

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<AplicacaoForm>({
    resolver: zodResolver(aplicacaoSchema),
    defaultValues: { tipo: 'cdb' },
  })

  const valorForm = useForm<ValorAtualForm>({ resolver: zodResolver(valorAtualSchema) })

  const invalidar = () => qc.invalidateQueries({ queryKey: ['aplicacoes-financeiras', selectedEmpresa] })

  const createMutation = useMutation({
    mutationFn: (d: AplicacaoForm) => api.post(`/empresas/${selectedEmpresa}/aplicacoes-financeiras`, {
      instituicao: d.instituicao,
      tipo: d.tipo,
      descricao: d.descricao || undefined,
      valor_aplicado: d.valor_aplicado,
      data_aplicacao: new Date(d.data_aplicacao).toISOString(),
      valor_atual: d.valor_atual || undefined,
      data_vencimento: d.data_vencimento ? new Date(d.data_vencimento).toISOString() : undefined,
      agencia_id: d.agencia_id || undefined,
      observacao: d.observacao || undefined,
    }),
    onSuccess: () => {
      invalidar()
      toast({ title: 'Aplicação financeira registrada!', variant: 'success' })
      setOpenCreate(false)
      reset({ tipo: 'cdb' })
    },
    onError: (e: unknown) => toast({ title: 'Erro ao registrar', description: extractApiError(e), variant: 'destructive' }),
  })

  const atualizarValorMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: ValorAtualForm }) =>
      api.patch(`/empresas/${selectedEmpresa}/aplicacoes-financeiras/${id}`, { valor_atual: d.valor_atual }),
    onSuccess: () => {
      invalidar()
      toast({ title: 'Valor atualizado!', variant: 'success' })
      setEditValor(null)
    },
    onError: (e: unknown) => toast({ title: 'Erro ao atualizar', description: extractApiError(e), variant: 'destructive' }),
  })

  const alternarAtivaMutation = useMutation({
    mutationFn: ({ id, ativa }: { id: string; ativa: boolean }) =>
      api.patch(`/empresas/${selectedEmpresa}/aplicacoes-financeiras/${id}`, { ativa }),
    onSuccess: (_res, { ativa }) => {
      invalidar()
      toast({ title: ativa ? 'Aplicação reativada.' : 'Aplicação encerrada.', variant: 'success' })
    },
    onError: (e: unknown) => toast({ title: 'Erro', description: extractApiError(e), variant: 'destructive' }),
  })

  const deletarMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/empresas/${selectedEmpresa}/aplicacoes-financeiras/${id}`),
    onSuccess: () => {
      invalidar()
      toast({ title: 'Registro removido.', variant: 'default' })
      setDeleteAplicacao(null)
    },
    onError: (e: unknown) => toast({ title: 'Erro ao remover', description: extractApiError(e), variant: 'destructive' }),
  })

  const items: any[] = data?.items ?? []
  const total: number = data?.total ?? 0
  const valorTotalAplicado: number = data?.valor_total_aplicado ?? 0
  const valorTotalAtual: number = data?.valor_total_atual ?? 0
  const rendimentoTotal = valorTotalAtual - valorTotalAplicado

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Aplicações Financeiras</h1>
          <p className="text-muted-foreground">CDB, poupança, fundos, tesouro direto e outras aplicações da empresa</p>
        </div>
        {selectedEmpresa && (
          <Button onClick={() => setOpenCreate(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova Aplicação
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap items-end">
            <div className="flex-1 min-w-[220px]">
              <label className="text-sm font-medium mb-1 block">Empresa</label>
              <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
                <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.razao_social}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant={apenasAtivas ? 'default' : 'outline'}
              size="sm"
              onClick={() => setApenasAtivas(v => !v)}
            >
              {apenasAtivas ? 'Mostrando só ativas' : 'Mostrar todas'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedEmpresa && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Aplicado</p>
            <p className="text-xl font-bold">{formatCurrency(valorTotalAplicado)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Valor Atual</p>
            <p className="text-xl font-bold">{formatCurrency(valorTotalAtual)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Rendimento</p>
            <p className={`text-xl font-bold flex items-center gap-1 ${rendimentoTotal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {rendimentoTotal >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {formatCurrency(rendimentoTotal)}
            </p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Aplicações</p>
            <p className="text-xl font-bold">{total}</p>
          </CardContent></Card>
        </div>
      )}

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Aplicações {total > 0 && <span className="text-base font-normal text-muted-foreground">({total} total)</span>}</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedEmpresa ? (
            <p className="text-muted-foreground text-center py-8">Selecione uma empresa</p>
          ) : isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <PiggyBank className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma aplicação financeira registrada.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-3 px-2">Instituição</th>
                    <th className="text-left py-3 px-2">Tipo</th>
                    <th className="text-right py-3 px-2">Valor Aplicado</th>
                    <th className="text-right py-3 px-2">Valor Atual</th>
                    <th className="text-right py-3 px-2">Rendimento</th>
                    <th className="text-left py-3 px-2">Aplicação</th>
                    <th className="text-left py-3 px-2">Vencimento</th>
                    <th className="text-center py-3 px-2">Status</th>
                    <th className="text-center py-3 px-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a: any) => (
                    <tr key={a.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-2 px-2 max-w-[180px]">
                        <p className="truncate font-medium">{a.instituicao}</p>
                        {a.descricao && <p className="text-xs text-muted-foreground truncate">{a.descricao}</p>}
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline">{TIPO_LABEL[a.tipo] ?? a.tipo}</Badge>
                      </td>
                      <td className="py-2 px-2 text-right font-mono">{formatCurrency(a.valor_aplicado)}</td>
                      <td className="py-2 px-2 text-right font-mono">
                        {a.valor_atual != null ? formatCurrency(a.valor_atual) : '—'}
                      </td>
                      <td className="py-2 px-2 text-right font-mono">
                        {a.rendimento != null ? (
                          <span className={a.rendimento >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                            {formatCurrency(a.rendimento)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap">{formatDate(a.data_aplicacao)}</td>
                      <td className="py-2 px-2 whitespace-nowrap">{a.data_vencimento ? formatDate(a.data_vencimento) : '—'}</td>
                      <td className="py-2 px-2 text-center">
                        <Badge variant={a.ativa ? 'success' : 'secondary'}>{a.ativa ? 'Ativa' : 'Encerrada'}</Badge>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <div className="flex gap-1 justify-center">
                          <Button
                            size="sm" variant="ghost" className="h-7 px-2"
                            title="Atualizar valor atual"
                            onClick={() => { setEditValor(a); valorForm.reset({ valor_atual: a.valor_atual ?? a.valor_aplicado }) }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm" variant="ghost" className="h-7 px-2"
                            title={a.ativa ? 'Encerrar aplicação' : 'Reativar aplicação'}
                            onClick={() => alternarAtivaMutation.mutate({ id: a.id, ativa: !a.ativa })}
                          >
                            {a.ativa ? <Ban className="h-3.5 w-3.5 text-amber-600" /> : <RotateCcw className="h-3.5 w-3.5 text-emerald-600" />}
                          </Button>
                          <Button
                            size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive"
                            title="Remover registro"
                            onClick={() => setDeleteAplicacao(a)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Nova Aplicação */}
      <Dialog open={openCreate} onOpenChange={v => { setOpenCreate(v); if (!v) reset({ tipo: 'cdb' }) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Aplicação Financeira</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 col-span-2">
                <Label>Instituição</Label>
                <Input placeholder="Ex: Banco do Brasil" {...register('instituicao')} />
                {errors.instituicao && <p className="text-xs text-destructive">{errors.instituicao.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={watch('tipo')} onValueChange={v => setValue('tipo', v, { shouldValidate: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_APLICACAO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Conta bancária <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Select value={watch('agencia_id') ?? ''} onValueChange={v => setValue('agencia_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent>
                    {agencias.map((ag: any) => (
                      <SelectItem key={ag.id} value={ag.id}>{ag.descricao ?? `${ag.banco_sigla} ${ag.agencia}/${ag.numero}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Descrição <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input placeholder="Ex: CDB 110% CDI" {...register('descricao')} />
              </div>
              <div className="space-y-1">
                <Label>Valor Aplicado</Label>
                <Input type="number" step="0.01" placeholder="0,00" {...register('valor_aplicado')} />
                {errors.valor_aplicado && <p className="text-xs text-destructive">{errors.valor_aplicado.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Data da Aplicação</Label>
                <Input type="date" {...register('data_aplicacao')} />
                {errors.data_aplicacao && <p className="text-xs text-destructive">{errors.data_aplicacao.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Valor Atual <span className="text-muted-foreground text-xs">(se já souber)</span></Label>
                <Input type="number" step="0.01" placeholder="0,00" {...register('valor_atual')} />
              </div>
              <div className="space-y-1">
                <Label>Vencimento <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input type="date" {...register('data_vencimento')} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Observação <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input placeholder="..." {...register('observacao')} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : 'Registrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Atualizar Valor Atual */}
      <Dialog open={!!editValor} onOpenChange={v => { if (!v) setEditValor(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Atualizar Valor Atual</DialogTitle>
            {editValor && <p className="text-sm text-muted-foreground">{editValor.instituicao}</p>}
          </DialogHeader>
          <form
            onSubmit={valorForm.handleSubmit(d => editValor && atualizarValorMutation.mutate({ id: editValor.id, d }))}
            className="space-y-4"
          >
            <div className="space-y-1">
              <Label>Valor Atual</Label>
              <Input type="number" step="0.01" placeholder="0,00" {...valorForm.register('valor_atual')} />
              {valorForm.formState.errors.valor_atual && (
                <p className="text-xs text-destructive">{valorForm.formState.errors.valor_atual.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditValor(null)}>Cancelar</Button>
              <Button type="submit" disabled={atualizarValorMutation.isPending}>
                {atualizarValorMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar Exclusão */}
      <Dialog open={!!deleteAplicacao} onOpenChange={v => { if (!v) setDeleteAplicacao(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Remover Registro
            </DialogTitle>
          </DialogHeader>
          {deleteAplicacao && (
            <p className="text-sm text-muted-foreground">
              Remover o registro de <span className="font-semibold text-foreground">{deleteAplicacao.instituicao}</span>?
              Use "Encerrar" em vez de remover se a aplicação foi resgatada — remover apaga o histórico.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAplicacao(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deletarMutation.isPending}
              onClick={() => deletarMutation.mutate(deleteAplicacao.id)}
            >
              {deletarMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Removendo...</> : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
