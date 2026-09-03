import { AlertCircle } from 'lucide-react'
import { Button } from './button'
import { extractApiError } from '@/lib/utils'

interface ErroConsultaProps {
  /** O erro que veio do react-query. */
  erro?: unknown
  /** O que não carregou, para completar "Não foi possível carregar ___". */
  contexto: string
  /** Normalmente o `refetch` da própria query. */
  onTentarDeNovo?: () => void
}

/**
 * Estado de erro de uma consulta.
 *
 * Existe porque a falha de rede estava caindo no estado vazio: a tela dizia
 * "Nenhum lançamento encontrado. Execute o NEO primeiro" quando o que houve foi
 * a requisição falhar. Dizer "não há nada" quando não se sabe é pior do que não
 * dizer nada — o contador vai atrás de um trabalho que não existe.
 *
 * Vem SEMPRE antes do estado vazio na cadeia de condições.
 */
export function ErroConsulta({ erro, contexto, onTentarDeNovo }: ErroConsultaProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <AlertCircle className="h-7 w-7 text-destructive" />
      <div>
        <p className="text-sm font-medium text-foreground">Não foi possível carregar {contexto}.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {extractApiError(erro, 'O servidor não respondeu.')}
        </p>
      </div>
      {onTentarDeNovo && (
        <Button variant="outline" size="sm" onClick={onTentarDeNovo}>Tentar de novo</Button>
      )}
    </div>
  )
}
