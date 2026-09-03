import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
  return d.toLocaleDateString('pt-BR')
}

/**
 * Extrai mensagem de erro legível de respostas da API.
 * FastAPI 422: { detail: [{type, loc, msg, input}] }
 * FastAPI 400/401: { detail: "mensagem" } ou { detail: { message: "..." } }
 */
/**
 * "2026-03" -> "03/2026". A competência estava vazando crua para breadcrumb,
 * título e tabela em Cartões, no meio de datas que já saem como DD/MM/AAAA.
 */
export function formatCompetencia(competencia: string): string {
  if (!competencia) return '-'
  const [ano, mes] = competencia.split('-')
  return mes && ano ? `${mes}/${ano}` : competencia
}

export function extractApiError(e: unknown, fallback = 'Ocorreu um erro.'): string {
  if (!e || typeof e !== 'object') return fallback
  const err = e as any
  const detail = err?.response?.data?.detail ?? err?.response?.data?.message ?? err?.message
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  if (typeof detail === 'object' && !Array.isArray(detail) && 'message' in detail) return String(detail.message)
  if (Array.isArray(detail)) {
    return detail
      .map((d: any) => {
        if (typeof d === 'string') return d
        if (d?.msg) return String(d.msg)
        return 'Erro de validação'
      })
      .join(' | ')
  }
  return fallback
}
