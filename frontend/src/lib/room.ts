import example from '../fixtures/round.json' with { type: 'json' }

export interface RoomMember {
  id: string
  name: string
  context: string
}
export interface TranscriptTurn {
  speaker: string
  kind: 'search' | 'vote' | 'final'
  text: string
}
export interface RoundResult {
  schemaVersion?: 2
  transcript: TranscriptTurn[]
  plan: {
    title: string
    steps: {
      what: string
      title: string
      url: string
      fit?: { memberId: string; name: string; vote: 'yes' | 'maybe' | 'no'; reason: string }[]
    }[]
    compromise: string
  }
}
export interface Room {
  slug: string
  city: string
  members: RoomMember[]
}
export const DEMO_MEMBERS: RoomMember[] = [
  {
    id: 'maya',
    name: 'Maya',
    context:
      'I’m vegan. Not “I’ll just have the fries” vegan. Proper food is the one thing I won’t compromise on. After that, I’m pretty easy.',
  },
  {
    id: 'dev',
    name: 'Dev',
    context:
      'I want to see my friends, not shout at them over a speaker. Bookshops, quieter corners, a walk. A packed room is my cue to leave.',
  },
  {
    id: 'sam',
    name: 'Sam',
    context:
      'I have about $20 for the whole night. I love a good plan, but my bank account has veto power. Free things are very much my thing.',
  },
  {
    id: 'nazar',
    name: 'Nazar',
    context:
      'The night starts at 10 and I would happily stay out until 3. Something with a bit of energy, please. I can stay home and be sensible any other day.',
  },
]
export function seedRoom(slug = 'hackathon'): Room {
  return {
    slug,
    city: 'Brooklyn',
    members: slug === 'hackathon' ? structuredClone(DEMO_MEMBERS) : [],
  }
}
export function slugFromPath(path: string): string {
  const slug = path.match(/^\/g\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/i)?.[1]
  return slug?.toLowerCase() || 'hackathon'
}
export function isVenueUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
  } catch {
    return false
  }
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object'
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim()
export function parseRound(value: unknown, members: RoomMember[]): RoundResult {
  if (!record(value) || !Array.isArray(value.transcript) || !record(value.plan))
    throw new Error('The plan response is incomplete. Please try again.')
  const turns = value.transcript
  const plan = value.plan
  if (
    turns.length !== members.length + 2 ||
    !turns.every((turn) => record(turn) && text(turn.speaker) && text(turn.text))
  )
    throw new Error('The conversation is incomplete. Please try again.')
  if (
    turns[0].kind !== 'search' ||
    turns[0].speaker !== 'Orchestrator' ||
    turns.at(-1).kind !== 'final' ||
    turns.at(-1).speaker !== 'Orchestrator' ||
    members.some(
      (member, index) =>
        turns[index + 1].kind !== 'vote' || turns[index + 1].speaker !== member.name,
    )
  )
    throw new Error('The conversation arrived out of order. Please try again.')
  if (
    !text(plan.title) ||
    !text(plan.compromise) ||
    !Array.isArray(plan.steps) ||
    !plan.steps.length ||
    !plan.steps.every(
      (step) =>
        record(step) &&
        text(step.title) &&
        text(step.what) &&
        isVenueUrl(step.url) &&
        (value.schemaVersion !== 2 ||
          (!('time' in step) &&
            Array.isArray(step.fit) &&
            step.fit.length === members.length &&
            members.every((member, index) => {
              const fit = (step.fit as unknown[])[index]
              return (
                record(fit) &&
                fit.memberId === member.id &&
                fit.name === member.name &&
                ['yes', 'maybe', 'no'].includes(String(fit.vote)) &&
                text(fit.reason) &&
                fit.reason.length <= 160
              )
            }))),
    )
  )
    throw new Error('The itinerary is incomplete. Please try again.')
  return value as unknown as RoundResult
}
export const DEMO_ROUND = parseRound(example, DEMO_MEMBERS)
export function formatPlan(plan: RoundResult['plan']): string {
  return [
    plan.title,
    ...plan.steps.map((step) =>
      [
        step.title,
        step.what,
        ...(step.fit || []).map(
          (fit) =>
            `${fit.vote === 'yes' ? '✓' : fit.vote === 'no' ? '−' : '~'} ${fit.name}: ${fit.reason}`,
        ),
        step.url,
      ].join('\n'),
    ),
    'The compromise: ' + plan.compromise,
  ].join('\n\n')
}
export function validateRoom(room: Room): string | null {
  if (!room.city.trim()) return 'Add a city first.'
  if (room.members.length !== 4) return 'Bring four people into the group to make a plan.'
  if (room.members.some((member) => !member.name.trim() || !member.context.trim()))
    return 'Everyone needs a name and a little context.'
  return null
}
