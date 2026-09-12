import { describe, expect, it } from "vitest";
import { MAX_PICKS, MIN_PICKS, pickWinners, rank } from "../src/tally.ts";
import { candidates, oneBucketCandidates, validVote } from "./fixtures.ts";
import type { MemberVote } from "../src/types.ts";

const vote = (yes: string[], no: string[], top3: string[], name = "x"): MemberVote =>
  validVote({
    name,
    memberId: name,
    yes,
    no,
    top3,
    maybe: candidates.map((c) => c.id).filter((id) => !yes.includes(id) && !no.includes(id)),
  });

describe("rank", () => {
  it("scores net yes: yes count minus no count", () => {
    const votes = [
      vote(["c1"], ["c2"], ["c1"], "a"),
      vote(["c1"], ["c2"], ["c1"], "b"),
      vote(["c2"], ["c1"], ["c2"], "c"),
    ];
    const byId = Object.fromEntries(rank(candidates, votes).map((r) => [r.id, r.score]));
    expect(byId.c1).toBe(1);
    expect(byId.c2).toBe(-1);
  });

  it("treats maybe as worth exactly zero", () => {
    const votes = [vote([], [], [], "a"), vote([], [], [], "b")];
    expect(rank(candidates, votes).every((r) => r.score === 0)).toBe(true);
  });

  it("breaks ties on top3 appearances", () => {
    const votes = [
      vote(["c1", "c2"], [], ["c2"], "a"),
      vote(["c1", "c2"], [], ["c2"], "b"),
    ];
    const [first] = rank(candidates, votes);
    expect(first?.id).toBe("c2");
    expect(first?.picks).toBe(2);
  });

  it("keeps a candidate three people love and one hates in contention", () => {
    const votes = [
      vote(["c3"], [], ["c3"], "a"),
      vote(["c3"], [], ["c3"], "b"),
      vote(["c3"], [], ["c3"], "c"),
      vote([], ["c3"], [], "d"),
    ];
    const winner = rank(candidates, votes)[0];
    expect(winner?.id).toBe("c3");
    expect(winner?.score).toBe(2);
  });

  it("never eliminates anything, so the list cannot empty", () => {
    const votes = candidates.map((_c, i) => vote([], candidates.map((x) => x.id), [], `hater${i}`));
    const ranked = rank(candidates, votes);
    expect(ranked).toHaveLength(candidates.length);
    expect(ranked.every((r) => r.score < 0)).toBe(true);
  });

  it("does not mutate the input candidates", () => {
    const snapshot = structuredClone(candidates);
    rank(candidates, [vote(["c1"], ["c2"], ["c1"])]);
    expect(candidates).toEqual(snapshot);
  });
});

describe("pickWinners", () => {
  it("suggests between 3 and 5 spots", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: `c${i + 1}`,
      title: `Venue ${i + 1}`,
      snippet: "",
      url: `https://venue${i + 1}.test/`,
      bucket: i % 3,
    }));
    const winners = pickWinners(many, [vote(["c1", "c2"], ["c9"], ["c1"], "a")]);

    expect(winners.length).toBeGreaterThanOrEqual(MIN_PICKS);
    expect(winners.length).toBeLessThanOrEqual(MAX_PICKS);
  });

  it("ranks strictly by score when everything is already varied", () => {
    const winners = pickWinners(candidates, [vote(["c5", "c4", "c3"], ["c1", "c2"], ["c5", "c4", "c3"])], 3);
    expect(winners).toHaveLength(3);
    expect(new Set(winners.map((w) => w.id))).toEqual(new Set(["c3", "c4", "c5"]));
  });

  it("orders equally scored winners stably by candidate order", () => {
    const votes = [vote(["c3", "c4", "c5"], [], [], "a")];
    expect(pickWinners(candidates, votes, 3).map((w) => w.id)).toEqual(["c3", "c4", "c5"]);
  });

  it("returns everything when there are fewer candidates than slots", () => {
    expect(pickWinners(candidates.slice(0, 2), [])).toHaveLength(2);
  });

  it("returns nothing for no candidates", () => {
    expect(pickWinners([], [])).toEqual([]);
  });

  it("never returns the same candidate twice", () => {
    const winners = pickWinners(candidates, [vote(["c1"], [], ["c1"], "a")]);
    expect(new Set(winners.map((w) => w.id)).size).toBe(winners.length);
  });
});

describe("pickWinners — giving everyone something (DESIGN_DECISIONS.md §17)", () => {
  it("suggests a spot one person loves even when everyone else vetoes it", () => {
    // Exactly the Dev case: his top pick scores -2 precisely because it is
    // polarising, and pure net-yes would delete it.
    const votes = [
      vote(["c1"], ["c5"], ["c1"], "Maya"),
      vote(["c1"], ["c5"], ["c1"], "Sam"),
      vote(["c1"], ["c5"], ["c1"], "Nazar"),
      vote(["c5"], ["c1"], ["c5"], "Dev"),
    ];
    const winners = pickWinners(candidates, votes);

    expect(winners.map((w) => w.id)).toContain("c5");
    expect(winners.find((w) => w.id === "c5")?.score).toBe(-2);
  });

  it("gives every voter one of their own top picks when it can", () => {
    const votes = [
      vote(["c1"], [], ["c1"], "Maya"),
      vote(["c2"], [], ["c2"], "Dev"),
      vote(["c3"], [], ["c3"], "Sam"),
      vote(["c4"], [], ["c4"], "Nazar"),
    ];
    const winners = pickWinners(candidates, votes).map((w) => w.id);

    for (const id of ["c1", "c2", "c3", "c4"]) expect(winners).toContain(id);
  });

  it("honours a voter's own ranking, not just the group score", () => {
    // c1 is the group favourite; Dev ranks c4 first and it is still free.
    const votes = [
      vote(["c1"], [], ["c1"], "Maya"),
      vote(["c1", "c4"], [], ["c4", "c1"], "Dev"),
    ];
    const winners = pickWinners(candidates, votes, 2);

    expect(winners.map((w) => w.id)).toEqual(["c1", "c4"]);
  });

  it("falls back to a voter's yes list when their top3 is already taken", () => {
    const votes = [
      vote(["c1"], [], ["c1"], "Maya"),
      vote(["c1", "c3"], [], ["c1"], "Dev"),
    ];
    const winners = pickWinners(candidates, votes, 2).map((w) => w.id);

    expect(winners[0]).toBe("c1");
    expect(winners[1]).toBe("c3");
  });

  it("skips a voter who wants nothing rather than inventing a champion", () => {
    const votes = [
      vote(["c1"], [], ["c1"], "Maya"),
      vote([], ["c1", "c2", "c3", "c4", "c5"], [], "Dev"),
    ];
    expect(pickWinners(candidates, votes)[0]?.id).toBe("c1");
  });
});

describe("pickWinners — spreading the suggestions (DESIGN_DECISIONS.md §17)", () => {
  it("always gives the top scorer a slot, whatever else happens", () => {
    const crowded = candidates.map((c, i) => ({
      ...c,
      bucket: i < 3 ? 0 : i,
      url: i < 3 ? `https://same.test/${c.id}` : c.url,
    }));
    const votes = [
      vote(["c1", "c2", "c3"], [], ["c1"], "a"),
      vote(["c1", "c2", "c3"], [], ["c1"], "b"),
      vote(["c1"], [], ["c1"], "c"),
    ];
    expect(pickWinners(crowded, votes)[0]?.id).toBe("c1");
  });

  it("spreads the fill across searches once everyone has a champion", () => {
    // One voter, so coverage claims a single slot and the rest is spread.
    const crowded = candidates.map((c, i) => ({ ...c, bucket: i < 3 ? 0 : i }));
    const votes = [vote(["c1", "c2", "c3"], [], ["c1"], "a")];
    const winners = pickWinners(crowded, votes, 3);

    expect(winners.filter((w) => w.bucket === 0)).toHaveLength(1);
    expect(new Set(winners.map((w) => w.bucket)).size).toBe(3);
  });

  it("prefers a fresh bucket over a higher scorer from a used one when filling", () => {
    // One voter, so coverage claims only c1 and the fill passes decide the rest.
    const crowded = candidates.map((c, i) => ({ ...c, bucket: i === 1 ? 0 : i }));
    const votes = [vote(["c1", "c2"], ["c3"], ["c1"], "a")];

    // c2 ties c1 on score but shares its bucket, so the fresh buckets go first.
    expect(pickWinners(crowded, votes, 3).map((w) => w.id)).toEqual(["c1", "c4", "c5"]);
  });

  it("does not suggest the same venue twice under two urls", () => {
    const sameSite = candidates.map((c, i) => ({
      ...c,
      url: i < 2 ? `https://mohawkaustin.com/${c.id}` : c.url,
    }));
    const votes = [vote(["c1", "c2"], [], ["c1", "c2"], "a")];
    const winners = pickWinners(sameSite, votes, 3);

    expect(winners.filter((w) => w.url.includes("mohawkaustin.com"))).toHaveLength(1);
  });

  it("treats www and bare hostnames as the same site", () => {
    const twins = candidates.map((c, i) => ({
      ...c,
      url: i === 0 ? "https://www.mohawkaustin.com/" : i === 1 ? "https://mohawkaustin.com/shows" : c.url,
      bucket: i === 1 ? 9 : c.bucket,
    }));
    const votes = [vote(["c1", "c2"], [], ["c1", "c2"], "a")];
    expect(pickWinners(twins, votes, 3).filter((w) => w.url.includes("mohawkaustin.com"))).toHaveLength(1);
  });

  it("still reaches three when every candidate is on one listings site", () => {
    const votes = [vote(["c1", "c2", "c3"], ["c4", "c5"], ["c1"], "a")];
    const winners = pickWinners(oneBucketCandidates, votes);

    expect(winners).toHaveLength(MIN_PICKS);
    expect(winners[0]?.id).toBe("c1");
  });

  it("ranks every rejected spot below every liked one", () => {
    const votes = [
      vote(["c1", "c2"], ["c3", "c4", "c5"], ["c1"], "a"),
      vote(["c1", "c2"], ["c3", "c4", "c5"], ["c1"], "b"),
    ];
    const winners = pickWinners(candidates, votes);

    expect(winners.slice(0, 2).map((w) => w.id)).toEqual(["c1", "c2"]);
    const firstRejected = winners.findIndex((w) => w.score < 0);
    expect(winners.slice(0, firstRejected).every((w) => w.score >= 0)).toBe(true);
  });

  it("does not pad past the minimum once hostnames repeat", () => {
    const winners = pickWinners(oneBucketCandidates, [vote(["c1"], [], ["c1"], "a")]);
    expect(winners).toHaveLength(MIN_PICKS);
  });
});
