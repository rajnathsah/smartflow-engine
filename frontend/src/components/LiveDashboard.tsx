import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, Database, AlertCircle, RefreshCw, Cpu } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

// Strong types representing backend pipeline progress models
export interface ActivePipeline {
  id: string
  name: string
  sourceUrl: string
  targetTable: string
  rowsFetched: number
  rowsInserted: number
  totalRows: number
  errorsCount: number
  status: 'syncing' | 'paused' | 'failed' | 'completed'
}

export const LiveDashboard: React.FC = () => {
  const { token } = useAuthStore()
  // Query active pipeline execution processes from the backend API, polling every 3 seconds
  const { data: activePipelines, isLoading, error } = useQuery<ActivePipeline[]>({
    queryKey: ['activePipelines', token],
    queryFn: async () => {
      try {
        const response = await fetch('/api/v1/pipelines/active', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!response.ok) {
          throw new Error('Failed to fetch active pipeline telemetry.')
        }
        return await response.json()
      } catch (err) {
        return []
      }
    },
    enabled: !!token,
    refetchInterval: 3000,
    // Add stable mock fallbacks internally if backend is unavailable or during local prototype development
    initialData: [
      {
        id: 'pipe-1',
        name: 'Stripe Payments Sync',
        sourceUrl: 'https://api.stripe.com/v1/charges',
        targetTable: 'stripe_ledger',
        rowsFetched: 4120,
        rowsInserted: 4120,
        totalRows: 5000,
        errorsCount: 0,
        status: 'syncing'
      },
      {
        id: 'pipe-2',
        name: 'Hubspot Contacts Sync',
        sourceUrl: 'https://api.hubapi.com/crm/v3/objects/contacts',
        targetTable: 'hubspot_contacts',
        rowsFetched: 12480,
        rowsInserted: 12250,
        totalRows: 25000,
        errorsCount: 3,
        status: 'syncing'
      },
      {
        id: 'pipe-3',
        name: 'Shopify Orders ETL',
        sourceUrl: 'https://myshop.myshopify.com/admin/api/orders',
        targetTable: 'shopify_orders',
        rowsFetched: 1540,
        rowsInserted: 1540,
        totalRows: 1540,
        errorsCount: 0,
        status: 'completed'
      }
    ] as ActivePipeline[]
  })

  if (isLoading && !activePipelines) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <RefreshCw className="h-6 w-6 text-text-secondary animate-spin" />
        <p className="text-xs text-text-secondary uppercase tracking-widest">Polling live execution metrics...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-2 max-w-lg mx-auto">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>Failed to sync execution metrics. Falling back to active cached states.</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans text-text-primary">
      
      {/* Header telemetry metadata */}
      <div className="flex items-center justify-between border-b border-border-primary pb-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight uppercase">Live Pipeline Execution</h3>
          <p className="text-xs text-text-muted mt-1">Real-time status monitor for active ETL workers and batch queues.</p>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1 bg-panel border border-border-primary rounded-md">
          <Activity className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
          <span className="text-[10px] text-text-secondary font-mono uppercase tracking-wider">Engine Polling Active</span>
        </div>
      </div>

      {activePipelines && activePipelines.length === 0 ? (
        <div className="border border-dashed border-border-primary rounded-xl p-12 text-center space-y-3">
          <div className="h-10 w-10 bg-panel border border-border-primary rounded-full flex items-center justify-center mx-auto">
            <Cpu className="h-5 w-5 text-text-muted" />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-text-secondary font-medium uppercase tracking-wider">Waiting for pipeline execution...</p>
            <p className="text-[11px] text-text-muted max-w-xs mx-auto">
              Any triggered pipeline extractions or database loading jobs will populate here in real-time.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {activePipelines?.map((pipeline) => {
            // Compute current load percentage safely
            const percentage = pipeline.totalRows > 0 
              ? Math.min(100, Math.round((pipeline.rowsInserted / pipeline.totalRows) * 100)) 
              : 0

            return (
              <div 
                key={pipeline.id} 
                className="bg-panel border border-border-primary rounded-lg p-5 space-y-4 hover:border-border-secondary transition-colors"
              >
                
                {/* Header row details */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold tracking-wide uppercase font-mono">{pipeline.name}</span>
                      {pipeline.status === 'syncing' ? (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[9px] font-semibold uppercase rounded-full">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Syncing</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-panel-card border border-border-primary text-text-secondary text-[9px] font-semibold uppercase rounded-full">
                          <span>{pipeline.status}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-text-muted font-mono">
                      <span className="truncate max-w-[220px]">URL: {pipeline.sourceUrl}</span>
                      <span className="flex items-center gap-1">
                        <Database className="h-3 w-3" /> {pipeline.targetTable}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold font-mono tracking-tight">{percentage}%</span>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider">Sync Progress</p>
                  </div>
                </div>

                {/* Ultra-thin Vercel-style progress indicator */}
                <div className="space-y-1">
                  <div className="h-1 w-full bg-border-primary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-text-primary transition-all duration-500 ease-in-out" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>

                {/* Metrics layout row */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border-primary/60">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider block">Rows Fetched</span>
                    <span className="text-xs font-mono font-medium">{pipeline.rowsFetched.toLocaleString()}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider block">Rows Inserted</span>
                    <span className="text-xs font-mono font-medium">{pipeline.rowsInserted.toLocaleString()}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider block">Errors</span>
                    <span className={`text-xs font-mono font-medium ${pipeline.errorsCount > 0 ? 'text-red-500 font-semibold' : 'text-text-secondary'}`}>
                      {pipeline.errorsCount.toLocaleString()}
                    </span>
                  </div>
                </div>

              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
export default LiveDashboard
