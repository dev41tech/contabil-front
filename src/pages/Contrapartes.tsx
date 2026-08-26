import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/api'
import { extractApiError } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Pagination } from '@/components/ui/pagination'
import { Plus, Loader2, Pencil, Trash2, Contact, Ban, RotateCcw } from 'lucide-react'
import { opcaoConta } from '@/lib/contas'

const TIPOS_CONTRAPARTE = [
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'cliente', label: 'Cliente' },
  { value: 'ambos', label: 'Ambos' },
]
const TIPO_LABEL: Record<string, string> = Object.fromEntries(TIPOS_CONTRAPARTE.map(t => [t.value, t.label]))

const PAGE_SIZE = 20

const contraparteCreateSchema = z.object({
  tipo: z.enum(['fornecedor', 'cliente', 'ambos'], { errorMap: () => ({ message: 'Selecione o tipo' }) }),
  documento: z.string().min(11, 'Informe um CPF ou CNPJ válido'),
  razao_social: z.string().min(2, 'Mínimo 2 caracteres'),
  nome_fantasia: z.string().optional(),
  conta_contabil_id: z.string().uuid('Selecione a conta contábil'),
})
type ContraparteCreateForm = z.infer<typeof contraparteCreateSchema>

const contraparteEditSchema = z.object({
  tipo: z.enum(['fornecedor', 'cliente', 'ambos']),
  razao_social: z.string().min(2, 'Mínimo 2 caracteres'),
  nome_fantasia: z.string().optional(),
  conta_contabil_id: z.string().uuid('Selecione a conta contábil'),
})
type ContraparteEditForm = z.infer<typeof contraparteEditSchema>

export function ContrapartesTab({ empresaId }: { empresaId: string }) {
  const qc = useQueryClient()
  const selectedEmpresa = empresaId
  const [tipoFiltro, setTipoFiltro] = useState('todos')
  const [apenasAtivas, setApenasAtivas] = useState(false)
  const [page, setPage] = useState(1)

  // Busca por texto usa debounce — não dispara uma request por tecla
  const [termoInput, setTermoInput] = useState('')
  const [termo, setTermo] = useState('')
  useEffect(() => {
    const t = setTimeout(() => { setTermo(termoInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [termoInput])

  const [openCreate, setOpenCreate] = useState(false)
  const [editContraparte, setEditContraparte] = useState<any | null>(null)
  const [deleteContraparte, setDeleteContraparte] = useState<any | null>(null)

  const { data: planoContas = [] } = useQuery<any[]>({
    queryKey: ['plano-contas', selectedEmpresa],
    queryFn: () => api.get(`/empresas/${selectedEmpresa}/plano-contas`).then(r => r.data.items ?? r.data),
    enabled: !!selectedEmpresa,
  })
  const contaOptions = planoContas.map((c: any) => opcaoConta(c))

  const buildParams = () => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('page_size', String(PAGE_SIZE))
    if (tipoFiltro !== 'todos') p.set('tipo', tipoFiltro)
    if (apenasAtivas) p.set('apenas_ativas', 'true')
    if (termo) p.set('termo', termo)
    return p.toString()
  }

  const { data, isLoading } = useQuery<any>({
    queryKey: ['contrapartes', selectedEmpresa, tipoFiltro, apenasAtivas, termo, page],
    queryFn: () => api.get(`/empresas/${selectedEmpresa}/contrapartes?${buildParams()}`).then(r => r.data),
    enabled: !!selectedEmpresa,
  })

  const invalidar = () => qc.invalidateQueries({ queryKey: ['contrapartes', selectedEmpresa] })

  const createForm = useForm<ContraparteCreateForm>({
    resolver: zodResolver(contraparteCreateSchema),
    defaultValues: { tipo: 'fornecedor', documento: '', razao_social: '', nome_fantasia: '', conta_contabil_id: '' },
  })
  const editForm = useForm<ContraparteEditForm>({ resolver: zodResolver(contraparteEditSchema) })

  const createMutation = useMutation({
    mutationFn: (d: ContraparteCreateForm) => api.post(`/empresas/${selectedEmpresa}/contrapartes`, {
      tipo: d.tipo,
      documento: d.documento,
      razao_social: d.razao_social,
      nome_fantasia: d.nome_fantasia || undefined,
      conta_contabil_id: d.conta_contabil_id,
    }),
    onSuccess: () => {
      invalidar()
      toast({ title: 'Contraparte cadastrada!', variant: 'success' })
      setOpenCreate(false)
      createForm.reset({ tipo: 'fornecedor', documento: '', razao_social: '', nome_fantasia: '', conta_contabil_id: '' })
    },
    onError: (e: unknown) => toast({ title: 'Erro ao cadastrar', description: extractApiError(e), variant: 'destructive' }),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: ContraparteEditForm }) =>
      api.patch(`/empresas/${selectedEmpresa}/contrapartes/${id}`, {
        tipo: d.tipo,
        razao_social: d.razao_social,
        nome_fantasia: d.nome_fantasia || undefined,
        conta_contabil_id: d.conta_contabil_id,
      }),
    onSuccess: () => {
      invalidar()
      toast({ title: 'Contraparte atualizada!', variant: 'success' })
      setEditContraparte(null)
    },
    onError: (e: unknown) => toast({ title: 'Erro ao atualizar', description: extractApiError(e), variant: 'destructive' }),
  })

  const alternarAtivaMutation = useMutation({
    mutationFn: ({ id, ativa }: { id: string; ativa: boolean }) =>
      api.patch(`/empresas/${selectedEmpresa}/contrapartes/${id}`, { ativa }),
    onSuccess: (_res, { ativa }) => {
      invalidar()
      toast({ title: ativa ? 'Contraparte reativada.' : 'Contraparte desativada.', variant: 'success' })
    },
    onError: (e: unknown) => toast({ title: 'Erro', description: extractApiError(e), variant: 'destructive' }),
  })

  const deletarMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/empresas/${selectedEmpresa}/contrapartes/${id}`),
    onSuccess: () => {
      invalidar()
      toast({ title: 'Contraparte removida.', variant: 'default' })
      setDeleteContraparte(null)
    },
    onError: (e: unknown) => toast({ title: 'Erro ao remover', description: extractApiError(e), variant: 'destructive' }),
  })

  function openEdit(c: any) {
    editForm.reset({
      tipo: c.tipo,
      razao_social: c.razao_social,
      nome_fantasia: c.nome_fantasia ?? '',
      conta_contabil_id: c.conta_contabil_id,
    })
    setEditContraparte(c)
  }

  const items: any[] = data?.items ?? []
  const total: number = data?.total ?? 0
  const filtrosAtivos = tipoFiltro !== 'todos' || apenasAtivas || !!termo
  const limparFiltros = () => { setTipoFiltro('todos'); setApenasAtivas(false); setTermoInput(''); setTermo(''); setPage(1) }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Classificação por favorecido/cliente</h2>
          <p className="text-muted-foreground">
            Fornecedores e clientes identificados por CPF/CNPJ, com a conta contábil de cada um
          </p>
        </div>
        {selectedEmpresa && (
          <Button onClick={() => setOpenCreate(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova Contraparte
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap items-end">
            <div className="flex-1 min-w-[220px]">
              <label className="text-sm font-medium mb-1 block">Buscar</label>
              <Input
                placeholder="Razão social, nome fantasia ou CPF/CNPJ"
                value={termoInput}
                onChange={e => setTermoInput(e.target.value)}
              />
            </div>
            <div className="min-w-[140px]">
              <label className="text-sm font-medium mb-1 block">Tipo</label>
              <Select value={tipoFiltro} onValueChange={v => { setTipoFiltro(v); setPage(1) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {TIPOS_CONTRAPARTE.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant={apenasAtivas ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setApenasAtivas(v => !v); setPage(1) }}
            >
              {apenasAtivas ? 'Mostrando só ativas' : 'Mostrar todas'}
            </Button>
            {filtrosAtivos && (
              <Button variant="ghost" size="sm" onClick={limparFiltros}>Limpar filtros</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Contrapartes {total > 0 && <span className="text-base font-normal text-muted-foreground">({total} total)</span>}</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedEmpresa ? (
            <p className="text-muted-foreground text-center py-8">Selecione uma empresa</p>
          ) : isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Contact className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {filtrosAtivos ? 'Nenhuma contraparte encontrada com esses filtros.' : 'Nenhuma contraparte cadastrada.'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-3 px-2">Razão Social</th>
                      <th className="text-left py-3 px-2">Documento</th>
                      <th className="text-left py-3 px-2">Tipo</th>
                      <th className="text-left py-3 px-2">Conta Contábil</th>
                      <th className="text-center py-3 px-2">Status</th>
                      <th className="text-center py-3 px-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((c: any) => (
                      <tr key={c.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="py-2 px-2 max-w-[220px]">
                          <p className="truncate font-medium">{c.razao_social}</p>
                          {c.nome_fantasia && <p className="text-xs text-muted-foreground truncate">{c.nome_fantasia}</p>}
                        </td>
                        <td className="py-2 px-2 font-mono text-xs whitespace-nowrap">{c.documento}</td>
                        <td className="py-2 px-2">
                          <Badge variant="outline">{TIPO_LABEL[c.tipo] ?? c.tipo}</Badge>
                        </td>
                        <td className="py-2 px-2 max-w-[200px] truncate">
                          {c.conta_codigo ? `${c.conta_codigo} — ` : ''}{c.conta_descricao ?? '—'}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Badge variant={c.ativa ? 'success' : 'secondary'}>{c.ativa ? 'Ativa' : 'Inativa'}</Badge>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex gap-1 justify-center">
                            <Button
                              size="sm" variant="ghost" className="h-7 px-2"
                              title="Editar"
                              onClick={() => openEdit(c)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm" variant="ghost" className="h-7 px-2"
                              title={c.ativa ? 'Desativar' : 'Reativar'}
                              onClick={() => alternarAtivaMutation.mutate({ id: c.id, ativa: !c.ativa })}
                            >
                              {c.ativa ? <Ban className="h-3.5 w-3.5 text-amber-600" /> : <RotateCcw className="h-3.5 w-3.5 text-emerald-600" />}
                            </Button>
                            <Button
                              size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive"
                              title="Remover"
                              onClick={() => setDeleteContraparte(c)}
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
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal: Nova Contraparte */}
      <Dialog open={openCreate} onOpenChange={v => { setOpenCreate(v); if (!v) createForm.reset({ tipo: 'fornecedor', documento: '', razao_social: '', nome_fantasia: '', conta_contabil_id: '' }) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Contraparte</DialogTitle></DialogHeader>
          <form onSubmit={createForm.handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={createForm.watch('tipo')} onValueChange={v => createForm.setValue('tipo', v as any, { shouldValidate: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_CONTRAPARTE.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>CPF/CNPJ</Label>
                <Input placeholder="000.000.000-00 ou 00.000.000/0000-00" {...createForm.register('documento')} />
                {createForm.formState.errors.documento && (
                  <p className="text-xs text-destructive">{createForm.formState.errors.documento.message}</p>
                )}
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Razão Social</Label>
                <Input placeholder="Ex: Axel Tecnologia Ltda" {...createForm.register('razao_social')} />
                {createForm.formState.errors.razao_social && (
                  <p className="text-xs text-destructive">{createForm.formState.errors.razao_social.message}</p>
                )}
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Nome Fantasia <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input placeholder="Ex: Axel Tech" {...createForm.register('nome_fantasia')} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Conta Contábil</Label>
                <SearchableSelect
                  value={createForm.watch('conta_contabil_id')}
                  onValueChange={v => createForm.setValue('conta_contabil_id', v, { shouldValidate: true })}
                  options={contaOptions}
                  placeholder="Selecione a conta..."
                  searchPlaceholder="Buscar conta..."
                  emptyText="Nenhuma conta encontrada."
                />
                {createForm.formState.errors.conta_contabil_id && (
                  <p className="text-xs text-destructive">{createForm.formState.errors.conta_contabil_id.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  É a conta que vai ser sugerida sempre que essa contraparte for identificada num lançamento.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Contraparte */}
      <Dialog open={!!editContraparte} onOpenChange={v => { if (!v) setEditContraparte(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Contraparte</DialogTitle>
            {editContraparte && (
              <p className="text-sm text-muted-foreground font-mono">{editContraparte.documento}</p>
            )}
          </DialogHeader>
          <form
            onSubmit={editForm.handleSubmit(d => editContraparte && editMutation.mutate({ id: editContraparte.id, d }))}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={editForm.watch('tipo')} onValueChange={v => editForm.setValue('tipo', v as any, { shouldValidate: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_CONTRAPARTE.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Razão Social</Label>
                <Input {...editForm.register('razao_social')} />
                {editForm.formState.errors.razao_social && (
                  <p className="text-xs text-destructive">{editForm.formState.errors.razao_social.message}</p>
                )}
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Nome Fantasia <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input {...editForm.register('nome_fantasia')} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Conta Contábil</Label>
                <SearchableSelect
                  value={editForm.watch('conta_contabil_id')}
                  onValueChange={v => editForm.setValue('conta_contabil_id', v, { shouldValidate: true })}
                  options={contaOptions}
                  placeholder="Selecione a conta..."
                  searchPlaceholder="Buscar conta..."
                  emptyText="Nenhuma conta encontrada."
                />
                {editForm.formState.errors.conta_contabil_id && (
                  <p className="text-xs text-destructive">{editForm.formState.errors.conta_contabil_id.message}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditContraparte(null)}>Cancelar</Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {editMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar Exclusão */}
      <Dialog open={!!deleteContraparte} onOpenChange={v => { if (!v) setDeleteContraparte(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Remover Contraparte
            </DialogTitle>
          </DialogHeader>
          {deleteContraparte && (
            <p className="text-sm text-muted-foreground">
              Remover <span className="font-semibold text-foreground">{deleteContraparte.razao_social}</span>?
              Use "Desativar" em vez de remover se for algo temporário — remover apaga o registro.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteContraparte(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deletarMutation.isPending}
              onClick={() => deletarMutation.mutate(deleteContraparte.id)}
            >
              {deletarMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Removendo...</> : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ContrapartesTab
