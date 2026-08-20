import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/api'
import { extractApiError } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { FaixasTipoDialog } from './FaixasTipoDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, BookOpen, CheckCircle2, Loader2, Pencil, Plus, Search, Settings, Trash2, Upload } from 'lucide-react'

const TIPO_LABEL: Record<string, string> = {
  ativo: 'Ativo', passivo: 'Passivo', patrimonio_liquido: 'PL',
  receita: 'Receita', despesa: 'Despesa', custo: 'Custo', resultado: 'Resultado',
}
const TIPO_COLOR: Record<string, string> = {
  ativo: 'bg-emerald-100 text-emerald-700',
  passivo: 'bg-red-100 text-red-700',
  patrimonio_liquido: 'bg-purple-100 text-purple-700',
  receita: 'bg-blue-100 text-blue-700',
  despesa: 'bg-orange-100 text-orange-700',
  custo: 'bg-yellow-100 text-yellow-700',
  resultado: 'bg-cyan-100 text-cyan-700',
}

const TIPOS_OPCOES = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'passivo', label: 'Passivo' },
  { value: 'patrimonio_liquido', label: 'Patrimônio Líquido' },
  { value: 'receita', label: 'Receita' },
  { value: 'despesa', label: 'Despesa' },
  { value: 'custo', label: 'Custo' },
  { value: 'resultado', label: 'Resultado' },
]

const contaSchema = z.object({
  conta_numero: z.string().optional(),
  codigo: z.string().min(1, 'Código obrigatório').regex(/^\d+(\.\d+)*$/, 'Formato inválido. Ex: 1.1.02'),
  descricao: z.string().min(2, 'Mínimo 2 caracteres'),
  tipo: z.string().min(1, 'Selecione o tipo'),
  tipo_sa: z.enum(['S', 'A']),
})
type ContaForm = z.infer<typeof contaSchema>

export function PlanoContasTab({ empresaId }: { empresaId: string }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<string>('todos')
  const [showAll, setShowAll] = useState(false)
  const [openCreate, setOpenCreate] = useState(false)
  const [editConta, setEditConta] = useState<any>(null)
  const [deleteConta, setDeleteConta] = useState<any>(null)
  const [importResult, setImportResult] = useState<any>(null)
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [confirmExcluirSelecionadas, setConfirmExcluirSelecionadas] = useState(false)
  const [confirmExcluirTodas, setConfirmExcluirTodas] = useState(false)
  const [loteResult, setLoteResult] = useState<any>(null)
  const [openFaixas, setOpenFaixas] = useState(false)
  const DISPLAY_LIMIT = 100

  const { data, isLoading } = useQuery<any>({
    queryKey: ['plano-contas', empresaId],
    queryFn: () => api.get(`/empresas/${empresaId}/plano-contas`).then(r => r.data.items ?? r.data),
    enabled: !!empresaId,
  })

  const allContas: any[] = Array.isArray(data) ? data : (data?.items ?? [])

  const createForm = useForm<ContaForm>({
    resolver: zodResolver(contaSchema),
    defaultValues: { tipo_sa: 'A' },
  })
  const editForm = useForm<ContaForm>({ resolver: zodResolver(contaSchema) })

  const createMutation = useMutation({
    mutationFn: (d: ContaForm) => {
      const payload: any = { ...d }
      payload.conta_numero = d.conta_numero ? parseInt(d.conta_numero, 10) || null : null
      return api.post(`/empresas/${empresaId}/plano-contas`, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plano-contas', empresaId] })
      toast({ title: 'Conta criada!', variant: 'success' })
      setOpenCreate(false)
      createForm.reset({ tipo_sa: 'A' })
    },
    onError: (e: unknown) => toast({ title: 'Erro ao criar conta', description: extractApiError(e), variant: 'destructive' }),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<ContaForm> }) => {
      const payload: any = { ...d }
      if (payload.conta_numero !== undefined) {
        payload.conta_numero = payload.conta_numero ? parseInt(payload.conta_numero, 10) || null : null
      }
      return api.patch(`/empresas/${empresaId}/plano-contas/${id}`, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plano-contas', empresaId] })
      toast({ title: 'Conta atualizada!', variant: 'success' })
      setEditConta(null)
    },
    onError: (e: unknown) => toast({ title: 'Erro ao atualizar conta', description: extractApiError(e), variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/empresas/${empresaId}/plano-contas/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plano-contas', empresaId] })
      toast({ title: 'Conta removida!', variant: 'success' })
      setDeleteConta(null)
    },
    onError: (e: unknown) => toast({ title: 'Não foi possível remover', description: extractApiError(e), variant: 'destructive' }),
  })

  const excluirLoteMutation = useMutation({
    mutationFn: (payload: { ids?: string[]; todas?: boolean }) =>
      api.post(`/empresas/${empresaId}/plano-contas/excluir-lote`, payload).then(r => r.data),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['plano-contas', empresaId] })
      setSelecionadas(new Set())
      setConfirmExcluirSelecionadas(false)
      setConfirmExcluirTodas(false)
      setLoteResult(res)
      toast({
        title: `${res.removidas} conta(s) removida(s)`,
        description: res.bloqueadas?.length ? `${res.bloqueadas.length} não puderam ser removidas — veja detalhes abaixo.` : undefined,
        variant: res.bloqueadas?.length ? 'default' : 'success',
      })
    },
    onError: (e: unknown) => toast({ title: 'Erro ao excluir em lote', description: extractApiError(e), variant: 'destructive' }),
  })

  const importMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('arquivo', file)
      return api.post(`/empresas/${empresaId}/plano-contas/importar`, form)
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['plano-contas', empresaId] })
      setImportResult(res.data)
      toast({
        title: `Importação concluída: ${res.data.importadas} conta(s) importada(s)`,
        description: res.data.erros?.length ? `${res.data.erros.length} linha(s) com erro` : undefined,
        variant: res.data.erros?.length ? 'default' : 'success',
      })
    },
    onError: (e: unknown) => toast({ title: 'Erro na importação', description: extractApiError(e), variant: 'destructive' }),
  })

  // Preenche o form de edição quando uma conta é selecionada
  useEffect(() => {
    if (editConta) {
      editForm.reset({
        conta_numero: editConta.conta_numero != null ? String(editConta.conta_numero) : '',
        codigo: editConta.codigo,
        descricao: editConta.descricao,
        tipo: editConta.tipo,
        tipo_sa: editConta.tipo_sa ?? 'A',
      })
    }
  }, [editConta])

  const filtered = useMemo(() => {
    let list = allContas
    if (tipoFiltro !== 'todos') list = list.filter((c: any) => c.tipo === tipoFiltro)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((c: any) =>
        (c.descricao ?? '').toLowerCase().includes(q) ||
        (c.codigo ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [allContas, search, tipoFiltro])

  const displayed = showAll ? filtered : filtered.slice(0, DISPLAY_LIMIT)

  const toggleSelecionada = (id: string) => {
    setSelecionadas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const todosVisiveisSelecionados = displayed.length > 0 && displayed.every((c: any) => selecionadas.has(c.id))
  const algumVisivelSelecionado = displayed.some((c: any) => selecionadas.has(c.id))

  const toggleSelecionarVisiveis = () => {
    setSelecionadas(prev => {
      const next = new Set(prev)
      if (todosVisiveisSelecionados) {
        displayed.forEach((c: any) => next.delete(c.id))
      } else {
        displayed.forEach((c: any) => next.add(c.id))
      }
      return next
    })
  }

  if (isLoading) return (
    <div className="flex justify-center py-10">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )

  const tiposUnicos = [...new Set(allContas.map((c: any) => c.tipo).filter(Boolean))]

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setOpenCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova Conta
          </Button>
          <Button
            size="sm" variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={importMutation.isPending}
          >
            {importMutation.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Importando...</>
              : <><Upload className="h-4 w-4 mr-1" />Importar XLSX/CSV</>
            }
          </Button>
          <input
            ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) importMutation.mutate(f); e.target.value = '' }}
          />
          <Button
            size="sm" variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmExcluirTodas(true)}
            disabled={!allContas.length}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Excluir Todas
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpenFaixas(true)}>
            <Settings className="h-4 w-4 mr-1" /> Configurar Plano de Contas
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">{allContas.length} contas</span>
      </div>

      {/* Barra de seleção em lote */}
      {selecionadas.size > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
          <span className="text-sm text-blue-900">{selecionadas.size} conta(s) selecionada(s)</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelecionadas(new Set())}>Limpar seleção</Button>
            <Button size="sm" variant="destructive" onClick={() => setConfirmExcluirSelecionadas(true)}>
              <Trash2 className="h-4 w-4 mr-1" /> Excluir selecionadas
            </Button>
          </div>
        </div>
      )}

      {/* Resultado da importação */}
      {importResult && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="h-4 w-4" /> {importResult.importadas} importadas
              </span>
              <span className="text-muted-foreground">{importResult.duplicadas} duplicadas ignoradas</span>
              {importResult.erros?.length > 0 && (
                <span className="flex items-center gap-1 text-amber-700 font-medium">
                  <AlertCircle className="h-4 w-4" /> {importResult.erros.length} erros
                </span>
              )}
            </div>
            <button onClick={() => setImportResult(null)} className="text-xs text-muted-foreground hover:text-foreground">Fechar</button>
          </div>
          {importResult.erros?.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {importResult.erros.map((e: any, i: number) => (
                <div key={i} className="text-xs flex items-start gap-2 text-amber-800 bg-amber-50 px-2 py-1 rounded">
                  <span className="font-medium shrink-0">Linha {e.linha}:</span>
                  {e.codigo && <span className="font-mono text-muted-foreground shrink-0">{e.codigo}</span>}
                  <span className="truncate">{e.erro}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resultado da exclusão em lote */}
      {loteResult && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="h-4 w-4" /> {loteResult.removidas} removida(s)
              </span>
              {loteResult.bloqueadas?.length > 0 && (
                <span className="flex items-center gap-1 text-amber-700 font-medium">
                  <AlertCircle className="h-4 w-4" /> {loteResult.bloqueadas.length} bloqueada(s)
                </span>
              )}
            </div>
            <button onClick={() => setLoteResult(null)} className="text-xs text-muted-foreground hover:text-foreground">Fechar</button>
          </div>
          {loteResult.bloqueadas?.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {loteResult.bloqueadas.map((b: any) => (
                <div key={b.id} className="text-xs flex items-start gap-2 text-amber-800 bg-amber-50 px-2 py-1 rounded">
                  <span className="font-mono font-medium shrink-0">{b.codigo}</span>
                  <span className="truncate">{b.erro}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por classificação ou descrição..."
            value={search}
            onChange={e => { setSearch(e.target.value); setShowAll(false) }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setTipoFiltro('todos')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tipoFiltro === 'todos' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
          >
            Todos
          </button>
          {tiposUnicos.map(t => (
            <button
              key={t}
              onClick={() => { setTipoFiltro(t); setShowAll(false) }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tipoFiltro === t ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
            >
              {TIPO_LABEL[t] ?? t}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} de {allContas.length} contas
        </span>
      </div>

      {/* Cabeçalho */}
      <div className="grid grid-cols-[1.5rem_4rem_8rem_1fr_3rem_5rem_4rem] gap-2 px-2 py-1.5 bg-muted/50 rounded text-xs font-semibold text-muted-foreground uppercase tracking-wide items-center">
        <input
          type="checkbox"
          className="h-3.5 w-3.5"
          checked={todosVisiveisSelecionados}
          ref={el => { if (el) el.indeterminate = !todosVisiveisSelecionados && algumVisivelSelecionado }}
          onChange={toggleSelecionarVisiveis}
          aria-label="Selecionar todas as contas visíveis"
        />
        <span>Conta</span>
        <span>Classificação</span>
        <span>Descrição</span>
        <span className="text-center">S/A</span>
        <span>Tipo</span>
        <span></span>
      </div>

      {/* Lista */}
      {!allContas.length ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada. Crie ou importe um XLSX/CSV.</p>
        </div>
      ) : (
        <div className="divide-y divide-border/50 rounded-md border overflow-hidden">
          {displayed.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma conta encontrada.</p>
          ) : (
            displayed.map((c: any) => {
              const depth = Math.min((c.codigo?.split('.').length ?? 1) - 1, 6)
              const isSintetico = c.tipo_sa === 'S'
              return (
                <div
                  key={c.id}
                  className={`grid grid-cols-[1.5rem_4rem_8rem_1fr_3rem_5rem_4rem] gap-2 items-center px-2 py-2 hover:bg-muted/30 transition-colors group ${isSintetico ? 'bg-slate-50/70' : ''} ${selecionadas.has(c.id) ? 'bg-blue-50/60' : ''}`}
                  style={{ paddingLeft: `${8 + depth * 16}px` }}
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5"
                    checked={selecionadas.has(c.id)}
                    onChange={() => toggleSelecionada(c.id)}
                    aria-label={`Selecionar ${c.codigo}`}
                  />
                  <span className="font-mono text-xs text-muted-foreground truncate">
                    {c.conta_numero ?? '—'}
                  </span>
                  <span className={`font-mono text-xs truncate ${isSintetico ? 'text-slate-600 font-semibold' : 'text-muted-foreground'}`}>
                    {c.codigo}
                  </span>
                  <span className={`text-sm truncate ${isSintetico ? 'font-semibold text-slate-700' : ''}`}>
                    {c.descricao}
                  </span>
                  <span className="text-center">
                    <span className={`inline-block text-xs px-1.5 py-0.5 rounded font-medium ${isSintetico ? 'bg-slate-200 text-slate-600' : 'bg-slate-100 text-slate-500'}`}>
                      {c.tipo_sa ?? 'A'}
                    </span>
                  </span>
                  <span>
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_COLOR[c.tipo] ?? 'bg-gray-100 text-gray-600'}`}>
                      {TIPO_LABEL[c.tipo] ?? c.tipo}
                    </span>
                  </span>
                  <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end pr-1">
                    <button
                      onClick={() => setEditConta(c)}
                      className="p-1 rounded hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteConta(c)}
                      className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                      title="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}

      {!showAll && filtered.length > DISPLAY_LIMIT && (
        <div className="text-center pt-2">
          <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
            Ver todos os {filtered.length} registros
          </Button>
        </div>
      )}

      {/* Dialog — Nova Conta */}
      <Dialog open={openCreate} onOpenChange={v => { setOpenCreate(v); if (!v) createForm.reset({ tipo_sa: 'A' }) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" /> Nova Conta Contábil
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Conta <span className="text-muted-foreground font-normal text-xs">(nº)</span></Label>
                <Input placeholder="Ex: 551" type="number" {...createForm.register('conta_numero')} />
              </div>
              <div className="space-y-1.5">
                <Label>Classificação</Label>
                <Input placeholder="Ex: 3.2.01" {...createForm.register('codigo')} />
                {createForm.formState.errors.codigo && (
                  <p className="text-xs text-destructive">{createForm.formState.errors.codigo.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>S/A</Label>
                <Select
                  value={createForm.watch('tipo_sa')}
                  onValueChange={v => createForm.setValue('tipo_sa', v as 'S' | 'A')}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A — Analítica</SelectItem>
                    <SelectItem value="S">S — Sintética</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input placeholder="Ex: Receitas de Serviços" {...createForm.register('descricao')} />
              {createForm.formState.errors.descricao && (
                <p className="text-xs text-destructive">{createForm.formState.errors.descricao.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={createForm.watch('tipo')} onValueChange={v => createForm.setValue('tipo', v, { shouldValidate: true })}>
                <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  {TIPOS_OPCOES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {createForm.formState.errors.tipo && (
                <p className="text-xs text-destructive">{createForm.formState.errors.tipo.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : 'Criar Conta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog — Editar Conta */}
      <Dialog open={!!editConta} onOpenChange={v => { if (!v) setEditConta(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-500" /> Editar Conta
            </DialogTitle>
            {editConta && (
              <p className="text-sm text-muted-foreground font-mono">{editConta.codigo}</p>
            )}
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(d => editMutation.mutate({ id: editConta.id, d }))} className="space-y-4">
            {/* Conta + Classificação */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Conta <span className="text-muted-foreground font-normal text-xs">(nº)</span></Label>
                <Input type="number" placeholder="Ex: 551" {...editForm.register('conta_numero')} />
              </div>
              <div className="space-y-1.5">
                <Label>Classificação</Label>
                <Input placeholder="Ex: 1.1.02.0001" {...editForm.register('codigo')} />
                {editForm.formState.errors.codigo && (
                  <p className="text-xs text-destructive">{editForm.formState.errors.codigo.message}</p>
                )}
              </div>
            </div>
            {/* Descrição */}
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input {...editForm.register('descricao')} />
              {editForm.formState.errors.descricao && (
                <p className="text-xs text-destructive">{editForm.formState.errors.descricao.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={editForm.watch('tipo')} onValueChange={v => editForm.setValue('tipo', v, { shouldValidate: true })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_OPCOES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>S/A</Label>
                <Select value={editForm.watch('tipo_sa')} onValueChange={v => editForm.setValue('tipo_sa', v as 'S' | 'A')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A — Analítica</SelectItem>
                    <SelectItem value="S">S — Sintética</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditConta(null)}>Cancelar</Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {editMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog — Confirmar Exclusão */}
      <Dialog open={!!deleteConta} onOpenChange={v => { if (!v) setDeleteConta(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Remover Conta
            </DialogTitle>
          </DialogHeader>
          {deleteConta && (
            <p className="text-sm text-muted-foreground">
              Remover <span className="font-semibold text-foreground">{deleteConta.codigo} — {deleteConta.descricao}</span>?
              Esta ação não poderá ser desfeita.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConta(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(deleteConta.id)}
            >
              {deleteMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Removendo...</> : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Confirmar Exclusão em Lote (selecionadas) */}
      <Dialog open={confirmExcluirSelecionadas} onOpenChange={setConfirmExcluirSelecionadas}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Excluir contas selecionadas
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remover <span className="font-semibold text-foreground">{selecionadas.size}</span> conta(s) selecionada(s)?
            Contas com lançamentos, regras ou subcontas vinculadas não serão removidas.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmExcluirSelecionadas(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={excluirLoteMutation.isPending}
              onClick={() => excluirLoteMutation.mutate({ ids: Array.from(selecionadas) })}
            >
              {excluirLoteMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Removendo...</> : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Confirmar Exclusão Total */}
      <Dialog open={confirmExcluirTodas} onOpenChange={setConfirmExcluirTodas}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Excluir todo o plano de contas
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remover as <span className="font-semibold text-foreground">{allContas.length}</span> contas cadastradas nesta empresa?
            Contas com lançamentos, regras ou subcontas vinculadas não serão removidas. Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmExcluirTodas(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={excluirLoteMutation.isPending}
              onClick={() => excluirLoteMutation.mutate({ todas: true })}
            >
              {excluirLoteMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Removendo...</> : 'Excluir Todas'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FaixasTipoDialog empresaId={empresaId} open={openFaixas} onOpenChange={setOpenFaixas} />
    </div>
  )
}


