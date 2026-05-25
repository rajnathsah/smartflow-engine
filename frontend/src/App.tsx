import React, { useState, useEffect } from 'react'
import axios from 'axios'
import {
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
  useNavigate
} from 'react-router-dom'
import {
  Database,
  Activity,
  LogOut,
  Plus,
  CheckCircle2,
  AlertCircle,
  Sliders,
  ShieldCheck,
  Users,
  Shield,
  Cpu,
  Menu,
  ChevronLeft,
  Globe,
  Network
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { usePipelineStore } from '@/store/pipelineStore'
import type { Pipeline, ActivityLog, Source, Destination } from '@/types'
import { PipelinesTable } from '@/components/PipelinesTable'
import { CreatePipelineForm } from '@/components/CreatePipelineForm'
import { CreateSourceForm } from '@/components/CreateSourceForm'
import { CreateDestinationForm } from '@/components/CreateDestinationForm'
import { UsersTable } from '@/components/UsersTable'
import { RoleBuilder } from '@/components/RoleBuilder'
import { Login } from '@/components/Login'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { LiveDashboard } from '@/components/LiveDashboard'
import { Toaster } from 'sonner'

const DashboardLayout = () => {
  const { activeTenant, logout, token } = useAuthStore()
  const {
    pipelines,
    sources,
    destinations,
    addPipeline,
    addSource,
    addDestination,
    updatePipeline,
    getPipelineById,
    setActiveTenant
  } = usePipelineStore()
  const location = useLocation()
  const navigate = useNavigate()

  const [logs, setLogs] = useState<ActivityLog[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [triggeringId, setTriggeringId] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isSourceDrawerOpen, setIsSourceDrawerOpen] = useState(false)
  const [isDestinationDrawerOpen, setIsDestinationDrawerOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // Simulate loader state on mount to show off skeleton layout
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 1200)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    setActiveTenant(activeTenant)
  }, [activeTenant, setActiveTenant])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Trigger pipeline sync via backend API
  const handleTriggerSync = async (id: string) => {
    const pipeline = getPipelineById(id)
    if (!pipeline) {
      return
    }

    setTriggeringId(id)
    updatePipeline(id, { status: 'syncing' })
    
    const startTime = new Date().toLocaleTimeString('en-US', { hour12: false })
    const startLogId = String(Date.now())
    
    setLogs(prev => [
      {
        id: startLogId,
        time: startTime,
        event: `Manual execution trigger: ${pipeline?.name}`,
        status: 'info',
        detail: 'Dispatched Celery worker job extraction queue...'
      },
      ...prev
    ])

    try {
      const schemaMapping = pipeline.schemaMapping ?? []
      const syncPayload = {
        name: pipeline.name,
        sourceUrl: pipeline.sourceUrl,
        sourceAuthType: pipeline.sourceAuthType,
        sourceToken: pipeline.sourceToken || '',
        sourceHeaders: pipeline.sourceHeaders,
        schema_mapping: schemaMapping.length > 0 ? schemaMapping : {},
        targetDbDialect: pipeline.targetDbDialect,
        targetDbHost: pipeline.targetDbHost,
        targetDbPort: pipeline.targetDbPort,
        targetDbName: pipeline.targetDbName,
        targetDbUser: pipeline.targetDbUser,
        targetDbPassword: pipeline.targetDbPassword || '',
        enableSshBastion: pipeline.enableSshBastion,
      }

      console.log(`Sync Now clicked for pipeline ${id}`)
      console.log('Sync payload:', syncPayload)

      const response = await axios.post(
        `/api/v1/pipelines/${id}/sync`,
        syncPayload,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const taskId = response.data?.task_id

      updatePipeline(id, {
        status: 'syncing',
        taskId: taskId || undefined
      })

      const endTime = new Date().toLocaleTimeString('en-US', { hour12: false })
      setLogs(prev => [
        {
          id: String(Date.now()),
          time: endTime,
          event: `Sync dispatched: ${pipeline.name}`,
          status: 'success',
          detail: taskId
            ? `Backend accepted sync request. Task ID: ${taskId}`
            : 'Backend accepted sync request.'
        },
        ...prev
      ])
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.detail || error.message
        : 'Unknown sync request failure.'

      updatePipeline(id, { status: 'failed', taskId: undefined })

      const endTime = new Date().toLocaleTimeString('en-US', { hour12: false })
      setLogs(prev => [
        {
          id: String(Date.now()),
          time: endTime,
          event: `Sync failed: ${pipeline.name}`,
          status: 'failed',
          detail: String(message)
        },
        ...prev
      ])
    } finally {
      setTriggeringId(null)
    }
  }

  // Polling for active sync tasks
  useEffect(() => {
    const activeSyncPipelines = pipelines.filter(p => p.status === 'syncing' && p.taskId)
    if (activeSyncPipelines.length === 0) return

    const pollInterval = setInterval(async () => {
      for (const pipeline of activeSyncPipelines) {
        if (!pipeline.taskId) continue
        try {
          const response = await axios.get(
            `/api/v1/pipelines/tasks/${pipeline.taskId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          const { status, result, error } = response.data
          
          if (status === 'SUCCESS') {
            const recordsSynced = Number(result?.records_synced ?? 0)
            updatePipeline(pipeline.id, {
              status: 'active',
              recordsSynced: recordsSynced,
              lastSync: 'Just now',
              taskId: undefined
            })
            const endTime = new Date().toLocaleTimeString('en-US', { hour12: false })
            setLogs(prev => [
              {
                id: String(Date.now()),
                time: endTime,
                event: `Sync completed: ${pipeline.name}`,
                status: 'success',
                detail: `Successfully processed and inserted ${recordsSynced.toLocaleString()} records.`
              },
              ...prev
            ])
          } else if (status === 'FAILURE' || status === 'REVOKED') {
            updatePipeline(pipeline.id, {
              status: 'failed',
              taskId: undefined
            })
            const endTime = new Date().toLocaleTimeString('en-US', { hour12: false })
            setLogs(prev => [
              {
                id: String(Date.now()),
                time: endTime,
                event: `Sync failed: ${pipeline.name}`,
                status: 'failed',
                detail: error || `Celery task execution ended with status: ${status}`
              },
              ...prev
            ])
          }
        } catch (err) {
          console.error(`Error polling task status for pipeline ${pipeline.id}:`, err)
        }
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [pipelines, updatePipeline, setLogs])

  const handleAddPipeline = (data: Omit<Pipeline, 'id' | 'status' | 'lastSync' | 'recordsSynced' | 'schemaMapping'>) => {
    const newPipeline: Pipeline = {
      ...data,
      id: String(Date.now()),
      status: 'active',
      lastSync: 'Never run',
      recordsSynced: 0,
      schemaMapping: []
    }

    setIsLoading(true)
    
    setTimeout(() => {
      addPipeline(newPipeline)
      
      const currentTime = new Date().toLocaleTimeString('en-US', { hour12: false })
      setLogs(prev => [
        {
          id: String(Date.now()),
          time: currentTime,
          event: `Pipeline Provisioned: ${newPipeline.name}`,
          status: 'success',
          detail: `Mapped API endpoint to target: ${newPipeline.targetDbName} (${newPipeline.targetDbDialect})`
        },
        ...prev
      ])
      
      setIsLoading(false)
    }, 800)
  }

  const handleCreateSource = (data: Omit<Source, 'id'>) => {
    const newSource: Source = {
      ...data,
      id: String(Date.now())
    }
    addSource(newSource)
  }

  const handleCreateDestination = (data: Omit<Destination, 'id'>) => {
    const newDestination: Destination = {
      ...data,
      id: String(Date.now())
    }
    addDestination(newDestination)
  }

  // Dynamically calculate metrics from current Pipelines State
  const activePipelines = pipelines.filter(p => p.status === 'active' || p.status === 'syncing').length
  const totalRecords = pipelines.reduce((sum, p) => sum + p.recordsSynced, 0)
  const averageLatency = pipelines.length > 0 ? 120 + pipelines.length * 8 : 0

  const navItems = [
    { path: '/dashboard', label: 'Overview', icon: Activity },
    { path: '/sources', label: 'Sources', icon: Globe },
    { path: '/destinations', label: 'Destinations', icon: Database },
    { path: '/pipelines', label: 'Connections', icon: Network },
    { path: '/live', label: 'Live Sync', icon: Cpu },
  ]

  const rbacItems = [
    { path: '/users', label: 'Users', icon: Users },
    { path: '/roles', label: 'Roles', icon: Shield },
  ]

  return (
    <div className="flex h-screen bg-background text-text-primary font-sans overflow-hidden">
      <aside className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} transition-all duration-300 border-r border-border-primary bg-panel flex flex-col justify-between shrink-0`}>
        <div>
          <div className="h-16 flex items-center justify-between px-4 border-b border-border-primary">
            <div className="flex items-center gap-3 overflow-hidden">
              <svg viewBox="0 0 100 100" className="h-8 w-8 shrink-0">
                <rect width="100" height="100" rx="24" fill="#000000" />
                <path d="M 32 35 L 68 35 L 68 50 L 32 50 L 32 65 L 68 65" 
                      fill="none" 
                      stroke="#ffffff" 
                      strokeWidth="10" 
                      strokeLinecap="square" 
                      strokeLinejoin="miter" />
                <rect x="62" y="44" width="12" height="12" fill="#ffffff" />
              </svg>
              {!isSidebarCollapsed && (
                <span className="font-semibold text-sm tracking-wider uppercase truncate">synq.to</span>
              )}
            </div>
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 rounded hover:bg-text-primary/5 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              {isSidebarCollapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          <div className="p-4 border-b border-border-primary">
            {isSidebarCollapsed ? (
              <div className="flex justify-center">
                <ShieldCheck className="h-4.5 w-4.5 text-emerald-500" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs text-text-muted mb-2 px-2">
                  <span>ACTIVE TENANT</span>
                  <ShieldCheck className="h-3.5 w-3.5 text-text-secondary" />
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-panel-card border border-border-primary rounded text-sm font-medium">
                  <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                  <span className="truncate">{activeTenant || 'acme_prod_tenant'}</span>
                </div>
              </>
            )}
          </div>

          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center rounded text-sm transition-all duration-150 ${
                    isSidebarCollapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2'
                  } ${
                    isActive
                      ? 'bg-text-primary/10 text-text-primary font-medium border border-border-primary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-text-primary/5 border border-transparent'
                  }`}
                  title={isSidebarCollapsed ? item.label : undefined}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  {!isSidebarCollapsed && <span>{item.label}</span>}
                </Link>
              )
            })}

            {!isSidebarCollapsed ? (
              <div className="pt-4 pb-1.5 px-3">
                <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Access Control</span>
              </div>
            ) : (
              <div className="border-t border-border-primary my-2" />
            )}
            {rbacItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center rounded text-sm transition-all duration-150 ${
                    isSidebarCollapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2'
                  } ${
                    isActive
                      ? 'bg-text-primary/10 text-text-primary font-medium border border-border-primary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-text-primary/5 border border-transparent'
                  }`}
                  title={isSidebarCollapsed ? item.label : undefined}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  {!isSidebarCollapsed && <span>{item.label}</span>}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="p-3 border-t border-border-primary bg-panel-card/30">
          {isSidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-panel flex items-center justify-center text-[10px] font-bold border border-border-primary">
                A
              </div>
              <button
                onClick={handleLogout}
                className="p-2 border border-border-primary bg-background hover:bg-text-primary/5 text-text-secondary hover:text-text-primary rounded transition-all cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-3 py-2 mb-2">
                <div className="h-6 w-6 rounded-full bg-panel flex items-center justify-center text-[10px] font-bold border border-border-primary">
                  A
                </div>
                <span className="text-xs font-medium truncate text-text-secondary">Administrator</span>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border-primary bg-background hover:bg-text-primary/5 text-text-secondary hover:text-text-primary rounded text-xs transition-all cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main content core container */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header layout */}
        <header className="h-16 border-b border-border-primary flex items-center justify-between px-8 bg-panel-card/10">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold tracking-tight text-text-primary capitalize">
              {location.pathname.replace('/', '')}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-panel border border-border-primary rounded-full text-[11px] text-text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Dynamic Dialers Active</span>
            </div>
          </div>
        </header>

        {/* Routing View Render */}
        <main className="flex-1 overflow-y-auto p-8">
          <Routes>
            <Route
              path="dashboard"
              element={
                <OverviewPanel
                  activeCount={activePipelines}
                  totalCount={pipelines.length}
                  totalVolume={totalVolumeFormat(totalRecords)}
                  latency={pipelines.length > 0 ? `${averageLatency}ms` : '0ms'}
                  logs={logs}
                />
              }
            />
            <Route
              path="sources"
              element={
                <SourcesPanel
                  sources={sources}
                  onCreateClick={() => setIsSourceDrawerOpen(true)}
                />
              }
            />
            <Route
              path="destinations"
              element={
                <DestinationsPanel
                  destinations={destinations}
                  onCreateClick={() => setIsDestinationDrawerOpen(true)}
                />
              }
            />
            <Route
              path="pipelines"
              element={
                <PipelinesPanel
                  pipelines={pipelines}
                  isLoading={isLoading}
                  onTriggerSync={handleTriggerSync}
                  triggeringId={triggeringId}
                  onCreateClick={() => setIsDrawerOpen(true)}
                />
              }
            />
            <Route path="live" element={<LiveDashboard />} />
            <Route path="users" element={<UsersTable />} />
            <Route path="roles" element={<RoleBuilder />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </main>
      </div>

      <CreatePipelineForm
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        sources={sources}
        destinations={destinations}
        onSubmitPipeline={handleAddPipeline}
      />

      <CreateSourceForm
        isOpen={isSourceDrawerOpen}
        onClose={() => setIsSourceDrawerOpen(false)}
        onSubmitSource={handleCreateSource}
      />

      <CreateDestinationForm
        isOpen={isDestinationDrawerOpen}
        onClose={() => setIsDestinationDrawerOpen(false)}
        onSubmitDestination={handleCreateDestination}
      />
    </div>
  )
}

// Convert sync numbers to K/M representations
const totalVolumeFormat = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

// 1. Overview Panel Dashboard Layout
interface OverviewPanelProps {
  activeCount: number
  totalCount: number
  totalVolume: string
  latency: string
  logs: ActivityLog[]
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

      {/* Overview Cards */}
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

      {/* Activity Log Section */}
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

// 2. Pipelines Panel Controller
interface PipelinesPanelProps {
  pipelines: Pipeline[]
  isLoading: boolean
  onTriggerSync: (id: string) => void
  triggeringId: string | null
  onCreateClick: () => void
}

const PipelinesPanel: React.FC<PipelinesPanelProps> = ({
  pipelines,
  isLoading,
  onTriggerSync,
  triggeringId,
  onCreateClick
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
          className="flex items-center gap-2 px-3.5 py-2 bg-text-primary text-background font-medium hover:opacity-90 text-xs rounded-lg transition-all cursor-pointer"
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

function App() {
  const { theme } = useAuthStore()

  // Sync document root class with active theme
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
  }, [theme])

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
      <Toaster
        theme={theme === 'light' ? 'light' : 'dark'}
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: 'bg-panel border border-border-primary text-text-primary shadow-2xl rounded-lg font-sans p-4 flex items-center gap-3 w-80',
            success: 'text-text-primary border-border-primary [&_svg]:text-emerald-500',
            error: 'bg-panel border-red-500/30 text-rose-500 [&_svg]:text-rose-500',
            title: 'text-xs font-semibold font-sans',
            description: 'text-[10px] text-text-secondary font-sans'
          }
        }}
      />
    </>
  )
}

interface SourcesPanelProps {
  sources: Source[]
  onCreateClick: () => void
}

const SourcesPanel: React.FC<SourcesPanelProps> = ({ sources, onCreateClick }) => {
  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-text-primary">Data Sources</h2>
          <p className="text-sm text-text-muted">Register and configure HTTP API sources to extract data from.</p>
        </div>
        <button
          onClick={onCreateClick}
          className="flex items-center gap-2 px-3.5 py-2 bg-text-primary text-background font-medium hover:opacity-90 text-xs rounded-lg transition-all cursor-pointer"
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-text-primary text-background font-medium hover:opacity-90 text-xs rounded transition-all duration-150 cursor-pointer shadow-lg"
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

interface DestinationsPanelProps {
  destinations: Destination[]
  onCreateClick: () => void
}

const DestinationsPanel: React.FC<DestinationsPanelProps> = ({ destinations, onCreateClick }) => {
  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-text-primary">Data Destinations</h2>
          <p className="text-sm text-text-muted">Register and configure target SQL databases for data syncs.</p>
        </div>
        <button
          onClick={onCreateClick}
          className="flex items-center gap-2 px-3.5 py-2 bg-text-primary text-background font-medium hover:opacity-90 text-xs rounded-lg transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4 font-bold" />
          Create Destination
        </button>
      </div>

      {destinations.length === 0 ? (
        <div className="bg-panel border border-border-primary rounded-xl p-16 text-center max-w-5xl mx-auto space-y-5">
          <div className="flex justify-center">
            <div className="h-20 w-20 bg-panel-card border border-border-primary rounded-full flex items-center justify-center">
              <Database className="h-10 w-10 text-text-muted" />
            </div>
          </div>
          <div className="space-y-2 max-w-sm mx-auto">
            <h3 className="text-sm font-semibold text-text-primary">No Active Destinations</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Register MySQL or PostgreSQL endpoints to load your extracted api payloads.
            </p>
          </div>
          <button
            onClick={onCreateClick}
            className="inline-flex items-center gap-2 px-4 py-2 bg-text-primary text-background font-medium hover:opacity-90 text-xs rounded transition-all duration-150 cursor-pointer shadow-lg"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Destination
          </button>
        </div>
      ) : (
        <div className="bg-panel border border-border-primary rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-primary bg-panel-card/30 text-xs text-text-muted uppercase tracking-wider font-semibold">
                  <th className="px-6 py-4">Destination Name</th>
                  <th className="px-6 py-4">SQL Dialect</th>
                  <th className="px-6 py-4">Connection Host</th>
                  <th className="px-6 py-4">Database Target</th>
                  <th className="px-6 py-4">SSH Tunnel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary text-sm">
                {destinations.map((dest) => (
                  <tr key={dest.id} className="hover:bg-panel-card/30 transition-colors duration-100">
                    <td className="px-6 py-4 font-medium text-text-primary">{dest.name}</td>
                    <td className="px-6 py-4 capitalize text-xs text-text-muted font-mono">{dest.targetDbDialect}</td>
                    <td className="px-6 py-4 font-mono text-xs text-text-secondary">{dest.targetDbHost}:{dest.targetDbPort}</td>
                    <td className="px-6 py-4 font-mono text-xs text-text-secondary">{dest.targetDbName}</td>
                    <td className="px-6 py-4 text-xs text-text-muted">{dest.enableSshBastion ? 'Enabled' : 'Disabled'}</td>
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

export default App
