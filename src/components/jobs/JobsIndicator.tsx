import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, AlertTriangle, Loader2, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { JOB_POLL_INTERVAL_MS, type Job, type JobStatus } from '@/hooks/useJob'

interface JobsPage {
  items: Job[]
  total: number
}

const STATUS_LABELS: Record<JobStatus, string> = {
  na_fila: 'Na fila',
  processando: 'Processando',
  concluido: 'Concluído',
  concluido_com_alertas: 'Concluído com alertas',
  falhou: 'Falhou',
}

function normalizeJobs(data: JobsPage | Job[] | undefined) {
  if (!data) return []
  return Array.isArray(data) ? data : data.items ?? []
}

function useJobsByStatus(empresaId: string, status: 'na_fila' | 'processando') {
  return useQuery<JobsPage | Job[]>({
    queryKey: ['jobs', empresaId, status],
    queryFn: () => api.get(`/empresas/${empresaId}/jobs`, {
      params: { status, page: 1, page_size: 20 },
    }).then(response => response.data),
    enabled: !!empresaId,
    refetchInterval: query => {
      if (query.state.status === 'error') return false
      return normalizeJobs(query.state.data as JobsPage | Job[] | undefined).length
        ? JOB_POLL_INTERVAL_MS
        : false
    },
    retry: 2,
  })
}

function JobResult({ job }: { job: Job }) {
  if (job.erro) return <p className="mt-2 text-sm text-red-800">{job.erro}</p>
  if (!job.resultado) return null

  return (
    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
      {Object.entries(job.resultado).map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-muted-foreground">{key.replace(/_/g, ' ')}</dt>
          <dd className="break-words text-right font-medium">
            {Array.isArray(value) ? (value.length ? value.join('; ') : '—') : String(value ?? '—')}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function statusVariant(status: JobStatus) {
  if (status === 'falhou') return 'destructive' as const
  if (status === 'concluido') return 'success' as const
  if (status === 'concluido_com_alertas' || status === 'na_fila') return 'warning' as const
  return 'secondary' as const
}

export function JobsIndicator() {
  const { empresa } = useEmpresa()
  const empresaId = empresa?.id ?? ''
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const queuedQuery = useJobsByStatus(empresaId, 'na_fila')
  const processingQuery = useJobsByStatus(empresaId, 'processando')
  const recentQuery = useQuery<JobsPage | Job[]>({
    queryKey: ['jobs', empresaId, 'recentes'],
    queryFn: () => api.get(`/empresas/${empresaId}/jobs`, {
      params: { page: 1, page_size: 20 },
    }).then(response => response.data),
    enabled: !!empresaId,
  })

  const running = useMemo(() => {
    const jobs = [...normalizeJobs(queuedQuery.data), ...normalizeJobs(processingQuery.data)]
    return [...new Map(jobs.map(job => [job.id, job])).values()]
  }, [queuedQuery.data, processingQuery.data])

  useEffect(() => {
    if (empresaId) qc.invalidateQueries({ queryKey: ['jobs', empresaId, 'recentes'] })
  }, [empresaId, running.length, qc])

  const recent = normalizeJobs(recentQuery.data)
  const loading = queuedQuery.isLoading || processingQuery.isLoading

  function retry(job: Job) {
    setOpen(false)
    navigate(job.tipo === 'neo_processar' ? '/neo' : '/extrato')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!empresaId}
        className="flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        title={empresaId ? 'Acompanhar jobs da empresa ativa' : 'Selecione uma empresa para acompanhar jobs'}
      >
        {running.length > 0 ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : <Activity className="h-4 w-4 text-muted-foreground" />}
        <span className="hidden font-medium sm:inline">Jobs</span>
        {running.length > 0 && <Badge variant="default" className="px-1.5">{running.length}</Badge>}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Jobs — {empresa?.razao_social}</DialogTitle>
          </DialogHeader>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Em andamento</h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Consultando…</p>
            ) : running.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum job em andamento.</p>
            ) : (
              <div className="space-y-2">
                {running.map(job => <JobRow key={job.id} job={job} onRetry={retry} />)}
              </div>
            )}
          </section>

          <section className="border-t pt-4">
            <h3 className="mb-2 text-sm font-semibold">Histórico recente</h3>
            {recentQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Consultando…</p>
            ) : recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum job recente.</p>
            ) : (
              <div className="space-y-2">
                {recent.map(job => <JobRow key={job.id} job={job} onRetry={retry} />)}
              </div>
            )}
          </section>
        </DialogContent>
      </Dialog>
    </>
  )
}

function JobRow({ job, onRetry }: { job: Job; onRetry: (job: Job) => void }) {
  const hasTotal = job.total != null
  const progress = hasTotal ? `${job.processados ?? 0} de ${job.total}` : 'Começando'

  return (
    <article className="rounded-md border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{job.tipo === 'neo_processar' ? 'Processamento NEO' : 'Importação de extrato'}</p>
          <p className="text-xs text-muted-foreground">{new Date(job.created_at).toLocaleString('pt-BR')}</p>
        </div>
        <Badge variant={statusVariant(job.status)}>{STATUS_LABELS[job.status]}</Badge>
      </div>
      {(job.status === 'na_fila' || job.status === 'processando') && <p className="mt-2 text-sm">{progress}</p>}
      <JobResult job={job} />
      {job.status === 'falhou' && (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => onRetry(job)}>
          <RotateCcw className="h-3.5 w-3.5" />
          {job.tipo === 'extrato_importar' ? 'Escolher arquivo e tentar novamente' : 'Ir ao NEO e tentar novamente'}
        </Button>
      )}
      {job.status === 'concluido_com_alertas' && !job.resultado && (
        <p className="mt-2 flex items-center gap-1 text-xs text-amber-800"><AlertTriangle className="h-3.5 w-3.5" />Concluído com ocorrências que exigem atenção.</p>
      )}
    </article>
  )
}
