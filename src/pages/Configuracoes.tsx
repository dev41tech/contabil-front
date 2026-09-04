import { BookOpen, Building2, Users } from 'lucide-react'
import { useEmpresaDefault } from '@/hooks/useEmpresaDefault'
import { useEmpresas } from '@/hooks/useEmpresas'
import { AgenciasTab } from '@/components/configuracoes/AgenciasTab'
import { EmpresasTab } from '@/components/configuracoes/EmpresasTab'
import { PlanoContasTab } from '@/components/configuracoes/PlanoContasTab'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function ConfiguracoesPage() {
  const [selectedEmpresa, setSelectedEmpresa] = useEmpresaDefault()
  const { data: empresas = [] } = useEmpresas()

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Configurações</h1>

      <Card>
        <CardContent className="pt-6">
          <div className="max-w-sm">
            <label className="text-sm font-medium mb-1.5 block" htmlFor="pages-configuracoes-empresa">Empresa</label>
            <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
              <SelectTrigger id="pages-configuracoes-empresa">
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresas.map(empresa => (
                  <SelectItem key={empresa.id} value={empresa.id}>{empresa.razao_social}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs key={selectedEmpresa || 'sem-empresa'} defaultValue={selectedEmpresa ? 'plano' : 'empresas'}>
        <TabsList className="grid w-full grid-cols-3 max-w-xl">
          <TabsTrigger value="plano" className="gap-1.5">
            <BookOpen className="h-4 w-4" /> Plano de Contas
          </TabsTrigger>
          <TabsTrigger value="agencias" className="gap-1.5">
            <Building2 className="h-4 w-4" /> Contas bancárias
          </TabsTrigger>
          <TabsTrigger value="empresas" className="gap-1.5">
            <Users className="h-4 w-4" /> Empresas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plano" className="mt-4">
          {selectedEmpresa ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="h-5 w-5 text-brand" /> Plano de Contas
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Estrutura hierárquica de contas contábeis da empresa.
                </p>
              </CardHeader>
              <CardContent><PlanoContasTab empresaId={selectedEmpresa} /></CardContent>
            </Card>
          ) : <EmptySelection />}
        </TabsContent>

        <TabsContent value="agencias" className="mt-4">
          {selectedEmpresa ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5 text-brand" /> Contas Bancárias
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Contas bancárias cadastradas para esta empresa.
                </p>
              </CardHeader>
              <CardContent><AgenciasTab empresaId={selectedEmpresa} /></CardContent>
            </Card>
          ) : <EmptySelection />}
        </TabsContent>

        <TabsContent value="empresas" className="mt-4">
          <EmpresasTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function EmptySelection() {
  return (
    <div className="text-center py-16 border-2 border-dashed rounded-lg text-muted-foreground">
      <p className="text-sm">Selecione uma empresa para ver as configurações.</p>
    </div>
  )
}
