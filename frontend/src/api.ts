import type { Member, RunResult } from "./types.ts";

const json = async (res: Response) => {
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : `request failed (${res.status})`);
  return body;
};

export const listMembers = async (slug: string): Promise<Member[]> =>
  (await json(await fetch(`/api/groups/${encodeURIComponent(slug)}/members`))).members as Member[];

export const joinGroup = async (slug: string, name: string, context: string): Promise<Member> =>
  (await json(
    await fetch(`/api/groups/${encodeURIComponent(slug)}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, context }),
    }),
  )).member as Member;

/**
 * `demo=1` serves the cached run. Conference wifi will betray you, so the
 * fixture is reachable from the UI, not just from curl.
 */
export const runPlan = async (slug: string, city: string, demo: boolean): Promise<RunResult> =>
  (await json(
    await fetch(`/api/groups/${encodeURIComponent(slug)}/plan${demo ? "?demo=1" : ""}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ city }),
    }),
  )) as unknown as RunResult;
