import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Plus, Trash2, Globe, Key, ShieldAlert } from 'lucide-react'
import type { Source, PipelineHeader } from '@/types'

const sourceSchema = z.object({
  name: z.string().min(2, 'Source name must be at least 2 characters'),
  sourceUrl: z.string().url('Must be a valid HTTP/HTTPS URL'),
  sourceAuthType: z.enum(['none', 'bearer', 'apikey'] as const),
  sourceToken: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.sourceAuthType !== 'none' && (!data.sourceToken || data.sourceToken.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Authentication token is required when auth type is enabled',
      path: ['sourceToken'],
    })
  }
})

type SourceFormData = z.infer<typeof sourceSchema>

interface CreateSourceFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmitSource: (sourceData: Omit<Source, 'id'>) => void
}

export const CreateSourceForm: React.FC<CreateSourceFormProps> = ({
  isOpen,
  onClose,
  onSubmitSource
}) => {
  const [headers, setHeaders] = useState<PipelineHeader[]>([])
  const [newHeaderKey, setNewHeaderKey] = useState('')
  const [newHeaderValue, setNewHeaderValue] = useState('')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid }
  } = useForm<SourceFormData>({
    resolver: zodResolver(sourceSchema) as any,
    defaultValues: {
      sourceAuthType: 'none',
    },
    mode: 'onChange'
  })

  const watchAuthType = watch('sourceAuthType')

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
      name: data.name,
      sourceUrl: data.sourceUrl,
      sourceAuthType: data.sourceAuthType,
      sourceToken: data.sourceToken,
      sourceHeaders: headers
    })
    setHeaders([])
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity duration-300"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-background border-l border-border-primary z-50 shadow-2xl flex flex-col justify-between transform transition-transform duration-300 font-sans">
        <div className="p-6 border-b border-border-primary">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold tracking-tight text-text-primary uppercase">Create Data Source</h2>
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
              className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted text-sm rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-border-secondary transition-all"
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
                className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted text-sm rounded-lg pl-9 pr-3.5 py-2.5 focus:outline-none focus:border-border-secondary transition-all font-mono"
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
                      ? 'bg-panel border-border-secondary text-text-primary'
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
                  placeholder="Secret Token Value"
                  {...register('sourceToken')}
                  className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted text-sm rounded-lg pl-9 pr-3.5 py-2.5 focus:outline-none focus:border-border-secondary transition-all"
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
            className="flex-1 py-2.5 border border-border-primary hover:border-border-secondary bg-panel hover:bg-text-primary/5 text-text-secondary hover:text-text-primary text-xs font-semibold uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isValid}
            onClick={handleSubmit(onFormSubmit)}
            className="flex-grow py-2.5 bg-text-primary text-background text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-accent-hover active:scale-[0.99] disabled:opacity-40 transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5"
          >
            Save Source
          </button>
        </div>
      </div>
    </>
  )
}
export default CreateSourceForm
