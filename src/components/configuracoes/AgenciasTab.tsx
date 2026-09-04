import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/api'
import { extractApiError } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { SearchableCombobox, type ComboOption } from './SearchableCombobox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, Loader2, Pencil, Plus, ToggleLeft, ToggleRight, Wrench } from 'lucide-react'
import { opcaoConta } from '@/lib/contas'

const agenciaSchema = z.object({
  banco_sigla: z.string().min(2, 'Informe o banco'),
  agencia: z.string().regex(/^\d+$/, 'Apenas dígitos'),
  numero: z.string().min(1, 'Informe o número da conta'),
  digito: z.string().optional(),
  conta_contabil_id: z.union([z.string().uuid(), z.literal('')]).nullable().optional(),
})
type AgenciaForm = z.infer<typeof agenciaSchema>

export function AgenciasTab({ empresaId }: { empresaId: string }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editAgencia, setEditAgencia] = useState<any>(null)
  const [desativarAgencia, setDesativarAgencia] = useState<any>(null)
  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['agencias', empresaId],
    queryFn: () => api.get(`/empresas/${empresaId}/agencias`).then(r => r.data.items ?? r.data),
    enabled: !!empresaId,
  })

  const { data: contas = [] } = useQuery<any[]>({
    queryKey: ['plano-contas', empresaId],
    queryFn: () => api.get(`/empresas/${empresaId}/plano-contas`).then(r => r.data.items ?? r.data),
    enabled: !!empresaId,
  })
  const contaOptions = useMemo<ComboOption[]>(() => [
    { value: '', label: 'Sem vínculo com o Plano de Contas' },
    ...contas.map((c: any) =>
      opcaoConta(c, c.tipo_sa === 'A' ? 'Analítica' : c.tipo_sa === 'S' ? 'Sintética' : undefined),
    ),
  ], [contas])

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AgenciaForm>({
    resolver: zodResolver(agenciaSchema),
  })
  const editForm = useForm<AgenciaForm>({ resolver: zodResolver(agenciaSchema) })
  const createMutation = useMutation({
    mutationFn: (d: AgenciaForm) => api.post(`/empresas/${empresaId}/agencias`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agencias', empresaId] })
      toast({ title: 'Conta bancária criada!', variant: 'success' })
      setOpen(false)
      reset()
    },
    onError: (e: unknown) => toast({ title: 'Erro', description: extractApiError(e), variant: 'destructive' }),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AgenciaForm }) => api.patch(
      `/empresas/${empresaId}/agencias/${id}`,
      {
        ...data,
        digito: data.digito || null,
        conta_contabil_id: data.conta_contabil_id || null,
      },
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agencias', empresaId] })
      toast({ title: 'Conta bancária atualizada!', variant: 'success' })
      setEditAgencia(null)
    },
    onError: (e: unknown) => toast({ title: 'Erro ao atualizar conta bancária', description: extractApiError(e), variant: 'destructive' }),
  })

  const desativarMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/empresas/${empresaId}/agencias/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agencias', empresaId] })
      toast({ title: 'Conta bancária desativada.', variant: 'default' })
      setDesativarAgencia(null)
    },
    onError: (e: unknown) => toast({ title: 'Erro ao desativar conta bancária', description: extractApiError(e), variant: 'destructive' }),
  })

  // Reativar sempre existiu no backend (`PATCH { ativa: true }`, e o serviço
  // diz isso no próprio docstring). O que não existia era o botão: a tela só
  // renderizava ação para conta ativa, e o formulário de edição nunca mandou
  // `ativa`. Quem desativasse por engano ficava sem caminho de volta.
  //
  // Sem diálogo de confirmação de propósito: reativar não destrói nada, e o
  // caminho de volta é um clique no mesmo lugar. A confirmação fica onde há
  // perda — desativar e reapontar o razão.
  const reativarMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/empresas/${empresaId}/agencias/${id}`, { ativa: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agencias', empresaId] })
      // O seletor de conta do Extrato e do NEO lista só as ativas: sem
      // invalidar aqui, a conta volta na tela de Configurações e continua
      // sumida onde ela é usada de verdade.
      qc.invalidateQueries({ queryKey: ['extrato', empresaId] })
      toast({ title: 'Conta bancária reativada.', variant: 'success' })
    },
    onError: (e: unknown) => toast({ title: 'Erro ao reativar conta bancária', description: extractApiError(e), variant: 'destructive' }),
  })

  // Reapontar a conta bancária do razão. Fica atrás de confirmação porque
  // REESCREVE registros contábeis já gravados — não é o tipo de coisa que pode
  // acontecer por um clique distraído.
  const [confirmarReapontar, setConfirmarReapontar] = useState(false)
  const [relatorio, setRelatorio] = useState<any[] | null>(null)
  const reapontarMutation = useMutation({
    mutationFn: () =>
      api.post(`/empresas/${empresaId}/agencias/reapontar-contas-sinteticas`).then(r => r.data),
    onSuccess: (dados: any[]) => {
      qc.invalidateQueries({ queryKey: ['agencias', empresaId] })
      setConfirmarReapontar(false)
      setRelatorio(dados)
      if (!dados.length) {
        toast({ title: 'Nada a corrigir', description: 'Nenhuma conta bancária com conta contábil sintética pendente.', variant: 'default' })
      }
    },
    onError: (e: unknown) => toast({ title: 'Erro ao reapontar', description: extractApiError(e), variant: 'destructive' }),
  })

  const abrirEdicao = (agencia: any) => {
    editForm.reset({
      banco_sigla: agencia.banco_sigla,
      agencia: agencia.agencia,
      numero: agencia.numero,
      digito: agencia.digito ?? '',
      conta_contabil_id: agencia.conta_contabil_id ?? '',
    })
    setEditAgencia(agencia)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data.length} conta{data.length !== 1 ? 's' : ''} bancária{data.length !== 1 ? 's' : ''} cadastrada{data.length !== 1 ? 's' : ''}</p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setConfirmarReapontar(true)}>
            <Wrench className="h-4 w-4 mr-1" /> Corrigir conta do razão
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova Conta Bancária
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !data.length ? (
        <div className="text-center py-10 border-2 border-dashed rounded-lg">
          <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma conta bancária cadastrada.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((a: any) => (
            <div key={a.id} className={`flex items-center justify-between gap-3 p-4 rounded-lg border transition-shadow ${a.ativa ? 'bg-card hover:shadow-sm' : 'bg-muted/50 opacity-75'}`}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand font-bold text-sm shrink-0">
                  {a.banco_sigla?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm">{a.banco_sigla}</p>
                  <p className="text-xs text-muted-foreground">
                    Ag: <span className="font-mono">{a.agencia}</span>
                    {' · '}
                    CC: <span className="font-mono">{a.numero}{a.digito ? `-${a.digito}` : ''}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Conta contábil: {a.conta_contabil_id
                      ? `${a.conta_contabil_codigo ?? ''}${a.conta_contabil_codigo ? ' — ' : ''}${a.conta_contabil_descricao ?? a.conta_contabil_id}`
                      : 'sem vínculo'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Badge variant={a.ativa ? 'success' : 'secondary'} className="text-xs">
                  {a.ativa ? 'Ativa' : 'Inativa'}
                </Badge>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => abrirEdicao(a)} title="Editar conta bancária">
                  <Pencil className="h-4 w-4" />
                </Button>
                {a.ativa ? (
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDesativarAgencia(a)} title="Desativar conta bancária">
                    <ToggleLeft className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-success hover:text-success" onClick={() => reativarMutation.mutate(a.id)} disabled={reativarMutation.isPending} title="Reativar conta bancária">
                    {reativarMutation.isPending && reativarMutation.variables === a.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <ToggleRight className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" /> Nova Conta Bancária
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="components-configuracoes-agenciastab-banco">Banco</Label>
              <Input id="components-configuracoes-agenciastab-banco" placeholder="Ex: BRADESCO" {...register('banco_sigla')} />
              {errors.banco_sigla && <p className="text-xs text-destructive">{errors.banco_sigla.message}</p>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="components-configuracoes-agenciastab-agencia">Agência</Label>
                <Input id="components-configuracoes-agenciastab-agencia" placeholder="0001" {...register('agencia')} />
                {errors.agencia && <p className="text-xs text-destructive">{errors.agencia.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="components-configuracoes-agenciastab-conta">Conta</Label>
                <Input id="components-configuracoes-agenciastab-conta" placeholder="12345" {...register('numero')} />
                {errors.numero && <p className="text-xs text-destructive">{errors.numero.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="components-configuracoes-agenciastab-digito">Dígito</Label>
                <Input id="components-configuracoes-agenciastab-digito" placeholder="6" {...register('digito')} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : 'Criar Conta Bancária'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editAgencia} onOpenChange={v => { if (!v) setEditAgencia(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-muted-foreground" /> Editar Conta Bancária
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(d => editAgencia && editMutation.mutate({ id: editAgencia.id, data: d }))} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="components-configuracoes-agenciastab-banco-2">Banco</Label>
              <Input id="components-configuracoes-agenciastab-banco-2" placeholder="Ex: BRADESCO" {...editForm.register('banco_sigla')} />
              {editForm.formState.errors.banco_sigla && <p className="text-xs text-destructive">{editForm.formState.errors.banco_sigla.message}</p>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="components-configuracoes-agenciastab-agencia-2">Agência</Label>
                <Input id="components-configuracoes-agenciastab-agencia-2" placeholder="0001" {...editForm.register('agencia')} />
                {editForm.formState.errors.agencia && <p className="text-xs text-destructive">{editForm.formState.errors.agencia.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="components-configuracoes-agenciastab-conta-2">Conta</Label>
                <Input id="components-configuracoes-agenciastab-conta-2" placeholder="12345" {...editForm.register('numero')} />
                {editForm.formState.errors.numero && <p className="text-xs text-destructive">{editForm.formState.errors.numero.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="components-configuracoes-agenciastab-digito-2">Dígito</Label>
                <Input id="components-configuracoes-agenciastab-digito-2" placeholder="6" {...editForm.register('digito')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="components-configuracoes-agenciastab-conta-do-plano-de-contas">Conta do Plano de Contas</Label>
              <SearchableCombobox id="components-configuracoes-agenciastab-conta-do-plano-de-contas"
                options={contaOptions}
                value={editForm.watch('conta_contabil_id') ?? ''}
                onChange={v => editForm.setValue('conta_contabil_id', v, { shouldValidate: true })}
                placeholder="Sem vínculo com o Plano de Contas"
              />
              <p className="text-xs text-muted-foreground">
                Se ficar sem vínculo, o motor NEO criará automaticamente uma conta sintética para a contrapartida bancária.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditAgencia(null)}>Cancelar</Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {editMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!desativarAgencia} onOpenChange={v => { if (!v) setDesativarAgencia(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Desativar Conta Bancária</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Desativar <span className="font-medium text-foreground">{desativarAgencia?.descricao ?? `${desativarAgencia?.banco_sigla} — Ag ${desativarAgencia?.agencia} / CC ${desativarAgencia?.numero}${desativarAgencia?.digito ? `-${desativarAgencia.digito}` : ''}`}</span>?
            A conta deixará de aparecer nas seleções, mas todo o histórico de transações será preservado.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDesativarAgencia(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => desativarAgencia && desativarMutation.mutate(desativarAgencia.id)} disabled={desativarMutation.isPending}>
              {desativarMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Desativando...</> : 'Desativar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmarReapontar} onOpenChange={setConfirmarReapontar}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Corrigir a conta bancária do razão</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Quando uma conta bancária fica <span className="font-medium text-foreground">sem conta do Plano de Contas</span>,
              o motor NEO cria uma conta sintética (<code className="text-xs">1.1.B.…</code>) para a contrapartida
              bancária. Ela não tem número abreviado — e é o abreviado que a exportação de registros contábeis usa,
              então esses lançamentos saem num formato que o sistema contábil externo não importa.
            </p>
            <p>
              Vincular a conta contábil à conta bancária resolve os lançamentos <span className="font-medium text-foreground">novos</span>.
              Esta ação corrige os que <span className="font-medium text-foreground">já estão gravados</span>: move o razão
              da conta sintética para a conta vinculada e desativa a sintética.
            </p>
            <p className="text-warning">
              Isso <span className="font-medium">reescreve registros contábeis já lançados</span>. Se alguma conta sintética
              ainda for usada por outra coisa (uma regra, por exemplo), ela é mantida e aparece no relatório.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarReapontar(false)}>Cancelar</Button>
            <Button onClick={() => reapontarMutation.mutate()} disabled={reapontarMutation.isPending}>
              {reapontarMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Corrigindo...</> : 'Corrigir agora'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!relatorio?.length} onOpenChange={v => { if (!v) setRelatorio(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Contas corrigidas</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {relatorio?.map((r: any, i: number) => (
              <div key={i} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{r.agencia}</p>
                <p className="text-xs text-muted-foreground font-mono">{r.conta_sintetica}</p>
                <p className="mt-1">
                  {r.registros_movidos} lançamento{r.registros_movidos !== 1 ? 's' : ''} no razão
                  {r.decisoes_movidas ? ` · ${r.decisoes_movidas} decisão(ões) do NEO` : ''}
                </p>
                {!r.sintetica_desativada && (
                  <p className="mt-1 text-xs text-warning">
                    A conta sintética foi mantida porque ainda é usada por:{' '}
                    {Object.entries(r.referencias_restantes ?? {})
                      .map(([k, v]) => `${k} (${v})`)
                      .join(', ')}.
                  </p>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setRelatorio(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


