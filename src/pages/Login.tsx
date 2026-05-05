import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { extractApiError } from '@/lib/utils'
import { api } from '@/lib/api'

const schema = z.object({
  cnpj: z.string().min(1, 'CNPJ do escritório é obrigatório'),
  email: z.string().email('Email inválido'),
  senha: z.string().min(1, 'Senha obrigatória'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [tenantInfo, setTenantInfo] = useState<{ id: string; nome: string } | null>(null)
  const [tenantError, setTenantError] = useState('')
  const [resolvingTenant, setResolvingTenant] = useState(false)

  // Ref para acessar tenantInfo atual sem problemas de closure
  const tenantRef = useRef<{ id: string; nome: string } | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting }, getValues } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const resolveTenant = async (): Promise<{ id: string; nome: string } | null> => {
    const cnpj = getValues('cnpj').trim()
    if (!cnpj) return null
    setResolvingTenant(true)
    setTenantError('')
    try {
      const { data } = await api.get(`/auth/tenant?cnpj=${encodeURIComponent(cnpj)}`)
      setTenantInfo(data)
      tenantRef.current = data
      return data
    } catch (e: unknown) {
      const msg = extractApiError(e, 'Escritório não encontrado para este CNPJ.')
      setTenantError(msg)
      setTenantInfo(null)
      tenantRef.current = null
      return null
    } finally {
      setResolvingTenant(false)
    }
  }

  const onSubmit = async (data: FormData) => {
    setError('')

    // Garante que tenant está resolvido
    let tenant = tenantRef.current
    if (!tenant) {
      tenant = await resolveTenant()
    }
    if (!tenant) {
      setError('CNPJ do escritório inválido ou não encontrado.')
      return
    }

    try {
      await login(tenant.id, data.email, data.senha)
      navigate('/dashboard')
    } catch (e: unknown) {
      setError(extractApiError(e, 'Email ou senha incorretos.'))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Contabil Core</CardTitle>
          <CardDescription>Entre com suas credenciais para continuar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            {/* CNPJ do escritório */}
            <div className="space-y-1">
              <Label htmlFor="cnpj">CNPJ do Escritório Contábil</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="cnpj"
                  placeholder="41.000.000/0001-00"
                  className="flex-1"
                  {...register('cnpj')}
                  onBlur={resolveTenant}
                />
                {resolvingTenant && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
                {!resolvingTenant && tenantInfo && <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />}
                {!resolvingTenant && tenantError && <AlertCircle className="h-5 w-5 text-destructive shrink-0" />}
              </div>
              {errors.cnpj && <p className="text-xs text-destructive">{errors.cnpj.message}</p>}
              {tenantInfo && <p className="text-xs text-green-600 font-medium">✓ {tenantInfo.nome}</p>}
              {tenantError && <p className="text-xs text-destructive">{tenantError}</p>}
            </div>

            {/* Email */}
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@contabil.dev"
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            {/* Senha */}
            <div className="space-y-1">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                placeholder="••••••••"
                {...register('senha')}
              />
              {errors.senha && <p className="text-xs text-destructive">{errors.senha.message}</p>}
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 py-2 px-3 rounded-md text-center">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting || resolvingTenant}>
              {isSubmitting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Entrando...</>
                : 'Entrar'
              }
            </Button>
          </form>

          {/* Dica de desenvolvimento */}
          <div className="mt-5 p-3 bg-muted rounded-md text-xs text-muted-foreground space-y-0.5">
            <p className="font-semibold text-foreground mb-1">Dados de teste (seed):</p>
            <p>CNPJ: <code className="bg-background px-1 rounded">41.000.000/0001-00</code></p>
            <p>Email: <code className="bg-background px-1 rounded">admin@contabil.dev</code></p>
            <p>Senha: <code className="bg-background px-1 rounded">Admin@1234</code></p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
