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
