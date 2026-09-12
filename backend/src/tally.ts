import { hostOf } from "./candidates.ts";
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

export const MIN_PICKS = 3;
export const MAX_PICKS = 5;

/**
 * Pick 3-5 distinct spots: one champion per person first, then by score.
 *
 * CONTEXT.md specifies `ranked.slice(0, 3)`. Pure net-yes is the right rule for
 * picking *one* thing a group will do together, but it is the wrong rule for a
 * list of suggestions, and live runs showed why twice over:
 *
 *   - it concentrates. If a category appeals to a majority, every venue in that
 *     category outscores everything else and the list is four of the same thing.
 *   - it silently deletes the minority. A spot one person loves and three veto
 *     scores negative *because* it is polarising — so the one thing Dev would
 *     actually show up to can never appear, and every card reads "Dev won't
 *     like this" with nothing anywhere for him.
 *
 * The product is a list of distinct spots, each explained as "works for these
 * people, not for those". That needs coverage, not consensus. So:
 *
 *   1. one champion per person, in members order — their own highest preference
 *      that is still available, honouring their ranking before the group's
 *   2. fill toward MAX_PICKS by score across unused searches and sites
 *   3. fill toward MAX_PICKS by score, sites only
 *   4. only if still under MIN_PICKS, drop the remaining fussiness
 *
 * Hostname is preferred throughout but never absolute: two urls on one host can
 * be a venue's homepage and its events page (one spot, counted twice) or five
 * events on one listings site (five spots, counted once). Preferring fresh hosts
 * handles the first; the last pass stops the second from starving the list.
 */
export const pickWinners = (
  candidates: Candidate[],
  votes: MemberVote[],
  max = MAX_PICKS,
  min = MIN_PICKS,
): Ranked[] => {
  const ranked = rank(candidates, votes);
  const winners: Ranked[] = [];
  const taken = new Set<string>();
  const usedBuckets = new Set<number>();
  const usedHosts = new Set<string>();

  const available = (c: Ranked) => !taken.has(c.id) && !usedHosts.has(hostOf(c.url));

  const take = (c: Ranked) => {
    winners.push(c);
    taken.add(c.id);
    usedBuckets.add(c.bucket);
    usedHosts.add(hostOf(c.url));
  };

  const fill = (upTo: number, skip: (c: Ranked) => boolean) => {
    for (const c of ranked) {
      if (winners.length >= upTo) return;
      if (taken.has(c.id) || skip(c)) continue;
      take(c);
    }
  };

  // Pass 1: give everyone something. Their own top3 order comes first — this is
  // the one place a person's ranking outranks the group's score.
  for (const vote of votes) {
    if (winners.length >= max) break;

    const byOwnRanking = vote.top3
      .map((id) => ranked.find((c) => c.id === id))
      .filter((c): c is Ranked => c !== undefined);

    const champion =
      byOwnRanking.find(available) ?? ranked.find((c) => vote.yes.includes(c.id) && available(c));

    if (champion) take(champion);
  }

  fill(max, (c) => usedBuckets.has(c.bucket) || usedHosts.has(hostOf(c.url)));
  fill(max, (c) => usedHosts.has(hostOf(c.url)));
  // min never overrides an explicit max — a caller asking for 2 gets at most 2.
  fill(Math.min(min, max), () => false);

  return winners;
};
