import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Check, ShieldAlert, Shield, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { SYSTEM_PERMISSIONS } from '@/lib/permissions'

const roleSchema = z.object({
  roleName: z.string().min(2, 'Role name must be at least 2 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  permissions: z.array(z.string()).min(1, 'Select at least one permission from the matrix'),
})

type RoleFormData = z.infer<typeof roleSchema>

const DEFAULT_ROLES = [
  {
    roleName: 'Super_Admin',
    description: 'Complete administrative access to all workspace settings, teammates, connections, and pipelines.',
    permissions: ['pipelines:read', 'pipelines:write', 'pipelines:execute', 'connections:verify', 'connections:ssh', 'users:write', 'settings:write']
  },
  {
    roleName: 'Tenant_Admin',
    description: 'Full administrative control isolated within the specific tenant workspace.',
    permissions: ['pipelines:read', 'pipelines:write', 'pipelines:execute', 'connections:verify', 'connections:ssh', 'users:write', 'settings:write']
  },
  {
    roleName: 'Tenant_User',
    description: 'Standard member role restricted to viewing sync pipelines and initiating manually triggered sync tasks.',
    permissions: ['pipelines:read', 'pipelines:execute']
  }
]

export const RoleBuilder: React.FC = () => {
  const { activeTenant } = useAuthStore()
  const [successPayload, setSuccessPayload] = useState<string | null>(null)
  const [customRoles, setCustomRoles] = useState<RoleFormData[]>([])

  const storageKey = activeTenant ? `synq-custom-roles-${activeTenant}` : 'synq-custom-roles'

  const loadCustomRoles = () => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        setCustomRoles(JSON.parse(stored))
      } else {
        setCustomRoles([])
      }
    } catch (e) {
      setCustomRoles([])
    }
  }

  useEffect(() => {
    loadCustomRoles()
  }, [activeTenant])

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
    const storedRoles = JSON.parse(localStorage.getItem(storageKey) || '[]')
    const nextRoles = storedRoles.filter((role: RoleFormData) => role.roleName !== data.roleName)
    const updatedRoles = [...nextRoles, data]
    localStorage.setItem(storageKey, JSON.stringify(updatedRoles))
    setCustomRoles(updatedRoles)
    setSuccessPayload(payload)
    
    setTimeout(() => {
      reset()
      setSuccessPayload(null)
    }, 4000)
  }

  const allRoles = [...DEFAULT_ROLES, ...customRoles]

  const getPermissionLabel = (permId: string): string => {
    for (const group of SYSTEM_PERMISSIONS) {
      const found = group.items.find((item) => item.id === permId)
      if (found) {
        return found.label
      }
    }
    return permId
  }

  return (
    <div className="space-y-12 max-w-5xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-text-primary">Role Management & Authorization Directory</h2>
        <p className="text-sm text-text-muted">Configure custom role matrices and inspect system authorization boundaries.</p>
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

      <form onSubmit={handleSubmit(onRoleSubmit)} className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        <div className="lg:col-span-2 bg-panel border border-border-primary rounded-xl p-6 space-y-6">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-text-primary">Role Metadata</h3>
            <p className="text-xs text-text-muted">Define the identifier name and workspace description.</p>
          </div>

          <div className="space-y-4">
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

          <div className="space-y-6 max-h-[420px] overflow-y-auto pr-1">
            {SYSTEM_PERMISSIONS.map((group) => (
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
                        <div
                          className={`h-5 w-5 rounded-md border shrink-0 flex items-center justify-center transition-all ${
                            isChecked
                              ? 'bg-text-primary border-text-primary'
                              : 'bg-panel-card border-border-primary'
                          }`}
                        >
                          {isChecked && <Check className="h-3.5 w-3.5 text-background font-bold" />}
                        </div>

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

      <div className="bg-panel border border-border-primary rounded-xl p-6 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Workspace Role Directory</h3>
          <p className="text-xs text-text-muted">Inspect authorization mappings for all standard system roles and customized profiles.</p>
        </div>

        <div className="overflow-x-auto border border-border-primary rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-panel-card border-b border-border-primary text-text-muted font-medium uppercase tracking-wider text-[10px]">
                <th className="p-4">Role / Profile</th>
                <th className="p-4">Description</th>
                <th className="p-4">Authorization Scopes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary bg-panel-card/10">
              {allRoles.map((roleItem) => {
                const isSystem = DEFAULT_ROLES.some((dr) => dr.roleName === roleItem.roleName)
                return (
                  <tr key={roleItem.roleName} className="hover:bg-panel-card/35 transition-colors">
                    <td className="p-4 align-top">
                      <div className="flex items-center gap-2">
                        {isSystem ? (
                          <ShieldCheck className="h-4 w-4 text-text-secondary" />
                        ) : (
                          <Shield className="h-4 w-4 text-text-muted" />
                        )}
                        <span className="font-semibold text-text-primary font-mono">{roleItem.roleName}</span>
                        {isSystem && (
                          <span className="px-1.5 py-0.5 bg-border-primary text-text-muted rounded text-[9px] uppercase tracking-wide font-medium">
                            System
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-text-secondary max-w-sm align-top leading-relaxed">
                      {roleItem.description}
                    </td>
                    <td className="p-4 align-top">
                      <div className="flex flex-wrap gap-1.5 max-w-md">
                        {roleItem.permissions.map((permId) => (
                          <span
                            key={permId}
                            className="px-2 py-0.5 bg-panel-card border border-border-primary text-text-secondary rounded-full text-[10px] font-medium"
                          >
                            {getPermissionLabel(permId)}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default RoleBuilder
