import React from 'react'
import { CheckCircle2, AlertCircle, Sliders } from 'lucide-react'
import type { ActivityLog } from '@/types'

interface OverviewPanelProps {
  activeCount: number
  totalCount: number
  totalVolume: string
  latency: string
  logs: ReadonlyArray<ActivityLog>
}

const OverviewPanel: React.FC<OverviewPanelProps> = ({
  activeCount,
  totalCount,
  totalVolume,
  latency,
  logs
}) => {
  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-text-primary">System Status Overview</h2>
        <p className="text-sm text-text-muted">Dynamic connection latency metrics and pipeline extraction health.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Active Pipelines', value: `${activeCount} / ${totalCount}`, desc: 'Active synchronized databases' },
          { label: 'Total Rows Synced', value: totalVolume, desc: 'Aggregated rows transferred' },
          { label: 'Average Sync Latency', value: latency, desc: 'API query dynamic execution response' },
        ].map((card, idx) => (
          <div key={idx} className="bg-panel border border-border-primary p-6 rounded-xl space-y-2.5">
            <span className="text-xs text-text-muted font-medium uppercase tracking-wider">{card.label}</span>
            <div className="text-3xl font-light text-text-primary tracking-tight">{card.value}</div>
            <p className="text-xs text-text-muted">{card.desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-panel border border-border-primary rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border-primary flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Engine Activity Log</h3>
          <span className="text-xs text-text-muted">Dynamically Updated</span>
        </div>
        
        {logs.length === 0 ? (
          <div className="p-12 text-center text-xs text-text-muted">
            No recent engine sync activity logged. Trigger a pipeline sync to start tracking operations.
          </div>
        ) : (
          <div className="divide-y divide-border-primary">
            {logs.map((log) => (
              <div key={log.id} className="px-6 py-4.5 flex items-center justify-between text-sm hover:bg-panel-card/20 transition-colors">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs text-text-muted shrink-0">{log.time}</span>
                  <div>
                    <div className="font-medium text-text-secondary text-xs">{log.event}</div>
                    <div className="text-xs text-text-muted mt-0.5">{log.detail}</div>
                  </div>
                </div>
                <div>
                  {log.status === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {log.status === 'failed' && <AlertCircle className="h-4 w-4 text-rose-500" />}
                  {log.status === 'info' && <Sliders className="h-4 w-4 text-text-muted" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default OverviewPanel
