import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ShieldAlert, Key, Lock, Check } from 'lucide-react'

// Define conditional validation schema using Zod
const targetSchema = z.object({
  targetDb: z.enum(['postgresql', 'mysql'] as const),
  host: z.string().min(1, 'Database server host is required'),
  database: z.string().min(1, 'Target database name is required'),
  port: z.coerce.number().int().min(1).max(65535, 'Port must be between 1 and 65535'),
  username: z.string().min(1, 'Database username is required'),
  password: z.string().min(1, 'Database password is required'),
  sshEnabled: z.boolean().default(false),
  bastionHost: z.string().optional(),
  bastionUser: z.string().optional(),
  pemKeyName: z.string().optional(),
  pemKeyContent: z.string().optional(),
}).superRefine((data, ctx) => {
  // If SSH bastion tunnel is enabled, make bastion parameters and PEM keys mandatory
  if (data.sshEnabled) {
    if (!data.bastionHost || data.bastionHost.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Bastion gateway host is required when SSH is enabled',
        path: ['bastionHost']
      })
    }
    if (!data.bastionUser || data.bastionUser.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SSH tunnel username is required when SSH is enabled',
        path: ['bastionUser']
      })
    }
    if (!data.pemKeyName || data.pemKeyName.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A private PEM key file is required to authenticate SSH bastion',
        path: ['pemKeyName']
      })
    }
    if (!data.pemKeyContent || data.pemKeyContent.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PEM key content is empty or invalid',
        path: ['pemKeyContent']
      })
    }
  }
})

type TargetFormData = z.infer<typeof targetSchema>

interface TargetConfigFormProps {
  onSubmitTargetConfig?: (values: TargetFormData) => void
}

export const TargetConfigForm: React.FC<TargetConfigFormProps> = ({
  onSubmitTargetConfig
}) => {
  const [dragActive, setDragActive] = useState(false)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors }
  } = useForm<TargetFormData>({
    resolver: zodResolver(targetSchema) as any,
    defaultValues: {
      targetDb: 'postgresql',
      host: '',
      database: '',
      port: 5432,
      username: '',
      password: '',
      sshEnabled: false,
      bastionHost: '',
      bastionUser: '',
      pemKeyName: '',
      pemKeyContent: '',
    },
    mode: 'onChange'
  })

  const watchSshEnabled = watch('sshEnabled')
  const watchPemKeyName = watch('pemKeyName')
  const watchTargetDb = watch('targetDb')

  useEffect(() => {
    setValue('port', watchTargetDb === 'mysql' ? 3306 : 5432, { shouldValidate: true })
  }, [setValue, watchTargetDb])

  // Drag and drop events handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (file.name.endsWith('.pem') || file.name.endsWith('.key')) {
        setValue('pemKeyName', file.name, { shouldValidate: true })
        
        const reader = new FileReader()
        reader.onload = (event) => {
          const content = event.target?.result as string
          setValue('pemKeyContent', content || '', { shouldValidate: true })
        }
        reader.onerror = () => {
          alert('Error reading key file contents.')
        }
        reader.readAsText(file)
      } else {
        alert('Security warning: Only .pem or .key extension private key formats are supported.')
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.name.endsWith('.pem') || file.name.endsWith('.key')) {
        setValue('pemKeyName', file.name, { shouldValidate: true })

        const reader = new FileReader()
        reader.onload = (event) => {
          const content = event.target?.result as string
          setValue('pemKeyContent', content || '', { shouldValidate: true })
        }
        reader.onerror = () => {
          alert('Error reading key file contents.')
        }
        reader.readAsText(file)
      } else {
        alert('Security warning: Only .pem or .key extension private key formats are supported.')
      }
    }
  }

  const onFormSubmit = (data: TargetFormData) => {
    console.log('Form Data Submitted:', data)

    const payload: TargetFormData = {
      targetDb: data.targetDb,
      host: data.host.trim(),
      database: data.database.trim(),
      port: Number(data.port) || (data.targetDb === 'mysql' ? 3306 : 5432),
      username: data.username.trim(),
      password: data.password,
      sshEnabled: data.sshEnabled,
      bastionHost: data.bastionHost?.trim() || '',
      bastionUser: data.bastionUser?.trim() || '',
      pemKeyName: data.pemKeyName?.trim() || '',
      pemKeyContent: data.pemKeyContent || '',
    }

    console.log(payload)
    onSubmitTargetConfig?.(payload)
    setSuccess(true)
    setTimeout(() => {
      reset()
      setSuccess(false)
    }, 3000)
  }

  return (
    <div className="bg-panel border border-border-primary rounded-xl p-6 max-w-2xl mx-auto space-y-6 font-sans text-text-primary">
      
      {/* Header title */}
      <div className="border-b border-border-primary pb-4">
        <h3 className="text-sm font-semibold tracking-tight uppercase">Target Database Provisioning</h3>
        <p className="text-xs text-text-muted mt-1">Configure destination database credentials and optional SSH jump host credentials.</p>
      </div>

      {success && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-500 shrink-0" />
          <span>Database configuration saved successfully. Check console log payload.</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
        <input type="hidden" {...register('targetDb', { required: true })} />

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
            Target SQL Dialect
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(['postgresql', 'mysql'] as const).map((dialect) => (
              <button
                key={dialect}
                type="button"
                onClick={() => setValue('targetDb', dialect, {
                  shouldValidate: true,
                  shouldDirty: true,
                  shouldTouch: true
                })}
                className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
                  watchTargetDb === dialect
                    ? 'border-border-primary bg-text-primary text-background'
                    : 'border-border-primary bg-panel text-text-secondary hover:border-border-secondary'
                }`}
              >
                {dialect === 'postgresql' ? 'PostgreSQL' : 'MySQL'}
              </button>
            ))}
          </div>
        </div>
        
        {/* Host & Port */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
              Database Host / Address
            </label>
            <input
              type="text"
              placeholder="database-replica.cluster.rds.amazonaws.com"
              autoComplete="off"
              {...register('host', { required: true })}
              className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-border-secondary focus:border-border-secondary transition-all font-mono"
            />
            {errors.host && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {errors.host.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
              Dial Port
            </label>
            <input
              type="number"
              placeholder="5432"
              {...register('port')}
              className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-border-secondary focus:border-border-secondary transition-all font-mono"
            />
            {errors.port && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {errors.port.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
            Target Database Name
          </label>
          <input
            type="text"
            placeholder="smartflow_target"
            autoComplete="off"
            {...register('database', { required: true })}
            className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-border-secondary focus:border-border-secondary transition-all font-mono"
          />
          {errors.database && (
            <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {errors.database.message}
            </p>
          )}
        </div>

        {/* Username & Password */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
              DB Username
            </label>
            <input
              type="text"
              placeholder="sync_operator"
              autoComplete="username"
              {...register('username', { required: true })}
              className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-border-secondary focus:border-border-secondary transition-all font-mono"
            />
            {errors.username && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {errors.username.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
              DB Password
            </label>
            <input
              type="password"
              placeholder="••••••••••••"
              {...register('password', { required: true })}
              className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-border-secondary focus:border-border-secondary transition-all font-mono"
            />
            {errors.password && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {errors.password.message}
              </p>
            )}
          </div>
        </div>

        {/* SSH Custom Switch Toggle */}
        <div className="p-4 bg-panel-card border border-border-primary rounded-xl flex items-center justify-between transition-colors">
          <div className="space-y-0.5 pr-4">
            <label className="text-xs font-semibold text-text-primary tracking-tight">Enable SSH Bastion Tunnel Proxy</label>
            <p className="text-[10px] text-text-muted leading-relaxed">
              Connect to databases hidden behind private VPC subnets proxying via a secure SSH bastion host.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setValue('sshEnabled', !watchSshEnabled, { shouldValidate: true })}
            className={`h-5 w-10 shrink-0 rounded-full transition-all relative cursor-pointer flex items-center ${
              watchSshEnabled ? 'bg-text-primary' : 'bg-border-primary'
            }`}
          >
            <span className={`h-4.5 w-4.5 rounded-full bg-background absolute top-0.25 transition-all ${
              watchSshEnabled ? 'left-5' : 'left-0.5'
            }`} />
          </button>
        </div>

        {/* Animated SSH Section details */}
        {watchSshEnabled && (
          <div className="space-y-4 pt-4 border-t border-border-primary animate-in slide-in-from-top-2 fade-in duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                  Bastion Tunnel Host
                </label>
                <input
                  type="text"
                  placeholder="bastion.vpc.company.com"
                  {...register('bastionHost')}
                  className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-border-secondary font-mono"
                />
                {errors.bastionHost && (
                  <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {errors.bastionHost.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                  Bastion SSH User
                </label>
                <input
                  type="text"
                  placeholder="ubuntu"
                  {...register('bastionUser')}
                  className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-border-secondary font-mono"
                />
                {errors.bastionUser && (
                  <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {errors.bastionUser.message}
                  </p>
                )}
              </div>

            </div>

            {/* Custom file upload PEM Key dropzone */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                Bastion Private Auth PEM Key
              </label>
              
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border border-dashed rounded-lg p-6 text-center transition-all relative ${
                  dragActive
                    ? 'border-text-secondary bg-panel'
                    : watchPemKeyName
                    ? 'border-border-secondary bg-panel-card'
                    : 'border-border-primary bg-panel-card/30 hover:border-border-secondary'
                }`}
              >
                <input
                  type="file"
                  id="pem-upload"
                  onChange={handleFileChange}
                  accept=".pem,.key"
                  className="hidden"
                />
                
                <label htmlFor="pem-upload" className="cursor-pointer space-y-2 block">
                  <div className="flex justify-center">
                    <div className="h-10 w-10 bg-panel border border-border-primary rounded-full flex items-center justify-center">
                      <Key className="h-5 w-5 text-text-secondary" />
                    </div>
                  </div>
                  
                  {watchPemKeyName ? (
                    <div className="space-y-1">
                      <p className="text-xs text-text-primary font-mono font-medium">{watchPemKeyName}</p>
                      <p className="text-[10px] text-emerald-500 font-semibold uppercase">Key Loaded Successfully</p>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <p className="text-xs text-text-secondary font-medium">
                        Drag and drop your private <span className="font-mono">.pem</span> or <span className="font-mono">.key</span> file here
                      </p>
                      <p className="text-[10px] text-text-muted">or click to browse local files</p>
                    </div>
                  )}
                </label>
              </div>

              {errors.pemKeyName && (
                <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {errors.pemKeyName.message}
                </p>
              )}
              {errors.pemKeyContent && !errors.pemKeyName && (
                <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {errors.pemKeyContent.message}
                </p>
              )}
            </div>

          </div>
        )}

        <button
          type="submit"
          className="w-full py-2.5 bg-text-primary text-background hover:opacity-90 font-medium text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Lock className="h-4 w-4 text-background" />
          Verify & Save Destination Configuration
        </button>

      </form>
    </div>
  )
}
export default TargetConfigForm
