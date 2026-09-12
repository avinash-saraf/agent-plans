import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEMO_MEMBERS,
  DEMO_ROUND,
  isVenueUrl,
  parseRound,
  readRoom,
  seedRoom,
  slugFromPath,
  validateRoom,
} from '../src/lib/room.ts'
import { requestRound } from '../src/lib/planningApi.ts'

test('accepts the six-turn contract and preserves vote text without parsing prose', () => {
  const round = structuredClone(DEMO_ROUND)
  round.transcript[1].text = 'No structured counts are required by the frontend.'
  assert.deepEqual(parseRound(round, DEMO_MEMBERS), round)
})
test('rejects incomplete, reordered, and misattributed conversations', () => {
  const missing = structuredClone(DEMO_ROUND)
  missing.transcript.splice(2, 1)
  assert.throws(() => parseRound(missing, DEMO_MEMBERS), /incomplete/)
  const reordered = structuredClone(DEMO_ROUND)
  ;[reordered.transcript[1], reordered.transcript[2]] = [
    reordered.transcript[2],
    reordered.transcript[1],
  ]
  assert.throws(() => parseRound(reordered, DEMO_MEMBERS), /out of order/)
  const wrongKind = structuredClone(DEMO_ROUND)
  wrongKind.transcript[5].kind = 'search'
  assert.throws(() => parseRound(wrongKind, DEMO_MEMBERS), /out of order/)
  assert.throws(() => parseRound(null, DEMO_MEMBERS), /incomplete/)
})
test('requires an explicit compromise and grounded link fields', () => {
  for (const invalidUrl of [
    'javascript:alert(1)',
    'data:text/html,test',
    'https://name:password@example.com',
    '/relative',
    'not a url',
  ]) {
    assert.equal(isVenueUrl(invalidUrl), false)
    const round = structuredClone(DEMO_ROUND)
    round.plan.steps[0].url = invalidUrl
    assert.throws(() => parseRound(round, DEMO_MEMBERS), /itinerary is incomplete/)
  }
  assert.equal(isVenueUrl('https://example.com/venue'), true)
  const round = structuredClone(DEMO_ROUND)
  round.plan.compromise = ' '
  assert.throws(() => parseRound(round, DEMO_MEMBERS), /itinerary is incomplete/)
})
test('restores valid group data and isolates groups by slug', () => {
  const room = { slug: 'friday-people', city: 'Queens', members: [DEMO_MEMBERS[0]] }
  assert.deepEqual(readRoom(JSON.stringify(room), room.slug), room)
  assert.deepEqual(readRoom(JSON.stringify(room), 'another-group'), seedRoom('another-group'))
  assert.equal(seedRoom('another-group').members.length, 0)
  assert.equal(seedRoom('hackathon').members.length, 4)
})
test('corrupted local data and duplicate identities recover to a safe room', () => {
  assert.deepEqual(readRoom('{broken', 'hackathon'), seedRoom())
  const duplicate = { ...seedRoom(), members: [DEMO_MEMBERS[0], DEMO_MEMBERS[0]] }
  assert.deepEqual(readRoom(JSON.stringify(duplicate), 'hackathon'), seedRoom())
  const seed = seedRoom()
  seed.members[0].name = 'Changed'
  assert.equal(DEMO_MEMBERS[0].name, 'Maya')
})
test('planning needs exactly four complete blurbs and a city', () => {
  assert.equal(validateRoom(seedRoom()), null)
  assert.match(validateRoom({ ...seedRoom(), city: ' ' })!, /city/)
  assert.match(validateRoom({ ...seedRoom(), members: [] })!, /four people/)
  const room = seedRoom()
  room.members[0].context = ' '
  assert.match(validateRoom(room)!, /context/)
  assert.equal(slugFromPath('/g/Friday-People'), 'friday-people')
  assert.equal(slugFromPath('/g/../../escape'), 'hackathon')
})
test('an unconfigured planning route fails explicitly rather than returning sample data', async () => {
  await assert.rejects(
    requestRound({ city: 'Brooklyn', members: DEMO_MEMBERS }),
    /still being connected/,
  )
})
