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
    <div className="py-6 font-sans">
      <div className="px-8">
        <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">System Status Overview</h2>
        <p className="text-sm text-gray-500 dark:text-text-muted">Dynamic connection latency metrics and pipeline extraction health.</p>
      </div>

      {/* Grid for Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 px-8">
        {[
          { label: 'Active Pipelines', value: `${activeCount} / ${totalCount}`, desc: 'Active synchronized databases' },
          { label: 'Total Rows Synced', value: totalVolume, desc: 'Aggregated rows transferred' },
          { label: 'Average Sync Latency', value: latency, desc: 'API query dynamic execution response' },
        ].map((card, idx) => (
          <div key={idx} className="bg-white dark:bg-[#0F0F0F] p-6 rounded-lg border border-gray-200 dark:border-white/10 shadow-sm space-y-2.5">
            <span className="text-xs text-gray-400 dark:text-text-muted font-semibold uppercase tracking-wider">{card.label}</span>
            <div className="text-3xl font-light text-gray-900 dark:text-white tracking-tight">{card.value}</div>
            <p className="text-xs text-gray-500 dark:text-text-muted">{card.desc}</p>
          </div>
        ))}
      </div>

      {/* Activity Log Section */}
      <div className="mt-8 mx-8 bg-white dark:bg-[#0F0F0F] rounded-lg border border-gray-200 dark:border-white/10 min-h-[300px] p-6 flex flex-col">
        <div className="pb-4 border-b border-gray-100 dark:border-white/10 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">Engine Activity Log</h3>
          <span className="text-xs text-gray-400 dark:text-text-muted">Dynamically Updated</span>
        </div>
        
        {logs.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-xs text-gray-400 dark:text-text-muted italic py-12">
            No recent engine sync activity logged. Trigger a pipeline sync to start tracking operations.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-[#1C1C1E] flex-1 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="py-4.5 flex items-center justify-between text-sm hover:bg-gray-50/50 dark:hover:bg-panel-card/20 transition-colors">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs text-gray-400 dark:text-text-muted shrink-0">{log.time}</span>
                  <div>
                    <div className="font-medium text-gray-800 dark:text-text-secondary text-xs">{log.event}</div>
                    <div className="text-xs text-gray-400 dark:text-text-muted mt-0.5">{log.detail}</div>
                  </div>
                </div>
                <div>
                  {log.status === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {log.status === 'failed' && <AlertCircle className="h-4 w-4 text-rose-500" />}
                  {log.status === 'info' && <Sliders className="h-4 w-4 text-gray-400 dark:text-text-muted" />}
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
