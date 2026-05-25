import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, ShieldAlert } from 'lucide-react'
import type { Destination } from '@/types'

const destinationSchema = z.object({
  name: z.string().min(2, 'Destination name must be at least 2 characters'),
  targetDbDialect: z.enum(['postgresql', 'mysql'] as const),
  targetDbHost: z.string().min(1, 'Database host is required'),
  targetDbPort: z.coerce.number().int().min(1).max(65535, 'Port must be between 1 and 65535'),
  targetDbName: z.string().min(1, 'Database name is required'),
  targetDbUser: z.string().min(1, 'Database username is required'),
  targetDbPassword: z.string().min(1, 'Database password is required'),
  enableSshBastion: z.boolean().default(false),
})

type DestinationFormData = z.infer<typeof destinationSchema>

interface CreateDestinationFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmitDestination: (destinationData: Omit<Destination, 'id'>) => void
}

export const CreateDestinationForm: React.FC<CreateDestinationFormProps> = ({
  isOpen,
  onClose,
  onSubmitDestination
}) => {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
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

  useEffect(() => {
    if (watchDialect === 'mysql') {
      setValue('targetDbPort', 3306)
    } else {
      setValue('targetDbPort', 5432)
    }
  }, [watchDialect, setValue])

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
      name: data.name,
      targetDbDialect: data.targetDbDialect,
      targetDbHost: data.targetDbHost,
      targetDbPort: data.targetDbPort,
      targetDbName: data.targetDbName,
      targetDbUser: data.targetDbUser,
      targetDbPassword: data.targetDbPassword,
      enableSshBastion: data.enableSshBastion
    })
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
              <h2 className="text-sm font-semibold tracking-tight text-text-primary uppercase">Create Destination</h2>
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
              Target SQL Dialect
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['postgresql', 'mysql'] as const).map((dialect) => (
                <button
                  key={dialect}
                  type="button"
                  onClick={() => setValue('targetDbDialect', dialect, { shouldValidate: true })}
                  className={`py-2 px-3 text-xs border rounded-lg font-semibold capitalize transition-all cursor-pointer ${
                    watchDialect === dialect
                      ? 'bg-panel border-border-secondary text-text-primary'
                      : 'bg-panel-card border-border-primary text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {dialect === 'postgresql' ? 'PostgreSQL' : 'MySQL'}
                </button>
              ))}
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
                className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-border-secondary transition-all font-mono"
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
                className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-border-secondary transition-all font-mono"
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
              Schema / Database Name
            </label>
            <input
              type="text"
              placeholder="e.g. billing_sync"
              {...register('targetDbName')}
              className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-border-secondary transition-all font-mono"
            />
            {errors.targetDbName && (
              <p className="text-[11px] text-rose-500 mt-1">
                {errors.targetDbName.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                Username
              </label>
              <input
                type="text"
                placeholder="postgres"
                {...register('targetDbUser')}
                className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-border-secondary transition-all font-mono"
              />
              {errors.targetDbUser && (
                <p className="text-[11px] text-rose-500 mt-1">
                  {errors.targetDbUser.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••••••"
                {...register('targetDbPassword')}
                className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-border-secondary transition-all font-mono"
              />
              {errors.targetDbPassword && (
                <p className="text-[11px] text-rose-500 mt-1">
                  {errors.targetDbPassword.message}
                </p>
              )}
            </div>
          </div>

          <div className="p-4 bg-panel-card border border-border-primary rounded-xl flex items-center justify-between">
            <div className="space-y-0.5 pr-4">
              <label className="text-xs font-semibold text-text-primary tracking-tight">Enable SSH Bastion Tunnel</label>
              <p className="text-[10px] text-text-muted leading-relaxed">
                Proxy database connections through an isolated security jump server.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setValue('enableSshBastion', !watch('enableSshBastion'))}
              className={`h-5 w-9 shrink-0 rounded-full transition-colors relative cursor-pointer ${
                watch('enableSshBastion') ? 'bg-text-primary' : 'bg-border-primary'
              }`}
            >
              <span className={`h-4.5 w-4.5 rounded-full bg-background absolute top-0.25 transition-all ${
                watch('enableSshBastion') ? 'right-0.25' : 'left-0.25'
              }`} />
            </button>
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
            Save Destination
          </button>
        </div>
      </div>
    </>
  )
}
export default CreateDestinationForm
