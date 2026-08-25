export interface NeoGrupoPendencia {
  padrao: string
  rotulo: string
  dc: 'D' | 'C'
  quantidade: number
  valor_total: number
  data_inicio: string
  data_fim: string
  agencia_ids: string[]
  amostras: string[]
  transacao_ids: string[]
}

export interface NeoPendenciasAgrupadas {
  grupos: NeoGrupoPendencia[]
  total_pendentes: number
  total_agrupadas: number
  total_grupos: number
  parcial: boolean
}

export interface NeoSimulacaoRegra {
  pendencias_atingidas: number
  ja_contabilizadas_atingidas: number
  conflitos: number
}

export interface SelectOption {
  value: string
  label: string
  /** Segunda linha da opção — nas contas, a classificação. Ver `lib/contas`. */
  sublabel?: string
}

export interface AgenciaNeo {
  id: string
  descricao?: string
  banco_sigla?: string
  agencia?: string
  numero?: string
}

export function agenciaLabel(agencia: AgenciaNeo) {
  return agencia.descricao ?? `${agencia.banco_sigla ?? ''} ${agencia.agencia ?? ''}/${agencia.numero ?? ''}`.trim()
}
