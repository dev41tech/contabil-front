import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useEmpresaDefault } from '@/hooks/useEmpresaDefault'
import { api } from '@/lib/api'
import { formatCurrency, formatDate, extractApiError } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Pagination } from '@/components/ui/pagination'
import { Upload, Loader2, RefreshCw, AlertTriangle, Download } from 'lucide-react'

const STATUS_COLORS: Record<string, any> = {
  pendente: 'warning',
  conciliado: 'success',
  ignorado: 'secondary',
}

export default function ExtratoPage() {
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [selectedEmpresa, setSelectedEmpresa] = useEmpresaDefault(
    searchParams.get('empresa') ?? ''
  )
  const [selectedAgencia, setSelectedAgencia] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('todos')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  const { data: empresas = [] } = useQuery<any[]>({
    queryKey: ['empresas'],
    queryFn: () => api.get('/empresas').then(r => r.data.items ?? r.data),
  })

  const { data: agencias = [] } = useQuery<any[]>({
    queryKey: ['agencias', selectedEmpresa],
    queryFn: () => api.get(`/empresas/${selectedEmpresa}/agencias`).then(r => r.data.items ?? r.data),
    enabled: !!selectedEmpresa,
  })

  const buildParams = () => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('page_size', String(PAGE_SIZE))
    if (selectedAgencia) params.set('agencia_id', selectedAgencia)
    if (statusFiltro !== 'todos') params.set('status', statusFiltro)
    if (dataInicio) params.set('data_de', dataInicio)
    if (dataFim) params.set('data_ate', dataFim)
    return params.toString()
  }

  const { data: extrato, isLoading, refetch } = useQuery<any>({
    queryKey: ['extrato', selectedEmpresa, selectedAgencia, statusFiltro, dataInicio, dataFim, page],
    queryFn: () => api.get(`/empresas/${selectedEmpresa}/extrato?${buildParams()}`).then(r => r.data),
    enabled: !!selectedEmpresa,
  })

  const [uploadError, setUploadError] = useState<string | null>(null)

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedAgencia) throw new Error('Selecione uma agência primeiro')
      const form = new FormData()
      form.append('arquivo', file)
      return api.post(`/empresas/${selectedEmpresa}/extrato/importar?agencia_id=${selectedAgencia}`, form)
    },
    onSuccess: (res) => {
      setUploadError(null)
      const d = res.data
      const tipo = d.tipo ?? 'Extrato'
      toast({
        title: `${tipo} importado com sucesso!`,
        description: `${d.importadas ?? 0} novas transações, ${d.duplicadas ?? 0} duplicadas ignoradas.`,
        variant: 'success',
      })
      setPage(1)
      qc.invalidateQueries({ queryKey: ['extrato'] })
    },
    onError: (e: unknown) => {
      const msg = extractApiError(e)
      setUploadError(msg)
      toast({ title: 'Erro ao importar extrato', description: msg, variant: 'destructive' })
    },
  })

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadMutation.mutate(file)
    e.target.value = ''
  }

  // Exporta as MESMAS linhas que a tela está mostrando — mesmos filtros de
  // agência, status e período. A paginação não entra: o relatório traz o
  // período inteiro, não só a página aberta.
  const exportMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(
        `/empresas/${selectedEmpresa}/exportacao/gerar`,
        {
          formato: 'xlsx',
          tipo: 'extrato',
          agencia_id: selectedAgencia || null,
          status: statusFiltro !== 'todos' ? statusFiltro : null,
          data_de: dataInicio || null,
          data_ate: dataFim || null,
        },
        { responseType: 'blob' },
      )
      return data
    },
    onSuccess: (blob: Blob) => {
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `extrato_${new Date().toISOString().slice(0, 10)}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    },
    onError: (e: unknown) => {
      toast({
        title: 'Erro ao exportar extrato',
        description: extractApiError(e),
        variant: 'destructive',
      })
    },
  })

  const items: any[] = extrato?.items ?? []
  const total: number = extrato?.total ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Extrato Bancário</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportMutation.mutate()}
            disabled={!selectedEmpresa || total === 0 || exportMutation.isPending}
            title={total === 0 ? 'Nenhuma transação para exportar' : 'Exporta as transações com os filtros atuais'}
          >
            {exportMutation.isPending
              ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              : <Download className="h-4 w-4 mr-2" />}
            Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={!selectedEmpresa}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Linha 1: empresa, agência, importar */}
          <div className="flex gap-4 flex-wrap items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="text-sm font-medium mb-1 block">Empresa</label>
              <SearchableSelect
                value={selectedEmpresa}
                onValueChange={v => { setSelectedEmpresa(v); setSelectedAgencia(''); setPage(1) }}
                options={empresas.map((e: any) => ({ value: e.id, label: e.razao_social }))}
                placeholder="Selecione a empresa"
                searchPlaceholder="Buscar empresa..."
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="text-sm font-medium mb-1 block">Agência</label>
              <SearchableSelect
                value={selectedAgencia}
                onValueChange={v => { setSelectedAgencia(v); setPage(1) }}
                options={[
                  { value: '', label: 'Todas as agências' },
                  ...agencias.map((a: any) => ({
                    value: a.id,
                    label: `${a.banco_sigla} ${a.agencia}/${a.numero}`,
                  })),
                ]}
                placeholder="Todas as agências"
                searchPlaceholder="Buscar agência..."
                disabled={!selectedEmpresa}
              />
            </div>
            <div className="flex flex-col items-start gap-1">
              <Button
                onClick={() => fileRef.current?.click()}
                disabled={!selectedEmpresa || !selectedAgencia || uploadMutation.isPending}
              >
                {uploadMutation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Importando...</>
                  : <><Upload className="h-4 w-4 mr-2" />Importar OFX / PDF</>
                }
              </Button>
              {selectedEmpresa && !selectedAgencia && (
                <p className="text-xs text-muted-foreground">
                  Selecione uma agência específica para importar
                </p>
              )}
              <input ref={fileRef} type="file" accept=".ofx,.OFX,.pdf,.PDF" className="hidden" onChange={handleFile} />
            </div>
          </div>

          {/* Banner de erro de upload */}
          {uploadError && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-amber-800">Falha ao processar o arquivo</p>
                <p className="text-amber-700 mt-0.5">{uploadError}</p>
                {uploadError.toLowerCase().includes('openai') && (
                  <p className="text-xs text-amber-600 mt-1">
                    PDFs do Itaú são baseados em imagem e precisam de OCR via OpenAI Vision (GPT-4o).
                    Adicione <code className="bg-amber-100 px-1 rounded font-mono">OPENAI_API_KEY=sk-...</code> no arquivo <code className="bg-amber-100 px-1 rounded font-mono">.env</code> do servidor e reinicie.
                  </p>
                )}
              </div>
              <button onClick={() => setUploadError(null)} className="text-amber-500 hover:text-amber-700 shrink-0">✕</button>
            </div>
          )}

          {/* Linha 2: filtros */}
          <div className="flex gap-4 flex-wrap items-end border-t pt-4">
            <div className="min-w-[140px]">
              <label className="text-sm font-medium mb-1 block">Status</label>
              <Select value={statusFiltro} onValueChange={v => { setStatusFiltro(v); setPage(1) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="conciliado">Conciliado</SelectItem>
                  <SelectItem value="ignorado">Ignorado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">De</label>
              <Input type="date" value={dataInicio} onChange={e => { setDataInicio(e.target.value); setPage(1) }} className="w-40" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Até</label>
              <Input type="date" value={dataFim} onChange={e => { setDataFim(e.target.value); setPage(1) }} className="w-40" />
            </div>
            {(statusFiltro !== 'todos' || dataInicio || dataFim) && (
              <Button variant="ghost" size="sm" className="self-end" onClick={() => { setStatusFiltro('todos'); setDataInicio(''); setDataFim(''); setPage(1) }}>
                Limpar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transações {total > 0 && <span className="text-base font-normal text-muted-foreground">({total} total)</span>}</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedEmpresa ? (
            <p className="text-muted-foreground text-center py-8">Selecione uma empresa para ver as transações</p>
          ) : isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma transação encontrada. Importe um arquivo OFX ou PDF.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-3 px-2 w-28">Data</th>
                      <th className="text-left py-3 px-2">Histórico</th>
                      <th className="text-center py-3 px-2 w-8">D/C</th>
                      <th className="text-right py-3 px-2 w-32">Valor</th>
                      <th className="text-center py-3 px-2 w-28">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((t: any) => (
                      <tr key={t.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="py-2 px-2 whitespace-nowrap text-sm">
                          {formatDate(t.data)}
                        </td>
                        <td className="py-2 px-2 max-w-sm truncate text-sm">
                          {t.historico || '-'}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${t.dc === 'D' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {t.dc}
                          </span>
                        </td>
                        <td className={`py-2 px-2 text-right font-mono text-sm ${t.dc === 'D' ? 'text-red-600' : 'text-emerald-600'}`}>
                          {t.dc === 'D' ? '-' : '+'}{formatCurrency(t.valor)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Badge variant={STATUS_COLORS[t.status] ?? 'outline'}>{t.status}</Badge>
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
    </div>
  )
}
