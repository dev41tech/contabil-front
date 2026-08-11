/**
 * Cliente para o módulo CONCILPRO.
 *
 * As rotas do backend são escopadas por empresa
 * (`/empresas/{empresa_id}/concilpro/...`) — todo método aqui recebe
 * `empresaId` como primeiro argumento e monta a URL com ele. Antes este
 * arquivo tinha um axios próprio apontando para `/api/v1/concilpro` sem
 * empresa nenhuma (resquício de quando o ConcilPro era um serviço à parte);
 * isso fazia trocar de empresa não mudar a URL chamada, então os dados de
 * fornecedores ficavam iguais para qualquer empresa selecionada.
 */
import { api } from '@/lib/api'

const base = (empresaId: string) => `/empresas/${empresaId}/concilpro`

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface Arquivo {
  id: number
  nome_arquivo: string
  status: 'PROCESSANDO' | 'CONCLUIDO' | 'ERRO'
  total_fornecedores: number
  total_lancamentos: number
  periodo_inicio: string | null
  periodo_fim: string | null
  created_at: string
}

export interface Resumo {
  arquivo: { id: number; nome: string; periodo_inicio: string | null; periodo_fim: string | null }
  estatisticas: {
    total_fornecedores: number
    total_lancamentos: number
    fornecedores_quitados: number
    fornecedores_em_aberto: number
    fornecedores_adiantados: number
    /** Contas do plano sem nenhum lançamento no período — não entram em "quitados". */
    fornecedores_sem_movimento: number
    fornecedores_com_divergencia: number
    valor_total_a_pagar: number
  }
}

export interface Fornecedor {
  id: number
  codigo_conta: string
  conta_contabil: string
  nome_fornecedor: string
  total_credito: number
  total_debito: number
  saldo_final: number
  valor_a_pagar: number
  /**
   * SEM_MOVIMENTO = conta aberta no plano que não teve lançamento no período.
   * É categoria à parte de QUITADO de propósito: somá-la aos quitados inflaria a
   * métrica com contas que nunca tiveram movimento.
   */
  status_pagamento: 'QUITADO' | 'EM_ABERTO' | 'ADIANTADO' | 'SEM_MOVIMENTO'
  qtd_nfs_pendentes: number
  qtd_nfs_parciais: number
  divergencia_calculo: boolean
}

export interface FornecedorDetalhado {
  fornecedor: Fornecedor & { cnpj: string | null; saldo_anterior: number }
  compras_pendentes: Array<{
    id: number
    data_lancamento: string
    numero_nf: string | null
    historico: string
    valor_total: number
    valor_pago_parcial: number
    valor_saldo: number
    status_pagamento: 'PAGO' | 'PARCIAL' | 'PENDENTE'
  }>
  todos_lancamentos: Array<{
    id: number
    data: string
    lote: string | null
    historico: string
    tipo_operacao: 'COMPRA' | 'PAGAMENTO' | 'DEVOLUCAO'
    valor_debito: number
    valor_credito: number
    saldo_apos: number
  }>
}

export interface ConciliacaoFifoItem {
  numero_nf: string
  data_lancamento: string | null
  historico: string
  valor_total: number
  valor_pago: number
  data_pagamento: string | null
  valor_saldo: number
  status: string
  pagamentos: Array<{
    data_pagamento: string | null
    historico: string
    valor_pago: number
    saldo_restante: number
  }>
}

export interface Divergencia {
  id: number
  fornecedor_id: number
  tipo: string
  severidade: 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAIXA'
  descricao: string
  diferenca: number
  created_at: string
}

// ─── Serviços ─────────────────────────────────────────────────────────────────

export const concilproService = {

  uploadArquivo: async (empresaId: string, file: File): Promise<{ success: boolean; arquivo_id: number; status: string }> => {
    const form = new FormData()
    form.append('file', file)
    const { data } = await api.post(`${base(empresaId)}/upload`, form)
    return data
  },

  statusArquivo: async (empresaId: string, arquivoId: number) => {
    const { data } = await api.get(`${base(empresaId)}/arquivos/${arquivoId}/status`)
    return data as { status: string; total_fornecedores: number; total_lancamentos: number; mensagem_erro?: string }
  },

  listarArquivos: async (empresaId: string): Promise<Arquivo[]> => {
    const { data } = await api.get(`${base(empresaId)}/arquivos`)
    return data
  },

  obterResumo: async (empresaId: string, arquivoId: number): Promise<Resumo> => {
    const { data } = await api.get(`${base(empresaId)}/resumo/${arquivoId}`)
    return data
  },

  listarFornecedores: async (empresaId: string, arquivoId: number, status?: string): Promise<Fornecedor[]> => {
    const { data } = await api.get(`${base(empresaId)}/fornecedores`, {
      params: { arquivo_id: arquivoId, status, limit: 500 },
    })
    return Array.isArray(data) ? data : data.fornecedores ?? []
  },

  obterFornecedorDetalhado: async (empresaId: string, fornecedorId: number): Promise<FornecedorDetalhado> => {
    const { data } = await api.get(`${base(empresaId)}/fornecedores/${fornecedorId}`)
    return data
  },

  obterConciliacaoFifo: async (empresaId: string, fornecedorId: number): Promise<ConciliacaoFifoItem[]> => {
    const { data } = await api.get(`${base(empresaId)}/fornecedores/${fornecedorId}/conciliacao-fifo`)
    return data.conciliacao ?? data
  },

  listarDivergencias: async (empresaId: string, arquivoId: number): Promise<Divergencia[]> => {
    const { data } = await api.get(`${base(empresaId)}/divergencias`, {
      params: { arquivo_id: arquivoId },
    })
    return data
  },

  exportarExcel: async (empresaId: string, arquivoId: number, tipo: 'completo' | 'em_aberto' | 'divergencias') => {
    const { data } = await api.get(`${base(empresaId)}/export/excel/${arquivoId}`, {
      params: { tipo },
      responseType: 'blob',
    })
    const url = window.URL.createObjectURL(new Blob([data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `conciliacao_${tipo}.xlsx`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  },

  exportarLancamentosImportacao: async (empresaId: string, arquivoId: number) => {
    const { data } = await api.get(`${base(empresaId)}/export/lancamentos/${arquivoId}`, {
      responseType: 'blob',
    })
    const url = window.URL.createObjectURL(new Blob([data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `lancamentos_importacao_${arquivoId}.xlsx`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  },

}
