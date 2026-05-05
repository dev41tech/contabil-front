import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/api'
import { extractApiError } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Loader2, UserX, UserCheck, ShieldAlert } from 'lucide-react'

const usuarioSchema = z.object({
  nome: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(8, 'Mínimo 8 caracteres'),
  role: z.enum(['admin', 'contador'], { errorMap: () => ({ message: 'Selecione um perfil' }) }),
})
type UsuarioForm = z.infer<typeof usuarioSchema>

interface Usuario {
  id: string
  nome: string
  email: string
  role: string
  ativo: boolean
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  contador: 'Contador',
}

export default function UsuariosPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [confirmDeactivate, setConfirmDeactivate] = useState<Usuario | null>(null)

  const { data, isLoading } = useQuery<{ items: Usuario[]; total: number }>({
    queryKey: ['usuarios'],
    queryFn: () => api.get('/usuarios').then(r => r.data),
    // Sempre refaz o fetch ao montar a página — evita cache desatualizado
    // deixado por outras queries com o mesmo key mas transform diferente
    refetchOnMount: 'always',
    select: (d) => {
      // Normaliza caso o cache contenha um array (vindo de outra page)
      if (Array.isArray(d)) return { items: d as unknown as Usuario[], total: (d as unknown as Usuario[]).length }
      return d
    },
  })

  const usuarios = data?.items ?? []

  const { register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm<UsuarioForm>({
    resolver: zodResolver(usuarioSchema),
    defaultValues: { role: 'contador' },
  })

  const createMutation = useMutation({
    mutationFn: (body: UsuarioForm) => api.post('/usuarios', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] })
      toast({ title: 'Usuário criado!', variant: 'success' })
      setOpen(false)
      reset()
    },
    onError: (e: unknown) => {
      toast({ title: 'Erro ao criar usuário', description: extractApiError(e), variant: 'destructive' })
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/usuarios/${id}/desativar`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] })
      toast({ title: 'Usuário desativado', variant: 'success' })
      setConfirmDeactivate(null)
    },
    onError: (e: unknown) => {
      toast({ title: 'Erro', description: extractApiError(e), variant: 'destructive' })
      setConfirmDeactivate(null)
    },
  })

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/usuarios/${id}/reativar`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] })
      toast({ title: 'Usuário reativado', variant: 'success' })
    },
    onError: (e: unknown) => {
      toast({ title: 'Erro', description: extractApiError(e), variant: 'destructive' })
    },
  })

  // Redirecionar se não for admin
  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <ShieldAlert className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-semibold">Acesso restrito</h2>
        <p className="text-muted-foreground">Apenas administradores podem gerenciar usuários.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Usuários</h1>
          <p className="text-muted-foreground">Gerencie os usuários do escritório</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo Usuário
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Usuários cadastrados{' '}
            {data && <span className="text-base font-normal text-muted-foreground">({data.total} total)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : usuarios.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum usuário cadastrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-3 px-2">Nome</th>
                    <th className="text-left py-3 px-2">E-mail</th>
                    <th className="text-center py-3 px-2">Perfil</th>
                    <th className="text-center py-3 px-2">Status</th>
                    <th className="text-center py-3 px-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-2 px-2 font-medium">
                        {u.nome}
                        {u.id === user?.user_id && (
                          <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{u.email}</td>
                      <td className="py-2 px-2 text-center">
                        <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <Badge variant={u.ativo ? 'success' : 'outline'}>
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-center">
                        {u.id !== user?.user_id && (
                          u.ativo ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setConfirmDeactivate(u)}
                              disabled={deactivateMutation.isPending}
                            >
                              <UserX className="h-4 w-4 mr-1" /> Desativar
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-600"
                              onClick={() => reactivateMutation.mutate(u.id)}
                              disabled={reactivateMutation.isPending}
                            >
                              <UserCheck className="h-4 w-4 mr-1" /> Reativar
                            </Button>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Novo Usuário */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
            <div className="space-y-1">
              <Label>Nome completo</Label>
              <Input placeholder="João da Silva" {...register('nome')} />
              {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input type="email" placeholder="joao@exemplo.com" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Senha inicial</Label>
              <Input type="password" placeholder="Mínimo 8 caracteres" {...register('senha')} />
              {errors.senha && <p className="text-xs text-destructive">{errors.senha.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Perfil de acesso</Label>
              <Select defaultValue="contador" onValueChange={v => setValue('role', v as 'admin' | 'contador')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contador">Contador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpen(false); reset() }}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
                {createMutation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>
                  : 'Criar Usuário'
                }
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmação de Desativação */}
      <Dialog open={!!confirmDeactivate} onOpenChange={v => { if (!v) setConfirmDeactivate(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desativar usuário?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O usuário <strong>{confirmDeactivate?.nome}</strong> ({confirmDeactivate?.email}) perderá acesso ao sistema.
            Esta ação pode ser revertida reativando o usuário.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeactivate(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeactivate && deactivateMutation.mutate(confirmDeactivate.id)}
              disabled={deactivateMutation.isPending}
            >
              {deactivateMutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Desativando...</>
                : 'Sim, desativar'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
