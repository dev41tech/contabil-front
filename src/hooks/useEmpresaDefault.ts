/**
 * Hook que inicializa o seletor de empresa local a partir do contexto global.
 * Substitui useState('') em todas as páginas que têm seletor de empresa.
 *
 * Uso: const [selectedEmpresa, setSelectedEmpresa] = useEmpresaDefault()
 */
import { useState, useEffect } from 'react'
import { useEmpresa } from '@/contexts/EmpresaContext'

export function useEmpresaDefault(initialOverride = '') {
  const { empresa } = useEmpresa()
  const [selected, setSelected] = useState(
    initialOverride || empresa?.id || ''
  )

  // Quando o contexto muda (usuário troca no seletor global),
  // atualiza se não houver uma seleção local explícita diferente
  useEffect(() => {
    if (empresa?.id) {
      setSelected(empresa.id)
    }
  }, [empresa?.id])

  return [selected, setSelected] as const
}
