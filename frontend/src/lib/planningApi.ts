import { apiRequest } from './api.ts'
import { parseRound, type RoundResult, type RunPlanInput } from './room.ts'

/** Configure only after the teammate supplies the route. No invented endpoint or silent fallback. */
export const planningPath = import.meta.env?.VITE_PLANNER_API_PATH?.trim() || ''
export async function requestRound(
  input: RunPlanInput,
  signal?: AbortSignal,
): Promise<RoundResult> {
  if (!planningPath.startsWith('/') || planningPath.startsWith('//'))
    throw new Error('Live planning is still being connected. You can explore the example round.')
  const result = await apiRequest<unknown>(planningPath, {
    method: 'POST',
    body: JSON.stringify(input),
    signal,
  })
  return parseRound(result, input.members)
}
