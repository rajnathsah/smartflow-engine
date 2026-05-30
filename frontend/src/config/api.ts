export const getApiBaseUrl = (): string => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  if (!baseUrl) {
    return ''
  }
  if (baseUrl.startsWith('/')) {
    return baseUrl
  }
  try {
    new URL(baseUrl)
  } catch {
    throw new Error('Invalid VITE_API_BASE_URL format')
  }
  return baseUrl
}
