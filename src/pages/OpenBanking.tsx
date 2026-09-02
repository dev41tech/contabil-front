import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEmpresaDefault } from '@/hooks/useEmpresaDefault'
import { api } from '@/lib/api'
import { formatDate, extractApiError } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Wifi, WifiOff, RefreshCw, Trash2, Plus, Loader2,
  CheckCircle2, AlertCircle, Clock, Building2, ArrowDownToLine,
} from 'lucide-react'
import { useEmpresas } from '@/hooks/useEmpresas'

// ── tipos ─────────────────────────────────────────────────────────────────────

interface Conexao {
  id: string
  empresa_id: string
  agencia_id: string | null
  provedor: string
  item_id: string
  instituicao_nome: string
  banco_sigla: string
  agencia_numero: string | null
  conta_numero: string | null
  status: string
  last_sync_at: string | null
  next_sync_at: string | null
  total_transacoes_sync: number
  erro_msg: string | null
}

interface ConnectTokenResponse {
  access_token: string
  provedor: string
  mock_mode: boolean
}

interface SyncResult {
  conexao_id: string
  importadas: number
  duplicadas: number
  erros: number
  periodo_inicio: string
  periodo_fim: string
  status: string
}

// ── utils ─────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; variant: any; icon: React.ElementType }> = {
  ativa:    { label: 'Ativa',    variant: 'default',    icon: CheckCircle2 },
  pendente: { label: 'Pendente', variant: 'secondary',  icon: Clock        },
  expirada: { label: 'Expirada', variant: 'secondary',  icon: WifiOff      },
  erro:     { label: 'Erro',     variant: 'destructive', icon: AlertCircle  },
}

// ── widget Pluggy (iframe + postMessage) ──────────────────────────────────────

function PluggyWidget({
  accessToken,
  onSuccess,
  onClose,
}: {
  accessToken: string
  onSuccess: (itemId: string) => void
  onClose: () => void
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== 'https://connect.pluggy.ai') return
      const { type, data } = event.data ?? {}
      if (type === 'close' && data?.item?.id) {
        onSuccess(data.item.id)
      } else if (type === 'close') {
        onClose()
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [onSuccess, onClose])

  const widgetUrl = `https://connect.pluggy.ai/?token=${encodeURIComponent(accessToken)}`

  return (
    <div className="relative w-full" style={{ height: 600 }}>
      <iframe
        ref={iframeRef}
        src={widgetUrl}
        className="w-full h-full rounded-md border"
        allow="camera; microphone"
        title="Pluggy Connect"
      />
    </div>
  )
}

// ── modal mock (sem credenciais Pluggy) ───────────────────────────────────────

const MOCK_BANKS = [
  'Nubank', 'Itaú Unibanco S.A.', 'Banco Bradesco S.A.',
  'Banco do Brasil S.A.', 'Banco Inter S.A.', 'C6 Bank S.A.',
  'Banco Santander (Brasil) S.A.', 'Banco Cooperativo Sicoob',
]

function MockConnectModal({
  open,
  onConnect,
  onClose,
  loading,
}: {
  open: boolean
  onConnect: (banco: string) => void
  onClose: () => void
  loading: boolean
}) {
  const [banco, setBanco] = useState(MOCK_BANKS[0])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-primary" />
            Conectar Banco — Modo Demo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-md bg-warning/15 border border-warning/40 p-3 text-sm text-warning">
            <p className="font-medium mb-1">⚠️ Modo demonstração ativo</p>
            <p>A conexão com bancos reais não está disponível neste ambiente. Para habilitá-la, acione o suporte.</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Selecione o banco</label>
            <Select value={banco} onValueChange={setBanco}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOCK_BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Será criada uma conexão simulada com dados fictícios para demonstração. A sincronização gerará transações aleatórias realistas.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onConnect(banco)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wifi className="h-4 w-4 mr-2" />}
            Conectar (Demo)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── página principal ──────────────────────────────────────────────────────────

export default function OpenBankingPage() {
  const qc = useQueryClient()
  const [selectedEmpresa, setSelectedEmpresa] = useEmpresaDefault()

  // estados do fluxo de conexão
  const [connectToken, setConnectToken] = useState<ConnectTokenResponse | null>(null)
  const [showWidget, setShowWidget] = useState(false)
  const [showMockModal, setShowMockModal] = useState(false)

  // sync result
  const [lastSync, setLastSync] = useState<SyncResult | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)

  // dias para sincronizar
  const [diasSync, setDiasSync] = useState('90')

  // confirm delete
  const [deletando, setDeletando] = useState<Conexao | null>(null)

  const { data: empresas = [] } = useEmpresas()

  const { data: conexoes, isLoading } = useQuery<{ items: Conexao[]; total: number }>({
    queryKey: ['conexoes', selectedEmpresa],
    queryFn: () =>
      api.get(`/empresas/${selectedEmpresa}/openbanking/conexoes`).then(r => r.data),
    enabled: !!selectedEmpresa,
    refetchInterval: 30_000, // atualiza a cada 30s
  })

  const inv = () => qc.invalidateQueries({ queryKey: ['conexoes', selectedEmpresa] })

  // ── Iniciar conexão ────────────────────────────────────────────────────────

  const iniciarConexaoMut = useMutation({
    mutationFn: () =>
      api.post(`/empresas/${selectedEmpresa}/openbanking/connect-token`).then(r => r.data),
    onSuccess: (data: ConnectTokenResponse) => {
      setConnectToken(data)
      if (data.mock_mode) {
        setShowMockModal(true)
      } else {
        setShowWidget(true)
      }
    },
    onError: (e: unknown) =>
      toast({ title: 'Erro', description: extractApiError(e), variant: 'destructive' }),
  })

  // ── Salvar conexão (após widget ou mock) ───────────────────────────────────

  const salvarConexaoMut = useMutation({
    mutationFn: (body: { item_id: string; instituicao_nome?: string }) =>
      api.post(`/empresas/${selectedEmpresa}/openbanking/conexoes`, body).then(r => r.data),
    onSuccess: () => {
      inv()
      setShowWidget(false)
      setShowMockModal(false)
      setConnectToken(null)
      toast({ title: 'Banco conectado com sucesso!', variant: 'success' })
    },
    onError: (e: unknown) => {
      setShowWidget(false)
      setShowMockModal(false)
      toast({ title: 'Erro ao salvar conexão', description: extractApiError(e), variant: 'destructive' })
    },
  })

  const onMockConnect = (banco: string) => {
    const fakeItemId = `mock_${banco.toLowerCase().replace(/\s/g, '_')}_${Date.now()}`
    salvarConexaoMut.mutate({ item_id: fakeItemId, instituicao_nome: banco })
  }

  const onPluggySuccess = (itemId: string) => {
    salvarConexaoMut.mutate({ item_id: itemId })
  }

  // ── Sincronizar ────────────────────────────────────────────────────────────

  const sincronizarMut = useMutation({
    mutationFn: (id: string) =>
      api.post(`/empresas/${selectedEmpresa}/openbanking/conexoes/${id}/sincronizar`, {
        dias: Number(diasSync),
      }).then(r => r.data),
    onSuccess: (data: SyncResult) => {
      inv()
      qc.invalidateQueries({ queryKey: ['extrato', selectedEmpresa] })
      qc.invalidateQueries({ queryKey: ['stats', selectedEmpresa] })
      setSyncingId(null)
      setLastSync(data)
      toast({
        title: `Sincronização concluída — ${data.importadas} transações importadas`,
        variant: 'success',
      })
    },
    onError: (e: unknown) => {
      setSyncingId(null)
      toast({ title: 'Erro na sincronização', description: extractApiError(e), variant: 'destructive' })
    },
  })

  const handleSync = (id: string) => {
    setSyncingId(id)
    sincronizarMut.mutate(id)
  }

  // ── Remover ────────────────────────────────────────────────────────────────

  const removerMut = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/empresas/${selectedEmpresa}/openbanking/conexoes/${id}`),
    onSuccess: () => {
      inv()
      setDeletando(null)
      toast({ title: 'Conexão removida.', variant: 'success' })
    },
    onError: (e: unknown) =>
      toast({ title: 'Erro', description: extractApiError(e), variant: 'destructive' }),
  })

  const items = conexoes?.items ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Open Banking</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sincronize transações bancárias automaticamente via Open Finance Brasil
          </p>
        </div>
        {selectedEmpresa && (
          <Button
            onClick={() => iniciarConexaoMut.mutate()}
            disabled={iniciarConexaoMut.isPending}
          >
            {iniciarConexaoMut.isPending
              ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
              : <Plus className="h-4 w-4 mr-2" />}
            Conectar Banco
          </Button>
        )}
      </div>

      {/* Seletor de empresa */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <label className="text-sm font-medium mb-1 block">Empresa</label>
              <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
                <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.razao_social}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <label className="text-sm font-medium mb-1 block">Dias retroativos</label>
                <Select value={diasSync} onValueChange={setDiasSync}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 dias</SelectItem>
                    <SelectItem value="60">60 dias</SelectItem>
                    <SelectItem value="90">90 dias</SelectItem>
                    <SelectItem value="180">180 dias</SelectItem>
                    <SelectItem value="365">365 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resultado da última sincronização */}
      {lastSync && (
        <Card className="border-success/40 bg-success/10">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Última sincronização concluída</span>
              </div>
              <div className="flex gap-4 text-sm">
                <span className="text-success">
                  <strong>{lastSync.importadas}</strong> importadas
                </span>
                <span className="text-muted-foreground">
                  <strong>{lastSync.duplicadas}</strong> duplicadas
                </span>
                <span className="text-muted-foreground text-xs">
                  {lastSync.periodo_inicio} → {lastSync.periodo_fim}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setLastSync(null)}>
                ✕
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de conexões */}
      <Card>
        <CardHeader>
          <CardTitle>
            Contas Conectadas
            {items.length > 0 && (
              <span className="text-base font-normal text-muted-foreground ml-2">
                ({items.length})
              </span>
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
          ) : items.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Wifi className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
              <p className="text-muted-foreground font-medium">Nenhum banco conectado</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Clique em "Conectar Banco" para vincular uma conta bancária e sincronizar transações automaticamente.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map(c => {
                const st = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.pendente
                const StatusIcon = st.icon
                const isSyncing = syncingId === c.id

                return (
                  <div
                    key={c.id}
                    className="border rounded-lg p-4 flex items-center gap-4 flex-wrap"
                  >
                    {/* Ícone banco */}
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>

                    {/* Info principal */}
                    <div className="flex-1 min-w-[200px] space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{c.instituicao_nome}</span>
                        <Badge variant={st.variant} className="text-xs flex items-center gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {st.label}
                        </Badge>
                        {c.provedor === 'mock' && (
                          <Badge variant="outline" className="text-xs">Demo</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {c.banco_sigla}
                        {c.agencia_numero ? ` · Ag. ${c.agencia_numero}` : ''}
                        {c.conta_numero ? ` · CC ${c.conta_numero}` : ''}
                      </p>
                      <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <ArrowDownToLine className="h-3 w-3" />
                          {c.total_transacoes_sync.toLocaleString('pt-BR')} transações importadas
                        </span>
                        {c.last_sync_at && (
                          <span>
                            Última sync: {formatDate(c.last_sync_at)}
                          </span>
                        )}
                        {!c.last_sync_at && (
                          <span className="text-warning">Nunca sincronizado</span>
                        )}
                      </div>
                      {c.erro_msg && (
                        <p className="text-xs text-destructive mt-1">{c.erro_msg}</p>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSync(c.id)}
                        disabled={isSyncing}
                      >
                        {isSyncing
                          ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          : <RefreshCw className="h-4 w-4 mr-2" />}
                        Sincronizar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeletando(c)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info sobre Open Finance Brasil */}
      <Card className="border-dashed">
        <CardContent className="pt-6 pb-6">
          <div className="flex gap-4">
            <Wifi className="h-8 w-8 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">Open Finance Brasil</p>
              <p className="text-sm text-muted-foreground">
                A integração utiliza o <strong>Pluggy</strong> como agregador financeiro, que conecta
                a mais de 200 instituições participantes do Open Finance Brasil (regulado pelo Banco Central).
                Para habilitar a integração com bancos reais, acione o suporte.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Modal: Widget Pluggy ── */}
      <Dialog open={showWidget} onOpenChange={() => setShowWidget(false)}>
        <DialogContent className="max-w-lg p-4">
          <DialogHeader>
            <DialogTitle>Conectar Banco via Open Finance</DialogTitle>
          </DialogHeader>
          {connectToken && (
            <PluggyWidget
              accessToken={connectToken.access_token}
              onSuccess={onPluggySuccess}
              onClose={() => setShowWidget(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Modal: Mock ── */}
      <MockConnectModal
        open={showMockModal}
        onConnect={onMockConnect}
        onClose={() => setShowMockModal(false)}
        loading={salvarConexaoMut.isPending}
      />

      {/* ── Modal: Confirmar remoção ── */}
      <Dialog open={!!deletando} onOpenChange={() => setDeletando(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remover Conexão</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Remover a conexão com <strong>{deletando?.instituicao_nome}</strong>?
            As transações já importadas não serão apagadas.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletando(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={removerMut.isPending}
              onClick={() => deletando && removerMut.mutate(deletando.id)}
            >
              {removerMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
