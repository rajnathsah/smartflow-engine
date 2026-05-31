export interface PermissionItem {
  id: string
  label: string
  description: string
}

export interface PermissionGroup {
  section: string
  items: PermissionItem[]
}

export const SYSTEM_PERMISSIONS: PermissionGroup[] = [
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

export const hasPermission = (
  role: string | null,
  permissionId: string,
  activeTenant: string | null
): boolean => {
  if (!role) {
    return false
  }
  if (role === 'Super_Admin' || role === 'Tenant_Admin') {
    return true
  }
  if (role === 'Tenant_User') {
    return permissionId === 'pipelines:read' || permissionId === 'pipelines:execute'
  }
  const storageKey = activeTenant ? `synq-custom-roles-${activeTenant}` : 'synq-custom-roles'
  try {
    const storedRoles = JSON.parse(localStorage.getItem(storageKey) || '[]')
    const customRole = storedRoles.find((r: any) => r.roleName === role)
    if (customRole && Array.isArray(customRole.permissions)) {
      return customRole.permissions.includes(permissionId)
    }
  } catch (e) {
    return false
  }
  return false
}
