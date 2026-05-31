import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevents aggressive automatic queries on switching tabs
      retry: 1,                    // Limit retries on failures for cleaner UX
      staleTime: 30 * 1000,        // Cache active statuses for 30s before considering stale
    },
  },
})
