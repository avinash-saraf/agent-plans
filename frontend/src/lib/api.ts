/** Nest API boundary; errors never silently fall back to sample data. */
const baseUrl = (import.meta.env?.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body) headers.set('Content-Type', 'application/json')
  let response: Response
  try {
    response = await fetch(baseUrl + path, { ...options, headers, credentials: 'include' })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new ApiError(0, 'UNAVAILABLE', 'Couldn’t connect. Please try again in a moment.')
  }
  if (response.status === 204) return undefined as T
  const data: unknown = response.headers.get('content-type')?.includes('application/json')
    ? await response.json()
    : null
  if (!response.ok) {
    const error =
      data &&
      typeof data === 'object' &&
      'error' in data &&
      data.error &&
      typeof data.error === 'object'
        ? data.error
        : null
    const nestMessage = data && typeof data === 'object' && 'message' in data ? data.message : null
    const message = error && 'message' in error ? error.message : nestMessage
    throw new ApiError(
      response.status,
      error && 'code' in error ? String(error.code) : 'REQUEST_FAILED',
      response.status >= 500
        ? 'Couldn’t connect. Please try again in a moment.'
        : typeof message === 'string'
          ? message
          : Array.isArray(message) && message.every((item) => typeof item === 'string')
            ? message.join('. ')
            : 'The request could not be completed. Please try again.',
    )
  }
  if (data === null)
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      'The server returned an unexpected response.',
    )
  return data as T
}

export async function getBackendHealth(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch('/backend-health', { signal })
    return response.ok && (await response.text()) === 'Hello World!'
  } catch {
    return false
  }
}
