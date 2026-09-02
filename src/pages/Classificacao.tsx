import { AlertTriangle, Contact, FileSearch } from 'lucide-react'
import { RegrasTab } from '@/components/configuracoes/RegrasTab'
import { ConflitosQualidadeTab } from '@/components/classificacao/ConflitosQualidadeTab'
import { ContrapartesTab } from '@/pages/Contrapartes'
import { useEmpresaDefault } from '@/hooks/useEmpresaDefault'
import { useEmpresas } from '@/hooks/useEmpresas'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function ClassificacaoPage() {
  const [selectedEmpresa, setSelectedEmpresa] = useEmpresaDefault()
  const { data: empresas = [] } = useEmpresas()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Classificação</h1>
        <p className="text-muted-foreground">Configure como os lançamentos são associados ao plano de contas e confira a qualidade das decisões.</p>
      </div>

      <div className="rounded-lg border border-info/40 bg-info/15 px-4 py-3 text-sm text-info">
        <span className="font-semibold">Prioridade:</span> histórico bancário → CPF/CNPJ do favorecido → pendência manual
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="max-w-sm">
            <label className="mb-1.5 block text-sm font-medium">Empresa</label>
            <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
              <SelectTrigger>
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

      <Tabs key={selectedEmpresa || 'sem-empresa'} defaultValue="historico">
        <TabsList className="grid h-auto w-full grid-cols-1 sm:grid-cols-3">
          <TabsTrigger value="historico" className="gap-2"><FileSearch className="h-4 w-4" /> Por histórico bancário</TabsTrigger>
          <TabsTrigger value="contrapartes" className="gap-2"><Contact className="h-4 w-4" /> Por favorecido/cliente</TabsTrigger>
          <TabsTrigger value="qualidade" className="gap-2"><AlertTriangle className="h-4 w-4" /> Conflitos e qualidade</TabsTrigger>
        </TabsList>
        <TabsContent value="historico" className="mt-4">
          {selectedEmpresa ? <RegrasTab empresaId={selectedEmpresa} /> : <EmptySelection />}
        </TabsContent>
        <TabsContent value="contrapartes" className="mt-4">
          {selectedEmpresa ? <ContrapartesTab empresaId={selectedEmpresa} /> : <EmptySelection />}
        </TabsContent>
        <TabsContent value="qualidade" className="mt-4">
          {selectedEmpresa ? <ConflitosQualidadeTab empresaId={selectedEmpresa} /> : <EmptySelection />}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function EmptySelection() {
  return (
    <div className="rounded-lg border-2 border-dashed py-16 text-center text-muted-foreground">
      <p className="text-sm">Selecione uma empresa para ver as configurações de classificação.</p>
    </div>
  )
}
