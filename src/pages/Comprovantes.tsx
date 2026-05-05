import { useState, useRef } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Pagination } from '@/components/ui/pagination'
import { Plus, Loader2, Link2, Unlink, FileText, Eye } from 'lucide-react'

const comprovanteSchema = z.object({
  favorecido: z.string().optional(),
  cpf_cnpj: z.string().optional(),
  data_pagamento: z.string().optional(),
  data_vencimento: z.string().optional(),
  valor_pago: z.coerce.number().positive('Valor obrigatório'),
  valor_documento: z.coerce.number().optional(),
  juros: z.coerce.number().min(0).optional(),
  multa: z.coerce.number().min(0).optional(),
  desconto: z.coerce.number().min(0).optional(),
  observacao: z.string().optional(),
})
type ComprovanteForm = z.infer<typeof comprovanteSchema>

const PAGE_SIZE = 20

export default function ComprovantesPage() {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedEmpresa, setSelectedEmpresa] = useEmpresaDefault()
  const [statusFiltro, setStatusFiltro] = useState('todos')
  const [page, setPage] = useState(1)
  const [openCreate, setOpenCreate] = useState(false)
  const [openAssociar, setOpenAssociar] = useState<string | null>(null)
  const [openArquivo, setOpenArquivo] = useState<any | null>(null)
  const [pendingFile, setPendingFile] = useState<{ nome: string; base64: string } | null>(null)

  const { data: empresas = [] } = useQuery<any[]>({
    queryKey: ['empresas'],
    queryFn: () => api.get('/empresas').then(r => r.data.items ?? r.data),
  })

  const buildParams = () => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('page_size', String(PAGE_SIZE))
    if (statusFiltro !== 'todos') p.set('status', statusFiltro)
    return p.toString()
  }

  const { data: comprovantes, isLoading } = useQuery<any>({
    queryKey: ['comprovantes', selectedEmpresa, statusFiltro, page],
    queryFn: () => api.get(`/empresas/${selectedEmpresa}/comprovantes?${buildParams()}`).then(r => r.data),
    enabled: !!selectedEmpresa,
  })

  const { data: transacoesPendentes = [] } = useQuery<any[]>({
    queryKey: ['extrato-pendentes', selectedEmpresa],
    queryFn: () => api.get(`/empresas/${selectedEmpresa}/extrato?status=pendente&page_size=100`).then(r => r.data.items ?? []),
    enabled: !!selectedEmpresa && !!openAssociar,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ComprovanteForm>({
    resolver: zodResolver(comprovanteSchema),
  })

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: ComprovanteForm) => api.post(`/empresas/${selectedEmpresa}/comprovantes`, {
      ...data,
      data_pagamento: data.data_pagamento ? new Date(data.data_pagamento).toISOString() : undefined,
      data_vencimento: data.data_vencimento ? new Date(data.data_vencimento).toISOString() : undefined,
      arquivo_nome: pendingFile?.nome,
      arquivo_base64: pendingFile?.base64,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comprovantes', selectedEmpresa] })
      toast({ title: 'Comprovante criado!', variant: 'success' })
      setOpenCreate(false)
      reset()
      setPendingFile(null)
    },
    onError: (e: unknown) => toast({ title: 'Erro ao criar', description: extractApiError(e), variant: 'destructive' }),
  })

  const associarMutation = useMutation({
    mutationFn: ({ id, transacaoId }: { id: string; transacaoId: string }) =>
      api.post(`/empresas/${selectedEmpresa}/comprovantes/${id}/associar`, { transacao_id: transacaoId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comprovantes', selectedEmpresa] })
      toast({ title: 'Comprovante associado!', variant: 'success' })
      setOpenAssociar(null)
    },
    onError: (e: unknown) => toast({ title: 'Erro ao associar', description: extractApiError(e), variant: 'destructive' }),
  })

  const desassociarMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/empresas/${selectedEmpresa}/comprovantes/${id}/associar`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comprovantes', selectedEmpresa] })
      toast({ title: 'Associação removida.', variant: 'default' })
    },
    onError: (e: unknown) => toast({ title: 'Erro', description: extractApiError(e), variant: 'destructive' }),
  })

  const deletarMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/empresas/${selectedEmpresa}/comprovantes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comprovantes', selectedEmpresa] })
      toast({ title: 'Comprovante excluído.', variant: 'default' })
    },
    onError: (e: unknown) => toast({ title: 'Erro ao excluir', description: extractApiError(e), variant: 'destructive' }),
  })

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      setPendingFile({ nome: file.name, base64 })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const verArquivo = async (comprovante: any) => {
    if (!comprovante.tem_arquivo) return
    const res = await api.get(`/empresas/${selectedEmpresa}/comprovantes/${comprovante.id}/arquivo`, {
      responseType: 'blob',
    })
    const url = URL.createObjectURL(res.data)
    setOpenArquivo({ url, nome: comprovante.arquivo_nome ?? 'comprovante' })
  }

  const items: any[] = comprovantes?.items ?? []
  const total: number = comprovantes?.total ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Comprovantes</h1>
          <p className="text-muted-foreground">Comprovantes de pagamento vinculados ao extrato</p>
        </div>
        {selectedEmpresa && (
          <Button onClick={() => setOpenCreate(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo Comprovante
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="text-sm font-medium mb-1 block">Empresa</label>
              <Select value={selectedEmpresa} onValueChange={v => { setSelectedEmpresa(v); setPage(1) }}>
                <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.razao_social}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[140px]">
              <label className="text-sm font-medium mb-1 block">Status</label>
              <Select value={statusFiltro} onValueChange={v => { setStatusFiltro(v); setPage(1) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="associado">Associados</SelectItem>
                  <SelectItem value="nao_associado">Não Associados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(statusFiltro !== 'todos') && (
              <Button variant="ghost" size="sm" className="self-end" onClick={() => { setStatusFiltro('todos'); setPage(1) }}>
                Limpar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>
            Comprovantes{' '}
            {total > 0 && <span className="text-base font-normal text-muted-foreground">({total} total)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedEmpresa ? (
            <p className="text-muted-foreground text-center py-8">Selecione uma empresa para ver os comprovantes</p>
          ) : isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum comprovante encontrado.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-3 px-2">Dt Pgto</th>
                      <th className="text-left py-3 px-2">Favorecido</th>
                      <th className="text-left py-3 px-2">CPF/CNPJ</th>
                      <th className="text-right py-3 px-2">Valor Pago</th>
                      <th className="text-right py-3 px-2">Juros</th>
                      <th className="text-right py-3 px-2">Multa</th>
                      <th className="text-right py-3 px-2">Desconto</th>
                      <th className="text-center py-3 px-2">Arquivo</th>
                      <th className="text-center py-3 px-2">Status</th>
                      <th className="text-center py-3 px-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((c: any) => (
                      <tr key={c.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="py-2 px-2 whitespace-nowrap">{c.data_pagamento ? formatDate(c.data_pagamento) : '—'}</td>
                        <td className="py-2 px-2 max-w-[180px] truncate">{c.favorecido || '—'}</td>
                        <td className="py-2 px-2 font-mono text-xs">{c.cpf_cnpj || '—'}</td>
                        <td className="py-2 px-2 text-right font-mono">{formatCurrency(c.valor_pago)}</td>
                        <td className="py-2 px-2 text-right font-mono text-xs">{(c.juros ?? 0) > 0 ? formatCurrency(c.juros) : '—'}</td>
                        <td className="py-2 px-2 text-right font-mono text-xs">{(c.multa ?? 0) > 0 ? formatCurrency(c.multa) : '—'}</td>
                        <td className="py-2 px-2 text-right font-mono text-xs">{(c.desconto ?? 0) > 0 ? formatCurrency(c.desconto) : '—'}</td>
                        <td className="py-2 px-2 text-center">
                          {c.tem_arquivo ? (
                            <Button variant="ghost" size="sm" onClick={() => verArquivo(c)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Badge variant={c.transacao_id ? 'success' : 'outline'}>
                            {c.transacao_id ? 'Associado' : 'Pendente'}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex gap-1 justify-center">
                            {!c.transacao_id ? (
                              <Button variant="ghost" size="sm" onClick={() => setOpenAssociar(c.id)} title="Associar transação">
                                <Link2 className="h-4 w-4 text-blue-500" />
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" onClick={() => desassociarMutation.mutate(c.id)} title="Remover associação">
                                <Unlink className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
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

      {/* Modal Novo Comprovante */}
      <Dialog open={openCreate} onOpenChange={v => { setOpenCreate(v); if (!v) { reset(); setPendingFile(null) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Comprovante</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 col-span-2">
                <Label>Favorecido</Label>
                <Input placeholder="Nome do favorecido" {...register('favorecido')} />
              </div>
              <div className="space-y-1">
                <Label>CPF/CNPJ</Label>
                <Input placeholder="000.000.000-00" {...register('cpf_cnpj')} />
              </div>
              <div className="space-y-1">
                <Label>Valor Pago *</Label>
                <Input type="number" step="0.01" placeholder="0,00" {...register('valor_pago')} />
                {errors.valor_pago && <p className="text-xs text-destructive">{errors.valor_pago.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Valor do Documento</Label>
                <Input type="number" step="0.01" placeholder="0,00" {...register('valor_documento')} />
              </div>
              <div className="space-y-1">
                <Label>Data Pagamento</Label>
                <Input type="date" {...register('data_pagamento')} />
              </div>
              <div className="space-y-1">
                <Label>Data Vencimento</Label>
                <Input type="date" {...register('data_vencimento')} />
              </div>
              <div className="space-y-1">
                <Label>Juros</Label>
                <Input type="number" step="0.01" placeholder="0,00" {...register('juros')} />
              </div>
              <div className="space-y-1">
                <Label>Multa</Label>
                <Input type="number" step="0.01" placeholder="0,00" {...register('multa')} />
              </div>
              <div className="space-y-1">
                <Label>Desconto</Label>
                <Input type="number" step="0.01" placeholder="0,00" {...register('desconto')} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Observação</Label>
                <Input placeholder="Opcional" {...register('observacao')} />
              </div>
            </div>

            {/* Anexo */}
            <div className="space-y-1">
              <Label>Arquivo anexo (PDF, JPG, PNG)</Label>
              <div className="flex gap-2 items-center">
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <FileText className="h-4 w-4 mr-2" />
                  {pendingFile ? pendingFile.nome : 'Selecionar arquivo'}
                </Button>
                {pendingFile && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPendingFile(null)}>
                    Remover
                  </Button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFileSelect} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpenCreate(false); reset(); setPendingFile(null) }}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : 'Criar Comprovante'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Associar Transação */}
      <Dialog open={!!openAssociar} onOpenChange={v => { if (!v) setOpenAssociar(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Associar a uma Transação</DialogTitle>
          </DialogHeader>
          {transacoesPendentes.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">Nenhuma transação pendente encontrada.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-2">Data</th>
                    <th className="text-left py-2 px-2">Histórico</th>
                    <th className="text-right py-2 px-2">Valor</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {transacoesPendentes.map((t: any) => (
                    <tr key={t.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2 whitespace-nowrap">{formatDate(t.data_transacao)}</td>
                      <td className="py-2 px-2 max-w-xs truncate">{t.descricao || t.memo || '—'}</td>
                      <td className={`py-2 px-2 text-right font-mono ${t.valor < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(t.valor)}
                      </td>
                      <td className="py-2 px-2">
                        <Button size="sm" onClick={() => openAssociar && associarMutation.mutate({ id: openAssociar, transacaoId: t.id })}>
                          Associar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAssociar(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal visualização de arquivo */}
      <Dialog open={!!openArquivo} onOpenChange={v => { if (!v) setOpenArquivo(null) }}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{openArquivo?.nome}</DialogTitle>
          </DialogHeader>
          {openArquivo?.url && (
            <iframe src={openArquivo.url} className="w-full h-[60vh] border rounded" title="Comprovante" />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenArquivo(null)}>Fechar</Button>
            {openArquivo?.url && (
              <Button asChild>
                <a href={openArquivo.url} download={openArquivo.nome}>Baixar</a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
