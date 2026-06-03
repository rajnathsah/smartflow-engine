import React, { useReducer, useEffect, Suspense } from 'react'
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
  ShieldCheck,
  Users,
  Shield,
  Cpu,
  Menu,
  ChevronLeft,
  Globe,
  Network,
  BookOpen,
  Sun,
  Moon,
  Sliders
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { usePipelineStore } from '@/store/pipelineStore'
import type { Pipeline, ActivityLog, Source, Destination } from '@/types'
import { CreatePipelineForm } from '@/components/CreatePipelineForm'
import { CreateSourceForm } from '@/components/CreateSourceForm'
import { CreateDestinationForm } from '@/components/CreateDestinationForm'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Toaster } from 'sonner'
import { hasPermission } from '@/lib/permissions'
import apiClient from '@/api/client'
import { handleAPIError } from '@/utils/errors'
import { usePipelinePolling } from '@/hooks/usePipelinePolling'

const OverviewPanel = React.lazy(() => import('@/pages/OverviewPanel'))
const PipelinesPanel = React.lazy(() => import('@/pages/PipelinesPanel'))
const SourcesPanel = React.lazy(() => import('@/pages/SourcesPanel'))
const DestinationsPanel = React.lazy(() => import('@/pages/DestinationsPanel'))

const LiveDashboard = React.lazy(() => import('@/components/LiveDashboard').then(m => ({ default: m.LiveDashboard })))
const MappingCanvas = React.lazy(() => import('@/components/MappingCanvas').then(m => ({ default: m.MappingCanvas })))
const RAGPanel = React.lazy(() => import('@/components/RAGPanel').then(m => ({ default: m.RAGPanel })))
const UsersTable = React.lazy(() => import('@/components/UsersTable').then(m => ({ default: m.UsersTable })))
const RoleBuilder = React.lazy(() => import('@/components/RoleBuilder').then(m => ({ default: m.RoleBuilder })))
const Login = React.lazy(() => import('@/components/Login').then(m => ({ default: m.Login })))

interface DashboardState {
  logs: ActivityLog[]
  isLoading: boolean
  triggeringId: string | null
  isDrawerOpen: boolean
  isSourceDrawerOpen: boolean
  isDestinationDrawerOpen: boolean
  isSidebarCollapsed: boolean
}

type DashboardAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_TRIGGERING_ID'; payload: string | null }
  | { type: 'TOGGLE_DRAWER'; payload: boolean }
  | { type: 'TOGGLE_SOURCE_DRAWER'; payload: boolean }
  | { type: 'TOGGLE_DESTINATION_DRAWER'; payload: boolean }
  | { type: 'TOGGLE_SIDEBAR'; payload?: boolean }
  | { type: 'ADD_LOG'; payload: ActivityLog }
  | { type: 'SET_LOGS'; payload: ActivityLog[] }

const initialState: DashboardState = {
  logs: [],
  isLoading: true,
  triggeringId: null,
  isDrawerOpen: false,
  isSourceDrawerOpen: false,
  isDestinationDrawerOpen: false,
  isSidebarCollapsed: false
}

function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'SET_TRIGGERING_ID':
      return { ...state, triggeringId: action.payload }
    case 'TOGGLE_DRAWER':
      return { ...state, isDrawerOpen: action.payload }
    case 'TOGGLE_SOURCE_DRAWER':
      return { ...state, isSourceDrawerOpen: action.payload }
    case 'TOGGLE_DESTINATION_DRAWER':
      return { ...state, isDestinationDrawerOpen: action.payload }
    case 'TOGGLE_SIDEBAR':
      return { ...state, isSidebarCollapsed: action.payload ?? !state.isSidebarCollapsed }
    case 'ADD_LOG':
      return { ...state, logs: [action.payload, ...state.logs] }
    case 'SET_LOGS':
      return { ...state, logs: action.payload }
    default:
      return state
  }
}

const PageLoader = () => (
  <div className="flex items-center justify-center h-full w-full">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary"></div>
  </div>
)

const totalVolumeFormat = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

const DashboardLayout = () => {
  const { activeTenant, logout, theme, toggleTheme, role, email } = useAuthStore()
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

  const [state, dispatch] = useReducer(dashboardReducer, initialState)

  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch({ type: 'SET_LOADING', payload: false })
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

  const handleTriggerSync = async (id: string) => {
    const pipeline = getPipelineById(id)
    if (!pipeline) {
      return
    }

    dispatch({ type: 'SET_TRIGGERING_ID', payload: id })
    updatePipeline(id, { status: 'syncing' })
    
    const startTime = new Date().toLocaleTimeString('en-US', { hour12: false })
    const startLogId = String(Date.now())
    
    dispatch({
      type: 'ADD_LOG',
      payload: {
        id: startLogId,
        time: startTime,
        event: `Manual execution trigger: ${pipeline.name}`,
        status: 'info',
        detail: 'Dispatched Celery worker job extraction queue...'
      }
    })

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

      const response = await apiClient.post(
        `/api/v1/pipelines/${id}/sync`,
        syncPayload
      )
      const taskId = response.data?.task_id

      updatePipeline(id, {
        status: 'syncing',
        taskId: taskId || undefined
      })

      const endTime = new Date().toLocaleTimeString('en-US', { hour12: false })
      dispatch({
        type: 'ADD_LOG',
        payload: {
          id: String(Date.now()),
          time: endTime,
          event: `Sync dispatched: ${pipeline.name}`,
          status: 'success',
          detail: taskId
            ? `Backend accepted sync request. Task ID: ${taskId}`
            : 'Backend accepted sync request.'
        }
      })
    } catch (error) {
      const apiErr = handleAPIError(error)
      updatePipeline(id, { status: 'failed', taskId: undefined })

      const endTime = new Date().toLocaleTimeString('en-US', { hour12: false })
      dispatch({
        type: 'ADD_LOG',
        payload: {
          id: String(Date.now()),
          time: endTime,
          event: `Sync failed: ${pipeline.name}`,
          status: 'failed',
          detail: apiErr.detail || apiErr.message
        }
      })
    } finally {
      dispatch({ type: 'SET_TRIGGERING_ID', payload: null })
    }
  }

  usePipelinePolling({
    pipelines,
    updatePipeline,
    onSuccess: (pipeline, recordsSynced) => {
      const endTime = new Date().toLocaleTimeString('en-US', { hour12: false })
      dispatch({
        type: 'ADD_LOG',
        payload: {
          id: String(Date.now()),
          time: endTime,
          event: `Sync completed: ${pipeline.name}`,
          status: 'success',
          detail: `Successfully processed and inserted ${recordsSynced.toLocaleString()} records.`
        }
      })
    },
    onFailure: (pipeline, errorMsg) => {
      const endTime = new Date().toLocaleTimeString('en-US', { hour12: false })
      dispatch({
        type: 'ADD_LOG',
        payload: {
          id: String(Date.now()),
          time: endTime,
          event: `Sync failed: ${pipeline.name}`,
          status: 'failed',
          detail: errorMsg
        }
      })
    }
  })

  const handleAddPipeline = (data: Omit<Pipeline, 'id' | 'status' | 'lastSync' | 'recordsSynced' | 'schemaMapping'>) => {
    const newPipeline: Pipeline = {
      ...data,
      id: String(Date.now()),
      status: 'active',
      lastSync: 'Never run',
      recordsSynced: 0,
      schemaMapping: []
    }

    dispatch({ type: 'SET_LOADING', payload: true })
    
    setTimeout(() => {
      addPipeline(newPipeline)
      
      const currentTime = new Date().toLocaleTimeString('en-US', { hour12: false })
      dispatch({
        type: 'ADD_LOG',
        payload: {
          id: String(Date.now()),
          time: currentTime,
          event: `Pipeline Provisioned: ${newPipeline.name}`,
          status: 'success',
          detail: `Mapped API endpoint to target: ${newPipeline.targetDbName} (${newPipeline.targetDbDialect})`
        }
      })
      
      dispatch({ type: 'SET_LOADING', payload: false })
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

  const activePipelines = pipelines.filter(p => p.status === 'active' || p.status === 'syncing').length
  const totalRecords = pipelines.reduce((sum, p) => sum + p.recordsSynced, 0)
  const averageLatency = pipelines.length > 0 ? 120 + pipelines.length * 8 : 0

  const navItems = [
    { path: '/dashboard', label: 'Overview', icon: Activity },
    { path: '/sources', label: 'Sources', icon: Globe },
    { path: '/destinations', label: 'Destinations', icon: Database },
    { path: '/pipelines', label: 'Connections', icon: Network },
    { path: '/mapper', label: 'Schema Mapper', icon: Sliders },
    { path: '/analysis', label: 'Document AI', icon: BookOpen },
    { path: '/live', label: 'Live Sync', icon: Cpu },
  ]

  const rbacItems = [
    { path: '/users', label: 'Users', icon: Users },
    { path: '/roles', label: 'Roles', icon: Shield },
  ]

  return (
    <div className="flex h-screen bg-background text-text-primary font-sans overflow-hidden">
      <aside className={`${state.isSidebarCollapsed ? 'w-16' : 'w-64'} transition-all duration-300 border-r border-border-primary bg-panel flex flex-col justify-between shrink-0`}>
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
              {!state.isSidebarCollapsed && (
                <span className="font-semibold text-sm tracking-wider uppercase truncate">synq.to</span>
              )}
            </div>
            <button 
              onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
              className="p-1.5 rounded hover:bg-text-primary/5 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              aria-label={state.isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {state.isSidebarCollapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          <div className="p-4 border-b border-border-primary">
            {state.isSidebarCollapsed ? (
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
                    state.isSidebarCollapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2'
                  } ${
                    isActive
                      ? 'bg-text-primary/10 text-text-primary font-medium border border-border-primary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-text-primary/5 border border-transparent'
                  }`}
                  title={state.isSidebarCollapsed ? item.label : undefined}
                  aria-label={item.label}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  {!state.isSidebarCollapsed && <span>{item.label}</span>}
                </Link>
              )
            })}

            {!state.isSidebarCollapsed ? (
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
                    state.isSidebarCollapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2'
                  } ${
                    isActive
                      ? 'bg-text-primary/10 text-text-primary font-medium border border-border-primary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-text-primary/5 border border-transparent'
                  }`}
                  title={state.isSidebarCollapsed ? item.label : undefined}
                  aria-label={item.label}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  {!state.isSidebarCollapsed && <span>{item.label}</span>}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="p-3 border-t border-border-primary bg-panel-card/30">
          {state.isSidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-panel flex items-center justify-center text-[10px] font-bold border border-border-primary">
                {(email || 'U')[0].toUpperCase()}
              </div>
              <button
                onClick={handleLogout}
                className="p-2 border border-border-primary bg-background hover:bg-text-primary/5 text-text-secondary hover:text-text-primary rounded transition-all cursor-pointer"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-3 py-2 mb-2">
                <div className="h-6 w-6 rounded-full bg-panel flex items-center justify-center text-[10px] font-bold border border-border-primary">
                  {(email || 'U')[0].toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium truncate text-text-secondary">{email || 'User'}</span>
                  <span className="text-[9px] uppercase tracking-wider font-semibold text-text-muted">{role || 'Role'}</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border-primary bg-background hover:bg-text-primary/5 text-text-secondary hover:text-text-primary rounded text-xs transition-all cursor-pointer"
                aria-label="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border-primary flex items-center justify-between px-8 bg-panel-card/10">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold tracking-tight text-text-primary capitalize">
              {location.pathname.replace('/', '')}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 border border-border-primary bg-panel hover:bg-text-primary/5 text-text-secondary hover:text-text-primary rounded-lg transition-all cursor-pointer flex items-center justify-center"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-panel border border-border-primary rounded-full text-[11px] text-text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Dynamic Dialers Active</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route
                path="dashboard"
                element={
                  <OverviewPanel
                    activeCount={activePipelines}
                    totalCount={pipelines.length}
                    totalVolume={totalVolumeFormat(totalRecords)}
                    latency={pipelines.length > 0 ? `${averageLatency}ms` : '0ms'}
                    logs={state.logs}
                  />
                }
              />
              <Route
                path="sources"
                element={
                  <SourcesPanel
                    sources={sources}
                    onCreateClick={() => dispatch({ type: 'TOGGLE_SOURCE_DRAWER', payload: true })}
                    canWrite={hasPermission(role, 'pipelines:write', activeTenant)}
                  />
                }
              />
              <Route
                path="destinations"
                element={
                  <DestinationsPanel
                    destinations={destinations}
                    onCreateClick={() => dispatch({ type: 'TOGGLE_DESTINATION_DRAWER', payload: true })}
                    canWrite={hasPermission(role, 'pipelines:write', activeTenant)}
                  />
                }
              />
              <Route
                path="pipelines"
                element={
                  <PipelinesPanel
                    pipelines={pipelines}
                    isLoading={state.isLoading}
                    onTriggerSync={handleTriggerSync}
                    triggeringId={state.triggeringId}
                    onCreateClick={() => dispatch({ type: 'TOGGLE_DRAWER', payload: true })}
                    canWrite={hasPermission(role, 'pipelines:write', activeTenant)}
                  />
                }
              />
              <Route path="live" element={<LiveDashboard />} />
              <Route path="mapper" element={<MappingCanvas />} />
              <Route path="analysis" element={<RAGPanel />} />
              <Route path="users" element={<UsersTable />} />
              <Route path="roles" element={<RoleBuilder />} />
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>

      <CreatePipelineForm
        isOpen={state.isDrawerOpen}
        onClose={() => dispatch({ type: 'TOGGLE_DRAWER', payload: false })}
        sources={sources}
        destinations={destinations}
        onSubmitPipeline={handleAddPipeline}
      />

      <CreateSourceForm
        isOpen={state.isSourceDrawerOpen}
        onClose={() => dispatch({ type: 'TOGGLE_SOURCE_DRAWER', payload: false })}
        onSubmitSource={handleCreateSource}
      />

      <CreateDestinationForm
        isOpen={state.isDestinationDrawerOpen}
        onClose={() => dispatch({ type: 'TOGGLE_DESTINATION_DRAWER', payload: false })}
        onSubmitDestination={handleCreateDestination}
      />
    </div>
  )
}

function App() {
  const { theme } = useAuthStore()

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
  }, [theme])

  return (
    <>
      <Suspense fallback={<PageLoader />}>
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
      </Suspense>
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

export default App
