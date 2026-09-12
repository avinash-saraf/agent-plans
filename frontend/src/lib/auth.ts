import { ApiError, apiRequest } from './api.ts'

export interface AuthUser {
  id: string
  name: string
  email: string
  createdAt: string
}
export interface AuthSession {
  user: AuthUser
  accessToken: string
}

function isUser(value: unknown): value is AuthUser {
  return (
    !!value &&
    typeof value === 'object' &&
    ['id', 'name', 'email', 'createdAt'].every(
      (key) => key in value && typeof (value as Record<string, unknown>)[key] === 'string',
    )
  )
}

export async function authenticate(
  mode: 'login' | 'register',
  fields: { name?: string; email: string; password: string },
  signal?: AbortSignal,
): Promise<AuthSession> {
  const body = {
    email: fields.email.trim(),
    password: fields.password,
    ...(mode === 'register' ? { name: fields.name?.trim() } : {}),
  }
  const data = await apiRequest<unknown>('/auth/' + mode, {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  })
  if (
    !data ||
    typeof data !== 'object' ||
    !('user' in data) ||
    !isUser(data.user) ||
    !('accessToken' in data) ||
    typeof data.accessToken !== 'string' ||
    !data.accessToken
  )
    throw new ApiError(
      200,
      'INVALID_RESPONSE',
      'We couldn’t finish signing you in. Please try again.',
    )
  return { user: data.user, accessToken: data.accessToken }
}

export async function getProfile(accessToken: string, signal?: AbortSignal): Promise<AuthUser> {
  const data = await apiRequest<unknown>('/auth/me', {
    headers: { Authorization: 'Bearer ' + accessToken },
    signal,
  })
  if (!isUser(data)) throw new ApiError(200, 'INVALID_RESPONSE', 'We couldn’t load your profile.')
  return data
}
