import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import { Building2, Loader2, Pencil, Plus } from 'lucide-react'
import { api } from '@/lib/api'
import { extractApiError } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { useEmpresas, type EmpresaOption } from '@/hooks/useEmpresas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const empresaSchema = z.object({
  razao_social: z.string().min(2, 'Mínimo 2 caracteres'),
  cnpj: z.string().min(14, 'CNPJ inválido'),
  regime_tributario: z.enum(['simples_nacional', 'lucro_presumido', 'lucro_real'], {
    errorMap: () => ({ message: 'Selecione um regime' }),
  }),
})

type EmpresaFormData = z.infer<typeof empresaSchema>

const REGIME_LABEL: Record<EmpresaFormData['regime_tributario'], string> = {
  simples_nacional: 'Simples Nacional',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
}

const EMPTY_VALUES: EmpresaFormData = {
  razao_social: '',
  cnpj: '',
  regime_tributario: 'simples_nacional',
}

export function EmpresasTab() {
  const queryClient = useQueryClient()
  const { data: empresas = [], isLoading } = useEmpresas()
  const [openCreate, setOpenCreate] = useState(false)
  const [editEmpresa, setEditEmpresa] = useState<EmpresaOption | null>(null)
  const createForm = useForm<EmpresaFormData>({
    resolver: zodResolver(empresaSchema),
    defaultValues: EMPTY_VALUES,
  })
  const editForm = useForm<EmpresaFormData>({
    resolver: zodResolver(empresaSchema),
    defaultValues: EMPTY_VALUES,
  })

  const createMutation = useMutation({
    mutationFn: (data: EmpresaFormData) => api.post('/empresas', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] })
      toast({ title: 'Empresa criada!', variant: 'success' })
      setOpenCreate(false)
      createForm.reset(EMPTY_VALUES)
    },
    onError: (error: unknown) => toast({
      title: 'Erro ao criar empresa',
      description: extractApiError(error),
      variant: 'destructive',
    }),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EmpresaFormData }) => api.patch(`/empresas/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] })
      toast({ title: 'Empresa atualizada!', variant: 'success' })
      setEditEmpresa(null)
    },
    onError: (error: unknown) => toast({
      title: 'Erro ao atualizar empresa',
      description: extractApiError(error),
      variant: 'destructive',
    }),
  })

  function abrirEdicao(empresa: EmpresaOption) {
    editForm.reset({
      razao_social: empresa.razao_social,
      cnpj: empresa.cnpj ?? '',
      regime_tributario: normalizarRegime(empresa.regime_tributario),
    })
    setEditEmpresa(empresa)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-slate-600" /> Empresas
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Cadastre e atualize as empresas do escritório.</p>
          </div>
          <Button size="sm" onClick={() => setOpenCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova Empresa
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : empresas.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma empresa cadastrada.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {empresas.map(empresa => (
              <div key={empresa.id} className="flex items-center justify-between gap-3 rounded-lg border bg-white p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{empresa.razao_social}</p>
                  <p className="text-xs text-muted-foreground">{empresa.cnpj || 'CNPJ não informado'}</p>
                  {empresa.regime_tributario && (
                    <Badge variant="secondary" className="mt-2">
                      {REGIME_LABEL[normalizarRegime(empresa.regime_tributario)]}
                    </Badge>
                  )}
                </div>
                <Button size="icon" variant="ghost" onClick={() => abrirEdicao(empresa)} title="Editar empresa">
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={openCreate} onOpenChange={open => { setOpenCreate(open); if (!open) createForm.reset(EMPTY_VALUES) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Empresa</DialogTitle></DialogHeader>
          <form onSubmit={createForm.handleSubmit(data => createMutation.mutate(data))} className="space-y-4">
            <EmpresaFields form={createForm} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Criar Empresa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editEmpresa} onOpenChange={open => { if (!open) setEditEmpresa(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Empresa</DialogTitle></DialogHeader>
          <form onSubmit={editForm.handleSubmit(data => editEmpresa && editMutation.mutate({ id: editEmpresa.id, data }))} className="space-y-4">
            <EmpresaFields form={editForm} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditEmpresa(null)}>Cancelar</Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {editMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function EmpresaFields({ form }: { form: UseFormReturn<EmpresaFormData> }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Razão Social</Label>
        <Input placeholder="ACME COMERCIO LTDA" {...form.register('razao_social')} />
        {form.formState.errors.razao_social && <p className="text-xs text-destructive">{form.formState.errors.razao_social.message}</p>}
      </div>
      <div className="space-y-1">
        <Label>CNPJ</Label>
        <Input placeholder="12.345.678/0001-90" {...form.register('cnpj')} />
        {form.formState.errors.cnpj && <p className="text-xs text-destructive">{form.formState.errors.cnpj.message}</p>}
      </div>
      <div className="space-y-1">
        <Label>Regime Tributário</Label>
        <Select
          value={form.watch('regime_tributario')}
          onValueChange={value => form.setValue('regime_tributario', value as EmpresaFormData['regime_tributario'], { shouldValidate: true })}
        >
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            {Object.entries(REGIME_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.formState.errors.regime_tributario && <p className="text-xs text-destructive">{form.formState.errors.regime_tributario.message}</p>}
      </div>
    </div>
  )
}

function normalizarRegime(value?: string): EmpresaFormData['regime_tributario'] {
  if (value === 'lucro_presumido' || value === 'lucro_real') return value
  return 'simples_nacional'
}
