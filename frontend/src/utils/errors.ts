import axios from 'axios'

export class APIError extends Error {
  status?: number
  detail?: string

  constructor(message: string, status?: number, detail?: string) {
    super(message)
    this.name = 'APIError'
    this.status = status
    this.detail = detail
    Object.setPrototypeOf(this, APIError.prototype)
  }
}

export const handleAPIError = (error: unknown): APIError => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const detail = error.response?.data?.detail || error.response?.data?.message || error.message
    return new APIError(detail, status, detail)
  }
  if (error instanceof Error) {
    return new APIError(error.message)
  }
  return new APIError('An unexpected error occurred')
}
