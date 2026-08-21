import { AlertTriangle, Loader2 } from 'lucide-react'
import type { Job } from '@/hooks/useJob'
import { isJobRunning } from '@/hooks/useJob'

export function JobProgress({ job }: { job: Job<unknown> }) {
  if (!isJobRunning(job.status)) return null

  const hasTotal = job.total != null
  const processed = job.processados ?? 0
  const percent = hasTotal && job.total! > 0
    ? Math.min(100, Math.round((processed / job.total!) * 100))
    : 0

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4" role="status">
      <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
        {job.status === 'na_fila'
          ? <><Loader2 className="h-4 w-4 animate-spin" />Na fila, aguardando início…</>
          : <><Loader2 className="h-4 w-4 animate-spin" />Processamento em andamento</>}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
        <div
          className={`h-full rounded-full bg-blue-600 transition-all ${hasTotal ? '' : 'w-1/3 animate-pulse'}`}
          style={hasTotal ? { width: `${percent}%` } : undefined}
        />
      </div>
      <p className="mt-2 text-sm text-blue-800">
        {hasTotal
          ? `${processed.toLocaleString('pt-BR')} de ${job.total!.toLocaleString('pt-BR')} processados`
          : 'Começando: o total ainda está sendo calculado.'}
      </p>
    </div>
  )
}

export function JobPollingError({ onRetry, timedOut = false }: { onRetry: () => void; timedOut?: boolean }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
      <div>
        <p className="font-medium text-amber-900">{timedOut ? 'O acompanhamento automático foi pausado após 30 minutos.' : 'Não foi possível atualizar o andamento.'}</p>
        <button type="button" onClick={onRetry} className="mt-1 font-medium text-amber-900 underline">
          Tentar consultar novamente
        </button>
      </div>
    </div>
  )
}
