import React from 'react'
import {
  Database,
  ArrowRight,
  Loader2,
  Plus,
  Play,
  ArrowUpRight
} from 'lucide-react'
import type { Pipeline } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { hasPermission } from '@/lib/permissions'

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
  const canWrite = hasPermission(role, 'pipelines:write', activeTenant)
  const canExecute = hasPermission(role, 'pipelines:execute', activeTenant)
  
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
                  <td className="px-6 py-4.5">
                    <div className="h-4 bg-border-primary rounded w-36"></div>
                  </td>
                  <td className="px-6 py-4.5">
                    <div className="flex items-center gap-2">
                      <div className="h-3.5 bg-border-primary rounded w-20"></div>
                      <div className="h-3 bg-border-secondary rounded w-4"></div>
                      <div className="h-3.5 bg-border-primary rounded w-20"></div>
                    </div>
                  </td>
                  <td className="px-6 py-4.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-border-primary"></div>
                      <div className="h-3 bg-border-primary rounded w-12"></div>
                    </div>
                  </td>
                  <td className="px-6 py-4.5">
                    <div className="h-3.5 bg-border-primary rounded w-16 font-mono"></div>
                  </td>
                  <td className="px-6 py-4.5">
                    <div className="h-3 bg-border-primary rounded w-24"></div>
                  </td>
                  <td className="px-6 py-4.5 text-right">
                    <div className="inline-block h-7 bg-border-primary rounded w-20 float-right"></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (pipelines.length === 0) {
    return (
      <div className="bg-panel border border-border-primary rounded-xl p-16 text-center max-w-5xl mx-auto space-y-5">
        <div className="flex justify-center">
          <div className="h-20 w-20 bg-panel-card border border-border-primary rounded-full flex items-center justify-center">
            <Database className="h-10 w-10 text-text-muted" />
          </div>
        </div>
        
        <div className="space-y-2 max-w-sm mx-auto">
          <h3 className="text-sm font-semibold text-text-primary">No Active Sync Pipelines</h3>
          <p className="text-xs text-text-muted leading-relaxed">
            Provision dynamic data synchronization tasks by connecting rest api sources and target databases.
          </p>
        </div>

        <button
          onClick={onCreateClick}
          disabled={!canWrite}
          className="inline-flex items-center gap-2 px-4 py-2 bg-text-primary text-background font-medium hover:opacity-90 text-xs rounded transition-all duration-150 cursor-pointer shadow-lg active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
          title={!canWrite ? 'You do not have permission to provision pipelines' : undefined}
        >
          <Plus className="h-3.5 w-3.5" />
          Provision Pipeline
        </button>
      </div>
    )
  }

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
          <tbody className="divide-y divide-border-primary text-sm">
            {pipelines.map((pipe) => {
              const isSyncing = pipe.status === 'syncing' || triggeringId === pipe.id

              return (
                <tr key={pipe.id} className="hover:bg-panel-card/30 transition-colors duration-100">
                  <td className="px-6 py-4">
                    <span className="font-medium text-text-primary">{pipe.name}</span>
                    <span className="block text-[10px] text-text-muted truncate max-w-[200px] mt-0.5" title={pipe.sourceUrl}>
                      {pipe.sourceUrl}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-text-secondary uppercase">{pipe.sourceAuthType === 'none' ? 'Public REST' : 'Auth REST'}</span>
                      <ArrowRight className="h-3 w-3 text-text-muted" />
                      <span className="text-text-primary flex items-center gap-1">
                        {pipe.targetDbDialect}
                        <ArrowUpRight className="h-2.5 w-2.5 text-text-muted" />
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        pipe.status === 'active' ? 'bg-emerald-500' :
                        pipe.status === 'syncing' ? 'bg-sky-500 animate-pulse' :
                        pipe.status === 'failed' ? 'bg-rose-500' : 'bg-text-muted'
                      }`} />
                      <span className="text-xs capitalize font-medium">
                        {isSyncing ? 'syncing' : pipe.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-text-secondary">
                    {pipe.recordsSynced.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-xs text-text-muted">
                    {pipe.lastSync || 'Never run'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
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
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
