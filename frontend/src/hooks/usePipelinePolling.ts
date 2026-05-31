import { useEffect, useRef } from 'react'
import apiClient from '@/api/client'
import type { Pipeline } from '@/types'

interface UsePipelinePollingProps {
  pipelines: Pipeline[]
  updatePipeline: (id: string, updates: Partial<Pipeline>) => void
  onSuccess: (pipeline: Pipeline, recordsSynced: number) => void
  onFailure: (pipeline: Pipeline, errorMsg: string) => void
}

export const usePipelinePolling = ({
  pipelines,
  updatePipeline,
  onSuccess,
  onFailure
}: UsePipelinePollingProps) => {
  const delaysRef = useRef<Record<string, number>>({})
  const timersRef = useRef<Record<string, number>>({})

  useEffect(() => {
    const activeSyncPipelines = pipelines.filter(
      (p) => p.status === 'syncing' && p.taskId
    )

    const activeTaskIds = new Set(activeSyncPipelines.map((p) => p.taskId!))

    Object.keys(timersRef.current).forEach((taskId) => {
      if (!activeTaskIds.has(taskId)) {
        clearTimeout(timersRef.current[taskId])
        delete timersRef.current[taskId]
        delete delaysRef.current[taskId]
      }
    })

    activeSyncPipelines.forEach((pipeline) => {
      const taskId = pipeline.taskId!
      if (timersRef.current[taskId]) {
        return
      }

      if (!delaysRef.current[taskId]) {
        delaysRef.current[taskId] = 2000
      }

      const poll = async () => {
        try {
          const response = await apiClient.get(`/api/v1/pipelines/tasks/${taskId}`)
          const { status, result, error } = response.data

          if (status === 'SUCCESS') {
            const recordsSynced = Number(result?.records_synced ?? 0)
            updatePipeline(pipeline.id, {
              status: 'active',
              recordsSynced,
              lastSync: 'Just now',
              taskId: undefined
            })
            onSuccess(pipeline, recordsSynced)
          } else if (status === 'FAILURE' || status === 'REVOKED') {
            updatePipeline(pipeline.id, {
              status: 'failed',
              taskId: undefined
            })
            onFailure(pipeline, error || `Celery task status: ${status}`)
          } else {
            const currentDelay = delaysRef.current[taskId] || 2000
            const nextDelay = Math.min(currentDelay * 1.5, 30000)
            delaysRef.current[taskId] = nextDelay
            timersRef.current[taskId] = setTimeout(poll, nextDelay) as unknown as number
          }
        } catch (err) {
          updatePipeline(pipeline.id, {
            status: 'failed',
            taskId: undefined
          })
          onFailure(pipeline, err instanceof Error ? err.message : 'Unknown task error')
        }
      }

      timersRef.current[taskId] = setTimeout(poll, delaysRef.current[taskId]) as unknown as number
    })

    const timers = timersRef.current
    return () => {
      Object.values(timers).forEach((timer) => clearTimeout(timer))
    }
  }, [pipelines, updatePipeline, onSuccess, onFailure])
}
