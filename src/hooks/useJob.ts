import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'

export type JobTipo = 'neo_processar' | 'extrato_importar'
export type JobStatus = 'na_fila' | 'processando' | 'concluido' | 'concluido_com_alertas' | 'falhou'

export interface Job<TResultado = Record<string, unknown>> {
  id: string
  empresa_id: string
  tipo: JobTipo
  status: JobStatus
  total: number | null
  processados: number | null
  resultado: TResultado | null
  erro: string | null
  criado_por: string
  created_at: string
  iniciado_em: string | null
  concluido_em: string | null
  heartbeat_em: string | null
}

export const JOB_POLL_INTERVAL_MS = 3_000
const JOB_POLL_MAX_DURATION_MS = 30 * 60 * 1_000

export function isJobRunning(status: JobStatus | undefined) {
  return status === 'na_fila' || status === 'processando'
}

export function isJobFinished(status: JobStatus | undefined) {
  return status === 'concluido' || status === 'concluido_com_alertas' || status === 'falhou'
}

/**
 * Acompanha um job enquanto ele estiver ativo. O teto local evita polling sem
 * fim se a conexão cair ou o servidor deixar de produzir um estado terminal.
 */
export function useJob<TResultado = Record<string, unknown>>(empresaId: string, jobId: string | null) {
  const startedPollingAt = useRef(Date.now())
  const pollingTimeout = useRef<number | null>(null)
  const [pollingTimedOut, setPollingTimedOut] = useState(false)

  useEffect(() => {
    startedPollingAt.current = Date.now()
    setPollingTimedOut(false)
    if (!empresaId || !jobId) return
    pollingTimeout.current = window.setTimeout(() => setPollingTimedOut(true), JOB_POLL_MAX_DURATION_MS)
    return () => {
      if (pollingTimeout.current != null) window.clearTimeout(pollingTimeout.current)
    }
  }, [empresaId, jobId])

  const query = useQuery<Job<TResultado>>({
    queryKey: ['job', empresaId, jobId],
    queryFn: () => api.get(`/empresas/${empresaId}/jobs/${jobId}`).then(response => response.data),
    enabled: !!empresaId && !!jobId,
    retry: 2,
    refetchInterval: query => {
      if (query.state.status === 'error') return false
      const job = query.state.data as Job<TResultado> | undefined
      if (!isJobRunning(job?.status)) return false
      if (pollingTimedOut || Date.now() - startedPollingAt.current >= JOB_POLL_MAX_DURATION_MS) return false
      return JOB_POLL_INTERVAL_MS
    },
  })

  const restartPolling = useCallback(() => {
    startedPollingAt.current = Date.now()
    setPollingTimedOut(false)
    if (pollingTimeout.current != null) window.clearTimeout(pollingTimeout.current)
    pollingTimeout.current = window.setTimeout(() => setPollingTimedOut(true), JOB_POLL_MAX_DURATION_MS)
    return query.refetch()
  }, [query.refetch])

  return { ...query, pollingTimedOut, restartPolling }
}
