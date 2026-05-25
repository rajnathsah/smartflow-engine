import React, { useEffect, useCallback, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position
} from '@xyflow/react'
import type { NodeProps, Connection, Edge, Node } from '@xyflow/react'
import { Database, Check, Play } from 'lucide-react'
import '@xyflow/react/dist/style.css'

// Custom Source Node Component (Left Handle Right Position)
export const SourceNode: React.FC<NodeProps> = ({ data }) => {
  const label = typeof data?.label === 'string' ? data.label : 'Field'
  return (
    <div className="bg-panel border border-border-primary rounded-md shadow-lg p-3 min-w-[150px] text-sm text-text-primary font-mono relative">
      <div className="font-semibold text-text-muted text-[10px] uppercase tracking-wider mb-1">Source Field</div>
      <div className="truncate font-medium">{label}</div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-2.5 h-2.5 bg-text-secondary border-none hover:bg-text-primary transition-colors"
      />
    </div>
  )
}

// Custom Target Node Component (Right Handle Left Position)
export const TargetNode: React.FC<NodeProps> = ({ data }) => {
  const label = typeof data?.label === 'string' ? data.label : 'Column'
  return (
    <div className="bg-panel border border-border-primary rounded-md shadow-lg p-3 min-w-[150px] text-sm text-text-primary font-mono relative">
      <div className="font-semibold text-text-muted text-[10px] uppercase tracking-wider mb-1">Target Column</div>
      <div className="truncate font-medium">{label}</div>
      <Handle
        type="target"
        position={Position.Left}
        className="w-2.5 h-2.5 bg-text-secondary border-none hover:bg-text-primary transition-colors"
      />
    </div>
  )
}

// Node mappings registration
const nodeTypes = {
  sourceNode: SourceNode,
  targetNode: TargetNode
}

interface MappingCanvasProps {
  sourceKeys?: string[]
  targetColumns?: string[]
}

export const MappingCanvas: React.FC<MappingCanvasProps> = ({
  sourceKeys = ['user_id', 'email', 'created_at', 'status_flag'],
  targetColumns = ['id', 'contact_email', 'signup_date', 'active_status']
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [serializedPayload, setSerializedPayload] = useState<string | null>(null)

  // Dynamically map props to React Flow nodes coordinates
  useEffect(() => {
    const mappedNodes: Node[] = [
      ...sourceKeys.map((key, idx) => ({
        id: `source-${key}`,
        type: 'sourceNode',
        position: { x: 100, y: 50 + idx * 100 },
        data: { label: key },
      })),
      ...targetColumns.map((col, idx) => ({
        id: `target-${col}`,
        type: 'targetNode',
        position: { x: 500, y: 50 + idx * 100 },
        data: { label: col },
      })),
    ]
    setNodes(mappedNodes)
  }, [sourceKeys, targetColumns, setNodes])

  // Establish custom styled smoothstep edge lines
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'smoothstep',
            style: { stroke: '#71717a', strokeWidth: 2 },
          } as any,
          eds
        )
      ),
    [setEdges]
  )

  // Serialize and console.log mappings
  const handleSaveMapping = () => {
    const serialized = edges.map((edge: Edge) => {
      const sourceKey = edge.source.replace('source-', '')
      const targetKey = edge.target.replace('target-', '')
      return {
        source_key: sourceKey,
        target_key: targetKey
      }
    })

    console.log('Serialized Schema Mappings:', serialized)
    setSerializedPayload(JSON.stringify(serialized, null, 2))
    setSaveSuccess(true)

    setTimeout(() => {
      setSaveSuccess(false)
      setSerializedPayload(null)
    }, 4000)
  }

  return (
    <div className="space-y-6 max-w-5xl">
      
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-text-primary">Schema Field Mapper</h2>
          <p className="text-sm text-text-muted">Drag edges to map keys extracted from REST source queries to target columns.</p>
        </div>
        <button
          onClick={handleSaveMapping}
          className="flex items-center gap-2 px-3.5 py-2 bg-text-primary text-background font-semibold hover:opacity-90 text-xs rounded-lg transition-all cursor-pointer shadow-lg animate-fadeIn"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          Save Mapping
        </button>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl space-y-2 animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-500" />
            <span className="font-semibold uppercase tracking-wide">Schema Mapping Saved!</span>
          </div>
          <pre className="p-3 bg-panel-card border border-border-primary rounded-lg text-[10px] font-mono text-text-secondary overflow-x-auto leading-relaxed">
            {serializedPayload}
          </pre>
        </div>
      )}

      {/* Canvas container */}
      <div className="h-[450px] w-full bg-background border border-border-primary rounded-xl overflow-hidden relative shadow-inner">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="bg-background"
        >
          <Background color="var(--border-primary)" gap={20} size={1} />
          <Controls className="bg-panel border border-border-primary text-text-primary rounded-md" />
        </ReactFlow>
      </div>

      <div className="flex items-center gap-2 px-2 text-xs text-text-muted">
        <Database className="h-4 w-4 text-text-muted" />
        <span>Ensure all primary key identifiers are successfully mapped to prevent sync conflicts.</span>
      </div>

    </div>
  )
}
export default MappingCanvas
