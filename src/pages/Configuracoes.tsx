import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEmpresaDefault } from '@/hooks/useEmpresaDefault'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/api'
import { extractApiError } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Plus, Loader2, Search, ChevronDown, ChevronLeft, ChevronRight,
  BookOpen, Building2, Zap, TrendingUp, TrendingDown, ToggleLeft, ToggleRight,
  Pencil, Trash2, Upload, AlertCircle, CheckCircle2,
} from 'lucide-react'

// ── Schemas ──────────────────────────────────────────────────────────────────

const regraSchema = z.object({
  descricao: z.string().min(2, 'Mínimo 2 caracteres'),
  historico: z.string().min(2, 'Padrão muito curto'),
  conta_id: z.string().uuid('Selecione uma conta'),
  agencia_id: z.string().uuid('Selecione uma agência'),
  dc: z.enum(['D', 'C'], { errorMap: () => ({ message: 'Selecione débito ou crédito' }) }),
  tipo: z.enum(['automatica', 'manual']),
  manter_historico: z.boolean().default(false),
})
type RegraForm = z.infer<typeof regraSchema>

const agenciaSchema = z.object({
  banco_sigla: z.string().min(2, 'Informe o banco'),
  agencia: z.string().regex(/^\d+$/, 'Apenas dígitos'),
  numero: z.string().min(1, 'Informe o número da conta'),
  digito: z.string().optional(),
})
type AgenciaForm = z.infer<typeof agenciaSchema>

// ── SearchableCombobox ────────────────────────────────────────────────────────

interface ComboOption { value: string; label: string; sublabel?: string }

function SearchableCombobox({
  options, value, onChange, placeholder = 'Selecione...',
}: {
  options: ComboOption[]
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return options
    const q = search.toLowerCase()
    return options.filter(o =>
      o.label.toLowerCase().includes(q) || (o.sublabel ?? '').toLowerCase().includes(q)
    )
  }, [options, search])

  const selected = options.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = useCallback(() => {
    setOpen(true)
    setSearch('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
      >
        <span className={`truncate ${selected ? 'text-foreground' : 'text-muted-foreground'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute z-[200] w-full mt-1 bg-white border rounded-md shadow-xl">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar conta..."
                className="w-full pl-7 pr-3 py-1.5 text-sm border rounded bg-muted/30 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3 text-center">Nenhum resultado</p>
            ) : (
              <>
                {filtered.slice(0, 200).map(o => (
                  <div
                    key={o.value}
                    onMouseDown={e => {
                      e.preventDefault()
                      onChange(o.value)
                      setOpen(false)
                      setSearch('')
                    }}
                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-muted/60 transition-colors ${value === o.value ? 'bg-blue-50 font-medium text-blue-700' : ''}`}
                  >
                    <div className="font-medium truncate">{o.label}</div>
                    {o.sublabel && <div className="text-xs text-muted-foreground truncate">{o.sublabel}</div>}
                  </div>
                ))}
                {filtered.length > 200 && (
                  <p className="text-xs text-muted-foreground text-center py-2 border-t">
                    {filtered.length - 200} resultados ocultados. Refine a busca.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── PlanoContasList ───────────────────────────────────────────────────────────

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

function PlanoContasList({ empresaId }: { empresaId: string }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<string>('todos')
  const [showAll, setShowAll] = useState(false)
  const [openCreate, setOpenCreate] = useState(false)
  const [editConta, setEditConta] = useState<any>(null)
  const [deleteConta, setDeleteConta] = useState<any>(null)
  const [importResult, setImportResult] = useState<any>(null)
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
        </div>
        <span className="text-xs text-muted-foreground">{allContas.length} contas</span>
      </div>

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
      <div className="grid grid-cols-[4rem_8rem_1fr_3rem_5rem_4rem] gap-2 px-2 py-1.5 bg-muted/50 rounded text-xs font-semibold text-muted-foreground uppercase tracking-wide">
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
                  className={`grid grid-cols-[4rem_8rem_1fr_3rem_5rem_4rem] gap-2 items-center px-2 py-2 hover:bg-muted/30 transition-colors group ${isSintetico ? 'bg-slate-50/70' : ''}`}
                  style={{ paddingLeft: `${8 + depth * 16}px` }}
                >
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
    </div>
  )
}

// ── AgenciasList ──────────────────────────────────────────────────────────────

function AgenciasList({ empresaId }: { empresaId: string }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['agencias', empresaId],
    queryFn: () => api.get(`/empresas/${empresaId}/agencias`).then(r => r.data.items ?? r.data),
    enabled: !!empresaId,
  })
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AgenciaForm>({
    resolver: zodResolver(agenciaSchema),
  })
  const createMutation = useMutation({
    mutationFn: (d: AgenciaForm) => api.post(`/empresas/${empresaId}/agencias`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agencias', empresaId] })
      toast({ title: 'Agência criada!', variant: 'success' })
      setOpen(false)
      reset()
    },
    onError: (e: unknown) => toast({ title: 'Erro', description: extractApiError(e), variant: 'destructive' }),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data.length} agência{data.length !== 1 ? 's' : ''} cadastrada{data.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Agência
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !data.length ? (
        <div className="text-center py-10 border-2 border-dashed rounded-lg">
          <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma agência cadastrada.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between p-4 rounded-lg border bg-white hover:shadow-sm transition-shadow">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 font-bold text-sm shrink-0">
                  {a.banco_sigla?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm">{a.banco_sigla}</p>
                  <p className="text-xs text-muted-foreground">
                    Ag: <span className="font-mono">{a.agencia}</span>
                    {' · '}
                    CC: <span className="font-mono">{a.numero}{a.digito ? `-${a.digito}` : ''}</span>
                  </p>
                </div>
              </div>
              <Badge variant={a.ativa ? 'success' : 'secondary'} className="text-xs">
                {a.ativa ? 'Ativa' : 'Inativa'}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" /> Nova Agência Bancária
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
            <div className="space-y-1">
              <Label>Banco</Label>
              <Input placeholder="Ex: BRADESCO" {...register('banco_sigla')} />
              {errors.banco_sigla && <p className="text-xs text-destructive">{errors.banco_sigla.message}</p>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Agência</Label>
                <Input placeholder="0001" {...register('agencia')} />
                {errors.agencia && <p className="text-xs text-destructive">{errors.agencia.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Conta</Label>
                <Input placeholder="12345" {...register('numero')} />
                {errors.numero && <p className="text-xs text-destructive">{errors.numero.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Dígito</Label>
                <Input placeholder="6" {...register('digito')} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : 'Criar Agência'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── RegrasList ────────────────────────────────────────────────────────────────

const PAGE_SIZE_REGRAS = 50

function RegrasList({ empresaId }: { empresaId: string }) {
  const qc = useQueryClient()
  const [openDialog, setOpenDialog] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [agenciaFiltro, setAgenciaFiltro] = useState('todas')
  const [apenasAtivas, setApenasAtivas] = useState(false)

  const buildQuery = () => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('page_size', String(PAGE_SIZE_REGRAS))
    if (apenasAtivas) p.set('apenas_ativas', 'true')
    if (agenciaFiltro !== 'todas') p.set('agencia_id', agenciaFiltro)
    return p.toString()
  }

  const { data: regraData, isLoading } = useQuery<any>({
    queryKey: ['regras', empresaId, page, agenciaFiltro, apenasAtivas],
    queryFn: () => api.get(`/empresas/${empresaId}/regras?${buildQuery()}`).then(r => r.data),
    enabled: !!empresaId,
  })

  const { data: contasRaw } = useQuery<any>({
    queryKey: ['plano-contas', empresaId],
    queryFn: () => api.get(`/empresas/${empresaId}/plano-contas`).then(r => r.data.items ?? r.data),
    enabled: !!empresaId,
  })
  const contas: any[] = Array.isArray(contasRaw) ? contasRaw : (contasRaw?.items ?? [])

  const { data: agencias = [] } = useQuery<any[]>({
    queryKey: ['agencias', empresaId],
    queryFn: () => api.get(`/empresas/${empresaId}/agencias`).then(r => r.data.items ?? r.data),
    enabled: !!empresaId,
  })

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<RegraForm>({
    resolver: zodResolver(regraSchema),
    defaultValues: { tipo: 'automatica', manter_historico: false },
  })

  const watchContaId = watch('conta_id')
  const watchAgenciaId = watch('agencia_id')

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativa }: { id: string; ativa: boolean }) =>
      api.patch(`/empresas/${empresaId}/regras/${id}`, { ativa }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['regras', empresaId] })
      toast({ title: 'Regra atualizada', variant: 'success' })
    },
    onError: (e: unknown) => toast({ title: 'Erro', description: extractApiError(e), variant: 'destructive' }),
  })

  const createMutation = useMutation({
    mutationFn: (d: RegraForm) => api.post(`/empresas/${empresaId}/regras`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['regras', empresaId] })
      toast({ title: 'Regra criada com sucesso!', variant: 'success' })
      setOpenDialog(false)
      reset()
    },
    onError: (e: unknown) => toast({ title: 'Erro ao criar regra', description: extractApiError(e), variant: 'destructive' }),
  })

  const allRegras: any[] = regraData?.items ?? []
  const total: number = regraData?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE_REGRAS)

  // Filtro local de texto (sobre os itens carregados na página)
  const regras = useMemo(() => {
    if (!search.trim()) return allRegras
    const q = search.toLowerCase()
    return allRegras.filter((r: any) =>
      (r.descricao ?? '').toLowerCase().includes(q) ||
      (r.historico ?? '').toLowerCase().includes(q) ||
      (r.conta_descricao ?? '').toLowerCase().includes(q) ||
      (r.conta_codigo ?? '').toLowerCase().includes(q)
    )
  }, [allRegras, search])

  // Options para combobox de contas
  const contaOptions: ComboOption[] = useMemo(() =>
    contas
      .filter((c: any) => c.tipo_sa === 'A' || !c.tipo_sa) // preferencialmente analíticas
      .map((c: any) => ({
        value: c.id,
        label: `${c.codigo} — ${c.descricao}`,
        sublabel: TIPO_LABEL[c.tipo] ?? c.tipo,
      })),
    [contas]
  )

  const contaOptions_all: ComboOption[] = useMemo(() =>
    contas.map((c: any) => ({
      value: c.id,
      label: `${c.codigo} — ${c.descricao}`,
      sublabel: TIPO_LABEL[c.tipo] ?? c.tipo,
    })),
    [contas]
  )

  return (
    <div className="space-y-4">
      {/* Barra de filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, padrão ou conta..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>

        <Select value={agenciaFiltro} onValueChange={v => { setAgenciaFiltro(v); setPage(1) }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todas as agências" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as agências</SelectItem>
            {agencias.map((a: any) => (
              <SelectItem key={a.id} value={a.id}>
                {a.banco_sigla} {a.agencia}/{a.numero}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          onClick={() => { setApenasAtivas(!apenasAtivas); setPage(1) }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${apenasAtivas ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-border text-muted-foreground hover:bg-muted/50'}`}
        >
          {apenasAtivas ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
          {apenasAtivas ? 'Só ativas' : 'Todas'}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{total} regra{total !== 1 ? 's' : ''}</span>
          <Button size="sm" onClick={() => setOpenDialog(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova Regra
          </Button>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : regras.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Zap className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-muted-foreground">
            {search ? 'Nenhuma regra encontrada para esta busca.' : 'Nenhuma regra cadastrada.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {regras.map((r: any) => (
            <div
              key={r.id}
              className={`p-4 rounded-lg border transition-colors hover:shadow-sm ${r.ativa ? 'bg-white' : 'bg-muted/30 opacity-70'}`}
            >
              <div className="flex items-start justify-between gap-3">
                {/* Lado esquerdo: info principal */}
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Linha 1: nome + badges */}
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="font-semibold text-sm truncate">{r.descricao}</span>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold ${r.dc === 'D' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {r.dc === 'D' ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                      {r.dc === 'D' ? 'Débito' : 'Crédito'}
                    </span>
                    {r.tipo === 'automatica' && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                        <Zap className="h-3 w-3" /> Auto
                      </span>
                    )}
                  </div>

                  {/* Linha 2: padrão */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="shrink-0">Padrão:</span>
                    <code className="bg-muted px-2 py-0.5 rounded font-mono text-foreground max-w-xs truncate">
                      {r.historico}
                    </code>
                  </div>

                  {/* Linha 3: conta + agência */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    {(r.conta_codigo || r.conta_descricao) && (
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-mono text-muted-foreground">{r.conta_codigo}</span>
                        {r.conta_descricao && (
                          <span className="text-foreground font-medium truncate max-w-[220px]">
                            {r.conta_descricao}
                          </span>
                        )}
                      </div>
                    )}
                    {r.agencia_descricao && (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">{r.agencia_descricao}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Lado direito: status + toggle */}
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={r.ativa ? 'success' : 'secondary'} className="text-xs">
                    {r.ativa ? 'Ativa' : 'Inativa'}
                  </Badge>
                  <button
                    onClick={() => toggleMutation.mutate({ id: r.id, ativa: !r.ativa })}
                    disabled={toggleMutation.isPending}
                    title={r.ativa ? 'Desativar regra' : 'Ativar regra'}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                  >
                    {r.ativa
                      ? <ToggleRight className="h-5 w-5 text-emerald-600" />
                      : <ToggleLeft className="h-5 w-5" />
                    }
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Página {page} de {totalPages} · {total} regras
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="icon"
              className="h-8 w-8"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = page <= 3 ? i + 1 : page - 2 + i
              if (p < 1 || p > totalPages) return null
              return (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="icon"
                  className="h-8 w-8 text-xs"
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              )
            })}
            <Button
              variant="outline" size="icon"
              className="h-8 w-8"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialog Nova Regra */}
      <Dialog open={openDialog} onOpenChange={v => { setOpenDialog(v); if (!v) reset() }}>
        <DialogContent className="max-w-2xl overflow-visible">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-500" /> Nova Regra de Categorização
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Defina um padrão de texto do extrato bancário e a conta contábil correspondente.
            </p>
          </DialogHeader>

          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-5">
            {/* Descrição + Padrão */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>
                  Descrição da regra
                  <span className="text-muted-foreground text-xs font-normal ml-1">(nome interno)</span>
                </Label>
                <Input placeholder="Ex: Pagamento Fornecedores" {...register('descricao')} />
                {errors.descricao && <p className="text-xs text-destructive">{errors.descricao.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>
                  Padrão no extrato
                  <span className="text-muted-foreground text-xs font-normal ml-1">(texto da transação)</span>
                </Label>
                <Input placeholder="Ex: PAGTO FORNECEDOR" {...register('historico')} />
                {errors.historico && <p className="text-xs text-destructive">{errors.historico.message}</p>}
              </div>
            </div>

            {/* Conta + Agência */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground" /> Conta Contábil
                </Label>
                <SearchableCombobox
                  options={contaOptions_all}
                  value={watchContaId ?? ''}
                  onChange={v => setValue('conta_id', v, { shouldValidate: true })}
                  placeholder="Buscar e selecionar conta..."
                />
                {errors.conta_id && <p className="text-xs text-destructive">{errors.conta_id.message}</p>}
                {watchContaId && (() => {
                  const c = contas.find((x: any) => x.id === watchContaId)
                  return c ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${TIPO_COLOR[c.tipo] ?? 'bg-gray-100 text-gray-600'}`}>
                        {TIPO_LABEL[c.tipo] ?? c.tipo}
                      </span>
                      <span className="font-mono">{c.codigo}</span>
                      <span className="truncate">{c.descricao}</span>
                    </div>
                  ) : null
                })()}
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> Agência Bancária
                </Label>
                <Select onValueChange={v => setValue('agencia_id', v, { shouldValidate: true })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a agência" />
                  </SelectTrigger>
                  <SelectContent>
                    {agencias.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.banco_sigla} — Ag {a.agencia} / CC {a.numero}
                        {a.digito ? `-${a.digito}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.agencia_id && <p className="text-xs text-destructive">{errors.agencia_id.message}</p>}
              </div>
            </div>

            {/* Natureza + Tipo */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Natureza</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['D', 'C'] as const).map(dc => (
                    <button
                      key={dc}
                      type="button"
                      onClick={() => setValue('dc', dc, { shouldValidate: true })}
                      className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border text-sm font-medium transition-all ${watch('dc') === dc
                        ? dc === 'D'
                          ? 'bg-red-50 border-red-400 text-red-700'
                          : 'bg-emerald-50 border-emerald-400 text-emerald-700'
                        : 'bg-white border-border text-muted-foreground hover:bg-muted/30'
                      }`}
                    >
                      {dc === 'D' ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                      {dc === 'D' ? 'Débito' : 'Crédito'}
                    </button>
                  ))}
                </div>
                {errors.dc && <p className="text-xs text-destructive">{errors.dc.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de regra</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['automatica', 'manual'] as const).map(tipo => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setValue('tipo', tipo)}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md border text-sm font-medium transition-all ${watch('tipo') === tipo
                        ? 'bg-blue-50 border-blue-400 text-blue-700'
                        : 'bg-white border-border text-muted-foreground hover:bg-muted/30'
                      }`}
                    >
                      {tipo === 'automatica' && <Zap className="h-3.5 w-3.5" />}
                      {tipo === 'automatica' ? 'Automática' : 'Manual'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => { setOpenDialog(false); reset() }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>
                  : <><Plus className="h-4 w-4 mr-1" />Criar Regra</>
                }
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ConfiguracoesPage() {
  const [selectedEmpresa, setSelectedEmpresa] = useEmpresaDefault()
  const { data: empresas = [] } = useQuery<any[]>({
    queryKey: ['empresas'],
    queryFn: () => api.get('/empresas').then(r => r.data.items ?? r.data),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Configurações</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="max-w-sm">
            <label className="text-sm font-medium mb-1.5 block">Empresa</label>
            <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresas.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>{e.razao_social}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedEmpresa ? (
        <Tabs defaultValue="regras">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="regras" className="gap-1.5">
              <Zap className="h-4 w-4" /> Regras NEO
            </TabsTrigger>
            <TabsTrigger value="plano" className="gap-1.5">
              <BookOpen className="h-4 w-4" /> Plano de Contas
            </TabsTrigger>
            <TabsTrigger value="agencias" className="gap-1.5">
              <Building2 className="h-4 w-4" /> Agências
            </TabsTrigger>
          </TabsList>

          <TabsContent value="regras" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="h-5 w-5 text-blue-500" /> Regras de Categorização
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  O NEO usa essas regras para classificar automaticamente as transações do extrato.
                </p>
              </CardHeader>
              <CardContent>
                <RegrasList empresaId={selectedEmpresa} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plano" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="h-5 w-5 text-emerald-600" /> Plano de Contas
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Estrutura hierárquica de contas contábeis da empresa.
                </p>
              </CardHeader>
              <CardContent>
                <PlanoContasList empresaId={selectedEmpresa} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agencias" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5 text-slate-600" /> Agências Bancárias
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Contas bancárias cadastradas para esta empresa.
                </p>
              </CardHeader>
              <CardContent>
                <AgenciasList empresaId={selectedEmpresa} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="text-center py-16 border-2 border-dashed rounded-lg text-muted-foreground">
          <p className="text-sm">Selecione uma empresa para ver as configurações.</p>
        </div>
      )}
    </div>
  )
}
