import { describe, expect, it } from "vitest";
import { pickWinners, rank } from "../src/tally.ts";
import { candidates, validVote } from "./fixtures.ts";
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
  it("returns the three highest scorers", () => {
    const winners = pickWinners(candidates, [vote(["c5", "c4", "c3"], ["c1", "c2"], ["c5", "c4", "c3"])]);
    expect(winners).toHaveLength(3);
    expect(new Set(winners.map((w) => w.id))).toEqual(new Set(["c3", "c4", "c5"]));
  });

  it("orders equally scored winners stably by candidate order", () => {
    const votes = [vote(["c3", "c4", "c5"], [], [], "a")];
    expect(pickWinners(candidates, votes).map((w) => w.id)).toEqual(["c3", "c4", "c5"]);
  });

  it("returns everything when there are fewer than three candidates", () => {
    const two = candidates.slice(0, 2);
    expect(pickWinners(two, [])).toHaveLength(2);
  });
});
