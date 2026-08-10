import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEmpresaDefault } from '@/hooks/useEmpresaDefault'
import { api } from '@/lib/api'
import { formatCurrency, formatDate, extractApiError } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  CreditCard, Plus, ChevronRight, ChevronLeft, Trash2, Pencil,
  Upload, Loader2, LinkIcon, Unlink, FileText,
} from 'lucide-react'
import { useEmpresas } from '@/hooks/useEmpresas'

// ── tipos ─────────────────────────────────────────────────────────────────────

interface Cartao {
  id: string; nome: string; bandeira: string; ultimos_digitos: string | null
  dia_fechamento: number; dia_vencimento: number; limite: number | null
  ativo: boolean; total_faturas: number; fatura_aberta_valor: number | null
}

interface Fatura {
  id: string; cartao_id: string; cartao_nome: string; cartao_bandeira: string
  cartao_digitos: string | null; competencia: string; data_fechamento: string | null
  data_vencimento: string | null; valor_total: number; status: string
  transacao_id: string | null; observacao: string | null; total_lancamentos: number
}

interface Lancamento {
  id: string; fatura_id: string; data_compra: string
  descricao: string; valor: number; conta_id: string | null
  parcela_atual: number | null; parcela_total: number | null
}

interface Transacao { id: string; data: string; historico: string; valor: number; dc: string }

// ── utils ─────────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; variant: any }> = {
  aberta:  { label: 'Aberta',  variant: 'default'     },
  fechada: { label: 'Fechada', variant: 'secondary'   },
  paga:    { label: 'Paga',    variant: 'outline'     },
}

const BANDEIRA_LABEL: Record<string, string> = {
  visa: 'Visa', mastercard: 'Mastercard', elo: 'Elo',
  amex: 'Amex', hipercard: 'Hipercard', outros: 'Outros',
}

// ── componente principal ──────────────────────────────────────────────────────

export default function CartoesPage() {
  const qc = useQueryClient()
  const [selectedEmpresa, setSelectedEmpresa] = useEmpresaDefault()

  // navegação: null = lista cartões, cartao = lista faturas, fatura = lista lançamentos
  const [viewCartao, setViewCartao] = useState<Cartao | null>(null)
  const [viewFatura, setViewFatura] = useState<Fatura | null>(null)

  // modals
  const [modalNovoCartao, setModalNovoCartao] = useState(false)
  const [modalNovaFatura, setModalNovaFatura] = useState(false)
  const [modalNovoLanc, setModalNovoLanc] = useState(false)
  const [modalAssociar, setModalAssociar] = useState(false)
  const [modalDeleteCartao, setModalDeleteCartao] = useState<Cartao | null>(null)
  const [modalDeleteFatura, setModalDeleteFatura] = useState<Fatura | null>(null)

  // form states
  const [formCartao, setFormCartao] = useState({
    nome: '', bandeira: 'visa', ultimos_digitos: '',
    dia_fechamento: '10', dia_vencimento: '15', limite: '',
  })
  const [formFatura, setFormFatura] = useState({ competencia: '', data_vencimento: '', observacao: '' })
  const [formLanc, setFormLanc] = useState({ data_compra: '', descricao: '', valor: '', parcela_atual: '', parcela_total: '' })
  const [transacaoSelecionada, setTransacaoSelecionada] = useState('')

  const csvRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLInputElement>(null)

  // ── queries ─────────────────────────────────────────────────────────────────

  const { data: empresas = [] } = useEmpresas()

  const { data: cartoes, isLoading: loadingCartoes } = useQuery<{ items: Cartao[] }>({
    queryKey: ['cartoes', selectedEmpresa],
    queryFn: () => api.get(`/empresas/${selectedEmpresa}/cartoes`).then(r => r.data),
    enabled: !!selectedEmpresa,
  })

  const { data: faturas, isLoading: loadingFaturas } = useQuery<{ items: Fatura[] }>({
    queryKey: ['faturas', selectedEmpresa, viewCartao?.id],
    queryFn: () =>
      api.get(`/empresas/${selectedEmpresa}/cartoes/${viewCartao!.id}/faturas`).then(r => r.data),
    enabled: !!viewCartao,
  })

  const { data: lancamentos, isLoading: loadingLanc } = useQuery<{ items: Lancamento[]; total: number; valor_total: number }>({
    queryKey: ['lancamentos', selectedEmpresa, viewCartao?.id, viewFatura?.id],
    queryFn: () =>
      api.get(`/empresas/${selectedEmpresa}/cartoes/${viewCartao!.id}/faturas/${viewFatura!.id}/lancamentos`).then(r => r.data),
    enabled: !!viewFatura,
  })

  const { data: transacoesPendentes = [] } = useQuery<Transacao[]>({
    queryKey: ['transacoes-pendentes', selectedEmpresa],
    queryFn: () =>
      api.get(`/empresas/${selectedEmpresa}/extrato?status=pendente&page_size=100`).then(r => r.data.items ?? []),
    enabled: modalAssociar && !!selectedEmpresa,
  })

  // ── invalidações ────────────────────────────────────────────────────────────

  const invCartoes  = () => qc.invalidateQueries({ queryKey: ['cartoes', selectedEmpresa] })
  const invFaturas  = () => qc.invalidateQueries({ queryKey: ['faturas', selectedEmpresa, viewCartao?.id] })
  const invLanc     = () => qc.invalidateQueries({ queryKey: ['lancamentos', selectedEmpresa, viewCartao?.id, viewFatura?.id] })

  // ── mutations ────────────────────────────────────────────────────────────────

  const criarCartaoMut = useMutation({
    mutationFn: () => api.post(`/empresas/${selectedEmpresa}/cartoes`, {
      nome: formCartao.nome, bandeira: formCartao.bandeira,
      ultimos_digitos: formCartao.ultimos_digitos || null,
      dia_fechamento: Number(formCartao.dia_fechamento),
      dia_vencimento: Number(formCartao.dia_vencimento),
      limite: formCartao.limite ? Number(formCartao.limite) : null,
    }),
    onSuccess: () => { invCartoes(); toast({ title: 'Cartão cadastrado!', variant: 'success' }); setModalNovoCartao(false) },
    onError: (e: unknown) => toast({ title: 'Erro', description: extractApiError(e), variant: 'destructive' }),
  })

  const deletarCartaoMut = useMutation({
    mutationFn: (id: string) => api.delete(`/empresas/${selectedEmpresa}/cartoes/${id}`),
    onSuccess: () => { invCartoes(); toast({ title: 'Cartão removido.', variant: 'success' }); setModalDeleteCartao(null) },
    onError: (e: unknown) => toast({ title: 'Erro', description: extractApiError(e), variant: 'destructive' }),
  })

  const criarFaturaMut = useMutation({
    mutationFn: () => api.post(`/empresas/${selectedEmpresa}/cartoes/${viewCartao!.id}/faturas`, {
      competencia: formFatura.competencia,
      data_vencimento: formFatura.data_vencimento ? new Date(formFatura.data_vencimento).toISOString() : null,
      observacao: formFatura.observacao || null,
    }),
    onSuccess: () => { invFaturas(); invCartoes(); toast({ title: 'Fatura criada!', variant: 'success' }); setModalNovaFatura(false) },
    onError: (e: unknown) => toast({ title: 'Erro', description: extractApiError(e), variant: 'destructive' }),
  })

  const fecharFaturaMut = useMutation({
    mutationFn: (f: Fatura) => api.patch(
      `/empresas/${selectedEmpresa}/cartoes/${viewCartao!.id}/faturas/${f.id}`,
      { status: 'fechada' }
    ),
    onSuccess: () => { invFaturas(); toast({ title: 'Fatura fechada.', variant: 'success' }) },
    onError: (e: unknown) => toast({ title: 'Erro', description: extractApiError(e), variant: 'destructive' }),
  })

  const associarMut = useMutation({
    mutationFn: () => api.post(
      `/empresas/${selectedEmpresa}/cartoes/${viewCartao!.id}/faturas/${viewFatura!.id}/associar-transacao`,
      { transacao_id: transacaoSelecionada }
    ),
    onSuccess: (res) => {
      invFaturas(); invLanc()
      setViewFatura(res.data)
      toast({ title: 'Fatura marcada como paga!', variant: 'success' })
      setModalAssociar(false)
    },
    onError: (e: unknown) => toast({ title: 'Erro', description: extractApiError(e), variant: 'destructive' }),
  })

  const desassociarMut = useMutation({
    mutationFn: () => api.delete(
      `/empresas/${selectedEmpresa}/cartoes/${viewCartao!.id}/faturas/${viewFatura!.id}/associar-transacao`
    ),
    onSuccess: (res) => {
      invFaturas(); setViewFatura(res.data)
      toast({ title: 'Associação removida.', variant: 'success' })
    },
    onError: (e: unknown) => toast({ title: 'Erro', description: extractApiError(e), variant: 'destructive' }),
  })

  const adicionarLancMut = useMutation({
    mutationFn: () => api.post(
      `/empresas/${selectedEmpresa}/cartoes/${viewCartao!.id}/faturas/${viewFatura!.id}/lancamentos`,
      {
        data_compra: new Date(formLanc.data_compra).toISOString(),
        descricao: formLanc.descricao,
        valor: Number(formLanc.valor),
        parcela_atual: formLanc.parcela_atual ? Number(formLanc.parcela_atual) : null,
        parcela_total: formLanc.parcela_total ? Number(formLanc.parcela_total) : null,
      }
    ),
    onSuccess: () => {
      invLanc(); invFaturas()
      toast({ title: 'Lançamento adicionado!', variant: 'success' })
      setModalNovoLanc(false)
      setFormLanc({ data_compra: '', descricao: '', valor: '', parcela_atual: '', parcela_total: '' })
    },
    onError: (e: unknown) => toast({ title: 'Erro', description: extractApiError(e), variant: 'destructive' }),
  })

  const removerLancMut = useMutation({
    mutationFn: (id: string) => api.delete(
      `/empresas/${selectedEmpresa}/cartoes/${viewCartao!.id}/faturas/${viewFatura!.id}/lancamentos/${id}`
    ),
    onSuccess: () => { invLanc(); invFaturas(); toast({ title: 'Lançamento removido.', variant: 'success' }) },
    onError: (e: unknown) => toast({ title: 'Erro', description: extractApiError(e), variant: 'destructive' }),
  })

  const csvMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('arquivo', file)
      return api.post(
        `/empresas/${selectedEmpresa}/cartoes/${viewCartao!.id}/faturas/${viewFatura!.id}/lancamentos/importar-csv`,
        fd
      )
    },
    onSuccess: (res) => {
      invLanc(); invFaturas()
      const { importados, erros } = res.data
      toast({ title: `${importados} lançamentos importados.${erros.length ? ` (${erros.length} erros)` : ''}`, variant: 'success' })
    },
    onError: (e: unknown) => toast({ title: 'Erro', description: extractApiError(e), variant: 'destructive' }),
  })

  const pdfMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('arquivo', file)
      return api.post(
        `/empresas/${selectedEmpresa}/cartoes/${viewCartao!.id}/faturas/${viewFatura!.id}/lancamentos/importar-pdf`,
        fd
      )
    },
    onSuccess: (res) => {
      invLanc(); invFaturas()
      const { importados, duplicados, erros } = res.data
      toast({
        title: importados > 0 ? `${importados} lançamentos importados da fatura.` : 'Nenhum lançamento importado.',
        description: `${duplicados} duplicado(s) ignorado(s).${erros?.length ? ` ${erros.length} erro(s).` : ''}`,
        variant: erros?.length && importados === 0 ? 'destructive' : 'success',
      })
    },
    onError: (e: unknown) => toast({
      title: 'Erro ao importar PDF',
      description: extractApiError(e) || 'Não foi possível extrair os lançamentos. Tente importar via CSV.',
      variant: 'destructive',
    }),
  })

  // ── render helpers ────────────────────────────────────────────────────────

  const breadcrumb = (
    <div className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
      <button
        onClick={() => { setViewCartao(null); setViewFatura(null) }}
        className={viewCartao ? 'hover:text-foreground transition-colors' : 'text-foreground font-medium'}
      >
        Cartões
      </button>
      {viewCartao && (
        <>
          <ChevronRight className="h-3 w-3" />
          <button
            onClick={() => setViewFatura(null)}
            className={viewFatura ? 'hover:text-foreground transition-colors' : 'text-foreground font-medium'}
          >
            {viewCartao.nome}
          </button>
        </>
      )}
      {viewFatura && (
        <>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">Fatura {viewFatura.competencia}</span>
        </>
      )}
    </div>
  )

  // ── TELA 1 — Lista de Cartões ─────────────────────────────────────────────

  const telaCartoes = (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold">Cartão de Crédito</h1>
        {selectedEmpresa && (
          <Button size="sm" onClick={() => setModalNovoCartao(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo Cartão
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <Select value={selectedEmpresa} onValueChange={v => { setSelectedEmpresa(v); setViewCartao(null); setViewFatura(null) }}>
            <SelectTrigger className="max-w-xs"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
            <SelectContent>
              {empresas.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.razao_social}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Cartões Cadastrados</CardTitle></CardHeader>
        <CardContent>
          {!selectedEmpresa ? (
            <p className="text-muted-foreground text-center py-8">Selecione uma empresa</p>
          ) : loadingCartoes ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !cartoes?.items.length ? (
            <div className="text-center py-8 space-y-2">
              <CreditCard className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground text-sm">Nenhum cartão cadastrado.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {cartoes.items.map(c => (
                <div
                  key={c.id}
                  className="border rounded-lg p-4 space-y-2 hover:shadow-md transition-shadow cursor-pointer bg-card"
                  onClick={() => setViewCartao(c)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-primary shrink-0" />
                      <div>
                        <p className="font-semibold text-sm">{c.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {BANDEIRA_LABEL[c.bandeira]}{c.ultimos_digitos ? ` •••• ${c.ultimos_digitos}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setModalDeleteCartao(c)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>Fecha dia {c.dia_fechamento} · Vence dia {c.dia_vencimento}</p>
                    {c.limite && <p>Limite: {formatCurrency(c.limite)}</p>}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-muted-foreground">{c.total_faturas} faturas</span>
                    {c.fatura_aberta_valor != null && (
                      <span className="text-sm font-semibold text-orange-600">
                        Aberta: {formatCurrency(c.fatura_aberta_valor)}
                      </span>
                    )}
                    <Badge variant={c.ativo ? 'default' : 'secondary'} className="text-xs">
                      {c.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )

  // ── TELA 2 — Faturas do Cartão ────────────────────────────────────────────

  const telaFaturas = viewCartao && (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">{viewCartao.nome}</h1>
          {breadcrumb}
        </div>
        <Button size="sm" onClick={() => setModalNovaFatura(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova Fatura
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Faturas</CardTitle></CardHeader>
        <CardContent>
          {loadingFaturas ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !faturas?.items.length ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma fatura cadastrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-3 px-3">Competência</th>
                    <th className="text-left py-3 px-3">Vencimento</th>
                    <th className="text-right py-3 px-3">Valor Total</th>
                    <th className="text-center py-3 px-3">Lançamentos</th>
                    <th className="text-center py-3 px-3">Status</th>
                    <th className="text-right py-3 px-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {faturas.items.map(f => {
                    const st = STATUS_BADGE[f.status] ?? { label: f.status, variant: 'outline' }
                    return (
                      <tr key={f.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="py-2 px-3 font-medium cursor-pointer hover:text-primary"
                          onClick={() => { setViewFatura(f) }}>
                          {f.competencia}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {f.data_vencimento ? formatDate(f.data_vencimento) : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">
                          {formatCurrency(f.valor_total)}
                        </td>
                        <td className="py-2 px-3 text-center text-muted-foreground">
                          {f.total_lancamentos}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              title="Ver lançamentos" onClick={() => setViewFatura(f)}>
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                            {f.status === 'aberta' && (
                              <Button variant="ghost" size="icon" className="h-7 w-7"
                                title="Fechar fatura"
                                onClick={() => fecharFaturaMut.mutate(f)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )

  // ── TELA 3 — Lançamentos da Fatura ────────────────────────────────────────

  const telaLancamentos = viewFatura && viewCartao && (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Fatura {viewFatura.competencia}</h1>
          {breadcrumb}
        </div>
        {viewFatura.status !== 'paga' && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { csvRef.current?.click() }}>
              <Upload className="h-4 w-4 mr-2" /> Importar CSV
            </Button>
            <input ref={csvRef} type="file" accept=".csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) csvMut.mutate(f); e.target.value = '' }} />
            <Button variant="outline" size="sm" onClick={() => { pdfRef.current?.click() }} disabled={pdfMut.isPending}>
              {pdfMut.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...</>
                : <><FileText className="h-4 w-4 mr-2" /> Importar PDF</>}
            </Button>
            <input ref={pdfRef} type="file" accept=".pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) pdfMut.mutate(f); e.target.value = '' }} />
            <Button size="sm" onClick={() => setModalNovoLanc(true)}>
              <Plus className="h-4 w-4 mr-2" /> Lançamento
            </Button>
          </div>
        )}
      </div>

      {/* Resumo da fatura
          Total/Lançamentos vêm da query de lançamentos (sempre fresca após
          import/adicionar/remover) em vez do snapshot de viewFatura, que só é
          atualizado quando o usuário reabre a fatura na lista. */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-xl font-bold">{formatCurrency(lancamentos?.valor_total ?? viewFatura.valor_total)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Lançamentos</p>
          <p className="text-xl font-bold">{lancamentos?.total ?? viewFatura.total_lancamentos}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Status</p>
          <Badge variant={STATUS_BADGE[viewFatura.status]?.variant} className="mt-1">
            {STATUS_BADGE[viewFatura.status]?.label}
          </Badge>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Vencimento</p>
          <p className="text-sm font-semibold">
            {viewFatura.data_vencimento ? formatDate(viewFatura.data_vencimento) : '—'}
          </p>
        </CardContent></Card>
      </div>

      {/* Botões de pagamento */}
      <div className="flex gap-2">
        {!viewFatura.transacao_id ? (
          <Button variant="outline" size="sm" onClick={() => { setTransacaoSelecionada(''); setModalAssociar(true) }}
            disabled={viewFatura.status === 'aberta'}>
            <LinkIcon className="h-4 w-4 mr-2" />
            Associar Pagamento
          </Button>
        ) : (
          <Button variant="outline" size="sm"
            onClick={() => desassociarMut.mutate()} disabled={desassociarMut.isPending}>
            <Unlink className="h-4 w-4 mr-2" />
            Desvincular Pagamento
          </Button>
        )}
      </div>

      {/* Tabela de lançamentos */}
      <Card>
        <CardHeader>
          <CardTitle>
            Lançamentos
            {lancamentos && (
              <span className="text-base font-normal text-muted-foreground ml-2">
                ({lancamentos.total} itens · {formatCurrency(lancamentos.valor_total)})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingLanc ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !lancamentos?.items.length ? (
            <p className="text-muted-foreground text-center py-8">
              {viewFatura.status === 'paga' ? 'Fatura paga sem lançamentos registrados.' : 'Nenhum lançamento. Adicione manualmente ou importe um CSV.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-3 px-3">Data</th>
                    <th className="text-left py-3 px-3">Descrição</th>
                    <th className="text-center py-3 px-3">Parcela</th>
                    <th className="text-right py-3 px-3">Valor</th>
                    {viewFatura.status !== 'paga' && <th className="py-3 px-3"></th>}
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.items.map(l => (
                    <tr key={l.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-2 px-3 whitespace-nowrap">{formatDate(l.data_compra)}</td>
                      <td className="py-2 px-3">{l.descricao}</td>
                      <td className="py-2 px-3 text-center text-muted-foreground text-xs">
                        {l.parcela_atual && l.parcela_total ? `${l.parcela_atual}/${l.parcela_total}` : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{formatCurrency(l.valor)}</td>
                      {viewFatura.status !== 'paga' && (
                        <td className="py-2 px-3 text-right">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => removerLancMut.mutate(l.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )

  // ── RENDER PRINCIPAL ──────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {viewFatura ? telaLancamentos : viewCartao ? telaFaturas : telaCartoes}

      {/* ── Modal: Novo Cartão ── */}
      <Dialog open={modalNovoCartao} onOpenChange={setModalNovoCartao}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo Cartão de Crédito</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nome</label>
              <Input placeholder="Nubank Empresarial" value={formCartao.nome}
                onChange={e => setFormCartao(p => ({ ...p, nome: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Bandeira</label>
                <Select value={formCartao.bandeira} onValueChange={v => setFormCartao(p => ({ ...p, bandeira: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(BANDEIRA_LABEL).map(([v, l]) =>
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Últimos 4 dígitos</label>
                <Input placeholder="1234" maxLength={4} value={formCartao.ultimos_digitos}
                  onChange={e => setFormCartao(p => ({ ...p, ultimos_digitos: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Dia de Fechamento</label>
                <Input type="number" min={1} max={28} value={formCartao.dia_fechamento}
                  onChange={e => setFormCartao(p => ({ ...p, dia_fechamento: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Dia de Vencimento</label>
                <Input type="number" min={1} max={28} value={formCartao.dia_vencimento}
                  onChange={e => setFormCartao(p => ({ ...p, dia_vencimento: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Limite (opcional)</label>
              <Input type="number" placeholder="5000.00" value={formCartao.limite}
                onChange={e => setFormCartao(p => ({ ...p, limite: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalNovoCartao(false)}>Cancelar</Button>
            <Button onClick={() => criarCartaoMut.mutate()} disabled={!formCartao.nome || criarCartaoMut.isPending}>
              {criarCartaoMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Confirmar exclusão cartão ── */}
      <Dialog open={!!modalDeleteCartao} onOpenChange={() => setModalDeleteCartao(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remover Cartão</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Tem certeza que deseja remover <strong>{modalDeleteCartao?.nome}</strong>?
            Cartões com faturas em aberto não podem ser removidos.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalDeleteCartao(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={deletarCartaoMut.isPending}
              onClick={() => modalDeleteCartao && deletarCartaoMut.mutate(modalDeleteCartao.id)}>
              {deletarCartaoMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Nova Fatura ── */}
      <Dialog open={modalNovaFatura} onOpenChange={setModalNovaFatura}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Fatura</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Competência (mês)</label>
              <Input type="month" value={formFatura.competencia}
                onChange={e => setFormFatura(p => ({ ...p, competencia: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Data de Vencimento (opcional)</label>
              <Input type="date" value={formFatura.data_vencimento}
                onChange={e => setFormFatura(p => ({ ...p, data_vencimento: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Observação (opcional)</label>
              <Input placeholder="..." value={formFatura.observacao}
                onChange={e => setFormFatura(p => ({ ...p, observacao: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalNovaFatura(false)}>Cancelar</Button>
            <Button onClick={() => criarFaturaMut.mutate()} disabled={!formFatura.competencia || criarFaturaMut.isPending}>
              {criarFaturaMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Criar Fatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Novo Lançamento ── */}
      <Dialog open={modalNovoLanc} onOpenChange={setModalNovoLanc}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo Lançamento</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Data da Compra</label>
              <Input type="date" value={formLanc.data_compra}
                onChange={e => setFormLanc(p => ({ ...p, data_compra: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Descrição</label>
              <Input placeholder="Amazon Prime, Posto Shell..." value={formLanc.descricao}
                onChange={e => setFormLanc(p => ({ ...p, descricao: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Valor (R$)</label>
              <Input type="number" step="0.01" placeholder="129.90" value={formLanc.valor}
                onChange={e => setFormLanc(p => ({ ...p, valor: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Parcela Atual</label>
                <Input type="number" min={1} placeholder="1" value={formLanc.parcela_atual}
                  onChange={e => setFormLanc(p => ({ ...p, parcela_atual: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Total Parcelas</label>
                <Input type="number" min={1} placeholder="3" value={formLanc.parcela_total}
                  onChange={e => setFormLanc(p => ({ ...p, parcela_total: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalNovoLanc(false)}>Cancelar</Button>
            <Button onClick={() => adicionarLancMut.mutate()}
              disabled={!formLanc.data_compra || !formLanc.descricao || !formLanc.valor || adicionarLancMut.isPending}>
              {adicionarLancMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Associar Transação ── */}
      <Dialog open={modalAssociar} onOpenChange={setModalAssociar}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Associar Pagamento da Fatura</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Selecione a transação bancária que corresponde ao pagamento desta fatura ({formatCurrency(viewFatura?.valor_total ?? 0)}).
          </p>
          <div className="max-h-64 overflow-y-auto border rounded-md">
            {transacoesPendentes.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">Nenhuma transação pendente.</p>
            ) : transacoesPendentes.map(t => (
              <label
                key={t.id}
                className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors border-b last:border-b-0 ${transacaoSelecionada === t.id ? 'bg-primary/5' : ''}`}
              >
                <input type="radio" name="transacao" value={t.id}
                  checked={transacaoSelecionada === t.id}
                  onChange={() => setTransacaoSelecionada(t.id)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{t.historico}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(t.data)}</p>
                </div>
                <span className={`font-mono text-sm font-semibold ${t.dc === 'D' ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(t.valor)}
                </span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAssociar(false)}>Cancelar</Button>
            <Button onClick={() => associarMut.mutate()} disabled={!transacaoSelecionada || associarMut.isPending}>
              {associarMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
