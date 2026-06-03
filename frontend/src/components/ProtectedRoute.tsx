import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

interface ProtectedRouteProps {
  children?: React.ReactNode
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, token, isFirstLogin } = useAuthStore()

  if (!isAuthenticated || !token || isFirstLogin) {
    return <Navigate to="/login" replace />
  }

  return children ? <>{children}</> : <Outlet />
}


export default ProtectedRoute
