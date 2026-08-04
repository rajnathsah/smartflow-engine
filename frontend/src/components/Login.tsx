import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import apiClient from '@/api/client'
import { Lock, Loader2, ShieldAlert } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { motion } from 'framer-motion'
import { APP_CONFIG } from '@/config/constants'
import { notify } from '@/lib/notify'

// ─── Validation Schemas ──────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  tenant: z.string().optional(),
})

const registerSchema = z.object({
  tenant: z.string().min(2, 'Workspace tenant name must be at least 2 characters'),
  username: z.string().min(2, 'Username must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const resetSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Confirm password must be at least 8 characters'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

type LoginFormData = z.infer<typeof loginSchema>
type RegisterFormData = z.infer<typeof registerSchema>
type ResetFormData = z.infer<typeof resetSchema>

export const Login: React.FC = () => {
  const { login, isFirstLogin, token, email, activeTenant, role } = useAuthStore()
  const [error, setError] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [isFirstLoginState, setIsFirstLoginState] = useState(false)

  const [tempToken, setTempToken] = useState<string | null>(null)
  const [tempEmail, setTempEmail] = useState<string | null>(null)
  const [tempTenant, setTempTenant] = useState<string | null>(null)
  const [tempRole, setTempRole] = useState<string | null>(null)

  const navigate = useNavigate()

  useEffect(() => {
    const expired = localStorage.getItem('session_expired_inactivity')
    if (expired) {
      localStorage.removeItem('session_expired_inactivity')
      setTimeout(() => {
        notify.error("Your session expired due to inactivity.")
      }, 200)
    }
  }, [])

  useEffect(() => {
    if (token && isFirstLogin) {
      setIsFirstLoginState(true)
      setTempToken(token)
      setTempEmail(email)
      setTempTenant(activeTenant)
      setTempRole(role)
    }
  }, [token, isFirstLogin, email, activeTenant, role])

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      tenant: '',
      email: APP_CONFIG.DEMO_EMAIL,
      password: 'admin123',
    }
  })

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      tenant: '',
      username: '',
      email: '',
      password: '',
    }
  })

  const resetForm = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    }
  })

  // ─── Submit Handlers ────────────────────────────────────────────────────────

  const onLoginSubmit = async (data: LoginFormData) => {
    setError('')
    setIsAuthenticating(true)
    try {
      const response = await apiClient.post('/api/v1/auth/login', {
        tenant: (data.tenant || '').trim() || 'System Workspace',
        username: data.email.trim(),
        password: data.password
      })
      const { access_token, reset_token, tenant_name, role, email, is_first_login } = response.data
      if (is_first_login) {
        setIsFirstLoginState(true)
        setTempToken(reset_token)
        setTempEmail(email)
        setTempTenant(tenant_name)
        setTempRole(role)
      } else {
        login(access_token, tenant_name, role, email, false)
        navigate('/dashboard')
      }
    } catch (err: any) {
      if (err.response && err.response.status === 428) {
        const { reset_token, tenant_name, role, email } = err.response.data.detail
        setIsFirstLoginState(true)
        setTempToken(reset_token)
        setTempEmail(email)
        setTempTenant(tenant_name)
        setTempRole(role)
      } else {
        setError(err.response?.data?.detail || 'Authentication failed. Please verify credentials.')
      }
    } finally {
      setIsAuthenticating(false)
    }
  }

  const onRegisterSubmit = async (data: RegisterFormData) => {
    setError('')
    setIsAuthenticating(true)
    try {
      const response = await apiClient.post('/api/v1/auth/register', {
        tenant: data.tenant.trim(),
        username: data.username.trim(),
        email: data.email.trim(),
        password: data.password
      })
      const { access_token, tenant_name, role, email } = response.data
      login(access_token, tenant_name, role, email, false)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Workspace onboarding failed.')
    } finally {
      setIsAuthenticating(false)
    }
  }

  const onResetSubmit = async (data: ResetFormData) => {
    setError('')
    setIsAuthenticating(true)
    try {
      const response = await apiClient.post(
        '/api/v1/auth/reset-password',
        { new_password: data.newPassword },
        {
          headers: {
            Authorization: `Bearer ${tempToken}`
          }
        }
      )
      const { access_token, tenant_name, role, email } = response.data
      login(access_token, tenant_name || tempTenant!, role || tempRole!, email || tempEmail!, false)
      setIsFirstLoginState(false)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Force password update failed.')
    } finally {
      setIsAuthenticating(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-[#000000] text-gray-900 dark:text-gray-100 font-sans px-4 py-8">
      
      {/* Centered Monochromatic Form Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full max-w-sm bg-white dark:bg-[#0F0F0F] p-8 rounded-xl border border-gray-200 dark:border-white/10 shadow-2xl h-auto space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col items-center space-y-3 text-center">
          <div className="h-12 w-12 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 rounded-xl flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 100 100" className="h-7 w-7 text-gray-900 dark:text-white">
              <path
                d="M 32 35 L 68 35 L 68 50 L 32 50 L 32 65 L 68 65"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                strokeLinecap="square"
                strokeLinejoin="miter"
              />
              <rect x="62" y="44" width="12" height="12" fill="currentColor" />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-wider text-gray-900 dark:text-white uppercase">
            {APP_CONFIG.APP_NAME}
          </h1>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs rounded flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form fields stacked vertically */}
        {isFirstLoginState ? (
          /* Force Reset View */
          <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wider uppercase block">
                New Secure Password
              </label>
              <input
                type="password"
                {...resetForm.register('newPassword')}
                disabled={isAuthenticating}
                className="w-full bg-gray-50 dark:bg-[#1A1A1A] border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 p-3 rounded focus:ring-1 focus:ring-gray-500 focus:outline-none transition-all font-mono"
              />
              {resetForm.formState.errors.newPassword && (
                <p className="text-[11px] text-red-500 flex items-center gap-1 mt-1">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {resetForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wider uppercase block">
                Confirm Password
              </label>
              <input
                type="password"
                {...resetForm.register('confirmPassword')}
                disabled={isAuthenticating}
                className="w-full bg-gray-50 dark:bg-[#1A1A1A] border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 p-3 rounded focus:ring-1 focus:ring-gray-500 focus:outline-none transition-all font-mono"
              />
              {resetForm.formState.errors.confirmPassword && (
                <p className="text-[11px] text-red-500 flex items-center gap-1 mt-1">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {resetForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-black font-bold tracking-wide rounded-md py-3 mt-4 hover:opacity-90 transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white dark:text-black" />
                  <span>Updating Password...</span>
                </>
              ) : (
                'Reset & Access'
              )}
            </button>
          </form>
        ) : authMode === 'login' ? (
          /* Login View */
          <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="flex flex-col gap-4">
            {/* Workspace Tenant is autofilled under the hood */}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wider uppercase block">
                Security Email
              </label>
              <input
                type="text"
                {...loginForm.register('email')}
                disabled={isAuthenticating}
                className="w-full bg-gray-50 dark:bg-[#1A1A1A] border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 p-3 rounded focus:ring-1 focus:ring-gray-500 focus:outline-none transition-all font-mono"
              />
              {loginForm.formState.errors.email && (
                <p className="text-[11px] text-red-500 flex items-center gap-1 mt-1">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {loginForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wider uppercase block">
                  Access Pass
                </label>
                <button
                  type="button"
                  onClick={() => notify.error("Please contact your workspace administrator to reset your password.")}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-semibold cursor-pointer transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                {...loginForm.register('password')}
                disabled={isAuthenticating}
                className="w-full bg-gray-50 dark:bg-[#1A1A1A] border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 p-3 rounded focus:ring-1 focus:ring-gray-500 focus:outline-none transition-all font-mono"
              />
              {loginForm.formState.errors.password && (
                <p className="text-[11px] text-red-500 flex items-center gap-1 mt-1">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {loginForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-black font-bold tracking-wide rounded-md py-3 mt-4 hover:opacity-90 transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white dark:text-black" />
                  <span>Signing In...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        ) : (
          /* Register View */
          <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wider uppercase block">
                Workspace Name
              </label>
              <input
                type="text"
                {...registerForm.register('tenant')}
                disabled={isAuthenticating}
                className="w-full bg-gray-50 dark:bg-[#1A1A1A] border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 p-3 rounded focus:ring-1 focus:ring-gray-500 focus:outline-none transition-all uppercase"
              />
              {registerForm.formState.errors.tenant && (
                <p className="text-[11px] text-red-500 flex items-center gap-1 mt-1">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {registerForm.formState.errors.tenant.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wider uppercase block">
                Operator Full Name
              </label>
              <input
                type="text"
                {...registerForm.register('username')}
                disabled={isAuthenticating}
                className="w-full bg-gray-50 dark:bg-[#1A1A1A] border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 p-3 rounded focus:ring-1 focus:ring-gray-500 focus:outline-none transition-all"
              />
              {registerForm.formState.errors.username && (
                <p className="text-[11px] text-red-500 flex items-center gap-1 mt-1">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {registerForm.formState.errors.username.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wider uppercase block">
                Operator Email
              </label>
              <input
                type="text"
                {...registerForm.register('email')}
                disabled={isAuthenticating}
                className="w-full bg-gray-50 dark:bg-[#1A1A1A] border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 p-3 rounded focus:ring-1 focus:ring-gray-500 focus:outline-none transition-all font-mono"
              />
              {registerForm.formState.errors.email && (
                <p className="text-[11px] text-red-500 flex items-center gap-1 mt-1">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {registerForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wider uppercase block">
                Password
              </label>
              <input
                type="password"
                {...registerForm.register('password')}
                disabled={isAuthenticating}
                className="w-full bg-gray-50 dark:bg-[#1A1A1A] border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 p-3 rounded focus:ring-1 focus:ring-gray-500 focus:outline-none transition-all font-mono"
              />
              {registerForm.formState.errors.password && (
                <p className="text-[11px] text-red-500 flex items-center gap-1 mt-1">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {registerForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-black font-bold tracking-wide rounded-md py-3 mt-4 hover:opacity-90 transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white dark:text-black" />
                  <span>Registering...</span>
                </>
              ) : (
                'Sign Up'
              )}
            </button>
          </form>
        )}

        {/* Form Toggle Switch */}
        <div className="text-center text-xs text-gray-500 pt-2 border-t border-gray-200 dark:border-gray-800">
          {authMode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button
                onClick={() => { setAuthMode('register'); setError(''); }}
                className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-semibold cursor-pointer transition-colors"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => { setAuthMode('login'); setError(''); }}
                className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-semibold cursor-pointer transition-colors"
              >
                Sign in
              </button>
            </>
          )}
        </div>

        {/* Footer Secure Node info */}
        <div className="text-center flex items-center justify-center gap-1.5 text-gray-500 text-xs font-semibold">
          <Lock className="h-3.5 w-3.5" />
          <span>Secure Enterprise Node</span>
        </div>
      </motion.div>
    </div>
  )
}

export default Login
