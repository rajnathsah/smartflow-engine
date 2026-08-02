import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

const apiClient = axios.create({
  withCredentials: true
})

apiClient.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
  if (csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken
  }
  return config
})

apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      const isLoginPath = window.location.pathname.endsWith('/login') || window.location.pathname === '/'
      if (!isLoginPath) {
        useAuthStore.getState().logout()
        localStorage.setItem('session_expired_inactivity', 'true')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient

