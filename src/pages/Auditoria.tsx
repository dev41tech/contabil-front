import { useMemo, useState } from 'react'
import axios from 'axios'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ChevronDown, FileClock, Loader2, ShieldAlert } from 'lucide-react'
import { api } from '@/lib/api'
import { extractApiError } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresaDefault } from '@/hooks/useEmpresaDefault'
import { useEmpresas } from '@/hooks/useEmpresas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pagination } from '@/components/ui/pagination'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

interface AuditoriaItem {
  id: string
  usuario_id: string | null
  usuario_nome: string | null
  usuario_email: string | null
  quando: string
  acao: string
  entidade: string
  entidade_id: string | null
  dados_antes: JsonValue | null
  dados_depois: JsonValue | null
}

interface AuditoriaResponse {
  items: AuditoriaItem[]
  total: number
  page: number
  page_size: number
}

interface UsuarioOption {
  id: string
  nome: string
  email: string
}

const PAGE_SIZE = 20

// O valor técnico é mantido como chave e enviado sem transformação ao backend.
const ACTION_LABELS: Record<string, string> = {
  'empresa.criada': 'Criação de empresa',
  'empresa.atualizada': 'Alteração de empresa',
  'empresa.desativada': 'Desativação de empresa',
  'empresa.reativada': 'Reativação de empresa',
  'usuario.criado': 'Criação de usuário',
  'usuario.atualizado': 'Alteração de usuário',
  'usuario.desativado': 'Desativação de usuário',
  'usuario.reativado': 'Reativação de usuário',
  'permissao.concedida': 'Concessão de permissão',
  'permissao.atualizada': 'Alteração de permissão',
  'permissao.revogada': 'Revogação de permissão',
  'plano_conta.criada': 'Criação de conta contábil',
  'plano_conta.atualizada': 'Alteração de conta contábil',
  'plano_conta.excluida': 'Exclusão de conta contábil',
  'plano_conta.exclusao_lote': 'Exclusão de contas em lote',
  'regra.criada': 'Criação de regra de classificação',
  'regra.atualizada': 'Alteração de regra de classificação',
  'regra.excluida': 'Exclusão de regra de classificação',
  'neo.processamento': 'Processamento do NEO',
  'neo.associacao_manual': 'Associação manual no NEO',
  'openbanking.conexao_criada': 'Criação de conexão bancária',
  'openbanking.conexao_removida': 'Remoção de conexão bancária',
  'openbanking.conexao_sincronizada': 'Sincronização de conexão bancária',
}

const ENTITY_LABELS: Record<string, string> = {
  empresa: 'Empresa',
  usuario: 'Usuário',
  permissao: 'Permissão',
  plano_conta: 'Conta contábil',
  regra: 'Regra de classificação',
  neo: 'NEO',
  openbanking: 'Open Banking',
}

const FIELD_LABELS: Record<string, string> = {
  id: 'Identificador',
  nome: 'Nome',
  email: 'E-mail',
  role: 'Perfil',
  ativo: 'Ativo',
  razao_social: 'Razão social',
  cnpj: 'CNPJ',
  codigo: 'Código',
  descricao: 'Descrição',
  conta_id: 'Conta contábil',
  usuario_id: 'Usuário',
  empresa_id: 'Empresa',
  modulos: 'Módulos',
  status: 'Status',
}

function labelAcao(acao: string) {
  return ACTION_LABELS[acao] ?? acao
}

function labelEntidade(entidade: string) {
  return ENTITY_LABELS[entidade] ?? entidade
}

function labelCampo(caminho: string) {
  return caminho.split('.').map(parte => FIELD_LABELS[parte] ?? parte.replace(/_/g, ' ')).join(' › ')
}

function flatten(value: JsonValue | null, prefix = '', output: Record<string, JsonValue> = {}) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value)
    if (entries.length === 0 && prefix) output[prefix] = value
    entries.forEach(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key, output))
  } else {
    output[prefix || 'valor'] = value
  }
  return output
}

function formatValue(value: JsonValue | undefined) {
  if (value === undefined) return '—'
  if (value === null) return 'Vazio'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (Array.isArray(value)) return value.length ? value.map(item => typeof item === 'object' ? JSON.stringify(item) : String(item)).join(', ') : 'Nenhum'
  if (typeof value === 'object') return Object.keys(value).length ? JSON.stringify(value) : 'Nenhum'
  return String(value)
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR')
}

export default function AuditoriaPage() {
  const { user } = useAuth()
  const [selectedEmpresa, setSelectedEmpresa] = useEmpresaDefault()
  const { data: empresas = [] } = useEmpresas()
  const [usuarioId, setUsuarioId] = useState('todos')
  const [acao, setAcao] = useState('todas')
  const [entidade, setEntidade] = useState('todas')
  const [mes, setMes] = useState('')
  const [dataDe, setDataDe] = useState('')
  const [dataAte, setDataAte] = useState('')
  const [page, setPage] = useState(1)
  const isAdmin = user?.role === 'admin'

  const usuariosQuery = useQuery<{ items: UsuarioOption[] }>({
    queryKey: ['usuarios', 'auditoria-filter'],
    queryFn: () => api.get('/usuarios').then(r => Array.isArray(r.data) ? { items: r.data } : r.data),
    enabled: isAdmin,
  })

  const auditoriaQuery = useQuery<AuditoriaResponse>({
    queryKey: ['auditoria', selectedEmpresa, usuarioId, acao, entidade, mes, dataDe, dataAte, page],
    queryFn: () => api.get(`/empresas/${selectedEmpresa}/auditoria`, {
      params: {
        usuario_id: usuarioId !== 'todos' ? usuarioId : undefined,
        acao: acao !== 'todas' ? acao : undefined,
        entidade: entidade !== 'todas' ? entidade : undefined,
        mes: mes || undefined,
        data_de: dataDe || undefined,
        data_ate: dataAte || undefined,
        page,
        page_size: PAGE_SIZE,
      },
    }).then(r => r.data),
    enabled: isAdmin && !!selectedEmpresa,
    retry: (failureCount, error) => !isForbidden(error) && failureCount < 2,
  })

  const actionOptions = useMemo(() => {
    const known = Object.keys(ACTION_LABELS)
    const seen = auditoriaQuery.data?.items.map(item => item.acao) ?? []
    return [...new Set([...known, ...seen])].sort((a, b) => labelAcao(a).localeCompare(labelAcao(b), 'pt-BR'))
  }, [auditoriaQuery.data])

  const entityOptions = useMemo(() => {
    const known = Object.keys(ENTITY_LABELS)
    const seen = auditoriaQuery.data?.items.map(item => item.entidade) ?? []
    return [...new Set([...known, ...seen])].sort((a, b) => labelEntidade(a).localeCompare(labelEntidade(b), 'pt-BR'))
  }, [auditoriaQuery.data])

  const changeFilter = (setter: (value: string) => void) => (value: string) => {
    setter(value)
    setPage(1)
  }

  if (!isAdmin || isForbidden(auditoriaQuery.error)) return <RestrictedAccess />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Trilha de auditoria</h1>
        <p className="text-muted-foreground">Consulte ações e alterações realizadas na empresa.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="xl:col-span-2">
              <Label className="mb-1.5 block" htmlFor="pages-auditoria-empresa">Empresa</Label>
              <SearchableSelect id="pages-auditoria-empresa" value={selectedEmpresa} onValueChange={changeFilter(setSelectedEmpresa)} options={empresas.map(empresa => ({ value: empresa.id, label: empresa.razao_social }))} placeholder="Selecione a empresa" searchPlaceholder="Buscar empresa..." />
            </div>
            <div>
              <Label className="mb-1.5 block" htmlFor="pages-auditoria-usuario">Usuário</Label>
              <SearchableSelect id="pages-auditoria-usuario" value={usuarioId} onValueChange={changeFilter(setUsuarioId)} options={[{ value: 'todos', label: 'Todos os usuários' }, ...(usuariosQuery.data?.items ?? []).map(usuario => ({ value: usuario.id, label: `${usuario.nome} — ${usuario.email}` }))]} searchPlaceholder="Buscar usuário..." />
            </div>
            <div>
              <Label className="mb-1.5 block" htmlFor="pages-auditoria-acao">Ação</Label>
              <Select value={acao} onValueChange={changeFilter(setAcao)}><SelectTrigger id="pages-auditoria-acao"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as ações</SelectItem>{actionOptions.map(value => <SelectItem key={value} value={value}>{labelAcao(value)}</SelectItem>)}</SelectContent></Select>
            </div>
            <div>
              <Label className="mb-1.5 block" htmlFor="pages-auditoria-entidade">Entidade</Label>
              <Select value={entidade} onValueChange={changeFilter(setEntidade)}><SelectTrigger id="pages-auditoria-entidade"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as entidades</SelectItem>{entityOptions.map(value => <SelectItem key={value} value={value}>{labelEntidade(value)}</SelectItem>)}</SelectContent></Select>
            </div>
            <div>
              <Label className="mb-1.5 block" htmlFor="pages-auditoria-competencia">Competência</Label>
              <Input id="pages-auditoria-competencia" type="month" value={mes} onChange={event => changeFilter(setMes)(event.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block" htmlFor="pages-auditoria-periodo-de">Período — de</Label>
              <Input id="pages-auditoria-periodo-de" type="date" value={dataDe} max={dataAte || undefined} onChange={event => changeFilter(setDataDe)(event.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block" htmlFor="pages-auditoria-periodo-ate">Período — até</Label>
              <Input id="pages-auditoria-periodo-ate" type="date" value={dataAte} min={dataDe || undefined} onChange={event => changeFilter(setDataAte)(event.target.value)} />
            </div>
          </div>
          {(usuarioId !== 'todos' || acao !== 'todas' || entidade !== 'todas' || mes || dataDe || dataAte) && (
            <Button variant="ghost" size="sm" className="mt-4" onClick={() => { setUsuarioId('todos'); setAcao('todas'); setEntidade('todas'); setMes(''); setDataDe(''); setDataAte(''); setPage(1) }}>Limpar filtros</Button>
          )}
        </CardContent>
      </Card>

      {!selectedEmpresa ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Selecione uma empresa para consultar a trilha.</CardContent></Card>
      ) : auditoriaQuery.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
      ) : auditoriaQuery.isError ? (
        <Card><CardContent className="flex items-center justify-center gap-3 py-12 text-destructive"><AlertCircle className="h-5 w-5" /><span>{extractApiError(auditoriaQuery.error)}</span></CardContent></Card>
      ) : !auditoriaQuery.data?.items.length ? (
        <Card><CardContent className="py-12 text-center"><FileClock className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="text-muted-foreground">Nenhum evento encontrado para os filtros informados.</p></CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Eventos <span className="font-normal text-muted-foreground">({auditoriaQuery.data.total})</span></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {auditoriaQuery.data.items.map(item => <AuditEvent key={item.id} item={item} />)}
            <Pagination page={page} pageSize={PAGE_SIZE} total={auditoriaQuery.data.total} onPageChange={setPage} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function isForbidden(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 403
}

function RestrictedAccess() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <ShieldAlert className="h-12 w-12 text-warning" />
      <h2 className="text-xl font-semibold">Trilha restrita a administradores</h2>
      <p className="max-w-lg text-muted-foreground">A auditoria contém informações sensíveis sobre ações de usuários. Peça a um administrador do escritório para realizar esta consulta.</p>
    </div>
  )
}

function AuditEvent({ item }: { item: AuditoriaItem }) {
  const actor = item.usuario_nome || item.usuario_email || 'Sistema'
  return (
    <details className="group rounded-lg border bg-card open:bg-muted/20">
      <summary className="flex cursor-pointer list-none items-start gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{labelAcao(item.acao)}</span>
            <Badge variant="outline">{labelEntidade(item.entidade)}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{actor}{item.usuario_email && item.usuario_nome ? ` — ${item.usuario_email}` : ''} · {formatDateTime(item.quando)}</p>
          {item.entidade_id && <p className="mt-1 truncate text-xs text-muted-foreground">Identificador: {item.entidade_id}</p>}
        </div>
        <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t p-4"><ChangeDetails before={item.dados_antes} after={item.dados_depois} /></div>
    </details>
  )
}

function ChangeDetails({ before, after }: { before: JsonValue | null; after: JsonValue | null }) {
  if (before == null && after == null) return <p className="text-sm text-muted-foreground">Este evento não registrou detalhes adicionais.</p>

  if (before == null) return <Snapshot title="Dados criados" tone="created" values={flatten(after)} />
  if (after == null) return <Snapshot title="Dados removidos" tone="removed" values={flatten(before)} />

  const beforeFlat = flatten(before)
  const afterFlat = flatten(after)
  const fields = [...new Set([...Object.keys(beforeFlat), ...Object.keys(afterFlat)])].filter(field => JSON.stringify(beforeFlat[field]) !== JSON.stringify(afterFlat[field]))

  if (!fields.length) return <p className="text-sm text-muted-foreground">Nenhuma diferença de campo foi registrada.</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead><tr className="border-b text-muted-foreground"><th className="px-2 py-2 text-left">Campo alterado</th><th className="px-2 py-2 text-left">Antes</th><th className="px-2 py-2 text-left">Depois</th></tr></thead>
        <tbody>{fields.map(field => <tr key={field} className="border-b last:border-0"><td className="px-2 py-2 font-medium capitalize">{labelCampo(field)}</td><td className="max-w-xs break-words px-2 py-2 text-danger">{formatValue(beforeFlat[field])}</td><td className="max-w-xs break-words px-2 py-2 text-success">{formatValue(afterFlat[field])}</td></tr>)}</tbody>
      </table>
    </div>
  )
}

function Snapshot({ title, tone, values }: { title: string; tone: 'created' | 'removed'; values: Record<string, JsonValue> }) {
  const entries = Object.entries(values)
  return (
    <div>
      <p className={`mb-3 text-sm font-semibold ${tone === 'created' ? 'text-success' : 'text-danger'}`}>{title}</p>
      {entries.length ? <dl className="grid gap-x-6 gap-y-3 md:grid-cols-2">{entries.map(([field, value]) => <div key={field} className="rounded-md bg-background p-3"><dt className="text-xs font-medium capitalize text-muted-foreground">{labelCampo(field)}</dt><dd className="mt-1 break-words text-sm">{formatValue(value)}</dd></div>)}</dl> : <p className="text-sm text-muted-foreground">Nenhum detalhe registrado.</p>}
    </div>
  )
}
