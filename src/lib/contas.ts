/**
 * Como uma conta contábil aparece nos seletores — uma definição só.
 *
 * O seletor mostrava a CLASSIFICAÇÃO ("1.1.1.02.0001 — BANCO - DO BRASIL"),
 * que não é como o contador chama a conta. Na tela de Plano de Contas as
 * colunas são "Conta" (o número da conta) e "Classificação" (a hierarquia), e
 * é pelo número que ele procura. Escolher a conta por um identificador que a
 * tela de origem trata como secundário obriga a traduzir de cabeça a cada
 * lançamento.
 *
 * A classificação não some: vira a segunda linha da opção, e continua entrando
 * na busca — quem já procurava por "1.1.1" continua achando.
 *
 * `conta_numero` é opcional no cadastro (contas criadas à mão podem não ter),
 * então a classificação assume o lugar quando ele falta. O rótulo nunca fica
 * só com a descrição: sem nenhum número, duas contas homônimas viram a mesma
 * linha na lista.
 */

export interface ContaLike {
  id: string
  conta_numero?: number | string | null
  codigo?: string | null
  descricao?: string | null
}

export interface OpcaoConta {
  value: string
  label: string
  sublabel?: string
}

function texto(valor: unknown): string {
  return valor == null ? '' : String(valor).trim()
}

/** Identificador principal: o número da conta, com a classificação de reserva. */
export function numeroDaConta(conta: ContaLike): string {
  return texto(conta.conta_numero) || texto(conta.codigo)
}

export function rotuloConta(conta: ContaLike): string {
  const numero = numeroDaConta(conta)
  const descricao = texto(conta.descricao)
  if (!numero) return descricao
  return descricao ? `${numero} — ${descricao}` : numero
}

/**
 * Opção pronta para `SearchableSelect`/`SearchableCombobox`.
 *
 * `complemento` é para quem já mostrava outra informação na segunda linha
 * (Analítica/Sintética, em Agências) — ela continua ali, junto da
 * classificação, em vez de uma substituir a outra.
 */
export function opcaoConta(conta: ContaLike, complemento?: string): OpcaoConta {
  const classificacao = texto(conta.codigo)
  const partes: string[] = []
  // Só repete a classificação quando ela NÃO é o rótulo principal.
  if (classificacao && classificacao !== numeroDaConta(conta)) {
    partes.push(classificacao)
  }
  if (complemento) partes.push(complemento)

  return {
    value: conta.id,
    label: rotuloConta(conta),
    sublabel: partes.length ? partes.join(' · ') : undefined,
  }
}
