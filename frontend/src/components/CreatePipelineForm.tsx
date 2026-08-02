import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  X,
  ArrowRight,
  ArrowLeft,
  Check,
  ShieldAlert,
  Globe,
  Database,
  GitMerge,
  Plus,
  Trash2,
  ChevronDown,
  ArrowRightLeft,
  Zap
} from 'lucide-react'
import type { Pipeline, Source, Destination, FieldMapping, SchemaMappingConfig, FieldDataType, FieldTransformation } from '@/types'

// ─── Zod schema ──────────────────────────────────────────────────────────────

const connectionSchema = z.object({
  name: z.string().min(2, 'Pipeline name must be at least 2 characters'),
  sourceId: z.string().min(1, 'Please select a data source'),
  destinationId: z.string().min(1, 'Please select a database target'),
  schedule: z.string().min(1, 'Sync schedule is required'),
})

type ConnectionFormData = z.infer<typeof connectionSchema>

// ─── Constants ────────────────────────────────────────────────────────────────

const DATA_TYPES: { value: FieldDataType; label: string }[] = [
  { value: 'string',    label: 'String'    },
  { value: 'integer',   label: 'Integer'   },
  { value: 'float',     label: 'Float'     },
  { value: 'boolean',   label: 'Boolean'   },
  { value: 'timestamp', label: 'Timestamp' },
  { value: 'json',      label: 'JSON'      },
]

const TRANSFORMATIONS: { value: FieldTransformation; label: string; description: string }[] = [
  { value: 'none',      label: 'None',      description: 'Pass value through unchanged'           },
  { value: 'uppercase', label: 'Uppercase', description: 'Convert text to UPPER CASE'             },
  { value: 'lowercase', label: 'Lowercase', description: 'Convert text to lower case'             },
  { value: 'trim',      label: 'Trim',      description: 'Strip leading & trailing whitespace'    },
  { value: 'cast',      label: 'Cast',      description: 'Cast value to the selected data type'   },
]

// ─── Field Mapping Row ────────────────────────────────────────────────────────

interface FieldMappingRowProps {
  index: number
  mapping: FieldMapping
  onChange: (index: number, updated: FieldMapping) => void
  onRemove: (index: number) => void
}

const FieldMappingRow: React.FC<FieldMappingRowProps> = ({ index, mapping, onChange, onRemove }) => {
  const baseInput = 'w-full bg-background border border-border-primary text-text-primary placeholder-text-muted text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:border-border-secondary transition-all font-mono'
  const baseSelect = 'w-full bg-background border border-border-primary text-text-primary text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:border-border-secondary transition-all appearance-none cursor-pointer'

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center p-3 bg-panel border border-border-primary rounded-xl group hover:border-border-secondary transition-all">
      {/* Source field */}
      <div className="space-y-1">
        <span className="text-[9px] font-semibold text-text-muted uppercase tracking-wider">Source Field</span>
        <input
          type="text"
          placeholder="e.g. user_id"
          value={mapping.source_field}
          onChange={e => onChange(index, { ...mapping, source_field: e.target.value })}
          className={baseInput}
        />
      </div>

      {/* Arrow divider */}
      <div className="flex flex-col items-center gap-1 pt-4">
        <ArrowRightLeft className="h-3 w-3 text-text-muted" />
      </div>

      {/* Target field */}
      <div className="space-y-1">
        <span className="text-[9px] font-semibold text-text-muted uppercase tracking-wider">Target Field</span>
        <input
          type="text"
          placeholder="e.g. contact_email"
          value={mapping.target_field}
          onChange={e => onChange(index, { ...mapping, target_field: e.target.value })}
          className={baseInput}
        />
      </div>

      {/* Data type + transformation (full width, below) */}
      <div className="col-span-3 grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-[9px] font-semibold text-text-muted uppercase tracking-wider">Data Type</span>
          <div className="relative">
            <select
              value={mapping.data_type}
              onChange={e => onChange(index, { ...mapping, data_type: e.target.value as FieldDataType })}
              className={baseSelect}
            >
              {DATA_TYPES.map(dt => (
                <option key={dt.value} value={dt.value} className="bg-panel-card">{dt.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-text-muted pointer-events-none" />
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-[9px] font-semibold text-text-muted uppercase tracking-wider">Transformation</span>
          <div className="relative">
            <select
              value={mapping.transformation}
              onChange={e => onChange(index, { ...mapping, transformation: e.target.value as FieldTransformation })}
              className={baseSelect}
            >
              {TRANSFORMATIONS.map(t => (
                <option key={t.value} value={t.value} className="bg-panel-card">{t.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-text-muted pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Remove button */}
      <div className="col-span-3 flex justify-end">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="flex items-center gap-1 text-[10px] text-text-muted hover:text-rose-400 transition-colors cursor-pointer"
        >
          <Trash2 className="h-3 w-3" />
          Remove
        </button>
      </div>
    </div>
  )
}

// ─── Schema Mapping Step ──────────────────────────────────────────────────────

interface SchemaMappingStepProps {
  mappings: FieldMapping[]
  onChange: (mappings: FieldMapping[]) => void
}

const SchemaMappingStep: React.FC<SchemaMappingStepProps> = ({ mappings, onChange }) => {
  const addRow = () => {
    onChange([
      ...mappings,
      { source_field: '', target_field: '', data_type: 'string', transformation: 'none' }
    ])
  }

  const updateRow = (index: number, updated: FieldMapping) => {
    onChange(mappings.map((m, i) => (i === index ? updated : m)))
  }

  const removeRow = (index: number) => {
    onChange(mappings.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5 p-3.5 bg-panel border border-border-primary rounded-xl">
        <div className="p-1.5 bg-text-primary/10 rounded-lg">
          <Zap className="h-3.5 w-3.5 text-text-primary" />
        </div>
        <div>
          <div className="text-xs font-semibold text-text-primary">Schema Mapping</div>
          <div className="text-[10px] text-text-muted">Define how source fields map to destination columns with optional transformations.</div>
        </div>
      </div>

      {/* Mapping rows */}
      {mappings.length === 0 ? (
        <div className="text-center p-8 bg-panel border border-dashed border-border-primary rounded-xl space-y-3">
          <GitMerge className="h-8 w-8 text-text-muted mx-auto" />
          <p className="text-xs text-text-muted">
            No field mappings defined. Add mappings below or skip to use defaults.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
          {mappings.map((m, i) => (
            <FieldMappingRow
              key={i}
              index={i}
              mapping={m}
              onChange={updateRow}
              onRemove={removeRow}
            />
          ))}
        </div>
      )}

      {/* Add row button */}
      <button
        type="button"
        onClick={addRow}
        className="w-full py-2.5 border border-dashed border-border-primary hover:border-border-secondary text-text-muted hover:text-text-primary text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Field Mapping
      </button>

      {/* Live preview */}
      {mappings.length > 0 && (
        <div className="p-3 bg-panel border border-border-primary rounded-xl space-y-1.5">
          <span className="text-[9px] font-semibold text-text-muted uppercase tracking-wider">Config Preview</span>
          <pre className="text-[10px] font-mono text-text-secondary overflow-x-auto leading-relaxed">
            {JSON.stringify({ mappings }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

// ─── Main Form ────────────────────────────────────────────────────────────────

interface CreatePipelineFormProps {
  isOpen: boolean
  onClose: () => void
  sources: Source[]
  destinations: Destination[]
  onSubmitPipeline: (pipelineData: Omit<Pipeline, 'id' | 'status' | 'lastSync' | 'recordsSynced'>) => void
}

export const CreatePipelineForm: React.FC<CreatePipelineFormProps> = ({
  isOpen,
  onClose,
  sources,
  destinations,
  onSubmitPipeline
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    reset,
    formState: { errors, isValid }
  } = useForm<ConnectionFormData>({
    resolver: zodResolver(connectionSchema) as any,
    defaultValues: {
      schedule: 'manual',
    },
    mode: 'onChange'
  })

  const watchSourceId      = watch('sourceId')
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

  // Reset state when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setStep(1)
      setFieldMappings([])
      reset()
    }
  }, [isOpen, reset])

  const handleNextStep = async () => {
    if (step === 1) {
      const ok = await trigger('sourceId')
      if (ok) setStep(2)
    } else if (step === 2) {
      const ok = await trigger('destinationId')
      if (ok) setStep(3)
    } else if (step === 3) {
      const ok = await trigger(['name', 'schedule'])
      if (ok) setStep(4)
    }
  }

  const handlePrevStep = () => {
    if (step === 2) setStep(1)
    else if (step === 3) setStep(2)
    else if (step === 4) setStep(3)
  }

  const onFormSubmit = (data: ConnectionFormData) => {
    const selectedSource = sources.find(s => s.id === data.sourceId)
    const selectedDest   = destinations.find(d => d.id === data.destinationId)

    if (selectedSource && selectedDest) {
      const schemaMapping: SchemaMappingConfig | null =
        fieldMappings.length > 0 ? { mappings: fieldMappings } : null

      onSubmitPipeline({
        name:                 data.name.trim(),
        sourceId:             data.sourceId,
        destinationId:        data.destinationId,
        schedule:             data.schedule,
        sourceUrl:            selectedSource.sourceUrl,
        sourceAuthType:       selectedSource.sourceAuthType,
        sourceToken:          selectedSource.sourceToken,
        sourceHeaders:        selectedSource.sourceHeaders,
        targetDbDialect:      selectedDest.targetDbDialect,
        targetDbHost:         selectedDest.targetDbHost,
        targetDbPort:         selectedDest.targetDbPort,
        targetDbName:         selectedDest.targetDbName,
        targetDbUser:         selectedDest.targetDbUser,
        targetDbPassword:     selectedDest.targetDbPassword,
        enableSshBastion:     selectedDest.enableSshBastion,
        schemaMapping,
      })
      onClose()
    }
  }

  if (!isOpen) return null

  const STEPS = [
    { n: 1, label: 'Source'    },
    { n: 2, label: 'Target'    },
    { n: 3, label: 'Settings'  },
    { n: 4, label: 'Mapping'   },
  ]

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity duration-300"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-background border-l border-border-primary z-50 shadow-2xl flex flex-col justify-between transform transition-transform duration-300 font-sans">
        {/* ── Header ── */}
        <div className="p-6 border-b border-border-primary">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold tracking-tight text-text-primary uppercase">Establish Pipeline</h2>
              <p className="text-xs text-text-muted">Link a data source to a target database.</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-panel border border-transparent hover:border-border-primary text-text-secondary hover:text-text-primary transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-2 mt-6">
            {STEPS.map(({ n, label }) => (
              <div
                key={n}
                className={`flex-1 pb-2 border-b-2 text-[10px] font-semibold transition-all ${
                  step === n
                    ? 'border-text-primary text-text-primary'
                    : step > n
                    ? 'border-emerald-500/50 text-emerald-500/80'
                    : 'border-border-primary text-text-muted'
                }`}
              >
                [{n}] {label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <form onSubmit={handleSubmit(onFormSubmit)} className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Step 1 – Source */}
          {step === 1 && (
            <div className="space-y-4">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide block">
                Choose Data Source
              </label>
              {sources.length === 0 ? (
                <div className="text-center p-8 bg-panel border border-dashed border-border-primary rounded-xl space-y-3">
                  <Globe className="h-8 w-8 text-text-muted mx-auto" />
                  <p className="text-xs text-text-muted">No registered sources found. Create a source first before building pipelines.</p>
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

          {/* Step 2 – Target */}
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

          {/* Step 3 – Settings */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide block">
                  Pipeline Name
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

          {/* Step 4 – Schema Mapping */}
          {step === 4 && (
            <SchemaMappingStep
              mappings={fieldMappings}
              onChange={setFieldMappings}
            />
          )}
        </form>

        {/* ── Footer ── */}
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
          ) : step === 3 ? (
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
                disabled={!isValid}
                className="flex-grow py-2.5 bg-text-primary text-background text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-accent-hover active:scale-[0.99] disabled:opacity-40 transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Next: Mapping</span>
                <GitMerge className="h-3.5 w-3.5" />
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
                type="button"
                onClick={handleSubmit(onFormSubmit)}
                className="flex-grow py-2.5 bg-text-primary text-background text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-accent-hover active:scale-[0.99] transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                <span>
                  {fieldMappings.length > 0
                    ? `Create Pipeline (${fieldMappings.length} mapping${fieldMappings.length !== 1 ? 's' : ''})`
                    : 'Create Pipeline'}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default CreatePipelineForm
