import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useEmpresaDefault } from '@/hooks/useEmpresaDefault'
import { api } from '@/lib/api'
import { formatCurrency, formatDate, extractApiError } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ErroConsulta } from '@/components/ui/erro-consulta'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pagination } from '@/components/ui/pagination'
import { Download, Loader2, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useEmpresas } from '@/hooks/useEmpresas'

type ExportTipo =
  | 'lancamentos'
  | 'lancamentos_importacao'
  | 'nfe_entrada'
  | 'nfe_saida'
  | 'nfse_tomado'
  | 'nfse_prestado'
  | 'conferencia'

const EXPORT_LABELS: Record<ExportTipo, string> = {
  lancamentos: 'Lançamentos Contábeis',
  lancamentos_importacao: 'Exportar para Domínio',
  nfe_entrada: 'Baixa NF-e Entrada',
  nfe_saida: 'Baixa NF-e Saída',
  nfse_tomado: 'Baixa NFS-e Tomado',
  nfse_prestado: 'Baixa NFS-e Prestado',
  conferencia: 'Simples Conferência',
}

const FILENAMES: Record<ExportTipo, string> = {
  lancamentos: 'lancamentos_contabeis',
  lancamentos_importacao: 'lancamentos_importacao',
  nfe_entrada: 'baixa_nfe_entrada',
  nfe_saida: 'baixa_nfe_saida',
  nfse_tomado: 'baixa_nfse_tomado',
  nfse_prestado: 'baixa_nfse_prestado',
  conferencia: 'simples_conferencia',
}

export default function RegistrosPage() {
  const [selectedEmpresa, setSelectedEmpresa] = useEmpresaDefault()
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  const { data: empresas = [] } = useEmpresas()

  const buildParams = () => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('page_size', String(PAGE_SIZE))
    if (dataInicio) params.set('data_de', dataInicio)
    if (dataFim) params.set('data_ate', dataFim)
    return params.toString()
  }

  const { data: registros, isLoading, isError, error, refetch } = useQuery<any>({
    queryKey: ['registros', selectedEmpresa, dataInicio, dataFim, page],
    queryFn: () => api.get(`/empresas/${selectedEmpresa}/contabil?${buildParams()}`).then(r => r.data),
    enabled: !!selectedEmpresa,
  })

  const exportMutation = useMutation({
    mutationFn: async ({ tipo, formato }: { tipo: ExportTipo; formato: 'csv' | 'xlsx' | 'txt' }) => {
      const body: any = { formato, tipo }
      if (dataInicio) body.data_de = new Date(dataInicio).toISOString()
      if (dataFim) body.data_ate = new Date(dataFim + 'T23:59:59').toISOString()

      const res = await api.post(
        `/empresas/${selectedEmpresa}/exportacao/gerar`,
        body,
        { responseType: 'blob' }
      )
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${FILENAMES[tipo]}.${formato}`
      a.click()
      URL.revokeObjectURL(url)
    },
    onSuccess: (_d, vars) =>
      toast({
        title: vars.tipo === 'lancamentos_importacao'
          ? 'Arquivo para o Domínio exportado!'
          : `${EXPORT_LABELS[vars.tipo]} exportado!`,
        variant: 'success',
      }),
    onError: (e: unknown) =>
      toast({ title: 'Erro na exportação', description: extractApiError(e), variant: 'destructive' }),
  })

  const doExport = (tipo: ExportTipo, formato: 'csv' | 'xlsx' | 'txt') =>
    exportMutation.mutate({ tipo, formato })

  const items: any[] = registros?.items ?? []
  const total: number = registros?.total ?? 0
  const canExport = !!selectedEmpresa && !exportMutation.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold">Registros Contábeis</h1>

        {selectedEmpresa && (
          <div className="flex gap-2 flex-wrap">
            {/* Exportação padrão: lançamentos */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => doExport('lancamentos', 'csv')}
              disabled={!canExport}
            >
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => doExport('lancamentos', 'xlsx')}
              disabled={!canExport}
            >
              <Download className="h-4 w-4 mr-2" /> Excel
            </Button>

            {/* Exportações especializadas */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" disabled={!canExport}>
                  {exportMutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    : <Download className="h-4 w-4 mr-2" />}
                  Exportações Especializadas
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Domínio</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => doExport('lancamentos_importacao', 'xlsx')}>
                    Exportar para Domínio (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => doExport('lancamentos_importacao', 'csv')}>
                    Exportar para Domínio (.csv)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => doExport('lancamentos_importacao', 'txt')}>
                    Exportar para Domínio (.txt)
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">NF-e</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => doExport('nfe_entrada', 'xlsx')}>
                    Baixa NF-e Entrada (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => doExport('nfe_entrada', 'csv')}>
                    Baixa NF-e Entrada (.csv)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => doExport('nfe_saida', 'xlsx')}>
                    Baixa NF-e Saída (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => doExport('nfe_saida', 'csv')}>
                    Baixa NF-e Saída (.csv)
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">NFS-e</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => doExport('nfse_tomado', 'xlsx')}>
                    Baixa NFS-e Tomado (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => doExport('nfse_tomado', 'csv')}>
                    Baixa NFS-e Tomado (.csv)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => doExport('nfse_prestado', 'xlsx')}>
                    Baixa NFS-e Prestado (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => doExport('nfse_prestado', 'csv')}>
                    Baixa NFS-e Prestado (.csv)
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Conferência</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => doExport('conferencia', 'xlsx')}>
                    Simples Conferência (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => doExport('conferencia', 'csv')}>
                    Simples Conferência (.csv)
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1 block" htmlFor="pages-registros-empresa">Empresa</label>
              <Select value={selectedEmpresa} onValueChange={v => { setSelectedEmpresa(v); setPage(1) }}>
                <SelectTrigger id="pages-registros-empresa"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.razao_social}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block" htmlFor="pages-registros-de">De</label>
              <Input id="pages-registros-de" type="date" value={dataInicio} onChange={e => { setDataInicio(e.target.value); setPage(1) }} className="w-40" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block" htmlFor="pages-registros-ate">Até</label>
              <Input id="pages-registros-ate" type="date" value={dataFim} onChange={e => { setDataFim(e.target.value); setPage(1) }} className="w-40" />
            </div>
            {(dataInicio || dataFim) && (
              <Button variant="ghost" size="sm" className="self-end" onClick={() => { setDataInicio(''); setDataFim(''); setPage(1) }}>
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Lançamentos{' '}
            {total > 0 && (
              <span className="text-base font-normal text-muted-foreground">({total} total)</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedEmpresa ? (
            <p className="text-muted-foreground text-center py-8">Selecione uma empresa</p>
          ) : isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <ErroConsulta erro={error} contexto="os lançamentos" onTentarDeNovo={() => refetch()} />
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum lançamento encontrado. Execute o NEO primeiro.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-3 px-2">Data</th>
                      <th className="text-left py-3 px-2">Conta</th>
                      <th className="text-center py-3 px-2">D/C</th>
                      <th className="text-right py-3 px-2">Valor</th>
                      <th className="text-left py-3 px-2">Histórico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r: any) => (
                      <tr key={r.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="py-2 px-2 whitespace-nowrap">
                          {formatDate(r.data_lancamento ?? r.data_competencia)}
                        </td>
                        <td className="py-2 px-2 font-mono text-xs">
                          {r.conta?.codigo ?? r.conta_id}
                        </td>
                        <td
                          className={`py-2 px-2 text-center font-bold ${
                            r.dc === 'D' ? 'text-danger' : 'text-success'
                          }`}
                        >
                          {r.dc}
                        </td>
                        <td className="py-2 px-2 text-right font-mono">
                          {formatCurrency(r.valor)}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground text-xs truncate max-w-[200px]" title={r.historico ?? undefined}>
                          {r.historico ?? '-'}
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
