import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/authStore'
import { APP_CONFIG } from '@/config/constants'
import apiClient from '@/api/client'

/**
 * Parses JWT to read claims without a library.
 */
function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch (e) {
    return null
  }
}

export function useSessionTimeout() {
  const { isAuthenticated, token, logout, login } = useAuthStore()

  // Track timestamps in ref to avoid unnecessary re-renders
  const lastActiveRef = useRef<number>(Date.now())
  const lastRefreshRef = useRef<number>(Date.now())
  const isRefreshingRef = useRef<boolean>(false)

  useEffect(() => {
    if (!isAuthenticated || !token) {
      return
    }

    // Set initial active time
    lastActiveRef.current = Date.now()
    localStorage.setItem('session_last_active', String(Date.now()))

    // Throttle user activity writes to localStorage
    let lastWrite = 0
    const recordActivity = () => {
      const now = Date.now()
      lastActiveRef.current = now
      if (now - lastWrite > 3000) {
        localStorage.setItem('session_last_active', String(now))
        lastWrite = now
      }
    }

    // Attach listeners for activity tracking
    const events = ['mousemove', 'keydown', 'click', 'scroll']
    events.forEach(event => {
      window.addEventListener(event, recordActivity, { passive: true })
    })

    // Setup checking interval
    const checkInterval = setInterval(async () => {
      const now = Date.now()

      // 1. Session Idle Timeout Check
      // Sync last active across multiple tabs
      const storedLastActive = Number(localStorage.getItem('session_last_active') || '0')
      const effectiveLastActive = Math.max(lastActiveRef.current, storedLastActive)
      const timeoutMs = APP_CONFIG.SESSION_TIMEOUT_MINUTES * 60 * 1000

      if (now - effectiveLastActive > timeoutMs) {
        clearInterval(checkInterval)
        logout()
        localStorage.setItem('session_expired_inactivity', 'true')
        window.location.href = '/login'
        return
      }

      // 2. Silent Refresh / Slide Expiration Check
      if (isRefreshingRef.current) return

      const jwtPayload = parseJwt(token)
      if (!jwtPayload || !jwtPayload.exp) return

      const expMs = jwtPayload.exp * 1000
      const timeToExpiry = expMs - now

      // Refresh if the token expires in less than 15 minutes (or 25% of lifetime)
      // Or if the user has been active and 15 minutes have passed since last refresh
      const fifteenMinutesMs = 15 * 60 * 1000
      const shouldRefresh = timeToExpiry < fifteenMinutesMs || (now - lastRefreshRef.current > fifteenMinutesMs)

      if (shouldRefresh) {
        isRefreshingRef.current = true
        try {
          const res = await apiClient.post('/api/v1/auth/refresh')
          if (res.data && res.data.access_token) {
            const data = res.data
            login(
              data.access_token,
              data.tenant_name,
              data.role,
              data.email,
              false
            )
            lastRefreshRef.current = Date.now()
          }
        } catch (err) {
          // If 401, the response interceptor automatically handles logout
          console.error('Failed to silently refresh session token:', err)
        } finally {
          isRefreshingRef.current = false
        }
      }
    }, 10000) // check every 10 seconds

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, recordActivity)
      })
      clearInterval(checkInterval)
    }
  }, [isAuthenticated, token, logout, login])
}

export default useSessionTimeout
