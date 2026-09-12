import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEMO_MEMBERS,
  DEMO_ROUND,
  formatPlan,
  isVenueUrl,
  parseRound,
  seedRoom,
  slugFromPath,
  validateRoom,
} from '../src/lib/room.ts'

test('accepts the six-turn contract and preserves vote text without parsing prose', () => {
  const round = structuredClone(DEMO_ROUND)
  round.transcript[1].text = 'No structured counts are required by the frontend.'
  assert.deepEqual(parseRound(round, DEMO_MEMBERS), round)
})

test('requires each person’s attributed reason on new plans and copies without a schedule', () => {
  const round = structuredClone(DEMO_ROUND)
  round.schemaVersion = 2
  round.plan.steps = round.plan.steps.map((step) => ({
    title: step.title,
    what: step.what,
    url: step.url,
    fit: DEMO_MEMBERS.map((m) => ({
      memberId: m.id,
      name: m.name,
      vote: 'yes',
      reason: 'Fits a stated interest.',
    })),
  }))
  assert.doesNotThrow(() => parseRound(round, DEMO_MEMBERS))
  const copied = formatPlan({
    ...round.plan,
    steps: round.plan.steps.map((s) => ({ ...s, time: '7pm' })),
  })
  assert.doesNotMatch(copied, /7pm/)
  assert.match(copied, /Maya: Fits a stated interest/)
  round.plan.steps[0].fit![0].memberId = 'someone-else'
  assert.throws(() => parseRound(round, DEMO_MEMBERS), /incomplete/)
  round.plan.steps[0].fit = []
  assert.throws(() => parseRound(round, DEMO_MEMBERS), /incomplete/)
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
