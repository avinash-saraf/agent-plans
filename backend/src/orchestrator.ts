import type { ChatPort } from "./ports.ts";
import type { FinalPlan, Member, MemberVote, Plan, Ranked, SearchPlan } from "./types.ts";
import { attemptTwice, correctionNote, parseFinal, parseSearchPlan } from "./validate.ts";

export const QUERY_COUNT = 3;

const searchSystem = (city: string) =>
  `You plan a night out in ${city} for a group of friends.

Read what each person said about themselves and write ${QUERY_COUNT} web search queries that would surface real venues and events they could actually go to.

Each query must serve a DIFFERENT person and a different kind of place. Write one query per person whose needs clash most with the rest of the group — if one person is loud-and-late and another needs quiet, that is two separate queries, not one blended query that serves neither.

Do not let the loudest constraint swallow all three. If every query returns the same kind of venue, the group has nothing to choose between and you have failed.

Also write one short line, first person, saying what you are looking for — it will be shown as your turn in a group chat.

Reply with JSON only, no prose:
{"queries":["","",""],"text":""}`;

/** Orchestrator turn 1. The only turn that sees every member's blob. */
export const searchTurn = async (
  members: Member[],
  city: string,
  chat: ChatPort,
  model: string,
): Promise<SearchPlan> => {
  const user = JSON.stringify(members.map((m) => ({ name: m.name, about: m.context })));
  const plan = await attemptTwice(
    (correction) =>
      chat({ model, system: searchSystem(city), user: correction ? user + correctionNote(correction) : user }),
    parseSearchPlan,
  );
  return { ...plan, queries: plan.queries.slice(0, QUERY_COUNT) };
};

const finalSystem = (winners: Ranked[]) =>
  `The group has already voted and the winners below are locked. You are not choosing anything — the tally chose.

Your job is sequencing and narrative only:
- order the winning venues into one evening and give each a plausible time
- write a compromise line that names a specific person and what they gave up

Name people directly, the way a friend would — "Maya voted no on both bars". The dissent has to show up somewhere.

Refer to venues by candidateId only. Never write a url.
Allowed candidateIds: ${winners.map((w) => w.id).join(", ")}

Reply with JSON only, no prose:
{"title":"","steps":[{"time":"","candidateId":"","what":""}],"compromise":""}`;

/**
 * Orchestrator turn 2. The agents no longer speak for themselves, so this turn
 * carries the entire narrative load — it gets the raw votes with names attached.
 */
export const finalTurn = async (
  winners: Ranked[],
  votes: MemberVote[],
  members: Member[],
  chat: ChatPort,
  model: string,
): Promise<FinalPlan> => {
  const user = JSON.stringify({
    winners: winners.map((w) => ({ id: w.id, title: w.title, snippet: w.snippet, score: w.score })),
    votes: votes.map((v) => ({ name: v.name, yes: v.yes, maybe: v.maybe, no: v.no, top3: v.top3 })),
    people: members.map((m) => ({ name: m.name, about: m.context })),
  });

  return attemptTwice(
    (correction) =>
      chat({ model, system: finalSystem(winners), user: correction ? user + correctionNote(correction) : user }),
    (raw) => parseFinal(raw, winners),
  );
};

/**
 * Ids in, titles and urls out — looked up from our own candidate array so a
 * url can only ever be one Exa actually returned.
 */
export const hydratePlan = (final: FinalPlan, winners: Ranked[]): Plan => ({
  title: final.title,
  compromise: final.compromise,
  steps: final.steps.map((s) => {
    const winner = winners.find((w) => w.id === s.candidateId);
    return {
      time: s.time,
      what: s.what,
      title: winner?.title ?? s.candidateId,
      url: winner?.url ?? "",
    };
  }),
});

export const finalText = (plan: Plan): string =>
  `${plan.title} — ${plan.steps.map((s) => `${s.time} ${s.title}`).join(", ")}. ${plan.compromise}`;
