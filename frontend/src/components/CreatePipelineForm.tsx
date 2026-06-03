import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, ArrowRight, ArrowLeft, Check, ShieldAlert, Globe, Database } from 'lucide-react'
import type { Pipeline, Source, Destination } from '@/types'

const connectionSchema = z.object({
  name: z.string().min(2, 'Connection name must be at least 2 characters'),
  sourceId: z.string().min(1, 'Please select a data source'),
  destinationId: z.string().min(1, 'Please select a database target'),
  schedule: z.string().min(1, 'Sync schedule is required'),
})

type ConnectionFormData = z.infer<typeof connectionSchema>

interface CreatePipelineFormProps {
  isOpen: boolean
  onClose: () => void
  sources: Source[]
  destinations: Destination[]
  onSubmitPipeline: (pipelineData: Omit<Pipeline, 'id' | 'status' | 'lastSync' | 'recordsSynced' | 'schemaMapping'>) => void
}

export const CreatePipelineForm: React.FC<CreatePipelineFormProps> = ({
  isOpen,
  onClose,
  sources,
  destinations,
  onSubmitPipeline
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors, isValid }
  } = useForm<ConnectionFormData>({
    resolver: zodResolver(connectionSchema) as any,
    defaultValues: {
      schedule: 'manual',
    },
    mode: 'onChange'
  })

  const watchSourceId = watch('sourceId')
  const watchDestinationId = watch('destinationId')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleNextStep = async () => {
    if (step === 1) {
      const isStep1Valid = await trigger('sourceId')
      if (isStep1Valid) {
        setStep(2)
      }
    } else if (step === 2) {
      const isStep2Valid = await trigger('destinationId')
      if (isStep2Valid) {
        setStep(3)
      }
    }
  }

  const handlePrevStep = () => {
    if (step === 2) {
      setStep(1)
    } else if (step === 3) {
      setStep(2)
    }
  }

  const onFormSubmit = (data: ConnectionFormData) => {
    const selectedSource = sources.find(s => s.id === data.sourceId)
    const selectedDest = destinations.find(d => d.id === data.destinationId)

    if (selectedSource && selectedDest) {
      onSubmitPipeline({
        name: data.name,
        sourceId: data.sourceId,
        destinationId: data.destinationId,
        schedule: data.schedule,
        sourceUrl: selectedSource.sourceUrl,
        sourceAuthType: selectedSource.sourceAuthType,
        sourceToken: selectedSource.sourceToken,
        sourceHeaders: selectedSource.sourceHeaders,
        targetDbDialect: selectedDest.targetDbDialect,
        targetDbHost: selectedDest.targetDbHost,
        targetDbPort: selectedDest.targetDbPort,
        targetDbName: selectedDest.targetDbName,
        targetDbUser: selectedDest.targetDbUser,
        targetDbPassword: selectedDest.targetDbPassword,
        enableSshBastion: selectedDest.enableSshBastion
      })
      setStep(1)
      onClose()
    }
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
              <h2 className="text-sm font-semibold tracking-tight text-text-primary uppercase">Establish Connection</h2>
              <p className="text-xs text-text-muted">Link a data source to a target database.</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-panel border border-transparent hover:border-border-primary text-text-secondary hover:text-text-primary transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-4 mt-6">
            <div className={`flex-1 pb-2 border-b-2 text-xs font-semibold ${step === 1 ? 'border-text-primary text-text-primary' : 'border-border-primary text-text-muted'}`}>
              [1] Select Source
            </div>
            <div className={`flex-1 pb-2 border-b-2 text-xs font-semibold ${step === 2 ? 'border-text-primary text-text-primary' : 'border-border-primary text-text-muted'}`}>
              [2] Select Target
            </div>
            <div className={`flex-1 pb-2 border-b-2 text-xs font-semibold ${step === 3 ? 'border-text-primary text-text-primary' : 'border-border-primary text-text-muted'}`}>
              [3] Sync Settings
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onFormSubmit)} className="flex-1 overflow-y-auto p-6 space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide block">
                Choose Data Source
              </label>

              {sources.length === 0 ? (
                <div className="text-center p-8 bg-panel border border-dashed border-border-primary rounded-xl space-y-3">
                  <Globe className="h-8 w-8 text-text-muted mx-auto" />
                  <p className="text-xs text-text-muted">No registered sources found. Create a source first before building connections.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sources.map((src) => (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => setValue('sourceId', src.id, { shouldValidate: true })}
                      className={`w-full p-4 border rounded-xl flex items-center justify-between text-left transition-all ${
                        watchSourceId === src.id
                          ? 'bg-[#18181B] border-white text-white'
                          : 'bg-panel-card border-border-primary text-text-secondary hover:text-text-primary hover:border-border-secondary'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold uppercase">{src.name}</div>
                        <div className="text-[10px] text-text-muted font-mono truncate max-w-[280px]">{src.sourceUrl}</div>
                      </div>
                      {watchSourceId === src.id && <Check className="h-4 w-4 text-white" />}
                    </button>
                  ))}
                </div>
              )}
              {errors.sourceId && (
                <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {errors.sourceId.message}
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide block">
                Choose Target Database
              </label>

              {destinations.length === 0 ? (
                <div className="text-center p-8 bg-panel border border-dashed border-border-primary rounded-xl space-y-3">
                  <Database className="h-8 w-8 text-text-muted mx-auto" />
                  <p className="text-xs text-text-muted">No registered destinations found. Create a destination first.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {destinations.map((dest) => (
                    <button
                      key={dest.id}
                      type="button"
                      onClick={() => setValue('destinationId', dest.id, { shouldValidate: true })}
                      className={`w-full p-4 border rounded-xl flex items-center justify-between text-left transition-all ${
                        watchDestinationId === dest.id
                          ? 'bg-[#18181B] border-white text-white'
                          : 'bg-panel-card border-border-primary text-text-secondary hover:text-text-primary hover:border-border-secondary'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold uppercase">{dest.name}</div>
                        <div className="text-[10px] text-text-muted font-mono truncate max-w-[280px]">
                          {dest.targetDbDialect}://{dest.targetDbHost}/{dest.targetDbName}
                        </div>
                      </div>
                      {watchDestinationId === dest.id && <Check className="h-4 w-4 text-white" />}
                    </button>
                  ))}
                </div>
              )}
              {errors.destinationId && (
                <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {errors.destinationId.message}
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide block">
                  Connection Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. stripe_to_postgres"
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
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide block">
                  Sync Frequency / Schedule
                </label>
                <select
                  {...register('schedule')}
                  className="w-full bg-panel-card border border-border-primary text-text-primary rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-border-secondary transition-all font-semibold"
                >
                  <option value="manual">Manual Trigger Only</option>
                  <option value="hourly">Every Hour</option>
                  <option value="daily">Every 24 Hours</option>
                </select>
                {errors.schedule && (
                  <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {errors.schedule.message}
                  </p>
                )}
              </div>
            </div>
          )}
        </form>

        <div className="p-6 border-t border-border-primary bg-panel-card/40 flex justify-between gap-3">
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 border border-border-primary hover:border-border-secondary bg-panel hover:bg-text-primary/5 text-text-secondary hover:text-text-primary text-xs font-semibold uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                disabled={!watchSourceId}
                className="flex-1 py-2.5 bg-text-primary text-background text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-accent-hover active:scale-[0.99] disabled:opacity-40 transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Continue</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </>
          ) : step === 2 ? (
            <>
              <button
                type="button"
                onClick={handlePrevStep}
                className="py-2.5 px-4 border border-border-primary hover:border-border-secondary bg-panel hover:bg-text-primary/5 text-text-secondary hover:text-text-primary text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                disabled={!watchDestinationId}
                className="flex-grow py-2.5 bg-text-primary text-background text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-accent-hover active:scale-[0.99] disabled:opacity-40 transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Continue</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handlePrevStep}
                className="py-2.5 px-4 border border-border-primary hover:border-border-secondary bg-panel hover:bg-text-primary/5 text-text-secondary hover:text-text-primary text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>
              <button
                type="submit"
                onClick={handleSubmit(onFormSubmit)}
                disabled={!isValid}
                className="flex-grow py-2.5 bg-text-primary text-background text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-accent-hover active:scale-[0.99] disabled:opacity-40 transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Create Connection</span>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
export default CreatePipelineForm
