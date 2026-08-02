import React, { useEffect, useState } from 'react'
import { Database, Check, Play, Zap } from 'lucide-react'
import apiClient from '@/api/client'

interface MappingItem {
  sourceKey: string
  rule: string
}

export const MappingCanvas: React.FC = () => {
  const [sourceKeys, setSourceKeys] = useState<string[]>([])
  const [targetColumns, setTargetColumns] = useState<string[]>([])
  const [mappings, setMappings] = useState<Record<string, MappingItem>>({})
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [serializedPayload, setSerializedPayload] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchSchema = async () => {
      setLoading(true)
      try {
        const response = await apiClient.get('/api/v1/pipelines/active/schema')
        const srcKeys = response.data.sourceKeys || []
        const tgtCols = response.data.targetColumns || []
        setSourceKeys(srcKeys)
        setTargetColumns(tgtCols)
        
        // Initialize mappings
        const initial: Record<string, MappingItem> = {}
        tgtCols.forEach((col: string) => {
          initial[col] = { sourceKey: '', rule: 'NONE' }
        })
        setMappings(initial)
      } catch (err) {
        console.error('Failed to fetch active schemas:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchSchema()
  }, [])

  // Auto-Map Logic
  const handleAutoMap = () => {
    const nextMappings = { ...mappings }
    targetColumns.forEach((col) => {
      // Look for case-insensitive exact or fuzzy match
      const colNorm = col.toLowerCase().replace(/_|-/g, '')
      const match = sourceKeys.find((src) => {
        const srcNorm = src.toLowerCase().replace(/_|-/g, '')
        return srcNorm === colNorm
      })
      if (match) {
        nextMappings[col] = {
          sourceKey: match,
          rule: nextMappings[col]?.rule || 'NONE'
        }
      }
    })
    setMappings(nextMappings)
  }

  // Save Mapping
  const handleSaveMapping = async () => {
    const serialized = Object.entries(mappings)
      .filter(([_, map]) => map.sourceKey !== '')
      .map(([targetCol, map]) => ({
        source_field: map.sourceKey,
        destination_field: targetCol,
        rule: map.rule || 'NONE'
      }))

    try {
      await apiClient.post('/api/v1/mappings', serialized)
      setSerializedPayload(JSON.stringify(serialized, null, 2))
      setSaveSuccess(true)
      setTimeout(() => {
        setSaveSuccess(false)
        setSerializedPayload(null)
      }, 5000)
    } catch (err) {
      console.error('Failed to save mapping config:', err)
    }
  }

  const handleSourceChange = (col: string, val: string) => {
    setMappings((prev) => ({
      ...prev,
      [col]: {
        ...prev[col],
        sourceKey: val
      }
    }))
  }

  const handleRuleChange = (col: string, val: string) => {
    setMappings((prev) => ({
      ...prev,
      [col]: {
        ...prev[col],
        rule: val
      }
    }))
  }

  return (
    <div className="space-y-6 w-full font-sans text-gray-900 dark:text-white">
      {/* Header */}
      <div className="flex items-center justify-between w-full mb-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">Schema Field Mapper</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Map REST API template keys to database destination columns.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleAutoMap}
            disabled={sourceKeys.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-xs rounded transition-all cursor-pointer shadow-md text-gray-700 dark:text-white font-semibold"
          >
            <Zap className="h-3.5 w-3.5 text-yellow-500" />
            Auto-Map Fields
          </button>
          <button
            onClick={handleSaveMapping}
            disabled={targetColumns.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 bg-gray-900 dark:bg-white text-white dark:text-black font-semibold hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed text-xs rounded-lg transition-all cursor-pointer shadow-lg"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Save Mapping
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl space-y-2 animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-500" />
            <span className="font-semibold uppercase tracking-wide">Schema Mapping Saved!</span>
          </div>
          <pre className="p-3 bg-gray-50 dark:bg-[#0F0F0F] border border-gray-200 dark:border-white/10 rounded-lg text-[10px] font-mono text-gray-800 dark:text-gray-300 overflow-x-auto leading-relaxed">
            {serializedPayload}
          </pre>
        </div>
      )}

      {loading ? (
        <div className="h-[350px] flex items-center justify-center border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0A0A0A] rounded-xl">
          <div className="text-xs text-gray-500 dark:text-gray-400 animate-pulse">Loading active schemas...</div>
        </div>
      ) : sourceKeys.length === 0 && targetColumns.length === 0 ? (
        <div className="h-[250px] flex flex-col items-center justify-center border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0A0A0A] rounded-xl text-center p-8 space-y-3">
          <Database className="h-10 w-10 text-gray-400 dark:text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">No Active Pipeline Data</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
            Please run or select a pipeline config containing valid REST source fields and target DB schemas to map fields.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel: Source schema list */}
          <div className="lg:col-span-1 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-xl p-5 space-y-4">
            <div className="pb-3 border-b border-gray-200 dark:border-white/10">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Available Source Keys</h3>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">REST API query keys detected in raw template payload.</p>
            </div>
            <div className="flex flex-wrap gap-2 max-h-[350px] overflow-y-auto pr-1">
              {sourceKeys.map((key) => (
                <span
                  key={key}
                  className="px-2.5 py-1.5 bg-gray-50 dark:bg-zinc-900 border border-gray-150 dark:border-white/5 rounded text-xs font-mono text-gray-700 dark:text-gray-300 select-all cursor-copy hover:border-gray-300 dark:hover:border-white/20 transition-all"
                  title="Click to select or copy"
                >
                  {key}
                </span>
              ))}
            </div>
          </div>

          {/* Right panel: Target schema mappings mapping controls */}
          <div className="lg:col-span-2 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-xl p-5 space-y-4">
            <div className="pb-3 border-b border-gray-200 dark:border-white/10">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Destination Field Mapping</h3>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Route source columns to target columns and specify casts/filters.</p>
            </div>
            
            <div className="divide-y divide-gray-150 dark:divide-white/5 max-h-[400px] overflow-y-auto pr-2">
              {targetColumns.map((col) => {
                const map = mappings[col] || { sourceKey: '', rule: 'NONE' }
                return (
                  <div key={col} className="flex flex-col sm:flex-row sm:items-center justify-between py-3.5 gap-4">
                    <div className="space-y-1">
                      <span className="font-mono text-xs text-gray-900 dark:text-white font-medium block">{col}</span>
                      <span className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-wider block bg-gray-50 dark:bg-zinc-900/50 border border-gray-150 dark:border-white/5 rounded px-1.5 py-0.5 w-max">
                        DB Target Column
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Source selector */}
                      <div className="flex flex-col space-y-1">
                        <label className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-semibold">Source Field</label>
                        <select
                          value={map.sourceKey}
                          onChange={(e) => handleSourceChange(col, e.target.value)}
                          className="w-48 bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-white/10 rounded px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-white/20 font-mono"
                        >
                          <option value="">[ None / Ignore ]</option>
                          {sourceKeys.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Rule selector */}
                      <div className="flex flex-col space-y-1">
                        <label className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-semibold">Transform Rule</label>
                        <select
                          value={map.rule}
                          onChange={(e) => handleRuleChange(col, e.target.value)}
                          className="w-32 bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-white/10 rounded px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-white/20 font-mono"
                        >
                          <option value="NONE">NONE</option>
                          <option value="CAST_INT">CAST_INT</option>
                          <option value="UPPERCASE">UPPERCASE</option>
                          <option value="LOWERCASE">LOWERCASE</option>
                          <option value="TRIM">TRIM</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 px-2 text-xs text-gray-500 dark:text-gray-400 mt-4">
        <Database className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        <span>Use the Auto-Map button to instantly link matched source template payload keys to target DB columns.</span>
      </div>
    </div>
  )
}

export default MappingCanvas
