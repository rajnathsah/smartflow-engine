import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Plus, Trash2, Globe, Key, ShieldAlert, Loader2 } from 'lucide-react'
import type { Source, PipelineHeader } from '@/types'
import { notify } from '@/lib/notify'
import apiClient from '@/api/client'

interface CreateSourceFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmitSource: (sourceData: Omit<Source, 'id'>) => void
  editingSource?: Source | null
}

export const CreateSourceForm: React.FC<CreateSourceFormProps> = ({
  isOpen,
  onClose,
  onSubmitSource,
  editingSource
}) => {
  const [headers, setHeaders] = useState<PipelineHeader[]>([])
  const [newHeaderKey, setNewHeaderKey] = useState('')
  const [newHeaderValue, setNewHeaderValue] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [hasTestedSuccessfully, setHasTestedSuccessfully] = useState(false)

  // Define schema dynamically to allow empty/masked token on edit
  const sourceSchema = z.object({
    name: z.string().min(2, 'Source name must be at least 2 characters'),
    sourceUrl: z.string().url('Must be a valid HTTP/HTTPS URL'),
    sourceAuthType: z.enum(['none', 'bearer', 'apikey'] as const),
    sourceToken: z.string().optional(),
  }).superRefine((data, ctx) => {
    // Only require token on create, or if token was changed from blank
    if (!editingSource && data.sourceAuthType !== 'none' && (!data.sourceToken || data.sourceToken.trim() === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Authentication token is required when auth type is enabled',
        path: ['sourceToken'],
      })
    }
  })

  type SourceFormData = z.infer<typeof sourceSchema>

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isValid }
  } = useForm<SourceFormData>({
    resolver: zodResolver(sourceSchema) as any,
    defaultValues: {
      sourceAuthType: 'none',
    },
    mode: 'onChange'
  })

  const watchAuthType = watch('sourceAuthType')
  const watchAll = watch()

  // Reset verification state when inputs change
  useEffect(() => {
    setHasTestedSuccessfully(false)
  }, [watchAll.sourceUrl, watchAll.sourceAuthType, watchAll.sourceToken, headers])

  // Sync edit mode details
  useEffect(() => {
    if (isOpen) {
      if (editingSource) {
        reset({
          name: editingSource.name,
          sourceUrl: editingSource.sourceUrl,
          sourceAuthType: editingSource.sourceAuthType,
          sourceToken: editingSource.sourceToken || '',
        })
        setHeaders(editingSource.sourceHeaders || [])
        setHasTestedSuccessfully(true) // editing is verified by default
      } else {
        reset({
          name: '',
          sourceUrl: '',
          sourceAuthType: 'none',
          sourceToken: '',
        })
        setHeaders([])
        setHasTestedSuccessfully(false)
      }
    }
  }, [editingSource, isOpen, reset])

  const handleTestConnection = async () => {
    const payload = {
      sourceUrl: watchAll.sourceUrl,
      sourceAuthType: watchAll.sourceAuthType,
      sourceToken: watchAll.sourceToken === '********' ? '' : watchAll.sourceToken,
      sourceHeaders: headers
    }

    if (!payload.sourceUrl) {
      notify.error('Verification Error', 'Endpoint URL is required to test connection.')
      return
    }

    setIsTesting(true)
    try {
      const endpoint = editingSource 
        ? `/api/v1/connections/${editingSource.id}/test`
        : `/api/v1/connections/test-dry-run`
      
      const res = await apiClient.post(endpoint, payload)
      if (res.data.success) {
        notify.success('Connection successful!', res.data.message || 'REST API source verified.')
        setHasTestedSuccessfully(true)
      } else {
        notify.error('Connection Failed', res.data.message || 'Test connection failed.')
        setHasTestedSuccessfully(false)
      }
    } catch (err: any) {
      notify.error('Test Failed', err.response?.data?.detail || 'Unreachable API host.')
      setHasTestedSuccessfully(false)
    } finally {
      setIsTesting(false)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleAddHeader = () => {
    const trimmedKey = newHeaderKey.trim()
    const trimmedVal = newHeaderValue.trim()
    if (trimmedKey && trimmedVal) {
      setHeaders([...headers, { key: trimmedKey, value: trimmedVal }])
      setNewHeaderKey('')
      setNewHeaderValue('')
    }
  }

  const handleRemoveHeader = (idx: number) => {
    setHeaders(headers.filter((_, i) => i !== idx))
  }

  const onFormSubmit = (data: SourceFormData) => {
    onSubmitSource({
      name: data.name.trim(),
      sourceUrl: data.sourceUrl.trim(),
      sourceAuthType: data.sourceAuthType,
      sourceToken: data.sourceToken ? (data.sourceToken === '********' ? '' : data.sourceToken.trim()) : undefined,
      sourceHeaders: headers.map(h => ({ key: h.key.trim(), value: h.value.trim() }))
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity duration-300 animate-fadeIn"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-background border-l border-border-primary z-50 shadow-2xl flex flex-col justify-between transform transition-transform duration-300 font-sans animate-slideLeft">
        <div className="p-6 border-b border-border-primary">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold tracking-tight text-text-primary uppercase">
                {editingSource ? 'Edit Data Source' : 'Create Data Source'}
              </h2>
              <p className="text-xs text-text-muted">Register a standalone REST API connector.</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-panel border border-transparent hover:border-border-primary text-text-secondary hover:text-text-primary transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit(onFormSubmit)} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              Source Name
            </label>
            <input
              type="text"
              placeholder="e.g. billing_api"
              {...register('name')}
              className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted text-sm rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-transparent transition-all font-sans"
            />
            {errors.name && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              REST API Endpoint URL
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted">
                <Globe className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="https://api.stripe.com/v1/charges"
                {...register('sourceUrl')}
                className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted text-sm rounded-lg pl-9 pr-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-transparent transition-all font-mono"
              />
            </div>
            {errors.sourceUrl && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {errors.sourceUrl.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              Authentication Strategy
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['none', 'bearer', 'apikey'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setValue('sourceAuthType', type, { shouldValidate: true })}
                  className={`py-2 px-3 text-xs border rounded-lg font-medium capitalize transition-all cursor-pointer ${
                    watchAuthType === type
                      ? 'bg-panel border-white/40 text-white font-bold'
                      : 'bg-panel-card border-border-primary text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {type === 'none' ? 'None' : type === 'bearer' ? 'Bearer' : 'API Key'}
                </button>
              ))}
            </div>
          </div>

          {watchAuthType !== 'none' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                {watchAuthType === 'bearer' ? 'Bearer Token' : 'API Key Token'}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted">
                  <Key className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  placeholder={editingSource ? '(Leave blank to keep existing)' : 'Secret Token Value'}
                  {...register('sourceToken')}
                  className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted text-sm rounded-lg pl-9 pr-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-transparent transition-all"
                />
              </div>
              {errors.sourceToken && (
                <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {errors.sourceToken.message}
                </p>
              )}
            </div>
          )}

          <div className="space-y-3 pt-2 border-t border-border-primary">
            <div>
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Custom Query Headers</h3>
              <p className="text-[11px] text-text-muted">Inject static headers like Content-Type or Client-ID.</p>
            </div>

            <div className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="Key"
                value={newHeaderKey}
                onChange={(e) => setNewHeaderKey(e.target.value)}
                className="flex-1 bg-panel-card border border-border-primary text-text-primary placeholder-text-muted text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:border-border-secondary transition-all font-mono"
              />
              <input
                type="text"
                placeholder="Value"
                value={newHeaderValue}
                onChange={(e) => setNewHeaderValue(e.target.value)}
                className="flex-1 bg-panel-card border border-border-primary text-text-primary placeholder-text-muted text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:border-border-secondary transition-all font-mono"
              />
              <button
                type="button"
                onClick={handleAddHeader}
                className="p-2 bg-panel border border-border-primary hover:border-border-secondary text-text-secondary hover:text-text-primary rounded-lg transition-all cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {headers.length > 0 && (
              <div className="bg-panel-card border border-border-primary rounded-lg divide-y divide-border-primary overflow-hidden font-mono text-[11px]">
                {headers.map((h, idx) => (
                  <div key={idx} className="flex justify-between items-center px-3 py-2">
                    <span className="text-text-secondary truncate pr-2 font-medium">{h.key}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-text-muted truncate max-w-[120px]">{h.value}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveHeader(idx)}
                        className="text-text-muted hover:text-rose-500 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        <div className="p-6 border-t border-border-primary bg-panel-card/40 flex justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-border-primary hover:border-border-secondary bg-panel hover:bg-text-primary/5 text-text-secondary hover:text-text-primary text-xs font-semibold uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center"
          >
            Cancel
          </button>
          {/* Test Connection Button (ghost/outline distinct styled) */}
          <button
            type="button"
            disabled={!watchAll.sourceUrl || isTesting}
            onClick={handleTestConnection}
            className="flex-1 py-2.5 border border-dashed border-white/20 hover:border-white/40 bg-transparent text-gray-300 hover:text-white text-xs font-semibold uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isTesting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Testing...</span>
              </>
            ) : (
              <span>Test Connection</span>
            )}
          </button>
          {/* Primary Save Button (Disabled until test is successful) */}
          <button
            type="submit"
            disabled={!isValid || isTesting || !hasTestedSuccessfully}
            onClick={handleSubmit(onFormSubmit)}
            className="px-4 py-2.5 bg-text-primary text-background text-xs font-bold uppercase tracking-wider rounded-lg hover:opacity-90 transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
            title={!hasTestedSuccessfully ? 'Please test the connection successfully before saving.' : undefined}
          >
            {editingSource ? 'Save Changes' : 'Save Source'}
          </button>
        </div>
      </div>
    </>
  )
}
export default CreateSourceForm
