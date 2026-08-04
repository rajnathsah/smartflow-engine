import { APP_CONFIG } from '@/config/constants'
import rolesMatrix from '../roles/roles.json'

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

// Map legacy frontend query keys to the new strictly-scoped keys in roles.json
const PERMISSION_MAPPING: Record<string, string> = {
  'pipelines:read': 'read:pipelines',
  'pipelines:write': 'write:pipelines',
  'pipelines:execute': 'write:pipelines', // Editors and Admins can trigger sync execution
  'connections:verify': 'write:sources', // Credentials testing mapped to source creation permission
  'connections:ssh': 'write:sources',
  'users:write': 'read:users',
  'settings:write': 'settings:write'
}

export const hasPermission = (
  role: string | null,
  permissionId: string,
  activeTenant: string | null
): boolean => {
  if (!role) {
    return false
  }

  // Normalize backend role names into the JSON keys in roles.json
  let normalizedRole = role
  if (role === 'Super_Admin') {
    normalizedRole = 'Super Admin'
  } else if (role === 'Tenant_Admin') {
    normalizedRole = 'Admin'
  } else if (role === 'Tenant_User') {
    normalizedRole = 'Viewer'
  } else if (role === 'User') {
    normalizedRole = 'Viewer'
  }

  // Check roles matrix
  const matrix = rolesMatrix as Record<string, string[]>
  const permissions = matrix[normalizedRole]
  if (!permissions) {
    // If not found in default roles, check custom roles in local storage
    const storageKey = activeTenant ? `${APP_CONFIG.STORE_KEY_ROLES}-${activeTenant}` : APP_CONFIG.STORE_KEY_ROLES
    try {
      const storedRoles = JSON.parse(localStorage.getItem(storageKey) || '[]')
      const customRole = storedRoles.find((r: any) => r.roleName === role)
      if (customRole && Array.isArray(customRole.permissions)) {
        const strictPerm = PERMISSION_MAPPING[permissionId] || permissionId
        return customRole.permissions.includes(strictPerm)
      }
    } catch (e) {
      return false
    }
    return false
  }

  // Super Admin can do everything
  if (permissions.includes('*')) {
    return true
  }

  // Mapped strict check
  const strictPerm = PERMISSION_MAPPING[permissionId] || permissionId

  // Administrative actions (managing users, modifying global system settings) require Super Admin '*'
  if (permissionId === 'users:write' || permissionId === 'settings:write') {
    return false
  }

  return permissions.includes(strictPerm)
}
