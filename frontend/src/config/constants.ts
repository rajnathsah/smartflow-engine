/**
 * APP_CONFIG — single source of truth for all application-level branding and metadata.
 *
 * Change these values once and they will propagate to:
 *   • Sidebar logo & name
 *   • Login page (hero, header, footer, CTA buttons)
 *   • Log console viewer status bar
 *   • HTML <title> tag (via useBrandTitle hook)
 *   • Copyright footers
 *   • Demo credential placeholders
 *
 * @module config/constants
 */

export const APP_CONFIG = {
  /** Primary display name used in UI elements (e.g. "synq.to") */
  APP_NAME: 'synq.to',

  /** Full legal / formal company name */
  COMPANY_NAME: 'Synq Technologies',

  /** Primary support contact */
  SUPPORT_EMAIL: 'support@synq.to',

  /** Used for demo credential placeholder in Login */
  DEMO_EMAIL: 'admin@synq.to',

  /** Used for email input placeholder on login form */
  EMAIL_PLACEHOLDER: 'operator@synq.to',

  /** Short tagline shown on the landing hero */
  TAGLINE: 'Zero-Touch ETL. Auto-infer schemas and sync databases in minutes, not days.',

  /** Console version string rendered in the log viewer status bar */
  CONSOLE_VERSION: 'v1.0',

  /**
   * Zustand persist store keys — kept here so they stay in sync if APP_NAME changes.
   * NOTE: changing these will reset persisted client state (users will be logged out).
   */
  STORE_KEY_AUTH: 'synq-auth',
  STORE_KEY_PIPELINES: 'synq-pipelines-decoupled',
  STORE_KEY_ROLES: 'synq-custom-roles',
  SESSION_TIMEOUT_MINUTES: 60,
} as const

/** Derived helpers */
export const APP_NAME      = APP_CONFIG.APP_NAME
export const COMPANY_NAME  = APP_CONFIG.COMPANY_NAME
export const SUPPORT_EMAIL = APP_CONFIG.SUPPORT_EMAIL
