import React, { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Lock, Loader2, ShieldAlert, ArrowLeft, Database, Globe, Network, ArrowRight, ShieldCheck, Mail, User, Sun, Moon } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { motion, useMotionValue, useMotionTemplate } from 'framer-motion'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  tenant: z.string().min(2, 'Tenant identifier must be at least 2 characters'),
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

export const DataTunnel: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = canvas.width = window.innerWidth
    let height = canvas.height = window.innerHeight

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
      init()
    }
    window.addEventListener('resize', handleResize)

    class Curve {
      startX: number
      startY: number
      cp1x: number
      cp1y: number
      cp2x: number
      cp2y: number
      endX: number
      endY: number
      color: string
      width: number

      constructor(index: number, totalCount: number) {
        const startYBase = (index / totalCount) * height
        this.startX = -50
        this.startY = startYBase + (Math.random() - 0.5) * 80
        this.endX = width + 50
        this.endY = startYBase + (Math.random() - 0.5) * 80
        this.cp1x = width * 0.33 + (Math.random() - 0.5) * 80
        this.cp1y = this.startY + (Math.random() - 0.5) * 250
        this.cp2x = width * 0.66 + (Math.random() - 0.5) * 80
        this.cp2y = this.endY + (Math.random() - 0.5) * 250
        const opacity = 0.03 + Math.random() * 0.05
        this.color = `rgba(255, 255, 255, ${opacity})`
        this.width = 1.0
      }

      getPoint(t: number) {
        const mt = 1 - t
        const mt2 = mt * mt
        const mt3 = mt2 * mt
        const t2 = t * t
        const t3 = t2 * t
        const x = mt3 * this.startX + 3 * mt2 * t * this.cp1x + 3 * mt * t2 * this.cp2x + t3 * this.endX
        const y = mt3 * this.startY + 3 * mt2 * t * this.cp1y + 3 * mt * t2 * this.cp2y + t3 * this.endY
        return { x, y }
      }

      draw() {
        if (!ctx) return
        ctx.strokeStyle = this.color
        ctx.lineWidth = this.width
        ctx.beginPath()
        ctx.moveTo(this.startX, this.startY)
        ctx.bezierCurveTo(this.cp1x, this.cp1y, this.cp2x, this.cp2y, this.endX, this.endY)
        ctx.stroke()
      }
    }

    class Particle {
      curve: Curve
      t: number
      speed: number
      size: number
      alpha: number

      constructor(curves: Curve[]) {
        this.curve = curves[Math.floor(Math.random() * curves.length)]
        this.t = Math.random()
        this.speed = 0.0003 + Math.random() * 0.0006
        this.size = 0.7 + Math.random() * 0.6
        this.alpha = 0.1 + Math.random() * 0.15
      }

      update() {
        this.t += this.speed
        if (this.t > 1) {
          this.t = 0
        }
      }

      draw() {
        if (!ctx) return
        const pt = this.curve.getPoint(this.t)
        let fade = 1
        if (this.t < 0.15) fade = this.t / 0.15
        else if (this.t > 0.85) fade = (1 - this.t) / 0.15
        ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha * fade})`
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, this.size, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    let curves: Curve[] = []
    let particles: Particle[] = []

    const init = () => {
      curves = []
      particles = []
      const totalCurves = 120
      for (let i = 0; i < totalCurves; i++) {
        curves.push(new Curve(i, totalCurves))
      }
      for (let i = 0; i < 600; i++) {
        particles.push(new Particle(curves))
      }
    }

    init()

    const animate = () => {
      if (!ctx) return
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, width, height)
      curves.forEach(c => c.draw())
      particles.forEach(p => {
        p.update()
        p.draw()
      })
      const mask = ctx.createRadialGradient(width / 2, height / 2, 80, width / 2, height / 2, 400)
      mask.addColorStop(0, 'rgba(0, 0, 0, 0.95)')
      mask.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = mask
      ctx.fillRect(0, 0, width, height)
      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0 bg-black"
    />
  )
}



interface ConnectorCardProps {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  category: string
}

const ConnectorCard: React.FC<ConnectorCardProps> = ({ title, description, icon: Icon, category }) => {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect()
    mouseX.set(clientX - left)
    mouseY.set(clientY - top)
  }

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 50, damping: 20 }}
      className="group relative rounded-2xl border border-zinc-900 bg-[#18181B]/40 p-8 space-y-6 overflow-hidden"
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition duration-300"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              150px circle at ${mouseX}px ${mouseY}px,
              rgba(255, 255, 255, 0.12),
              transparent 80%
            )
          `
        }}
      />
      <div className="h-10 w-10 bg-[#000000] rounded-lg border border-zinc-850 flex items-center justify-center">
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <h3 className="text-sm font-black tracking-wider uppercase text-white">{title}</h3>
          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">{category}</span>
        </div>
        <p className="text-zinc-400 text-xs font-light leading-relaxed">
          {description}
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-white hover:text-zinc-400 font-black uppercase tracking-wider cursor-pointer">
        <span>Explore Connector</span>
        <ArrowRight className="h-3 w-3" />
      </div>
    </motion.div>
  )
}

export const Login: React.FC = () => {
  const { login, isFirstLogin, token, email, activeTenant, role, theme, toggleTheme } = useAuthStore()
  const [error, setError] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isTransitioned, setIsTransitioned] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [isFirstLoginState, setIsFirstLoginState] = useState(false)
  const [showGoogleModal, setShowGoogleModal] = useState(false)
  const [googleEmail, setGoogleEmail] = useState('')
  const [googleName, setGoogleName] = useState('')

  const [tempToken, setTempToken] = useState<string | null>(null)
  const [tempEmail, setTempEmail] = useState<string | null>(null)
  const [tempTenant, setTempTenant] = useState<string | null>(null)
  const [tempRole, setTempRole] = useState<string | null>(null)

  const navigate = useNavigate()

  useEffect(() => {
    if (token && isFirstLogin) {
      setIsFirstLoginState(true)
      setIsTransitioned(true)
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
      email: '',
      password: '',
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

  const onLoginSubmit = async (data: LoginFormData) => {
    setError('')
    setIsAuthenticating(true)
    try {
      const response = await axios.post('/api/v1/auth/login', {
        tenant: data.tenant,
        username: data.email,
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
      const response = await axios.post('/api/v1/auth/register', {
        tenant: data.tenant,
        username: data.username,
        email: data.email,
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
      const response = await axios.post(
        '/api/v1/auth/reset-password',
        { new_password: data.newPassword },
        { headers: { Authorization: `Bearer ${tempToken}` } }
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

  const handleGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!googleEmail || !googleName) return
    setError('')
    setIsAuthenticating(true)
    try {
      const mockGoogleId = `google_${Math.floor(100000000000000000000 + Math.random() * 900000000000000000000).toString()}`
      const response = await axios.post('/api/v1/auth/google', {
        email: googleEmail,
        name: googleName,
        google_id: mockGoogleId
      })
      const { access_token, tenant_name, role, email } = response.data
      login(access_token, tenant_name, role, email, false)
      setShowGoogleModal(false)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Google federated login failed.')
    } finally {
      setIsAuthenticating(false)
    }
  }

  return (
    <div className="relative w-screen min-h-screen bg-[#000000] text-[#FFFFFF] font-sans selection:bg-[#FFFFFF]/10 selection:text-[#FFFFFF] overflow-x-hidden">
      
      <DataTunnel />

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.03] z-0">
        <svg viewBox="0 0 100 100" className="w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] text-white">
          <path d="M 32 35 L 68 35 L 68 50 L 32 50 L 32 65 L 68 65" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="10" 
                strokeLinecap="square" 
                strokeLinejoin="miter" />
          <rect x="62" y="44" width="12" height="12" fill="currentColor" />
        </svg>
      </div>

      <header className="fixed top-0 left-0 right-0 h-20 border-b border-zinc-900 bg-black/60 backdrop-blur-md flex items-center justify-between px-8 md:px-16 z-50">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 100 100" className="h-8 w-8 shrink-0">
            <rect width="100" height="100" rx="24" fill="#000000" />
            <path d="M 32 35 L 68 35 L 68 50 L 32 50 L 32 65 L 68 65" 
                  fill="none" 
                  stroke="#ffffff" 
                  strokeWidth="10" 
                  strokeLinecap="square" 
                  strokeLinejoin="miter" />
            <rect x="62" y="44" width="12" height="12" fill="#ffffff" />
          </svg>
          <span className="font-bold text-sm tracking-wider uppercase text-white">
            synq.to
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-8">
          <a href="#" className="text-xs font-semibold text-zinc-400 hover:text-white uppercase tracking-wider transition-colors">Product</a>
          <a href="#" className="text-xs font-semibold text-zinc-400 hover:text-white uppercase tracking-wider transition-colors">Solutions</a>
          <a href="#" className="text-xs font-semibold text-zinc-400 hover:text-white uppercase tracking-wider transition-colors">Docs</a>
          <a href="#" className="text-xs font-semibold text-zinc-400 hover:text-white uppercase tracking-wider transition-colors">Pricing</a>
        </nav>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className="p-2 border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-full transition-all cursor-pointer flex items-center justify-center"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <button 
            onClick={() => setIsTransitioned(true)}
            className="px-5 py-2.5 bg-[#FFFFFF] hover:bg-[#000000] hover:text-[#FFFFFF] text-[#000000] border border-[#FFFFFF] text-[10px] font-black uppercase tracking-widest rounded-full transition-all cursor-pointer shadow-[0_0_15px_rgba(255,255,255,0.1)]"
          >
            TRY IT FREE
          </button>
        </div>
      </header>

      {!isTransitioned && (
        <div className="relative pt-44 pb-32 z-10">
          
          <div className="max-w-4xl mx-auto px-6 text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 50, damping: 20 }}
              className="space-y-4"
            >
              <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight uppercase">
                BUILD PIPELINES WITH <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFFFFF] to-[#A1A1AA] drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]">
                  synq.to
                </span>
              </h1>
              <p className="text-zinc-450 text-xs md:text-sm tracking-widest uppercase max-w-lg mx-auto leading-relaxed">
                (ZERO-TOUCH ETL. AUTO-INFER SCHEMAS AND SYNC DATABASES IN MINUTES, NOT DAYS.)
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 50, damping: 20, delay: 0.1 }}
              className="flex flex-wrap items-center justify-center gap-4"
            >
              <button
                onClick={() => setIsTransitioned(true)}
                className="px-8 py-4 bg-[#FFFFFF] text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] border border-[#FFFFFF] font-black text-xs tracking-widest uppercase rounded-full transition-all cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              >
                ENTER SYNQ.TO
              </button>
              <button
                className="px-8 py-4 bg-transparent hover:bg-zinc-900 border border-zinc-800 text-white font-black text-xs tracking-widest uppercase rounded-full transition-all cursor-pointer"
              >
                TALK TO US
              </button>
            </motion.div>
          </div>

          <div className="max-w-5xl mx-auto px-8 pt-16 flex flex-wrap items-center justify-center gap-8 md:gap-12 text-zinc-500 text-xs font-semibold uppercase tracking-wider select-none">
            <div className="flex items-center gap-2 hover:text-white transition-colors duration-200 cursor-default">
              <ShieldCheck className="h-4 w-4" />
              <span>ISO 27001 Certified</span>
            </div>
            <div className="flex items-center gap-2 hover:text-white transition-colors duration-200 cursor-default">
              <Lock className="h-4 w-4" />
              <span>SOC 2 Type II Certified</span>
            </div>
            <div className="flex items-center gap-2 hover:text-white transition-colors duration-200 cursor-default">
              <Globe className="h-4 w-4" />
              <span>GDPR Compliant</span>
            </div>
            <div className="flex items-center gap-2 hover:text-white transition-colors duration-200 cursor-default">
              <Database className="h-4 w-4" />
              <span>HIPAA Secure</span>
            </div>
          </div>

          <div className="max-w-5xl mx-auto px-8 pt-32 space-y-16">
            <div className="space-y-2 text-center">
              <h2 className="text-xl md:text-3xl font-black tracking-tight text-white uppercase">
                Hundreds of connectors for your data pipelines
              </h2>
              <p className="text-zinc-500 text-xs uppercase tracking-widest">
                Every source, every destination. Zero manual mapping.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ConnectorCard 
                title="REST API Source" 
                category="Source" 
                description="Auto-infer structure from nested arrays and paths dynamically. Fully compatible with any REST API endpoint." 
                icon={Globe} 
              />
              <ConnectorCard 
                title="PostgreSQL Destination" 
                category="Destination" 
                description="Provision schemas automatically. Handles indexes, column generation, and secure SSH bastion jump server routing." 
                icon={Database} 
              />
              <ConnectorCard 
                title="MySQL Destination" 
                category="Destination" 
                description="Stream rows dynamically with Celery tasks. Automatically serializes nested payloads into structured JSON text." 
                icon={Network} 
              />
            </div>
          </div>
        </div>
      )}

      {isTransitioned && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/75 backdrop-blur-md px-4">
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 50, damping: 20 }}
            className="w-full max-w-md bg-[#09090B] border border-zinc-900 rounded-3xl p-8 space-y-6 shadow-[0_0_50px_rgba(255,255,255,0.06)] relative"
          >
            {!isFirstLoginState && (
              <button
                onClick={() => setIsTransitioned(false)}
                className="absolute top-6 left-6 text-zinc-500 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold"
              >
                <ArrowLeft className="h-3 w-3" />
                <span>Back</span>
              </button>
            )}

            {isFirstLoginState ? (
              <div className="space-y-6">
                <div className="space-y-1.5 text-center pt-2">
                  <h2 className="text-sm font-black tracking-widest text-white uppercase">Force Password Reset</h2>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Configure your new credentials to authorize node access</p>
                </div>

                {error && (
                  <div className="p-3 bg-zinc-950 border border-zinc-900 text-zinc-300 text-[11px] uppercase tracking-wider rounded-lg flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-zinc-400" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">
                      New Secure Password
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      {...resetForm.register('newPassword')}
                      disabled={isAuthenticating}
                      className="w-full bg-[#000000] border border-zinc-800 text-white placeholder-zinc-700 rounded-xl px-4 py-3 text-xs focus:border-[#FFFFFF] focus:outline-none transition-all font-mono"
                    />
                    {resetForm.formState.errors.newPassword && (
                      <p className="text-[10px] text-zinc-400 flex items-center gap-1 mt-1 uppercase tracking-wide">
                        <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {resetForm.formState.errors.newPassword.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      {...resetForm.register('confirmPassword')}
                      disabled={isAuthenticating}
                      className="w-full bg-[#000000] border border-zinc-800 text-white placeholder-zinc-700 rounded-xl px-4 py-3 text-xs focus:border-[#FFFFFF] focus:outline-none transition-all font-mono"
                    />
                    {resetForm.formState.errors.confirmPassword && (
                      <p className="text-[10px] text-zinc-400 flex items-center gap-1 mt-1 uppercase tracking-wide">
                        <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {resetForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isAuthenticating}
                    className="w-full mt-2 bg-[#FFFFFF] hover:bg-[#000000] hover:text-[#FFFFFF] border border-[#FFFFFF] text-[#000000] font-black py-3 rounded-xl transition-all duration-300 text-[10px] uppercase tracking-widest cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isAuthenticating ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Updating Session...</span>
                      </>
                    ) : (
                      'Reset & Authenticate'
                    )}
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex border-b border-zinc-900 justify-center">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); setError(''); }}
                    className={`pb-3.5 px-6 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${
                      authMode === 'login' ? 'border-white text-white' : 'border-transparent text-zinc-550 hover:text-white'
                    }`}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('register'); setError(''); }}
                    className={`pb-3.5 px-6 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${
                      authMode === 'register' ? 'border-white text-white' : 'border-transparent text-zinc-550 hover:text-white'
                    }`}
                  >
                    Register Workspace
                  </button>
                </div>

                {error && (
                  <div className="p-3 bg-zinc-950 border border-zinc-900 text-zinc-300 text-[11px] uppercase tracking-wider rounded-lg flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-zinc-400" />
                    <span>{error}</span>
                  </div>
                )}

                {authMode === 'login' ? (
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">
                        Workspace Tenant
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. acme_warehouse"
                        {...loginForm.register('tenant')}
                        disabled={isAuthenticating}
                        className="w-full bg-[#000000] border border-zinc-800 text-white placeholder-zinc-700 rounded-xl px-4 py-3 text-xs tracking-wider focus:border-[#FFFFFF] focus:outline-none transition-all uppercase"
                      />
                      {loginForm.formState.errors.tenant && (
                        <p className="text-[10px] text-zinc-400 flex items-center gap-1 mt-1 uppercase tracking-wide">
                          <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {loginForm.formState.errors.tenant.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">
                        Security Email
                      </label>
                      <input
                        type="text"
                        placeholder="operator@synq.to"
                        {...loginForm.register('email')}
                        disabled={isAuthenticating}
                        className="w-full bg-[#000000] border border-zinc-800 text-white placeholder-zinc-700 rounded-xl px-4 py-3 text-xs tracking-wider focus:border-[#FFFFFF] focus:outline-none transition-all font-mono"
                      />
                      {loginForm.formState.errors.email && (
                        <p className="text-[10px] text-zinc-400 flex items-center gap-1 mt-1 uppercase tracking-wide">
                          <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {loginForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-zinc-450 uppercase tracking-wider block">
                        Access Pass
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••••••"
                        {...loginForm.register('password')}
                        disabled={isAuthenticating}
                        className="w-full bg-[#000000] border border-zinc-800 text-white placeholder-zinc-700 rounded-xl px-4 py-3 text-xs tracking-wider focus:border-[#FFFFFF] focus:outline-none transition-all font-mono"
                      />
                      {loginForm.formState.errors.password && (
                        <p className="text-[10px] text-zinc-400 flex items-center gap-1 mt-1 uppercase tracking-wide">
                          <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {loginForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isAuthenticating}
                      className="w-full mt-2 bg-[#FFFFFF] hover:bg-[#000000] hover:text-[#FFFFFF] border border-[#FFFFFF] text-[#000000] font-black py-3 rounded-xl transition-all duration-300 text-[10px] uppercase tracking-widest cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isAuthenticating ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Configuring Node...</span>
                        </>
                      ) : (
                        'Authenticate Session'
                      )}
                    </button>

                    <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-zinc-900"></div>
                      <span className="flex-shrink mx-4 text-zinc-600 text-[9px] uppercase tracking-widest font-black">OR</span>
                      <div className="flex-grow border-t border-zinc-900"></div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowGoogleModal(true)}
                      className="w-full bg-transparent hover:bg-zinc-950 border border-zinc-800 text-white font-black py-3 rounded-xl transition-all duration-200 text-[10px] uppercase tracking-widest cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Globe className="h-3.5 w-3.5 text-zinc-400" />
                      <span>Sign in with Google</span>
                    </button>
                  </form>
                ) : (
                  <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">
                        Workspace Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Lenovo"
                        {...registerForm.register('tenant')}
                        disabled={isAuthenticating}
                        className="w-full bg-[#000000] border border-zinc-800 text-white placeholder-zinc-700 rounded-xl px-4 py-3 text-xs tracking-wider focus:border-[#FFFFFF] focus:outline-none transition-all uppercase"
                      />
                      {registerForm.formState.errors.tenant && (
                        <p className="text-[10px] text-zinc-400 flex items-center gap-1 mt-1 uppercase tracking-wide">
                          <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {registerForm.formState.errors.tenant.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">
                        Operator Username
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. aditya"
                        {...registerForm.register('username')}
                        disabled={isAuthenticating}
                        className="w-full bg-[#000000] border border-zinc-800 text-white placeholder-zinc-700 rounded-xl px-4 py-3 text-xs tracking-wider focus:border-[#FFFFFF] focus:outline-none transition-all"
                      />
                      {registerForm.formState.errors.username && (
                        <p className="text-[10px] text-zinc-400 flex items-center gap-1 mt-1 uppercase tracking-wide">
                          <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {registerForm.formState.errors.username.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">
                        Operator Email
                      </label>
                      <input
                        type="text"
                        placeholder="aditya@lenovo.com"
                        {...registerForm.register('email')}
                        disabled={isAuthenticating}
                        className="w-full bg-[#000000] border border-zinc-800 text-white placeholder-zinc-700 rounded-xl px-4 py-3 text-xs tracking-wider focus:border-[#FFFFFF] focus:outline-none transition-all font-mono"
                      />
                      {registerForm.formState.errors.email && (
                        <p className="text-[10px] text-zinc-400 flex items-center gap-1 mt-1 uppercase tracking-wide">
                          <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {registerForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-zinc-450 uppercase tracking-wider block">
                        Password
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••••••"
                        {...registerForm.register('password')}
                        disabled={isAuthenticating}
                        className="w-full bg-[#000000] border border-zinc-800 text-white placeholder-zinc-700 rounded-xl px-4 py-3 text-xs tracking-wider focus:border-[#FFFFFF] focus:outline-none transition-all font-mono"
                      />
                      {registerForm.formState.errors.password && (
                        <p className="text-[10px] text-zinc-400 flex items-center gap-1 mt-1 uppercase tracking-wide">
                          <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {registerForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isAuthenticating}
                      className="w-full mt-2 bg-[#FFFFFF] hover:bg-[#000000] hover:text-[#FFFFFF] border border-[#FFFFFF] text-[#000000] font-black py-3 rounded-xl transition-all duration-300 text-[10px] uppercase tracking-widest cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isAuthenticating ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Registering Node...</span>
                        </>
                      ) : (
                        'Create Workspace & Owner'
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}

            <div className="text-center pt-2 flex items-center justify-center gap-1.5 text-zinc-600 text-[10px] border-t border-zinc-900 pt-4 uppercase tracking-wider font-semibold">
              <Lock className="h-3 w-3 text-zinc-650" />
              <span>Secure Enterprise Node</span>
            </div>

          </motion.div>
        </div>
      )}

      {showGoogleModal && (
        <div className="fixed inset-0 flex items-center justify-center z-55 bg-black/85 backdrop-blur-md px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-[#09090B] border border-zinc-900 rounded-3xl p-8 space-y-6 shadow-2xl relative font-sans"
          >
            <div className="space-y-1.5 text-center">
              <h3 className="text-xs font-black tracking-widest text-white uppercase">Google OAuth Node</h3>
              <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Simulated Federated Identity Authorization</p>
            </div>

            <form onSubmit={handleGoogleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">Account Name</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-600">
                    <User className="h-3.5 w-3.5" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Anshika"
                    value={googleName}
                    onChange={e => setGoogleName(e.target.value)}
                    className="w-full bg-[#000000] border border-zinc-800 text-white placeholder-zinc-700 rounded-xl pl-9 pr-4 py-2.5 text-xs focus:border-[#FFFFFF] focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">Email Address</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-600">
                    <Mail className="h-3.5 w-3.5 font-bold" />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="anshika@lenovo.com"
                    value={googleEmail}
                    onChange={e => setGoogleEmail(e.target.value)}
                    className="w-full bg-[#000000] border border-zinc-800 text-white placeholder-zinc-700 rounded-xl pl-9 pr-4 py-2.5 text-xs focus:border-[#FFFFFF] focus:outline-none transition-all font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(false)}
                  className="flex-1 py-2.5 bg-transparent hover:bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="flex-1 py-2.5 bg-[#FFFFFF] hover:bg-[#000000] hover:text-[#FFFFFF] border border-[#FFFFFF] text-[#000000] rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isAuthenticating ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Sign In'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  )
}

export default Login
