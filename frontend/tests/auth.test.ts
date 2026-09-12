import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { authenticate, getProfile } from '../src/lib/auth.ts'
import { apiRequest, ApiError } from '../src/lib/api.ts'

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})
const user = {
  id: 'user-1',
  name: 'Test Person',
  email: 'test@example.com',
  createdAt: '2026-09-12T12:00:00Z',
}

test('login sends exactly the Nest DTO and profile uses bearer authorization', async () => {
  const requests: { path: string; options?: RequestInit }[] = []
  globalThis.fetch = async (path, options) => {
    requests.push({ path: String(path), options })
    return Response.json(String(path).endsWith('/me') ? user : { user, accessToken: 'test-token' })
  }
  const session = await authenticate('login', {
    name: 'Must not be sent',
    email: ' test@example.com ',
    password: 'test-password',
  })
  assert.deepEqual(JSON.parse(String(requests[0].options?.body)), {
    email: 'test@example.com',
    password: 'test-password',
  })
  assert.equal(requests[0].path, '/api/auth/login')
  assert.deepEqual(await getProfile(session.accessToken), user)
  assert.equal(new Headers(requests[1].options?.headers).get('Authorization'), 'Bearer test-token')
})

test('registration includes a trimmed name', async () => {
  globalThis.fetch = async (path, options) => {
    assert.equal(path, '/api/auth/register')
    assert.deepEqual(JSON.parse(String(options?.body)), {
      name: 'Test Person',
      email: 'test@example.com',
      password: 'test-password',
    })
    return Response.json({ user, accessToken: 'test-token' })
  }
  assert.equal(
    (
      await authenticate('register', {
        name: ' Test Person ',
        email: user.email,
        password: 'test-password',
      })
    ).user.id,
    user.id,
  )
})

test('shows Nest validation and duplicate-account errors without inventing a signed-in user', async () => {
  globalThis.fetch = async () =>
    Response.json(
      {
        statusCode: 400,
        message: ['password must be longer than or equal to 8 characters'],
        error: 'Bad Request',
      },
      { status: 400 },
    )
  await assert.rejects(
    authenticate('register', { name: user.name, email: user.email, password: 'short' }),
    /password must be longer/,
  )
  globalThis.fetch = async () =>
    Response.json(
      { statusCode: 409, message: 'An account with this email already exists', error: 'Conflict' },
      { status: 409 },
    )
  await assert.rejects(
    authenticate('register', { name: user.name, email: user.email, password: 'test-password' }),
    /already exists/,
  )
})

test('rejects malformed successful auth responses', async () => {
  globalThis.fetch = async () =>
    Response.json({ accessToken: 'token', user: { name: 'Incomplete' } })
  await assert.rejects(
    authenticate('login', { email: user.email, password: 'test-password' }),
    (error: unknown) => error instanceof ApiError && error.code === 'INVALID_RESPONSE',
  )
})

test('network failures remain failures and cancellation reaches fetch', async () => {
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch')
  }
  await assert.rejects(
    authenticate('login', { email: user.email, password: 'test-password' }),
    (error: unknown) => error instanceof ApiError && error.code === 'UNAVAILABLE',
  )
  const controller = new AbortController()
  controller.abort()
  globalThis.fetch = async (_path, options) => {
    assert.equal(options?.signal, controller.signal)
    throw controller.signal.reason
  }
  await assert.rejects(getProfile('test-token', controller.signal), { name: 'AbortError' })
})

test('handles empty successful responses', async () => {
  globalThis.fetch = async () =>
    new Response(null, { status: 204, headers: { 'Content-Type': 'application/json' } })
  assert.equal(await apiRequest('/empty'), undefined)
})
