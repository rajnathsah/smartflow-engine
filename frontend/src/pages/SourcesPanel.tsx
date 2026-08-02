import React, { useState } from 'react'
import { Plus, Globe, Loader2, Pencil, Plug, ShieldAlert, CheckCircle2 } from 'lucide-react'
import type { Source } from '@/types'
import { notify } from '@/lib/notify'
import apiClient from '@/api/client'

interface SourcesPanelProps {
  sources: Source[]
  onCreateClick: () => void
  onEditClick: (source: Source) => void
  canWrite: boolean
}

const SourcesPanel: React.FC<SourcesPanelProps> = ({
  sources,
  onCreateClick,
  onEditClick,
  canWrite
}) => {
  const [testingIds, setTestingIds] = useState<Record<string, boolean>>({})
  const [statuses, setStatuses] = useState<Record<string, { status: 'success' | 'failed'; message: string }>>({})

  const handleTest = async (id: string, name: string) => {
    setTestingIds(prev => ({ ...prev, [id]: true }))
    try {
      const res = await apiClient.post(`/api/v1/pipelines/connections/${id}/test`)
      if (res.data.status === 'success') {
        setStatuses(prev => ({ ...prev, [id]: { status: 'success', message: 'Connected successfully' } }))
        notify.success(
          'Connection Verified!',
          `Successfully connected to REST API host for '${name}'.`
        )
      } else {
        const errorMsg = res.data.message || 'REST API host unreachable.'
        setStatuses(prev => ({ ...prev, [id]: { status: 'failed', message: errorMsg } }))
        notify.error('Connection Failed', errorMsg)
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Unreachable API host.'
      setStatuses(prev => ({ ...prev, [id]: { status: 'failed', message: errorMsg } }))
      notify.error('Connection Verification Failed', errorMsg)
    } finally {
      setTestingIds(prev => ({ ...prev, [id]: false }))
    }
  }

  return (
    <div className="space-y-8 w-full">
      <div className="flex items-center justify-between w-full mb-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-text-primary">Data Sources</h2>
          <p className="text-sm text-text-muted">Register and configure HTTP API sources to extract data from.</p>
        </div>
        {canWrite && (
          <button
            onClick={onCreateClick}
            className="flex items-center gap-2 px-3.5 py-2 bg-text-primary text-background font-medium hover:opacity-90 text-xs rounded-lg transition-all cursor-pointer"
            aria-label="Create Source"
          >
            <Plus className="h-4 w-4 font-bold" />
            Create Source
          </button>
        )}
      </div>

      {sources.length === 0 ? (
        <div className="bg-white dark:bg-[#0F0F0F] border border-gray-200 dark:border-white/10 rounded-xl p-16 text-center w-full space-y-5">
          <div className="flex justify-center">
            <div className="h-20 w-20 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 rounded-full flex items-center justify-center">
              <Globe className="h-10 w-10 text-gray-400 dark:text-gray-500" />
            </div>
          </div>
          <div className="space-y-2 max-w-sm mx-auto">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">No Active Data Sources</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Register REST API data sources to make them available for pipeline connections.
            </p>
          </div>
          {canWrite && (
            <button
              onClick={onCreateClick}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-black font-semibold hover:bg-black dark:hover:bg-gray-100 text-xs rounded transition-all duration-150 cursor-pointer shadow-lg"
              aria-label="Create New Source"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Source
            </button>
          )}
        </div>
      ) : (
        <div className="bg-panel border border-border-primary rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-primary bg-panel-card/30 text-xs text-text-muted uppercase tracking-wider font-semibold">
                  <th className="px-6 py-4">Source Name</th>
                  <th className="px-6 py-4">Endpoint URL</th>
                  <th className="px-6 py-4">Auth Strategy</th>
                  <th className="px-6 py-4">Headers</th>
                  <th className="px-6 py-4">Verification Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary text-sm">
                {sources.map((src) => {
                  const statusInfo = statuses[src.id]
                  const isTesting = testingIds[src.id]
                  const isFailed = statusInfo?.status === 'failed'
                  const isSuccess = statusInfo?.status === 'success'

                  return (
                    <tr
                      key={src.id}
                      className={`transition-colors duration-100 ${
                        isFailed ? 'bg-rose-950/5 hover:bg-rose-950/10' : 'hover:bg-panel-card/30'
                      }`}
                    >
                      <td className="px-6 py-4 font-medium text-text-primary">
                        <div className="flex items-center gap-2">
                          <span>{src.name}</span>
                          {isFailed && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase tracking-wider">
                              <ShieldAlert className="h-3 w-3" /> Failed
                            </span>
                          )}
                          {isSuccess && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                              <CheckCircle2 className="h-3 w-3" /> Connected
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-text-secondary truncate max-w-[200px]" title={src.sourceUrl}>
                        {src.sourceUrl}
                      </td>
                      <td className="px-6 py-4 capitalize text-xs text-text-muted">{src.sourceAuthType}</td>
                      <td className="px-6 py-4 text-xs text-text-muted">{src.sourceHeaders?.length || 0} headers</td>
                      <td className="px-6 py-4 text-xs text-text-muted truncate max-w-[200px]" title={statusInfo?.message}>
                        {isTesting ? (
                          <span className="flex items-center gap-1.5 text-gray-400">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Testing...
                          </span>
                        ) : statusInfo ? (
                          <span className={isFailed ? 'text-rose-400' : 'text-emerald-400 font-medium'}>
                            {statusInfo.message}
                          </span>
                        ) : (
                          <span className="text-text-muted italic">Unverified</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          {/* Test connection action */}
                          <button
                            onClick={() => handleTest(src.id, src.name)}
                            disabled={isTesting}
                            className="p-2 border border-border-primary hover:border-border-secondary bg-panel hover:bg-text-primary/5 text-text-secondary hover:text-text-primary rounded-lg transition-all cursor-pointer disabled:opacity-50"
                            title="Test Connection"
                          >
                            {isTesting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Plug className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {/* Edit action */}
                          <button
                            onClick={() => onEditClick(src)}
                            disabled={!canWrite}
                            className="p-2 border border-border-primary hover:border-border-secondary bg-panel hover:bg-text-primary/5 text-text-secondary hover:text-text-primary rounded-lg transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Edit Connection"
                          >
                            <Pencil className="h-3.5 w-3.5" />
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
      )}
    </div>
  )
}

export default SourcesPanel
