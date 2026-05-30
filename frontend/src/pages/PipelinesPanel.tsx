import React from 'react'
import { Plus } from 'lucide-react'
import { PipelinesTable } from '@/components/PipelinesTable'
import type { Pipeline } from '@/types'

interface PipelinesPanelProps {
  pipelines: Pipeline[]
  isLoading: boolean
  onTriggerSync: (id: string) => void
  triggeringId: string | null
  onCreateClick: () => void
  canWrite: boolean
}

const PipelinesPanel: React.FC<PipelinesPanelProps> = ({
  pipelines,
  isLoading,
  onTriggerSync,
  triggeringId,
  onCreateClick,
  canWrite
}) => {
  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-text-primary">Data Sync Pipelines</h2>
          <p className="text-sm text-text-muted">Control extraction execution, verify dials, and provision rules.</p>
        </div>
        <button
          onClick={onCreateClick}
          disabled={!canWrite}
          className="flex items-center gap-2 px-3.5 py-2 bg-text-primary text-background font-medium hover:opacity-90 text-xs rounded-lg transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          title={!canWrite ? 'You do not have permission to create pipelines' : undefined}
          aria-label="Create Pipeline"
        >
          <Plus className="h-4 w-4 font-bold" />
          Create Pipeline
        </button>
      </div>

      <PipelinesTable
        pipelines={pipelines}
        isLoading={isLoading}
        onTriggerSync={onTriggerSync}
        triggeringId={triggeringId}
        onCreateClick={onCreateClick}
      />
    </div>
  )
}

export default PipelinesPanel
