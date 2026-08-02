import React, { useState } from 'react'
import {
  Database,
  ArrowRight,
  Loader2,
  Plus,
  Play,
  ArrowUpRight,
  Terminal
} from 'lucide-react'
import type { Pipeline } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { hasPermission } from '@/lib/permissions'
import { LogConsoleViewer } from '@/components/LogConsoleViewer'

interface PipelinesTableProps {
  pipelines: Pipeline[]
  isLoading: boolean
  onTriggerSync: (id: string) => void
  triggeringId: string | null
  onCreateClick: () => void
}

export const PipelinesTable: React.FC<PipelinesTableProps> = ({
  pipelines,
  isLoading,
  onTriggerSync,
  triggeringId,
  onCreateClick
}) => {
  const { role, activeTenant } = useAuthStore()
  const canWrite   = hasPermission(role, 'pipelines:write', activeTenant)
  const canExecute = hasPermission(role, 'pipelines:execute', activeTenant)

  // ── Log viewer state ──────────────────────────────────────────────────────
  const [logViewer, setLogViewer] = useState<{
    open: boolean
    pipelineId: string
    pipelineName: string
    runId: string | null
    status: Pipeline['status']
  }>({
    open: false,
    pipelineId: '',
    pipelineName: '',
    runId: null,
    status: 'idle'
  })

  const openLogs = (pipe: Pipeline) => {
    setLogViewer({
      open: true,
      pipelineId: pipe.id,
      pipelineName: pipe.name,
      runId: pipe.taskId ?? null,
      status: pipe.status
    })
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="bg-panel border border-border-primary rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-primary bg-panel-card/30 text-xs text-text-muted uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Pipeline</th>
                <th className="px-6 py-4">Source / Destination</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Records Transferred</th>
                <th className="px-6 py-4">Last Sync</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary">
              {[1, 2, 3, 4].map((i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-4.5"><div className="h-4 bg-border-primary rounded w-36" /></td>
                  <td className="px-6 py-4.5">
                    <div className="flex items-center gap-2">
                      <div className="h-3.5 bg-border-primary rounded w-20" />
                      <div className="h-3 bg-border-secondary rounded w-4" />
                      <div className="h-3.5 bg-border-primary rounded w-20" />
                    </div>
                  </td>
                  <td className="px-6 py-4.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-border-primary" />
                      <div className="h-3 bg-border-primary rounded w-12" />
                    </div>
                  </td>
                  <td className="px-6 py-4.5"><div className="h-3.5 bg-border-primary rounded w-16 font-mono" /></td>
                  <td className="px-6 py-4.5"><div className="h-3 bg-border-primary rounded w-24" /></td>
                  <td className="px-6 py-4.5 text-right"><div className="inline-block h-7 bg-border-primary rounded w-20 float-right" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (pipelines.length === 0) {
    return (
      <div className="bg-white dark:bg-[#0F0F0F] border border-gray-200 dark:border-white/10 rounded-xl p-16 text-center w-full space-y-5">
        <div className="flex justify-center">
          <div className="h-20 w-20 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 rounded-full flex items-center justify-center">
            <Database className="h-10 w-10 text-gray-400 dark:text-gray-500" />
          </div>
        </div>
        <div className="space-y-2 max-w-sm mx-auto">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">No Active Sync Pipelines</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Provision dynamic data synchronization tasks by connecting rest api sources and target databases.
          </p>
        </div>
        {canWrite && (
          <button
            onClick={onCreateClick}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-black font-semibold hover:bg-black dark:hover:bg-gray-100 text-xs rounded transition-all duration-150 cursor-pointer shadow-lg active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" />
            Provision Pipeline
          </button>
        )}
      </div>
    )
  }

  // ── Table ──────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="bg-panel border border-border-primary rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-primary bg-panel-card/30 text-xs text-text-muted uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Pipeline</th>
                <th className="px-6 py-4">Source / Destination</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Records Transferred</th>
                <th className="px-6 py-4">Last Sync</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary text-sm">
              {pipelines.map((pipe) => {
                const isSyncing   = pipe.status === 'syncing' || triggeringId === pipe.id
                const isFailed    = pipe.status === 'failed'
                const hasLogs     = !!pipe.taskId


                return (
                  <tr key={pipe.id} className="hover:bg-panel-card/30 transition-colors duration-100">
                    {/* Pipeline name */}
                    <td className="px-6 py-4">
                      <span className="font-medium text-text-primary">{pipe.name}</span>
                      <span
                        className="block text-[10px] text-text-muted truncate max-w-[200px] mt-0.5"
                        title={pipe.sourceUrl}
                      >
                        {pipe.sourceUrl}
                      </span>
                    </td>

                    {/* Source → Dest */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="text-text-secondary uppercase">
                          {pipe.sourceAuthType === 'none' ? 'Public REST' : 'Auth REST'}
                        </span>
                        <ArrowRight className="h-3 w-3 text-text-muted" />
                        <span className="text-text-primary flex items-center gap-1">
                          {pipe.targetDbDialect}
                          <ArrowUpRight className="h-2.5 w-2.5 text-text-muted" />
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col justify-center">
                        <div className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            pipe.status === 'active'   ? 'bg-emerald-500' :
                            pipe.status === 'syncing'  ? 'bg-sky-500 animate-pulse' :
                            pipe.status === 'failed'   ? 'bg-rose-500' :
                            'bg-text-muted'
                          }`} />
                          <span className="text-xs capitalize font-medium text-text-primary">
                            {isSyncing ? 'syncing' : pipe.status}
                          </span>
                        </div>
                        {pipe.status === 'failed' && pipe.error && (
                          <span className="block text-[10px] text-rose-400 font-mono mt-1 max-w-[200px] truncate" title={pipe.error}>
                            {pipe.error}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Records */}
                    <td className="px-6 py-4 font-mono text-xs text-text-secondary">
                      {pipe.recordsSynced.toLocaleString()}
                    </td>

                    {/* Last sync */}
                    <td className="px-6 py-4 text-xs text-text-muted">
                      {pipe.lastSync || 'Never run'}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">

                        {/* View Logs button */}
                        <button
                          id={`view-logs-${pipe.id}`}
                          onClick={() => openLogs(pipe)}
                          disabled={!hasLogs}
                          title={!hasLogs ? 'No run logs available yet' : isFailed ? 'View failure logs' : 'View run logs'}
                          className={`
                            px-2.5 py-1.5 text-xs border rounded inline-flex items-center gap-1.5 cursor-pointer
                            transition-all font-medium disabled:opacity-30 disabled:cursor-not-allowed
                            ${isFailed
                              ? 'border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/60'
                              : isSyncing
                              ? 'border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/60 animate-pulse'
                              : 'border-border-primary hover:border-border-secondary bg-panel hover:bg-text-primary/5 text-text-secondary hover:text-text-primary'
                            }
                          `}
                        >
                          <Terminal className={`h-3 w-3 ${isFailed ? 'text-rose-400' : isSyncing ? 'text-amber-400' : 'text-text-muted'}`} />
                          <span>{isFailed ? 'Err Logs' : isSyncing ? 'Live Logs' : 'Logs'}</span>
                          {(isFailed || isSyncing) && (
                            <span className={`h-1.5 w-1.5 rounded-full ${isFailed ? 'bg-rose-400' : 'bg-amber-400 animate-pulse'}`} />
                          )}
                        </button>

                        {/* Sync Now button */}
                        <button
                          id={`sync-${pipe.id}`}
                          onClick={() => onTriggerSync(pipe.id)}
                          disabled={isSyncing || !canExecute}
                          className="px-2.5 py-1.5 text-xs border border-border-primary hover:border-border-secondary rounded bg-panel hover:bg-text-primary/5 text-text-secondary hover:text-text-primary transition-all font-medium disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-1.5 cursor-pointer"
                          title={!canExecute ? 'You do not have permission to execute syncs' : undefined}
                        >
                          {isSyncing ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin text-text-secondary" />
                              <span>Syncing</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-2.5 w-2.5 fill-current text-text-muted" />
                              <span>Sync Now</span>
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Console Viewer */}
      <LogConsoleViewer
        isOpen={logViewer.open}
        onClose={() => setLogViewer(prev => ({ ...prev, open: false }))}
        pipelineId={logViewer.pipelineId}
        pipelineName={logViewer.pipelineName}
        runId={logViewer.runId}
        pipelineStatus={logViewer.status}
      />
    </>
  )
}
