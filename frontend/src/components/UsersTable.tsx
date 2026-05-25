import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { User as UserIcon, Plus, ShieldCheck, X, AlertCircle, CheckCircle2, Loader2, Lock } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

interface UserRecord {
  id: string
  name: string
  email: string
  role: string
  status: string
  lastLogin: string
}

export const UsersTable: React.FC = () => {
  const { token, role } = useAuthStore()
  const isAdmin = role === 'Tenant_Admin' || role === 'Super_Admin'
  const customRoles = JSON.parse(localStorage.getItem('synq-custom-roles') || '[]')

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [roleInput, setRoleInput] = useState('Tenant_User')
  
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [tempPassword, setTempPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: users = [], isLoading, refetch } = useQuery<UserRecord[]>({
    queryKey: ['users', token],
    queryFn: async () => {
      const response = await axios.get('/api/v1/auth/users', {
        headers: { Authorization: `Bearer ${token}` }
      })
      return response.data.map((u: any, idx: number) => ({
        id: String(idx),
        name: u.name,
        email: u.email,
        role: u.role === 'Tenant_Admin' ? 'Admin' : u.role === 'Super_Admin' ? 'Super Admin' : u.role === 'Tenant_User' ? 'User' : u.role,
        status: u.status,
        lastLogin: u.last_login
      }))
    },
    enabled: !!token
  })

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    setTempPassword('')

    const name = nameInput.trim()
    const email = emailInput.trim()

    if (!name || !email) {
      setError('Both teammate name and contact email address are required.')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await axios.post(
        '/api/v1/auth/invite',
        {
          email,
          name,
          role: roleInput
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const { temp_password, email_sent, resend_configured, email_error } = response.data
      setTempPassword(temp_password)
      setSuccessMessage(
        email_sent
          ? `Teammate successfully invited. Invitation email sent via Resend.`
          : resend_configured
            ? `Teammate invited, but Resend rejected the email request: ${email_error || 'Unknown Resend error.'}`
            : `Teammate invited! Since Resend API key is unconfigured, copy their temporary password below:`
      )
      setNameInput('')
      setEmailInput('')
      refetch()
      setIsAddOpen(false)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to send workspace invitation.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const openAddModal = () => {
    setError('')
    setNameInput('')
    setEmailInput('')
    setRoleInput('Tenant_User')
    setIsAddOpen(true)
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-text-primary">Workspace Users</h2>
          <p className="text-sm text-text-muted">Manage active teammates, edit permissions, and track console login events.</p>
        </div>
        {isAdmin && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-3.5 py-2 bg-text-primary text-background font-semibold hover:bg-accent-hover text-xs rounded-lg transition-all cursor-pointer shadow-lg"
          >
            <Plus className="h-4 w-4" />
            Invite Teammate
          </button>
        )}
      </div>

      {(successMessage || tempPassword) && (
        <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl space-y-3 max-w-3xl font-sans">
          <div className="flex items-center gap-2 text-white text-xs">
            <CheckCircle2 className="h-4 w-4 text-white" />
            <span className="font-bold uppercase tracking-wide">Workspace Invitation Dispatched</span>
          </div>
          <p className="text-xs text-zinc-400">{successMessage}</p>
          {tempPassword && (
            <div className="p-3 bg-black border border-zinc-800 rounded-lg text-xs font-mono text-white flex items-center justify-between">
              <span>Temp Pass: <strong className="text-white select-all">{tempPassword}</strong></span>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="bg-panel border border-border-primary rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-primary bg-panel-card/30 text-xs text-text-muted uppercase tracking-wider font-semibold">
                  <th className="px-6 py-4">Teammate</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Last Console Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary">
                {[1, 2, 3].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-border-primary"></div>
                        <div className="space-y-2">
                          <div className="h-3.5 bg-border-primary rounded w-28"></div>
                          <div className="h-3 bg-border-secondary rounded w-36"></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4.5">
                      <div className="h-5 bg-border-primary rounded w-16"></div>
                    </td>
                    <td className="px-6 py-4.5">
                      <div className="h-5 bg-border-primary rounded w-14"></div>
                    </td>
                    <td className="px-6 py-4.5">
                      <div className="h-3.5 bg-border-primary rounded w-20"></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : users.length === 0 ? (
        <div className="bg-panel border border-border-primary rounded-xl p-16 text-center max-w-5xl mx-auto space-y-5">
          <div className="flex justify-center">
            <div className="h-20 w-20 bg-panel-card border border-border-primary rounded-full flex items-center justify-center">
              <UserIcon className="h-10 w-10 text-text-muted" />
            </div>
          </div>
          <div className="space-y-2 max-w-sm mx-auto">
            <h3 className="text-sm font-semibold text-text-primary">No Teammates Provisioned</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Add access operators to delegate pipeline monitoring and database credentials provisioning.
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-text-primary text-background font-medium hover:opacity-90 text-xs rounded transition-all duration-150 cursor-pointer shadow-lg active:scale-[0.98]"
            >
              <Plus className="h-3.5 w-3.5" />
              Invite Teammate
            </button>
          )}
        </div>
      ) : (
        <div className="bg-panel border border-border-primary rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-primary bg-panel-card/30 text-xs text-text-muted uppercase tracking-wider font-semibold">
                  <th className="px-6 py-4">Teammate</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Last Console Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary text-sm">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-panel-card/30 transition-colors duration-100">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-panel-card border border-border-primary rounded-full flex items-center justify-center">
                          <UserIcon className="h-4 w-4 text-text-secondary" />
                        </div>
                        <div>
                          <span className="font-semibold text-text-primary block">{user.name}</span>
                          <span className="text-xs text-text-muted font-mono">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 border border-border-primary bg-panel-card text-text-secondary text-xs rounded-md font-medium">
                        <ShieldCheck className="h-3.5 w-3.5 text-text-muted" />
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          user.status === 'Active'
                            ? 'bg-[#18181B] text-white border-zinc-800'
                            : 'bg-panel border-border-primary text-text-muted'
                        }`}>
                          {user.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-text-muted font-mono">{user.lastLogin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isAddOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40" onClick={() => setIsAddOpen(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-panel border border-border-primary rounded-xl p-6 shadow-2xl z-50 space-y-4 font-sans">
            <div className="flex justify-between items-center border-b border-border-primary pb-3">
              <h3 className="text-sm font-semibold text-text-primary">Add Workspace Teammate</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-text-muted hover:text-text-primary p-0.5 rounded cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Teammate Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-border-secondary transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Teammate Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="john.doe@company.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full bg-panel-card border border-border-primary text-text-primary placeholder-text-muted text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-border-secondary transition-all font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Access Authorization Role</label>
                <select
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value as any)}
                  className="w-full bg-panel-card border border-border-primary text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-border-secondary transition-all font-semibold"
                >
                  <option value="Tenant_User">User (Tenant_User)</option>
                  <option value="Tenant_Admin">Admin (Tenant_Admin)</option>
                  {customRoles.map((customRole: any) => (
                    <option key={customRole.roleName} value={customRole.roleName}>{customRole.roleName}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2 bg-text-primary text-background font-semibold text-xs uppercase tracking-wider rounded-lg hover:bg-accent-hover transition-all cursor-pointer mt-2 flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    <span>Invite Teammate</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
export default UsersTable
