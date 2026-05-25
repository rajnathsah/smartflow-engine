import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Check, ShieldAlert } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

// Define validation schema
const roleSchema = z.object({
  roleName: z.string().min(2, 'Role name must be at least 2 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  permissions: z.array(z.string()).min(1, 'Select at least one permission from the matrix'),
})

type RoleFormData = z.infer<typeof roleSchema>

interface PermissionItem {
  id: string
  label: string
  description: string
}

interface PermissionGroup {
  section: string
  items: PermissionItem[]
}

export const RoleBuilder: React.FC = () => {
  const { activeTenant } = useAuthStore()
  const [successPayload, setSuccessPayload] = useState<string | null>(null)

  // Granular Permission Matrix data grouped logically
  const permissionGroups: PermissionGroup[] = [
    {
      section: 'Data Pipelines',
      items: [
        { id: 'pipelines:read', label: 'Read Pipelines', description: 'Authorize viewing active database sync pipelines and query logs.' },
        { id: 'pipelines:write', label: 'Create/Edit Pipelines', description: 'Authorize provisioning new API endpoints and database credentials.' },
        { id: 'pipelines:execute', label: 'Sync Execution', description: 'Authorize triggering manual synchronizations and forcing sync tasks.' }
      ]
    },
    {
      section: 'Secure Connections',
      items: [
        { id: 'connections:verify', label: 'Verify Credentials', description: 'Authorize dial testing REST API inputs and host databases.' },
        { id: 'connections:ssh', label: 'SSH Bastion Access', description: 'Authorize configuring proxies and secure jumpserver tunnels.' }
      ]
    },
    {
      section: 'System Access',
      items: [
        { id: 'users:write', label: 'Manage Teammates', description: 'Authorize inviting administrative accounts and modifying roles.' },
        { id: 'settings:write', label: 'Modify Settings', description: 'Authorize changing global schedules, logging scopes, and dialect settings.' }
      ]
    }
  ]

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors }
  } = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      roleName: '',
      description: '',
      permissions: []
    }
  })

  const watchPermissions = watch('permissions') || []

  const handleCheckboxToggle = (permId: string) => {
    if (watchPermissions.includes(permId)) {
      setValue(
        'permissions',
        watchPermissions.filter((id) => id !== permId),
        { shouldValidate: true }
      )
    } else {
      setValue('permissions', [...watchPermissions, permId], { shouldValidate: true })
    }
  }

  const onRoleSubmit = (data: RoleFormData) => {
    const payload = JSON.stringify(data, null, 2)
    const storageKey = activeTenant ? `synq-custom-roles-${activeTenant}` : 'synq-custom-roles'
    const storedRoles = JSON.parse(localStorage.getItem(storageKey) || '[]')
    const nextRoles = storedRoles.filter((role: RoleFormData) => role.roleName !== data.roleName)
    localStorage.setItem(storageKey, JSON.stringify([...nextRoles, data]))
    console.log('Provisioned Role Details:', data)
    setSuccessPayload(payload)
    
    // Reset form after a brief display delay
    setTimeout(() => {
      reset()
      setSuccessPayload(null)
    }, 4000)
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Page Header */}
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-text-primary">Custom Role Builder</h2>
        <p className="text-sm text-text-muted">Delegate granular read, write, and sync executing authorization scopes.</p>
      </div>

      {successPayload && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl space-y-2 max-w-3xl">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-500" />
            <span className="font-semibold uppercase tracking-wide">Role Provisioned Successfully!</span>
          </div>
          <pre className="p-3 bg-panel-card border border-border-primary rounded-lg text-[10px] font-mono text-text-secondary overflow-x-auto leading-relaxed">
            {successPayload}
          </pre>
        </div>
      )}

      {/* Two Column Form Layout */}
      <form onSubmit={handleSubmit(onRoleSubmit)} className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        
        {/* Left Side: Identifiers Form (2 Cols) */}
        <div className="lg:col-span-2 bg-panel border border-border-primary rounded-xl p-6 space-y-6">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-text-primary">Role Metadata</h3>
            <p className="text-xs text-text-muted">Define the identifier name and workspace description.</p>
          </div>

          <div className="space-y-4">
            {/* Role Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Role Identifier Name</label>
              <input
                type="text"
                placeholder="e.g. Data_Auditor"
                {...register('roleName')}
                className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted text-sm rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-border-secondary transition-all"
              />
              {errors.roleName && (
                <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {errors.roleName.message}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Access Scope Description</label>
              <textarea
                rows={4}
                placeholder="Summarize the sync extraction authorization parameters delegated to this custom role..."
                {...register('description')}
                className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted text-sm rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-border-secondary transition-all leading-relaxed"
              />
              {errors.description && (
                <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {errors.description.message}
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-text-primary text-background font-semibold hover:opacity-90 text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Provision Role Scope
          </button>
        </div>

        {/* Right Side: Matrix list (3 Cols) */}
        <div className="lg:col-span-3 bg-panel border border-border-primary rounded-xl p-6 space-y-6">
          <div className="space-y-1 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Permission Scope Matrix</h3>
              <p className="text-xs text-text-muted">Map resource actions to custom roles.</p>
            </div>
            {errors.permissions && (
              <span className="text-[11px] text-rose-500 font-semibold uppercase tracking-wider flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-md animate-pulse">
                <ShieldAlert className="h-3.5 w-3.5" />
                Error
              </span>
            )}
          </div>

          {/* Matrix items */}
          <div className="space-y-6 max-h-[420px] overflow-y-auto pr-1">
            {permissionGroups.map((group) => (
              <div key={group.section} className="space-y-3">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider block px-1">
                  {group.section}
                </span>
                
                <div className="border border-border-primary rounded-lg overflow-hidden divide-y divide-border-primary bg-panel-card/30">
                  {group.items.map((perm) => {
                    const isChecked = watchPermissions.includes(perm.id)

                    return (
                      <button
                        key={perm.id}
                        type="button"
                        onClick={() => handleCheckboxToggle(perm.id)}
                        className="w-full text-left p-4 hover:bg-panel-card/85 transition-colors flex items-start gap-4 cursor-pointer"
                      >
                        {/* Custom Monochromatic Checkbox */}
                        <div
                          className={`h-5 w-5 rounded-md border shrink-0 flex items-center justify-center transition-all ${
                            isChecked
                              ? 'bg-text-primary border-text-primary'
                              : 'bg-panel-card border-border-primary'
                          }`}
                        >
                          {isChecked && <Check className="h-3.5 w-3.5 text-background font-bold" />}
                        </div>

                        {/* Labels */}
                        <div className="space-y-0.5">
                          <span className="text-xs font-semibold text-text-secondary block">
                            {perm.label}
                          </span>
                          <p className="text-[11px] text-text-muted leading-relaxed">
                            {perm.description}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

      </form>
    </div>
  )
}
export default RoleBuilder
