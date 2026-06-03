import React from 'react'
import { Plus, Globe } from 'lucide-react'
import type { Source } from '@/types'

interface SourcesPanelProps {
  sources: Source[]
  onCreateClick: () => void
  canWrite: boolean
}

const SourcesPanel: React.FC<SourcesPanelProps> = ({
  sources,
  onCreateClick,
  canWrite
}) => {
  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-text-primary">Data Sources</h2>
          <p className="text-sm text-text-muted">Register and configure HTTP API sources to extract data from.</p>
        </div>
        <button
          onClick={onCreateClick}
          disabled={!canWrite}
          className="flex items-center gap-2 px-3.5 py-2 bg-text-primary text-background font-medium hover:opacity-90 text-xs rounded-lg transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          title={!canWrite ? 'You do not have permission to create sources' : undefined}
          aria-label="Create Source"
        >
          <Plus className="h-4 w-4 font-bold" />
          Create Source
        </button>
      </div>

      {sources.length === 0 ? (
        <div className="bg-panel border border-border-primary rounded-xl p-16 text-center max-w-5xl mx-auto space-y-5">
          <div className="flex justify-center">
            <div className="h-20 w-20 bg-panel-card border border-border-primary rounded-full flex items-center justify-center">
              <Globe className="h-10 w-10 text-text-muted" />
            </div>
          </div>
          <div className="space-y-2 max-w-sm mx-auto">
            <h3 className="text-sm font-semibold text-text-primary">No Active Data Sources</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Register REST API data sources to make them available for pipeline connections.
            </p>
          </div>
          <button
            onClick={onCreateClick}
            disabled={!canWrite}
            className="inline-flex items-center gap-2 px-4 py-2 bg-text-primary text-background font-medium hover:opacity-90 text-xs rounded transition-all duration-150 cursor-pointer shadow-lg disabled:opacity-30 disabled:cursor-not-allowed"
            title={!canWrite ? 'You do not have permission to create sources' : undefined}
            aria-label="Create New Source"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Source
          </button>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary text-sm">
                {sources.map((src) => (
                  <tr key={src.id} className="hover:bg-panel-card/30 transition-colors duration-100">
                    <td className="px-6 py-4 font-medium text-text-primary">{src.name}</td>
                    <td className="px-6 py-4 font-mono text-xs text-text-secondary">{src.sourceUrl}</td>
                    <td className="px-6 py-4 capitalize text-xs text-text-muted">{src.sourceAuthType}</td>
                    <td className="px-6 py-4 text-xs text-text-muted">{src.sourceHeaders?.length || 0} headers</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default SourcesPanel
