import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { BookOpen, Loader2, Plus, TrendingDown, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'

// Sentinela do select. O backend representa "vale para todos os bancos" com
// `agencia_id: null`, mas um <select> não guarda null — guarda string. A
// conversão acontece num lugar só, no submit deste formulário, para nenhum
// chamador precisar lembrar dela.
export const TODOS_OS_BANCOS = 'todos'

export const regraSchema = z.object({
  descricao: z.string().min(2, 'Mínimo 2 caracteres').max(500),
  historico: z.string().min(2, 'Padrão muito curto').max(500),
  conta_id: z.string().uuid('Selecione uma conta'),
  agencia_id: z
    .string()
    .refine(v => v === TODOS_OS_BANCOS || z.string().uuid().safeParse(v).success, {
      message: 'Selecione a agência ou "Todos os bancos"',
    }),
  dc: z.enum(['D', 'C'], {
    errorMap: () => ({ message: 'Selecione débito ou crédito' }),
  }),
  tipo: z.literal('automatica'),
  manter_historico: z.boolean(),
})

export type RegraFormData = z.infer<typeof regraSchema>

/** O que sai daqui para a API: a sentinela já virou `null`. */
export type RegraPayload = Omit<RegraFormData, 'agencia_id'> & {
  agencia_id: string | null
}
export type RegraFormField = 'descricao' | 'historico' | 'conta_id' | 'agencia_id' | 'dc'

interface RegraOption {
  value: string
  label: string
}

type AgenciaField =
  | { mode: 'select'; options: RegraOption[] }
  | { mode: 'fixed'; id: string }

interface RegraFormProps {
  contas: RegraOption[]
  agencia: AgenciaField
  initialValues?: Partial<RegraFormData>
  editableFields: readonly RegraFormField[]
  isSubmitting: boolean
  onSubmit: (data: RegraPayload) => void
  onCancel: () => void
  submitLabel?: string
}

const BASE_VALUES: RegraFormData = {
  descricao: '',
  historico: '',
  conta_id: '',
  agencia_id: '',
  dc: 'D',
  tipo: 'automatica',
  manter_historico: false,
}

export function RegraForm({
  contas,
  agencia,
  initialValues,
  editableFields,
  isSubmitting,
  onSubmit,
  onCancel,
  submitLabel = 'Criar Regra',
}: RegraFormProps) {
  const values: RegraFormData = {
    ...BASE_VALUES,
    ...initialValues,
    agencia_id: agencia.mode === 'fixed' ? agencia.id : (initialValues?.agencia_id ?? ''),
    tipo: 'automatica',
  }
  const form = useForm<RegraFormData>({ resolver: zodResolver(regraSchema), defaultValues: values })

  useEffect(() => {
    form.reset(values)
  }, [agencia.mode === 'fixed' ? agencia.id : initialValues?.agencia_id, initialValues?.conta_id, initialValues?.dc, initialValues?.descricao, initialValues?.historico])

  const editable = (field: RegraFormField) => editableFields.includes(field)

  return (
    <form
      onSubmit={form.handleSubmit(data =>
        onSubmit({
          ...data,
          agencia_id: data.agencia_id === TODOS_OS_BANCOS ? null : data.agencia_id,
        }),
      )}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="components-regras-regraform-descricao-da-regra-nome-interno">
            Descrição da regra
            <span className="text-muted-foreground text-xs font-normal ml-1">(nome interno)</span>
          </Label>
          <Input id="components-regras-regraform-descricao-da-regra-nome-interno"
            placeholder="Ex: Pagamento Fornecedores"
            disabled={!editable('descricao')}
            {...form.register('descricao')}
          />
          {form.formState.errors.descricao && <p className="text-xs text-destructive">{form.formState.errors.descricao.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="components-regras-regraform-padrao-no-extrato-texto-da-transacao">
            Padrão no extrato
            <span className="text-muted-foreground text-xs font-normal ml-1">(texto da transação)</span>
          </Label>
          <Input id="components-regras-regraform-padrao-no-extrato-texto-da-transacao"
            placeholder="Ex: PAGTO FORNECEDOR"
            disabled={!editable('historico')}
            {...form.register('historico')}
          />
          <p className="text-xs text-muted-foreground">Texto que ativa a regra, sem diferenciar maiúsculas e minúsculas.</p>
          {form.formState.errors.historico && <p className="text-xs text-destructive">{form.formState.errors.historico.message}</p>}
        </div>
      </div>

      <div className={`grid gap-4 ${agencia.mode === 'select' ? 'sm:grid-cols-2' : ''}`}>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5" htmlFor="components-regras-regraform-conta-contabil">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" /> Conta Contábil
          </Label>
          <SearchableSelect id="components-regras-regraform-conta-contabil"
            value={form.watch('conta_id')}
            onValueChange={value => form.setValue('conta_id', value, { shouldValidate: true })}
            options={contas}
            placeholder="Buscar e selecionar conta..."
            searchPlaceholder="Buscar conta..."
            disabled={!editable('conta_id')}
          />
          {form.formState.errors.conta_id && <p className="text-xs text-destructive">{form.formState.errors.conta_id.message}</p>}
        </div>

        {agencia.mode === 'select' && (
          <div className="space-y-1.5">
            <Label htmlFor="components-regras-regraform-agencia-bancaria">Agência Bancária</Label>
            <SearchableSelect id="components-regras-regraform-agencia-bancaria"
              value={form.watch('agencia_id')}
              onValueChange={value => form.setValue('agencia_id', value, { shouldValidate: true })}
              options={[
                { value: TODOS_OS_BANCOS, label: 'Todos os bancos' },
                ...agencia.options,
              ]}
              placeholder="Selecione a agência"
              searchPlaceholder="Buscar agência..."
              disabled={!editable('agencia_id')}
            />
            {form.formState.errors.agencia_id && <p className="text-xs text-destructive">{form.formState.errors.agencia_id.message}</p>}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label id="regra-natureza-rotulo">Natureza</Label>
        <div role="group" aria-labelledby="regra-natureza-rotulo" className="grid grid-cols-2 gap-2 sm:max-w-md">
          {(['D', 'C'] as const).map(dc => (
            <button
              key={dc}
              type="button"
              disabled={!editable('dc')}
              onClick={() => form.setValue('dc', dc, { shouldValidate: true })}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60 ${form.watch('dc') === dc
                ? dc === 'D'
                  ? 'bg-danger/15 border-danger/40 text-danger'
                  : 'bg-success/15 border-success/40 text-success'
                : 'bg-surface border-border text-muted-foreground hover:bg-muted/30'
              }`}
            >
              {dc === 'D' ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
              {dc === 'D' ? 'Débito' : 'Crédito'}
            </button>
          ))}
        </div>
        {form.formState.errors.dc && <p className="text-xs text-destructive">{form.formState.errors.dc.message}</p>}
      </div>

      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>
            : <><Plus className="h-4 w-4 mr-1" />{submitLabel}</>}
        </Button>
      </DialogFooter>
    </form>
  )
}
