import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { Pipeline, Source, Destination } from '@/types'

interface PipelineStoreState {
  activeTenant: string | null
  pipelines: Pipeline[]
  sources: Source[]
  destinations: Destination[]
  pipelinesByTenant: Record<string, Pipeline[]>
  sourcesByTenant: Record<string, Source[]>
  destinationsByTenant: Record<string, Destination[]>
  setActiveTenant: (tenant: string | null) => void
  addPipeline: (pipeline: Pipeline) => void
  addSource: (source: Source) => void
  addDestination: (destination: Destination) => void
  updatePipeline: (id: string, updates: Partial<Pipeline>) => void
  getPipelineById: (id: string) => Pipeline | undefined
}

export const usePipelineStore = create<PipelineStoreState>()(
  persist(
    (set, get) => ({
      activeTenant: null,
      pipelines: [],
      sources: [],
      destinations: [],
      pipelinesByTenant: {},
      sourcesByTenant: {},
      destinationsByTenant: {},
      setActiveTenant: (tenant) =>
        set((state) => ({
          activeTenant: tenant,
          pipelines: tenant ? (state.pipelinesByTenant || {})[tenant] || [] : [],
          sources: tenant ? (state.sourcesByTenant || {})[tenant] || [] : [],
          destinations: tenant ? (state.destinationsByTenant || {})[tenant] || [] : [],
        })),
      addPipeline: (pipeline) =>
        set((state) => {
          const tenantKey = state.activeTenant || 'default'
          const tenantPipelines = (state.pipelinesByTenant || {})[tenantKey] || []
          const updatedPipelines = [...tenantPipelines.filter((p) => p.id !== pipeline.id), pipeline]
          return {
            pipelines: updatedPipelines,
            pipelinesByTenant: {
              ...(state.pipelinesByTenant || {}),
              [tenantKey]: updatedPipelines,
            },
          }
        }),
      addSource: (source) =>
        set((state) => {
          const tenantKey = state.activeTenant || 'default'
          const tenantSources = (state.sourcesByTenant || {})[tenantKey] || []
          const updatedSources = [...tenantSources.filter((s) => s.id !== source.id), source]
          return {
            sources: updatedSources,
            sourcesByTenant: {
              ...(state.sourcesByTenant || {}),
              [tenantKey]: updatedSources,
            },
          }
        }),
      addDestination: (destination) =>
        set((state) => {
          const tenantKey = state.activeTenant || 'default'
          const tenantDestinations = (state.destinationsByTenant || {})[tenantKey] || []
          const updatedDestinations = [...tenantDestinations.filter((d) => d.id !== destination.id), destination]
          return {
            destinations: updatedDestinations,
            destinationsByTenant: {
              ...(state.destinationsByTenant || {}),
              [tenantKey]: updatedDestinations,
            },
          }
        }),
      updatePipeline: (id, updates) =>
        set((state) => {
          const tenantKey = state.activeTenant || 'default'
          const tenantPipelines = (state.pipelinesByTenant || {})[tenantKey] || []
          const updatedPipelines = tenantPipelines.map((pipeline) =>
            pipeline.id === id ? { ...pipeline, ...updates } : pipeline
          )
          return {
            pipelines: updatedPipelines,
            pipelinesByTenant: {
              ...(state.pipelinesByTenant || {}),
              [tenantKey]: updatedPipelines,
            },
          }
        }),
      getPipelineById: (id) => get().pipelines.find((pipeline) => pipeline.id === id),
    }),
    {
      name: 'synq-pipelines-decoupled',
    }
  )
)
