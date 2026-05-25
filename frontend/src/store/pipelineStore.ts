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
        set((state) => ({
          pipelines: [...state.pipelines, pipeline],
          pipelinesByTenant: {
            ...(state.pipelinesByTenant || {}),
            [state.activeTenant || 'default']: [...state.pipelines, pipeline],
          },
        })),
      addSource: (source) =>
        set((state) => ({
          sources: [...state.sources, source],
          sourcesByTenant: {
            ...(state.sourcesByTenant || {}),
            [state.activeTenant || 'default']: [...state.sources, source],
          },
        })),
      addDestination: (destination) =>
        set((state) => ({
          destinations: [...state.destinations, destination],
          destinationsByTenant: {
            ...(state.destinationsByTenant || {}),
            [state.activeTenant || 'default']: [...state.destinations, destination],
          },
        })),
      updatePipeline: (id, updates) =>
        set((state) => {
          const pipelines = state.pipelines.map((pipeline) =>
            pipeline.id === id ? { ...pipeline, ...updates } : pipeline
          )
          return {
            pipelines,
            pipelinesByTenant: {
              ...(state.pipelinesByTenant || {}),
              [state.activeTenant || 'default']: pipelines,
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
