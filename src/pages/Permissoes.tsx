import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEmpresaDefault } from '@/hooks/useEmpresaDefault'
import { api } from '@/lib/api'
import { extractApiError } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ShieldAlert, UserPlus, Pencil, Trash2, Loader2, ShieldCheck } from 'lucide-react'
import { useEmpresas } from '@/hooks/useEmpresas'

// ── tipos ─────────────────────────────────────────────────────────────────────

interface Permissao {
  usuario_id: string
  empresa_id: string
  modulos: string
  usuario_nome: string
  usuario_email: string
  usuario_role: string
  usuario_ativo: boolean
}

interface Usuario {
  id: string
  nome: string
  email: string
  role: string
  ativo: boolean
}

// ── módulos disponíveis ───────────────────────────────────────────────────────

const TODOS_MODULOS = [
  { value: 'extrato', label: 'Extrato OFX' },
  { value: 'regras', label: 'Regras' },
  { value: 'notas', label: 'Notas Fiscais' },
  { value: 'comprovantes', label: 'Comprovantes' },
  { value: 'contabil', label: 'Registros Contábeis' },
  { value: 'exportacao', label: 'Exportações' },
]

function parseModulos(modulos: string): string[] {
  if (modulos === '*') return TODOS_MODULOS.map(m => m.value)
  return modulos.split(',').map(m => m.trim()).filter(Boolean)
}

function serializeModulos(selecionados: string[]): string {
  if (selecionados.length === TODOS_MODULOS.length) return '*'
  return selecionados.sort().join(',')
}

// ── componente de seleção de módulos ─────────────────────────────────────────

function ModulosSelector({
  value,
  onChange,
}: {
  value: string[]
  onChange: (v: string[]) => void
}) {
  const isAll = value.length === TODOS_MODULOS.length

  const toggle = (mod: string) => {
    if (value.includes(mod)) {
      onChange(value.filter(m => m !== mod))
    } else {
      onChange([...value, mod])
    }
  }

  const toggleAll = () => {
    onChange(isAll ? [] : TODOS_MODULOS.map(m => m.value))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleAll}
          className={`text-xs px-2 py-0.5 rounded border transition-colors ${
            isAll
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-muted-foreground text-muted-foreground hover:bg-muted'
          }`}
        >
          {isAll ? '★ Acesso Total (*)' : 'Marcar todos'}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {TODOS_MODULOS.map(mod => {
          const ativo = value.includes(mod.value)
          return (
            <button
              key={mod.value}
              type="button"
              onClick={() => toggle(mod.value)}
              className={`text-xs px-3 py-2 rounded-md border text-left transition-colors ${
                ativo
                  ? 'bg-primary/10 border-primary text-primary font-medium'
                  : 'border-muted text-muted-foreground hover:bg-muted'
              }`}
            >
              {mod.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── badges de módulos ─────────────────────────────────────────────────────────

function ModulosBadges({ modulos }: { modulos: string }) {
  if (modulos === '*') {
    return (
      <Badge variant="default" className="text-xs">
        <ShieldCheck className="h-3 w-3 mr-1" /> Acesso Total
      </Badge>
    )
  }
  const lista = modulos.split(',').filter(Boolean)
  return (
    <div className="flex flex-wrap gap-1">
      {lista.map(m => {
        const label = TODOS_MODULOS.find(mod => mod.value === m)?.label ?? m
        return (
          <Badge key={m} variant="secondary" className="text-xs">
            {label}
          </Badge>
        )
      })}
    </div>
  )
}

// ── página principal ──────────────────────────────────────────────────────────

export default function PermissoesPage() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const [selectedEmpresa, setSelectedEmpresa] = useEmpresaDefault()
  const [modalAdicionar, setModalAdicionar] = useState(false)
  const [modalEditar, setModalEditar] = useState<Permissao | null>(null)
  const [modalRevogar, setModalRevogar] = useState<Permissao | null>(null)

  // Form state
  const [novoUsuarioId, setNovoUsuarioId] = useState('')
  const [modulosSelecionados, setModulosSelecionados] = useState<string[]>(
    TODOS_MODULOS.map(m => m.value)
  )

  // Bloqueia não-admins
  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
        <ShieldAlert className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-semibold">Acesso restrito</p>
        <p className="text-sm text-muted-foreground">
          Apenas administradores podem gerenciar permissões.
        </p>
      </div>
    )
  }

  const { data: empresas = [] } = useEmpresas()

  // Chave própria para evitar conflito com Usuarios.tsx que usa ['usuarios']
  // com shape diferente {items, total} — se compartilhassem cache, .filter() quebraria
  const { data: todosUsuariosRaw } = useQuery<{ items: Usuario[] } | Usuario[]>({
    queryKey: ['usuarios-todos'],
    queryFn: () => api.get('/usuarios').then(r => r.data),
    refetchOnMount: 'always',
  })
  const todosUsuarios: Usuario[] = Array.isArray(todosUsuariosRaw)
    ? todosUsuariosRaw
    : (todosUsuariosRaw?.items ?? [])

  const { data: permissoes, isLoading } = useQuery<{ items: Permissao[]; total: number }>({
    queryKey: ['permissoes', selectedEmpresa],
    queryFn: () =>
      api.get(`/empresas/${selectedEmpresa}/permissoes`).then(r => r.data),
    enabled: !!selectedEmpresa,
  })

  // Usuários que ainda não têm acesso à empresa selecionada
  const usuariosComAcesso = new Set(permissoes?.items.map(p => p.usuario_id) ?? [])
  const usuariosSemAcesso = todosUsuarios.filter(
    u => !usuariosComAcesso.has(u.id) && u.role !== 'admin'
  )

  // ── mutations ───────────────────────────────────────────────────────────────

  const invalidar = () => qc.invalidateQueries({ queryKey: ['permissoes', selectedEmpresa] })

  const adicionarMutation = useMutation({
    mutationFn: () =>
      api.post(`/empresas/${selectedEmpresa}/permissoes`, {
        usuario_id: novoUsuarioId,
        modulos: serializeModulos(modulosSelecionados),
      }),
    onSuccess: () => {
      invalidar()
      toast({ title: 'Acesso concedido!', variant: 'success' })
      setModalAdicionar(false)
      setNovoUsuarioId('')
      setModulosSelecionados(TODOS_MODULOS.map(m => m.value))
    },
    onError: (e: unknown) =>
      toast({ title: 'Erro', description: extractApiError(e), variant: 'destructive' }),
  })

  const editarMutation = useMutation({
    mutationFn: (p: Permissao) =>
      api.patch(`/empresas/${selectedEmpresa}/permissoes/${p.usuario_id}`, {
        modulos: serializeModulos(modulosSelecionados),
      }),
    onSuccess: () => {
      invalidar()
      toast({ title: 'Módulos atualizados!', variant: 'success' })
      setModalEditar(null)
    },
    onError: (e: unknown) =>
      toast({ title: 'Erro', description: extractApiError(e), variant: 'destructive' }),
  })

  const revogarMutation = useMutation({
    mutationFn: (p: Permissao) =>
      api.delete(`/empresas/${selectedEmpresa}/permissoes/${p.usuario_id}`),
    onSuccess: () => {
      invalidar()
      toast({ title: 'Acesso revogado.', variant: 'success' })
      setModalRevogar(null)
    },
    onError: (e: unknown) =>
      toast({ title: 'Erro', description: extractApiError(e), variant: 'destructive' }),
  })

  const abrirEditar = (p: Permissao) => {
    setModulosSelecionados(parseModulos(p.modulos))
    setModalEditar(p)
  }

  const items = permissoes?.items ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Permissões por Empresa</h1>
      </div>

      {/* Seletor de empresa */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <label className="text-sm font-medium mb-1 block">Empresa</label>
              <Select
                value={selectedEmpresa}
                onValueChange={v => setSelectedEmpresa(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedEmpresa && (
              <Button
                size="sm"
                onClick={() => {
                  setNovoUsuarioId('')
                  setModulosSelecionados(TODOS_MODULOS.map(m => m.value))
                  setModalAdicionar(true)
                }}
                disabled={usuariosSemAcesso.length === 0}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Adicionar Usuário
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabela de permissões */}
      <Card>
        <CardHeader>
          <CardTitle>
            Acessos Concedidos
            {items.length > 0 && (
              <span className="text-base font-normal text-muted-foreground ml-2">
                ({items.length})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedEmpresa ? (
            <p className="text-muted-foreground text-center py-8">
              Selecione uma empresa para ver os acessos
            </p>
          ) : isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground text-sm">
                Nenhum usuário com acesso a esta empresa ainda.
              </p>
              <p className="text-xs text-muted-foreground">
                Administradores têm acesso automático a todas as empresas.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-3 px-3">Usuário</th>
                    <th className="text-left py-3 px-3">E-mail</th>
                    <th className="text-left py-3 px-3">Módulos</th>
                    <th className="text-left py-3 px-3">Status</th>
                    <th className="text-right py-3 px-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(p => (
                    <tr
                      key={p.usuario_id}
                      className="border-b hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-2 px-3 font-medium">{p.usuario_nome}</td>
                      <td className="py-2 px-3 text-muted-foreground text-xs">
                        {p.usuario_email}
                      </td>
                      <td className="py-2 px-3">
                        <ModulosBadges modulos={p.modulos} />
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant={p.usuario_ativo ? 'default' : 'secondary'}>
                          {p.usuario_ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => abrirEditar(p)}
                            title="Editar módulos"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setModalRevogar(p)}
                            title="Revogar acesso"
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
          )}
        </CardContent>
      </Card>

      {/* Info sobre admins */}
      {selectedEmpresa && (
        <p className="text-xs text-muted-foreground px-1">
          * Usuários com perfil <strong>admin</strong> têm acesso automático a todas as empresas e não aparecem nesta lista.
        </p>
      )}

      {/* ── Modal: Adicionar usuário ── */}
      <Dialog open={modalAdicionar} onOpenChange={setModalAdicionar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Acesso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Usuário</label>
              <Select value={novoUsuarioId} onValueChange={setNovoUsuarioId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o usuário" />
                </SelectTrigger>
                <SelectContent>
                  {usuariosSemAcesso.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} — {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {usuariosSemAcesso.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Todos os usuários já têm acesso a esta empresa.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Módulos permitidos</label>
              <ModulosSelector
                value={modulosSelecionados}
                onChange={setModulosSelecionados}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAdicionar(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => adicionarMutation.mutate()}
              disabled={
                !novoUsuarioId ||
                modulosSelecionados.length === 0 ||
                adicionarMutation.isPending
              }
            >
              {adicionarMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</>
              ) : (
                'Conceder Acesso'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Editar módulos ── */}
      <Dialog open={!!modalEditar} onOpenChange={() => setModalEditar(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Editar Módulos — {modalEditar?.usuario_nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <ModulosSelector
              value={modulosSelecionados}
              onChange={setModulosSelecionados}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalEditar(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => modalEditar && editarMutation.mutate(modalEditar)}
              disabled={
                modulosSelecionados.length === 0 || editarMutation.isPending
              }
            >
              {editarMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Confirmar revogação ── */}
      <Dialog open={!!modalRevogar} onOpenChange={() => setModalRevogar(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Revogar Acesso</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Tem certeza que deseja revogar o acesso de{' '}
            <strong>{modalRevogar?.usuario_nome}</strong> a esta empresa? O usuário
            perderá imediatamente o acesso.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalRevogar(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => modalRevogar && revogarMutation.mutate(modalRevogar)}
              disabled={revogarMutation.isPending}
            >
              {revogarMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Revogando...</>
              ) : (
                'Revogar Acesso'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
