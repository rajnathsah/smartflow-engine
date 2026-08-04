import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, ShieldAlert, Loader2 } from 'lucide-react'
import type { Destination } from '@/types'
import { notify } from '@/lib/notify'
import apiClient from '@/api/client'

interface CreateDestinationFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmitDestination: (destinationData: Omit<Destination, 'id'>) => void
  editingDestination?: Destination | null
}

export const CreateDestinationForm: React.FC<CreateDestinationFormProps> = ({
  isOpen,
  onClose,
  onSubmitDestination,
  editingDestination
}) => {
  const [isTesting, setIsTesting] = useState(false)
  const [hasTestedSuccessfully, setHasTestedSuccessfully] = useState(false)

  // Define schema dynamically to support empty/masked password on edit
  const destinationSchema = z.object({
    name: z.string().min(2, 'Destination name must be at least 2 characters'),
    targetDbDialect: z.enum(['postgresql', 'mysql', 'redshift', 'snowflake', 'bigquery'] as const),
    targetDbHost: z.string().min(1, 'Database host is required'),
    targetDbPort: z.coerce.number().int().min(1).max(65535, 'Port must be between 1 and 65535'),
    targetDbName: z.string().min(1, 'Database name is required'),
    targetDbUser: z.string().min(1, 'Database username is required'),
    targetDbPassword: z.string().optional(),
    enableSshBastion: z.boolean().default(false),
  }).superRefine((data, ctx) => {
    // Only require password on create or if password was modified
    if (!editingDestination && (!data.targetDbPassword || data.targetDbPassword.trim() === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Database password is required',
        path: ['targetDbPassword'],
      })
    }
  })

  type DestinationFormData = z.infer<typeof destinationSchema>

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isValid }
  } = useForm<DestinationFormData>({
    resolver: zodResolver(destinationSchema) as any,
    defaultValues: {
      targetDbDialect: 'postgresql',
      targetDbPort: 5432,
      enableSshBastion: false,
    },
    mode: 'onChange'
  })

  const watchDialect = watch('targetDbDialect')
  const watchAll = watch()

  // Reset verification state when inputs change
  useEffect(() => {
    setHasTestedSuccessfully(false)
  }, [
    watchAll.targetDbDialect,
    watchAll.targetDbHost,
    watchAll.targetDbPort,
    watchAll.targetDbName,
    watchAll.targetDbUser,
    watchAll.targetDbPassword,
    watchAll.enableSshBastion
  ])

  // Change default port on dialect change (only on create)
  useEffect(() => {
    if (!editingDestination) {
      if (watchDialect === 'mysql') {
        setValue('targetDbPort', 3306)
      } else if (watchDialect === 'redshift') {
        setValue('targetDbPort', 5439)
      } else if (watchDialect === 'snowflake' || watchDialect === 'bigquery') {
        setValue('targetDbPort', 443)
      } else {
        setValue('targetDbPort', 5432)
      }
    }
  }, [watchDialect, setValue, editingDestination])

  // Sync edit mode details
  useEffect(() => {
    if (isOpen) {
      if (editingDestination) {
        reset({
          name: editingDestination.name,
          targetDbDialect: editingDestination.targetDbDialect,
          targetDbHost: editingDestination.targetDbHost,
          targetDbPort: editingDestination.targetDbPort,
          targetDbName: editingDestination.targetDbName,
          targetDbUser: editingDestination.targetDbUser,
          targetDbPassword: editingDestination.targetDbPassword || '',
          enableSshBastion: editingDestination.enableSshBastion,
        })
        setHasTestedSuccessfully(true) // editing is verified by default
      } else {
        reset({
          name: '',
          targetDbDialect: 'postgresql',
          targetDbHost: '',
          targetDbPort: 5432,
          targetDbName: '',
          targetDbUser: '',
          targetDbPassword: '',
          enableSshBastion: false,
        })
        setHasTestedSuccessfully(false)
      }
    }
  }, [editingDestination, isOpen, reset])

  const handleTestConnection = async () => {
    const payload = {
      targetDbDialect: watchAll.targetDbDialect,
      targetDbHost: watchAll.targetDbHost,
      targetDbPort: watchAll.targetDbPort,
      targetDbName: watchAll.targetDbName,
      targetDbUser: watchAll.targetDbUser,
      targetDbPassword: watchAll.targetDbPassword === '********' ? '' : watchAll.targetDbPassword,
      enableSshBastion: watchAll.enableSshBastion
    }

    if (!payload.targetDbHost || !payload.targetDbUser || !payload.targetDbName) {
      notify.error('Verification Error', 'Host, Username, and Database are required to run check.')
      return
    }

    setIsTesting(true)
    try {
      const endpoint = editingDestination 
        ? `/api/v1/connections/${editingDestination.id}/test`
        : `/api/v1/connections/test-dry-run`
      
      const res = await apiClient.post(endpoint, payload)
      if (res.data.success) {
        notify.success('Connection successful!', res.data.message || 'Database connection established.')
        setHasTestedSuccessfully(true)
      } else {
        notify.error('Connection Failed', res.data.message || 'Verification test failed.')
        setHasTestedSuccessfully(false)
      }
    } catch (err: any) {
      notify.error('Test Failed', err.response?.data?.detail || 'Unreachable target database.')
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

  const onFormSubmit = (data: DestinationFormData) => {
    onSubmitDestination({
      name: data.name.trim(),
      targetDbDialect: data.targetDbDialect,
      targetDbHost: data.targetDbHost.trim(),
      targetDbPort: data.targetDbPort,
      targetDbName: data.targetDbName.trim(),
      targetDbUser: data.targetDbUser.trim(),
      targetDbPassword: data.targetDbPassword ? (data.targetDbPassword === '********' ? '' : data.targetDbPassword.trim()) : undefined,
      enableSshBastion: data.enableSshBastion
    })
    onClose()
  }

  if (!isOpen) return null

  const isTestDisabled = !watchAll.targetDbHost || !watchAll.targetDbUser || !watchAll.targetDbName || isTesting

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
                {editingDestination ? 'Edit Destination' : 'Create Destination'}
              </h2>
              <p className="text-xs text-text-muted">Register a standalone database target.</p>
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
              Destination Name
            </label>
            <input
              type="text"
              placeholder="e.g. pg_dw_billing"
              {...register('name')}
              className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted text-sm rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-transparent transition-all"
            />
            {errors.name && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              Target SQL Dialect / Warehouse
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['postgresql', 'mysql', 'redshift', 'snowflake', 'bigquery'] as const).map((dialect) => {
                const label = 
                  dialect === 'postgresql' ? 'PostgreSQL' :
                  dialect === 'mysql' ? 'MySQL' :
                  dialect === 'redshift' ? 'Amazon Redshift' :
                  dialect === 'snowflake' ? 'Snowflake' : 'Google BigQuery'
                return (
                  <button
                    key={dialect}
                    type="button"
                    onClick={() => setValue('targetDbDialect', dialect, { shouldValidate: true })}
                    className={`py-2 px-3 text-xs border rounded-lg font-semibold transition-all cursor-pointer ${
                      watchDialect === dialect
                        ? 'bg-panel border-white/40 text-white font-bold'
                        : 'bg-panel-card border-border-primary text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                Database Host
              </label>
              <input
                type="text"
                placeholder="localhost"
                {...register('targetDbHost')}
                className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-transparent transition-all font-mono"
              />
              {errors.targetDbHost && (
                <p className="text-[11px] text-rose-500 mt-1">
                  {errors.targetDbHost.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                Port
              </label>
              <input
                type="number"
                {...register('targetDbPort')}
                className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-transparent transition-all font-mono"
              />
              {errors.targetDbPort && (
                <p className="text-[11px] text-rose-500 mt-1">
                  {errors.targetDbPort.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              Database Name
            </label>
            <input
              type="text"
              placeholder="e.g. analytics"
              {...register('targetDbName')}
              className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted text-sm rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-transparent transition-all font-mono"
            />
            {errors.targetDbName && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {errors.targetDbName.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              Database Username
            </label>
            <input
              type="text"
              placeholder="e.g. db_admin"
              {...register('targetDbUser')}
              className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted text-sm rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-transparent transition-all font-mono"
            />
            {errors.targetDbUser && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {errors.targetDbUser.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              Database Password
            </label>
            <input
              type="password"
              placeholder={editingDestination ? '(Leave blank to keep existing)' : 'Secret database password'}
              {...register('targetDbPassword')}
              className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted text-sm rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-transparent transition-all"
            />
            {errors.targetDbPassword && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {errors.targetDbPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5 pt-2 border-t border-border-primary">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">SSH Bastion Tunnel</h3>
                <p className="text-[11px] text-text-muted">Proxy database dial tests through a security jump server.</p>
              </div>
              <button
                type="button"
                onClick={() => setValue('enableSshBastion', !watch('enableSshBastion'))}
                className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 focus:outline-none ${
                  watch('enableSshBastion') ? 'bg-white/40' : 'bg-panel-card border border-border-primary'
                }`}
                aria-label="Toggle SSH Bastion"
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                    watch('enableSshBastion') ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
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
            disabled={isTestDisabled}
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
            {editingDestination ? 'Save Changes' : 'Save Destination'}
          </button>
        </div>
      </div>
    </>
  )
}
export default CreateDestinationForm
