import type { Candidate, MemberVote, Ranked } from "./types.ts";

/**
 * The actual decision, in plain code. No LLM.
 *
 * Net yes = yes count minus no count; `maybe` is worth zero, which is the whole
 * point of having it. Ties break on top3 appearances. Nothing is eliminated
 * outright, so the ranked list can never come back empty.
 */
export const rank = (candidates: Candidate[], votes: MemberVote[]): Ranked[] =>
  candidates
    .map((c) => ({
      ...c,
      score:
        votes.filter((v) => v.yes.includes(c.id)).length -
        votes.filter((v) => v.no.includes(c.id)).length,
      picks: votes.filter((v) => v.top3.includes(c.id)).length,
    }))
    .sort((a, b) => b.score - a.score || b.picks - a.picks);

export const WINNER_COUNT = 3;

export const pickWinners = (candidates: Candidate[], votes: MemberVote[]): Ranked[] =>
  rank(candidates, votes).slice(0, WINNER_COUNT);
