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

export default apiClient

