/**
 * Lista TODAS as empresas do escritório, paginando por baixo dos panos.
 *
 * Antes deste hook, cada tela chamava `GET /empresas` sem `page_size` e
 * recebia só as 50 primeiras (default do backend, em ordem alfabética). Com
 * mais de 50 empresas cadastradas, o restante simplesmente não aparecia em
 * nenhum seletor — nem no seletor global de empresa, nem nos filtros de cada
 * módulo — sem erro nenhum que indicasse o motivo.
 *
 * Uso: const { data: empresas = [], isLoading } = useEmpresas()
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface EmpresaOption {
  id: string
  razao_social: string
  cnpj?: string
  regime_tributario?: string
  ativa?: boolean
}

// Teto aceito pelo backend (`le=200` em GET /empresas). Usar o máximo permitido
// minimiza quantas idas e voltas o loop abaixo precisa dar.
const PAGE_SIZE = 200

async function buscarTodasEmpresas(): Promise<EmpresaOption[]> {
  const todas: EmpresaOption[] = []
  let page = 1

  for (;;) {
    const { data } = await api.get('/empresas', { params: { page, page_size: PAGE_SIZE } })
    const items: EmpresaOption[] = data.items ?? data
    todas.push(...items)

    const total: number = data.total ?? todas.length
    if (items.length === 0 || todas.length >= total) break
    page += 1
  }

  return todas
}

export function useEmpresas() {
  return useQuery<EmpresaOption[]>({
    queryKey: ['empresas', 'all'],
    queryFn: buscarTodasEmpresas,
    staleTime: 60_000,
  })
}
