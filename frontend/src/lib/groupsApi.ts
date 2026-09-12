import { apiRequest } from './api.ts'
import { parseRound, type Room, type RoundResult, type TranscriptTurn } from './room.ts'

export interface SharedRoom extends Room {
  revision: number
  run: null | {
    id: string
    status: 'running' | 'complete' | 'failed'
    startedAt: string
    transcript: TranscriptTurn[]
    result?: RoundResult
    error?: string
  }
}
function parseGroup(value: SharedRoom): SharedRoom {
  if (
    !value ||
    typeof value.slug !== 'string' ||
    typeof value.city !== 'string' ||
    !Number.isInteger(value.revision) ||
    !Array.isArray(value.members) ||
    value.members.length > 4 ||
    value.members.some((m) => !m.id || !m.name || !m.context)
  )
    throw new Error('The group response is incomplete. Please refresh.')
  if (value.run?.result) parseRound(value.run.result, value.members)
  return value
}
async function group(path: string, options?: RequestInit) {
  return parseGroup(await apiRequest<SharedRoom>(path, options))
}
const path = (slug: string) => '/groups/' + encodeURIComponent(slug)
export const getGroup = (slug: string, signal?: AbortSignal) => group(path(slug), { signal })
export const createGroup = (slug: string, city: string) =>
  group('/groups', { method: 'POST', body: JSON.stringify({ slug, city }) })
export const saveCity = (room: SharedRoom, city: string) =>
  group(path(room.slug), {
    method: 'PATCH',
    body: JSON.stringify({ revision: room.revision, city }),
  })
export const savePerson = (
  room: SharedRoom,
  person: { name: string; context: string },
  id?: string,
) =>
  group(path(room.slug) + '/members' + (id ? '/' + encodeURIComponent(id) : ''), {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify({ revision: room.revision, ...person }),
  })
export const removePerson = (room: SharedRoom, id: string) =>
  group(path(room.slug) + '/members/' + encodeURIComponent(id), {
    method: 'DELETE',
    body: JSON.stringify({ revision: room.revision }),
  })
export const makePlan = (room: SharedRoom, signal?: AbortSignal) =>
  group(path(room.slug) + '/plan', {
    method: 'POST',
    body: JSON.stringify({ revision: room.revision }),
    signal,
  })
export const plannerStatus = () => apiRequest<{ ready: boolean }>('/planning/status')
