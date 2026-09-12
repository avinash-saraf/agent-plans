import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { createGroup, getGroup, savePerson, makePlan, removePerson } from '../src/lib/groupsApi.ts'
import { DEMO_MEMBERS, DEMO_ROUND } from '../src/lib/room.ts'
const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})
const room = { slug: 'test-group', city: 'Brooklyn', revision: 4, members: DEMO_MEMBERS, run: null }
test('shared group writes send current revision and server-assigned identities', async () => {
  const requests: { url: string; method?: string; body: unknown }[] = []
  globalThis.fetch = async (url, options) => {
    requests.push({
      url: String(url),
      method: options?.method,
      body: options?.body ? JSON.parse(String(options.body)) : null,
    })
    return Response.json(room)
  }
  await createGroup(room.slug, room.city)
  await savePerson(room, { name: 'New', context: 'Likes parks' })
  await removePerson(room, 'maya')
  assert.deepEqual(requests[0].body, { slug: room.slug, city: room.city })
  assert.deepEqual(requests[1].body, { revision: 4, name: 'New', context: 'Likes parks' })
  assert.equal(requests[2].url, '/api/groups/test-group/members/maya')
  assert.equal(requests[2].method, 'DELETE')
})
test('planning uses saved group revision and validates persisted transcript', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/groups/test-group/plan')
    assert.deepEqual(JSON.parse(String(options?.body)), { revision: 4 })
    return Response.json({
      ...room,
      run: {
        id: 'run',
        status: 'complete',
        startedAt: new Date().toISOString(),
        transcript: DEMO_ROUND.transcript,
        result: DEMO_ROUND,
      },
    })
  }
  assert.deepEqual((await makePlan(room)).run?.result, DEMO_ROUND)
  globalThis.fetch = async () =>
    Response.json({ ...room, run: { result: { plan: {}, transcript: [] } } })
  await assert.rejects(getGroup(room.slug), /incomplete/)
})
test('shared group conflicts stay visible and never fall back to device data', async () => {
  globalThis.fetch = async () =>
    Response.json(
      { message: 'The group changed. Refresh it before saving again.' },
      { status: 409 },
    )
  await assert.rejects(savePerson(room, { name: 'New', context: 'Context' }), /group changed/)
})
