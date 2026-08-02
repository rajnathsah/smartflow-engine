/**
 * useBrandTitle — keeps the browser tab title in sync with APP_CONFIG.APP_NAME.
 *
 * Usage:
 *   useBrandTitle()                  // → "synq.to"
 *   useBrandTitle('Overview')        // → "Overview · synq.to"
 *   useBrandTitle('Failed Pipeline') // → "Failed Pipeline · synq.to"
 */
import { useEffect } from 'react'
import { APP_CONFIG } from '@/config/constants'

export function useBrandTitle(pageTitle?: string): void {
  useEffect(() => {
    document.title = pageTitle
      ? `${pageTitle} · ${APP_CONFIG.APP_NAME}`
      : APP_CONFIG.APP_NAME
  }, [pageTitle])
}
