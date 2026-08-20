import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Settings, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { extractApiError } from '@/lib/utils'
import { toast } from '@/hooks/useToast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

const TIPOS_OPCOES = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'passivo', label: 'Passivo' },
  { value: 'patrimonio_liquido', label: 'Patrimônio Líquido' },
  { value: 'receita', label: 'Receita' },
  { value: 'despesa', label: 'Despesa' },
  { value: 'custo', label: 'Custo' },
  { value: 'resultado', label: 'Resultado' },
]

const TIPO_COLOR: Record<string, string> = {
  ativo: 'bg-emerald-100 text-emerald-700',
  passivo: 'bg-red-100 text-red-700',
  patrimonio_liquido: 'bg-purple-100 text-purple-700',
  receita: 'bg-blue-100 text-blue-700',
  despesa: 'bg-orange-100 text-orange-700',
  custo: 'bg-yellow-100 text-yellow-700',
  resultado: 'bg-cyan-100 text-cyan-700',
}

interface FaixaDraft {
  id: string
  tipo: string
  codigo_de: string
  codigo_ate: string
}

interface FaixasTipoDialogProps {
  empresaId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FaixasTipoDialog({ empresaId, open, onOpenChange }: FaixasTipoDialogProps) {
  const queryClient = useQueryClient()
  const [faixasDraft, setFaixasDraft] = useState<FaixaDraft[]>([])
  const faixasQuery = useQuery<any>({
    queryKey: ['plano-contas-faixas', empresaId],
    queryFn: () => api.get(`/empresas/${empresaId}/plano-contas/faixas-tipo`).then(response => response.data),
    enabled: !!empresaId && open,
  })

  useEffect(() => {
    if (!open || !faixasQuery.data) return
    setFaixasDraft((faixasQuery.data.faixas ?? []).map((faixa: any, index: number) => ({
      id: faixa.id ?? `existente-${index}`,
      tipo: faixa.tipo,
      codigo_de: faixa.codigo_de,
      codigo_ate: faixa.codigo_ate,
    })))
  }, [open, faixasQuery.data])

  const salvarMutation = useMutation({
    mutationFn: (faixas: Array<{ tipo: string; codigo_de: string; codigo_ate: string }>) =>
      api.put(`/empresas/${empresaId}/plano-contas/faixas-tipo`, { faixas }).then(response => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plano-contas-faixas', empresaId] })
      toast({ title: 'Faixas de classificação salvas!', variant: 'success' })
      onOpenChange(false)
    },
    onError: (error: unknown) => toast({
      title: 'Erro ao salvar faixas',
      description: extractApiError(error),
      variant: 'destructive',
    }),
  })

  function adicionarFaixa(tipo: string) {
    setFaixasDraft(current => [
      ...current,
      { id: `nova-${Date.now()}-${Math.random()}`, tipo, codigo_de: '', codigo_ate: '' },
    ])
  }

  function atualizarFaixa(id: string, campo: 'codigo_de' | 'codigo_ate', valor: string) {
    setFaixasDraft(current => current.map(faixa => faixa.id === id ? { ...faixa, [campo]: valor } : faixa))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-emerald-600" /> Configurar Plano de Contas
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Faixas de código usadas para classificar o tipo automaticamente quando a planilha importada não traz
          a coluna “Tipo”. Um código fora de qualquer faixa configurada vira erro na importação — nunca é
          adivinhado. Faixas de tipos diferentes não podem se sobrepor.
        </p>
        {faixasQuery.isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-5 max-h-[55vh] overflow-y-auto pr-1">
            {TIPOS_OPCOES.map(tipo => {
              const faixasDoTipo = faixasDraft.filter(faixa => faixa.tipo === tipo.value)
              return (
                <div key={tipo.value} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge className={TIPO_COLOR[tipo.value]}>{tipo.label}</Badge>
                    <Button type="button" size="sm" variant="ghost" onClick={() => adicionarFaixa(tipo.value)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Faixa
                    </Button>
                  </div>
                  {faixasDoTipo.length === 0 ? (
                    <p className="text-xs text-muted-foreground pl-1">Nenhuma faixa configurada.</p>
                  ) : (
                    <div className="space-y-2">
                      {faixasDoTipo.map(faixa => (
                        <div key={faixa.id} className="flex items-center gap-2">
                          <Input
                            placeholder="De (ex: 1)"
                            value={faixa.codigo_de}
                            onChange={event => atualizarFaixa(faixa.id, 'codigo_de', event.target.value)}
                            className="font-mono text-sm"
                          />
                          <span className="text-xs text-muted-foreground shrink-0">até</span>
                          <Input
                            placeholder="Até (ex: 1.999999)"
                            value={faixa.codigo_ate}
                            onChange={event => atualizarFaixa(faixa.id, 'codigo_ate', event.target.value)}
                            className="font-mono text-sm"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => setFaixasDraft(current => current.filter(item => item.id !== faixa.id))}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            type="button"
            onClick={() => salvarMutation.mutate(faixasDraft.map(({ tipo, codigo_de, codigo_ate }) => ({ tipo, codigo_de, codigo_ate })))}
            disabled={salvarMutation.isPending}
          >
            {salvarMutation.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>
              : 'Salvar Faixas'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
