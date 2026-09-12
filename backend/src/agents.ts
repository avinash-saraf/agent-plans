import type { ChatPort } from "./ports.ts";
import type { Candidate, Member, MemberVote } from "./types.ts";
import { attemptTwice, correctionNote, parseVote } from "./validate.ts";

/**
 * The isolation invariant: an agent prompt contains exactly its own member and
 * the candidate list. Never another member's context, never another member's
 * vote, never the running transcript. Break it and you get anchoring plus
 * sycophantic convergence — the vegan signs off on the steakhouse.
 *
 * In review: if it isn't the loop variable, it doesn't go in the prompt.
 */
export const votePrompt = (member: Member, candidateCount: number): string =>
  `You are the agent for ${member.name}. You represent their interests only — you are their advocate, not a neutral assistant.

What ${member.name} told us about themselves:
${member.context}

Sort EVERY candidate id into exactly one of yes, maybe, or no.
Be decisive — if ${member.name} would not actually show up, it is a no.
Then pick your top 3 in order from your yes list (fall back to maybe if you have fewer than 3 yeses).

There are ${candidateCount} candidates. yes, maybe and no together must contain all
${candidateCount} ids, each exactly once — do not drop any and do not repeat any.
Every entry is an id STRING such as "c1". Never an object, never a title, never a url.

Reply with JSON only, no prose:
{"yes":[],"maybe":[],"no":[],"top3":[]}`;

/**
 * Urls are stripped before the candidate list reaches an agent. Agents reason
 * over ids and never need a url, and what is not in the prompt cannot be
 * echoed back as a hallucinated link.
 */
export const agentView = (candidates: Candidate[]) =>
  candidates.map(({ id, title, snippet }) => ({ id, title, snippet }));

/**
 * One call per agent with all 15 candidates. Judged in isolation everything
 * looks fine; judged against 14 alternatives a mediocre option is visibly
 * seventh-best. Also 4 calls instead of 60.
 */
export const voteCall = async (
  member: Member,
  candidates: Candidate[],
  chat: ChatPort,
  model: string,
): Promise<MemberVote> => {
  const list = JSON.stringify(agentView(candidates));

  const parsed = await attemptTwice(
    (correction) =>
      chat({
        model,
        system: votePrompt(member, candidates.length),
        user: correction ? list + correctionNote(correction) : list,
      }),
    (raw) => parseVote(raw, candidates),
  );

  // Identity travels with the payload — a positional bug would attribute Maya's
  // vetoes to Dev and produce a nonsense plan with no clue why.
  return { memberId: member.id, name: member.name, ...parsed };
};

/** All four agents in parallel, then sorted back into members order. */
export const collectVotes = async (
  members: Member[],
  candidates: Candidate[],
  chat: ChatPort,
  model: string,
): Promise<MemberVote[]> => {
  const votes = await Promise.all(members.map((m) => voteCall(m, candidates, chat, model)));
  const order = new Map(members.map((m, i) => [m.id, i]));
  return votes.sort((a, b) => (order.get(a.memberId) ?? 0) - (order.get(b.memberId) ?? 0));
};
