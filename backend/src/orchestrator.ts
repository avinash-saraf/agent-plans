import type { ChatPort } from "./ports.ts";
import type { FinalPicks, Member, MemberVote, Pick, Ranked, SearchPlan } from "./types.ts";
import { attemptTwice, correctionNote, parseFinalPicks, parseSearchPlan } from "./validate.ts";

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
  `The group has already voted and the spots below are locked. You are not choosing anything — the tally chose.

For each spot, say who it appeals to and who it does not, by name.

Rules:
- Be blunt and specific. Give the reason, not a feeling: "closes at 10", "everything is $18+", "nothing vegan but fries".
- One or two short sentences each. No hedging, no "might", no "could be fun for some".
- Start with the people, not the venue. The name is already on screen above your text, so repeating it wastes the line. Write "Maya and Nazar — vegan menu, nothing over $20", not "Veracruz All Natural appeals to Maya and Nazar because...".
- Name the actual people. Every person should show up somewhere across the spots.
- If a spot genuinely works for everyone, say so in doesntAppeal — do not invent an objection.
- These are separate suggestions, not an itinerary. Never give a time, never order them, never connect one to another ("start here", "then head to", "afterwards").

Refer to each spot by candidateId. Never write a url.
Allowed candidateIds: ${winners.map((w) => w.id).join(", ")}

The ids are internal plumbing. In "appeals" and "doesntAppeal" — the text people actually read — write venue NAMES, never an id. "Maya won't eat here", never "Maya voted no on c6".

Reply with JSON only, no prose:
{"picks":[{"candidateId":"","appeals":"","doesntAppeal":""}]}`;

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
): Promise<FinalPicks> => {
  const user = JSON.stringify({
    spots: winners.map((w) => ({ id: w.id, title: w.title, snippet: w.snippet, score: w.score })),
    votes: votes.map((v) => ({ name: v.name, yes: v.yes, maybe: v.maybe, no: v.no, top3: v.top3 })),
    people: members.map((m) => ({ name: m.name, about: m.context })),
  });

  return attemptTwice(
    (correction) =>
      chat({ model, system: finalSystem(winners), user: correction ? user + correctionNote(correction) : user }),
    (raw) => parseFinalPicks(raw, winners),
  );
};

/**
 * Ids in, titles and urls out — looked up from our own candidate array so a
 * url can only ever be one Exa actually returned.
 */
export const hydratePicks = (final: FinalPicks, winners: Ranked[]): Pick[] =>
  final.picks.map((p) => {
    const winner = winners.find((w) => w.id === p.candidateId);
    return {
      title: winner?.title ?? p.candidateId,
      url: winner?.url ?? "",
      appeals: p.appeals,
      doesntAppeal: p.doesntAppeal,
    };
  });

export const finalText = (picks: Pick[]): string =>
  `${picks.length} spots worth your time: ${picks.map((p) => p.title).join(", ")}.`;
