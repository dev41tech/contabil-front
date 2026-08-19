import { useState, useRef, useEffect } from 'react'
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
import { Pagination } from '@/components/ui/pagination'
import { Plus, Loader2, Link2, XCircle, Upload, FileUp, CheckCircle2, AlertCircle } from 'lucide-react'
import { useEmpresas } from '@/hooks/useEmpresas'

const STATUS_COLORS: Record<string, any> = {
  pendente: 'warning',
  associada: 'success',
  cancelada: 'destructive',
}

const notaSchema = z.object({
  tipo: z.enum(['nfe', 'nfse'], { errorMap: () => ({ message: 'Selecione o tipo' }) }),
  numero: z.string().min(1, 'Número obrigatório'),
  serie: z.string().optional(),
  cnpj_emitente: z.string().min(14, 'CNPJ inválido'),
  nome_emitente: z.string().optional(),
  valor: z.coerce.number().positive('Valor deve ser positivo'),
  data_emissao: z.string().min(1, 'Data obrigatória'),
  chave_acesso: z.string().optional(),
  observacao: z.string().optional(),
})
type NotaForm = z.infer<typeof notaSchema>

export default function NotasPage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedEmpresa, setSelectedEmpresa] = useEmpresaDefault()
  const [tipoFiltro, setTipoFiltro] = useState('todos')
  const [statusFiltro, setStatusFiltro] = useState('todos')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20
  const [openCreate, setOpenCreate] = useState(false)
  const [openAssociar, setOpenAssociar] = useState<string | null>(null) // nota id
  const [importResult, setImportResult] = useState<{ importadas: number; duplicadas: number; erros: string[] } | null>(null)

  // Busca — campos de texto usam debounce para não disparar uma request por tecla
  const [buscaInputs, setBuscaInputs] = useState({ numero: '', emitente: '', cnpj: '', chave_acesso: '' })
  const [busca, setBusca] = useState({ numero: '', emitente: '', cnpj: '', chave_acesso: '' })
  const [dataDe, setDataDe] = useState('')
  const [dataAte, setDataAte] = useState('')

  useEffect(() => {
    const t = setTimeout(() => { setBusca(buscaInputs); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [buscaInputs.numero, buscaInputs.emitente, buscaInputs.cnpj, buscaInputs.chave_acesso])

  const filtrosAtivos = tipoFiltro !== 'todos' || statusFiltro !== 'todos' ||
    Object.values(busca).some(Boolean) || !!dataDe || !!dataAte
  const limparFiltros = () => {
    setBuscaInputs({ numero: '', emitente: '', cnpj: '', chave_acesso: '' })
    setBusca({ numero: '', emitente: '', cnpj: '', chave_acesso: '' })
    setTipoFiltro('todos'); setStatusFiltro('todos')
    setDataDe(''); setDataAte(''); setPage(1)
  }

  const { data: empresas = [] } = useEmpresas()

  const buildParams = () => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('page_size', String(PAGE_SIZE))
    if (tipoFiltro !== 'todos') p.set('tipo', tipoFiltro)
    if (statusFiltro !== 'todos') p.set('status', statusFiltro)
    if (busca.numero) p.set('numero', busca.numero)
    if (busca.emitente) p.set('emitente', busca.emitente)
    if (busca.cnpj) p.set('cnpj', busca.cnpj)
    if (busca.chave_acesso) p.set('chave_acesso', busca.chave_acesso)
    if (dataDe) p.set('data_de', new Date(dataDe).toISOString())
    if (dataAte) p.set('data_ate', new Date(dataAte + 'T23:59:59').toISOString())
    return p.toString()
  }

  const { data: notas, isLoading } = useQuery<any>({
    queryKey: ['notas', selectedEmpresa, tipoFiltro, statusFiltro, busca, dataDe, dataAte, page],
    queryFn: () => api.get(`/empresas/${selectedEmpresa}/notas?${buildParams()}`).then(r => r.data),
    enabled: !!selectedEmpresa,
  })

  // Transações pendentes para associar
  const { data: transacoesPendentes = [] } = useQuery<any[]>({
    queryKey: ['extrato-pendentes', selectedEmpresa],
    queryFn: () => api.get(`/empresas/${selectedEmpresa}/extrato?status=pendente&page_size=100`).then(r => r.data.items ?? []),
    enabled: !!selectedEmpresa && !!openAssociar,
  })

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<NotaForm>({
    resolver: zodResolver(notaSchema),
    defaultValues: { tipo: 'nfe' },
  })

  const createMutation = useMutation({
    mutationFn: (data: NotaForm) => {
      const payload: any = { ...data, data_emissao: new Date(data.data_emissao).toISOString() }
      // Campos opcionais chegam como string vazia do form; o backend trata
      // "" como valor informado (ex: chave_acesso="" falha a validação de
      // 44 dígitos em vez de ser tratado como ausente).
      for (const campo of ['serie', 'nome_emitente', 'chave_acesso', 'observacao']) {
        if (!payload[campo]) delete payload[campo]
      }
      return api.post(`/empresas/${selectedEmpresa}/notas`, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notas', selectedEmpresa] })
      toast({ title: 'Nota fiscal criada!', variant: 'success' })
      setOpenCreate(false)
      reset()
    },
    onError: (e: unknown) => toast({ title: 'Erro ao criar nota', description: extractApiError(e), variant: 'destructive' }),
  })

  const associarMutation = useMutation({
    mutationFn: ({ notaId, transacaoId }: { notaId: string; transacaoId: string }) =>
      api.post(`/empresas/${selectedEmpresa}/notas/${notaId}/associar`, { transacao_id: transacaoId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notas', selectedEmpresa] })
      toast({ title: 'Nota associada à transação!', variant: 'success' })
      setOpenAssociar(null)
    },
    onError: (e: unknown) => toast({ title: 'Erro ao associar', description: extractApiError(e), variant: 'destructive' }),
  })

  const cancelarMutation = useMutation({
    mutationFn: (notaId: string) => api.post(`/empresas/${selectedEmpresa}/notas/${notaId}/cancelar`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notas', selectedEmpresa] })
      toast({ title: 'Nota cancelada.', variant: 'default' })
    },
    onError: (e: unknown) => toast({ title: 'Erro ao cancelar', description: extractApiError(e), variant: 'destructive' }),
  })

  const xmlMutation = useMutation({
    mutationFn: async (files: File[]) => {
      // Cada arquivo vai numa chamada isolada: um XML inválido no meio do lote
      // não pode derrubar os demais que já foram importados com sucesso.
      let importadas = 0
      let duplicadas = 0
      const erros: string[] = []
      for (const file of files) {
        const form = new FormData()
        form.append('arquivo', file)
        try {
          const res = await api.post(`/empresas/${selectedEmpresa}/notas/importar-xml`, form)
          importadas += res.data.importadas ?? 0
          duplicadas += res.data.duplicadas ?? 0
          if (res.data.erros?.length) erros.push(...res.data.erros)
        } catch (e: unknown) {
          erros.push(`${file.name}: ${extractApiError(e)}`)
        }
      }
      return { importadas, duplicadas, erros }
    },
    onSuccess: (d) => {
      toast({
        title: d.importadas > 0 ? 'Importação concluída' : 'Nenhuma nota importada',
        description: `${d.importadas} nota(s) importada(s), ${d.duplicadas} duplicada(s) ignorada(s).${d.erros.length ? ` ${d.erros.length} erro(s) — veja os detalhes abaixo.` : ''}`,
        variant: d.erros.length && d.importadas === 0 ? 'destructive' : d.erros.length ? 'default' : 'success',
      })
      setImportResult(d)
      qc.invalidateQueries({ queryKey: ['notas', selectedEmpresa] })
    },
    onError: (e: unknown) => toast({ title: 'Erro ao importar XML', description: extractApiError(e), variant: 'destructive' }),
  })

  const handleXmlFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) xmlMutation.mutate(files)
    e.target.value = ''
  }

  const ARQUIVO_VALIDO_RE = /\.(xml|zip|pdf|png|jpe?g)$/i

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!selectedEmpresa) return
    if (!Array.from(e.dataTransfer.types).includes('Files')) return
    dragCounter.current += 1
    setIsDragging(true)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = Math.max(0, dragCounter.current - 1)
    if (dragCounter.current === 0) setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setIsDragging(false)

    if (!selectedEmpresa) {
      toast({ title: 'Selecione uma empresa', description: 'Escolha a empresa antes de soltar o arquivo.', variant: 'destructive' })
      return
    }

    const soltos = Array.from(e.dataTransfer.files)
    const validos = soltos.filter(f => ARQUIVO_VALIDO_RE.test(f.name))
    if (validos.length === 0) {
      toast({ title: 'Arquivo inválido', description: 'Solte arquivos .xml, .zip, .pdf, .png ou .jpg.', variant: 'destructive' })
      return
    }
    if (validos.length < soltos.length) {
      toast({ title: 'Alguns arquivos foram ignorados', description: 'Só .xml, .zip, .pdf, .png e .jpg são aceitos.', variant: 'default' })
    }
    xmlMutation.mutate(validos)
  }

  const items: any[] = notas?.items ?? []
  const total: number = notas?.total ?? 0

  return (
    <div
      className="space-y-6 relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-none">
          <div className="rounded-lg border-2 border-dashed border-primary bg-card px-12 py-10 text-center shadow-lg">
            <FileUp className="mx-auto h-10 w-10 text-primary mb-3" />
            <p className="text-lg font-medium">Solte o(s) arquivo(s) aqui</p>
            <p className="text-sm text-muted-foreground">XML, ZIP, PDF ou imagem de notas fiscais</p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notas Fiscais</h1>
          <p className="text-muted-foreground">
            NF-e e NFS-e associadas às transações
            {selectedEmpresa && ' · arraste arquivos .xml, .zip, .pdf ou imagem para esta página para importar'}
          </p>
        </div>
        {selectedEmpresa && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={xmlMutation.isPending}
            >
              {xmlMutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Importando...</>
                : <><Upload className="h-4 w-4 mr-2" />Importar Nota</>}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xml,.XML,.zip,.ZIP,.pdf,.PDF,.png,.PNG,.jpg,.JPG,.jpeg,.JPEG"
              multiple
              className="hidden"
              onChange={handleXmlFile}
            />
            <Button onClick={() => setOpenCreate(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nova Nota
            </Button>
          </div>
        )}
      </div>

      {/* Resultado da importação */}
      {importResult && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="h-4 w-4" /> {importResult.importadas} importada(s)
              </span>
              <span className="text-muted-foreground">{importResult.duplicadas} duplicada(s) ignorada(s)</span>
              {importResult.erros.length > 0 && (
                <span className="flex items-center gap-1 text-amber-700 font-medium">
                  <AlertCircle className="h-4 w-4" /> {importResult.erros.length} erro(s)
                </span>
              )}
            </div>
            <button onClick={() => setImportResult(null)} className="text-xs text-muted-foreground hover:text-foreground">Fechar</button>
          </div>
          {importResult.erros.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {importResult.erros.map((erro, i) => (
                <div key={i} className="text-xs text-amber-800 bg-amber-50 px-2 py-1.5 rounded">
                  {erro}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
            <div className="min-w-[120px]">
              <label className="text-sm font-medium mb-1 block">Tipo</label>
              <Select value={tipoFiltro} onValueChange={v => { setTipoFiltro(v); setPage(1) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="nfe">NF-e</SelectItem>
                  <SelectItem value="nfse">NFS-e</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[130px]">
              <label className="text-sm font-medium mb-1 block">Status</label>
              <Select value={statusFiltro} onValueChange={v => { setStatusFiltro(v); setPage(1) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="associada">Associada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Busca */}
          <div className="flex gap-4 flex-wrap items-end mt-4 pt-4 border-t">
            <div className="min-w-[140px]">
              <label className="text-sm font-medium mb-1 block">Número</label>
              <Input
                placeholder="Buscar por número"
                value={buscaInputs.numero}
                onChange={e => setBuscaInputs(b => ({ ...b, numero: e.target.value }))}
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="text-sm font-medium mb-1 block">Emitente</label>
              <Input
                placeholder="Buscar por nome do emitente"
                value={buscaInputs.emitente}
                onChange={e => setBuscaInputs(b => ({ ...b, emitente: e.target.value }))}
              />
            </div>
            <div className="min-w-[160px]">
              <label className="text-sm font-medium mb-1 block">CNPJ</label>
              <Input
                placeholder="Emitente ou destinatário"
                value={buscaInputs.cnpj}
                onChange={e => setBuscaInputs(b => ({ ...b, cnpj: e.target.value }))}
              />
            </div>
            <div className="min-w-[180px]">
              <label className="text-sm font-medium mb-1 block">Chave de Acesso</label>
              <Input
                placeholder="Trecho da chave (44 dígitos)"
                value={buscaInputs.chave_acesso}
                onChange={e => setBuscaInputs(b => ({ ...b, chave_acesso: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Emissão de</label>
              <Input type="date" value={dataDe} onChange={e => { setDataDe(e.target.value); setPage(1) }} className="w-40" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">até</label>
              <Input type="date" value={dataAte} onChange={e => { setDataAte(e.target.value); setPage(1) }} className="w-40" />
            </div>
            {filtrosAtivos && (
              <Button variant="ghost" size="sm" onClick={limparFiltros}>Limpar busca</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Notas {total > 0 && <span className="text-base font-normal text-muted-foreground">({total} total)</span>}</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedEmpresa ? (
            <p className="text-muted-foreground text-center py-8">Selecione uma empresa</p>
          ) : isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {filtrosAtivos ? 'Nenhuma nota fiscal encontrada com esses filtros.' : 'Nenhuma nota fiscal cadastrada.'}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-3 px-2">Tipo</th>
                      <th className="text-left py-3 px-2">Número</th>
                      <th className="text-left py-3 px-2">Emitente</th>
                      <th className="text-left py-3 px-2">Emissão</th>
                      <th className="text-right py-3 px-2">Valor</th>
                      <th className="text-center py-3 px-2">Status</th>
                      <th className="text-center py-3 px-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((n: any) => (
                      <tr key={n.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="uppercase text-xs">{n.tipo}</Badge>
                            {n.origem === 'ocr' && (
                              <Badge
                                variant="outline"
                                className="text-xs text-amber-700 border-amber-300"
                                title="Extraída de PDF/imagem por OCR — sem verificação de assinatura digital."
                              >
                                OCR
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 font-mono text-xs">{n.numero}{n.serie ? `-${n.serie}` : ''}</td>
                        <td className="py-2 px-2 max-w-[180px] truncate">
                          <p>{n.nome_emitente ?? '—'}</p>
                          <p className="text-xs text-muted-foreground">{n.cnpj_emitente}</p>
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">{formatDate(n.data_emissao)}</td>
                        <td className="py-2 px-2 text-right font-mono text-green-600">{formatCurrency(n.valor)}</td>
                        <td className="py-2 px-2 text-center">
                          <Badge variant={STATUS_COLORS[n.status] ?? 'outline'}>{n.status}</Badge>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex gap-1 justify-center">
                            {n.status === 'pendente' && (
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setOpenAssociar(n.id)}>
                                <Link2 className="h-3 w-3 mr-1" /> Associar
                              </Button>
                            )}
                            {n.status !== 'cancelada' && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                onClick={() => { if (confirm('Cancelar esta nota fiscal?')) cancelarMutation.mutate(n.id) }}>
                                <XCircle className="h-3 w-3 mr-1" /> Cancelar
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

      {/* Modal: Nova Nota */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Nota Fiscal</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select defaultValue="nfe" onValueChange={v => setValue('tipo', v as 'nfe' | 'nfse')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nfe">NF-e (Produto)</SelectItem>
                    <SelectItem value="nfse">NFS-e (Serviço)</SelectItem>
                  </SelectContent>
                </Select>
                {errors.tipo && <p className="text-xs text-destructive">{errors.tipo.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Número</Label>
                <Input placeholder="000001" {...register('numero')} />
                {errors.numero && <p className="text-xs text-destructive">{errors.numero.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Série <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input placeholder="1" {...register('serie')} />
              </div>
              <div className="space-y-1">
                <Label>Data de Emissão</Label>
                <Input type="date" {...register('data_emissao')} />
                {errors.data_emissao && <p className="text-xs text-destructive">{errors.data_emissao.message}</p>}
              </div>
              <div className="space-y-1 col-span-2">
                <Label>CNPJ Emitente</Label>
                <Input placeholder="12.345.678/0001-90" {...register('cnpj_emitente')} />
                {errors.cnpj_emitente && <p className="text-xs text-destructive">{errors.cnpj_emitente.message}</p>}
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Nome Emitente <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input placeholder="FORNECEDOR XYZ LTDA" {...register('nome_emitente')} />
              </div>
              <div className="space-y-1">
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" placeholder="0,00" {...register('valor')} />
                {errors.valor && <p className="text-xs text-destructive">{errors.valor.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Chave de Acesso <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input placeholder="44 dígitos" {...register('chave_acesso')} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Observação <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input placeholder="..." {...register('observacao')} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpenCreate(false); reset() }}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : 'Criar Nota'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Associar Transação */}
      <Dialog open={!!openAssociar} onOpenChange={o => { if (!o) setOpenAssociar(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Associar Transação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Selecione a transação pendente que corresponde a esta nota fiscal:</p>
            {transacoesPendentes.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Nenhuma transação pendente encontrada.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2">
                {transacoesPendentes.map((t: any) => (
                  <button
                    key={t.id}
                    className="w-full text-left p-3 rounded-md border hover:bg-accent transition-colors"
                    onClick={() => openAssociar && associarMutation.mutate({ notaId: openAssociar, transacaoId: t.id })}
                    disabled={associarMutation.isPending}
                  >
                    <p className="font-medium text-sm">{t.historico || '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(t.data)} · {t.dc === 'D' ? 'Débito' : t.dc === 'C' ? 'Crédito' : '—'} · {formatCurrency(t.valor)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAssociar(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
