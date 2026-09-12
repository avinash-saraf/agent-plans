import type { Candidate, MemberVote, TranscriptTurn } from "./types.ts";

/**
 * Agents return no prose, so the transcript line is built in code from the
 * counts plus the top pick's title. Deterministic, free, and it still reads
 * as a turn in a conversation.
 */
export const voteLine = (vote: MemberVote, candidates: Candidate[]): string => {
  const counts = `${vote.yes.length} yes, ${vote.maybe.length} maybe, ${vote.no.length} no`;
  const topId = vote.top3[0];
  const top = candidates.find((c) => c.id === topId);
  return top ? `${counts} — top pick: ${top.title}` : counts;
};

export const voteTurn = (vote: MemberVote, candidates: Candidate[]): TranscriptTurn => ({
  speaker: vote.name,
  kind: "vote",
  text: voteLine(vote, candidates),
});
