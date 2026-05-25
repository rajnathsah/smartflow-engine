import { toast } from 'sonner'

/**
 * Enterprise-grade global toast notification handlers.
 * Decouples sonner toast calls and wraps them in clean success/error actions.
 */
export const notify = {
  success: (message: string, description?: string) => {
    toast.success(message, {
      description,
      duration: 4000
    })
  },
  error: (message: string, description?: string) => {
    toast.error(message, {
      description,
      duration: 5000
    })
  }
}

export const useNotify = () => notify
export default notify
