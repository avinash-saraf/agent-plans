import { toCandidates } from "./candidates.ts";
import { collectVotes } from "./agents.ts";
import { finalText, finalTurn, hydratePlan, searchTurn } from "./orchestrator.ts";
import { pickWinners } from "./tally.ts";
import { voteTurn } from "./voteText.ts";
import type { Models } from "./env.ts";
import type { ChatPort, SearchPort } from "./ports.ts";
import type { Member, RunResult, TranscriptTurn } from "./types.ts";

export type RunInput = {
  members: Member[];
  city: string;
  chat: ChatPort;
  search: SearchPort;
  models: Models;
};

/**
 * Six LLM calls, straight through:
 *
 *   orchestrator -> 3 exa queries -> 15 candidates -> 4 votes (parallel)
 *   -> tally (plain code) -> orchestrator final
 *
 * No loop and no branch, so it cannot fail to terminate. Turns are pushed to
 * the transcript as they happen, not at the end — if the final turn dies there
 * is still something to demo.
 */
export const runPlan = async ({ members, city, chat, search, models }: RunInput): Promise<RunResult> => {
  const transcript: TranscriptTurn[] = [];

  const plan = await searchTurn(members, city, chat, models.strong);
  transcript.push({ speaker: "Orchestrator", kind: "search", text: plan.text });

  const results = (await Promise.all(plan.queries.map((q) => search(q)))).flat();
  const candidates = toCandidates(results);
  if (candidates.length === 0) throw new Error("no candidates came back from search");

  const votes = await collectVotes(members, candidates, chat, models.cheap);
  for (const vote of votes) transcript.push(voteTurn(vote, candidates));

  const winners = pickWinners(candidates, votes);

  const final = await finalTurn(winners, votes, members, chat, models.strong);
  const hydrated = hydratePlan(final, winners);
  transcript.push({ speaker: "Orchestrator", kind: "final", text: finalText(hydrated) });

  return { transcript, plan: hydrated };
};
