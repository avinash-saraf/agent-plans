import { describe, expect, it, vi } from "vitest";
import {
  ValidationError,
  attemptTwice,
  parseFinalPicks,
  parseJson,
  parseSearchPlan,
  parseVote,
} from "../src/validate.ts";
import { candidates } from "./fixtures.ts";
import type { Ranked } from "../src/types.ts";

const winners: Ranked[] = candidates.slice(0, 3).map((c) => ({ ...c, score: 1, picks: 1 }));

const voteJson = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ yes: ["c1", "c2"], maybe: ["c3"], no: ["c4", "c5"], top3: ["c2"], ...over });

describe("parseJson", () => {
  it("throws ValidationError on malformed JSON", () => {
    expect(() => parseJson("{not json")).toThrow(ValidationError);
  });
});

describe("parseVote", () => {
  it("accepts a well-formed vote", () => {
    expect(parseVote(voteJson(), candidates).yes).toEqual(["c1", "c2"]);
  });

  it("rejects a candidate that appears in two buckets", () => {
    expect(() => parseVote(voteJson({ maybe: ["c3", "c1"] }), candidates)).toThrow(/c1 appears 2 times/);
  });

  it("rejects a candidate that was skipped entirely", () => {
    expect(() => parseVote(voteJson({ no: ["c4"] }), candidates)).toThrow(/c5 appears 0 times/);
  });

  it("rejects invented candidate ids", () => {
    expect(() => parseVote(voteJson({ no: ["c4", "c5", "c99"] }), candidates)).toThrow(/unknown candidate ids: c99/);
  });

  it("rejects top3 longer than three", () => {
    expect(() => parseVote(voteJson({ top3: ["c1", "c2", "c3", "c1"] }), candidates)).toThrow(/top3 has 4 entries/);
  });

  it("rejects a top3 pick drawn from the no list", () => {
    expect(() => parseVote(voteJson({ top3: ["c4"] }), candidates)).toThrow(/not in yes or maybe: c4/);
  });

  it("allows top3 to fall back to maybe", () => {
    expect(parseVote(voteJson({ yes: [], maybe: ["c1", "c2", "c3"], no: ["c4", "c5"], top3: ["c3"] }), candidates).top3)
      .toEqual(["c3"]);
  });

  it("rejects non-string array entries", () => {
    expect(() => parseVote(voteJson({ yes: [1, 2] }), candidates)).toThrow(/yes must be an array of strings/);
  });
});

describe("parseVote — failure modes seen on a live run", () => {
  it("rejects candidate objects echoed back in place of ids", () => {
    const bad = JSON.stringify({
      yes: [{ id: "c1", title: "Fabrik Austin" }],
      maybe: [],
      no: ["c2", "c3", "c4", "c5"],
      top3: [],
    });
    expect(() => parseVote(bad, candidates)).toThrow(/yes must be an array of strings/);
  });

  it("rejects a reply that silently drops candidates", () => {
    const bad = JSON.stringify({ yes: [], maybe: [], no: ["c1", "c2", "c3", "c5"], top3: [] });
    expect(() => parseVote(bad, candidates)).toThrow(/c4 appears 0 times/);
  });
});

describe("parseFinalPicks", () => {
  const picksJson = (over: Record<string, unknown> = {}) =>
    JSON.stringify({
      picks: [
        { candidateId: "c1", appeals: "Maya — real vegan menu.", doesntAppeal: "Dev — closes at 10." },
        { candidateId: "c2", appeals: "Dev — late sets.", doesntAppeal: "Sam — far too loud." },
      ],
      ...over,
    });

  it("accepts distinct picks that reference winners", () => {
    expect(parseFinalPicks(picksJson(), winners).picks).toHaveLength(2);
  });

  it("rejects a pick referencing a candidate that did not win", () => {
    const bad = picksJson({ picks: [{ candidateId: "c5", appeals: "a", doesntAppeal: "b" }] });
    expect(() => parseFinalPicks(bad, winners)).toThrow(/not one of the winners/);
  });

  it("rejects a hallucinated candidate id outright", () => {
    const bad = picksJson({ picks: [{ candidateId: "c42", appeals: "a", doesntAppeal: "b" }] });
    expect(() => parseFinalPicks(bad, winners)).toThrow(/c42 is not one of the winners/);
  });

  it("rejects the same spot suggested twice — they must be distinct", () => {
    const bad = picksJson({
      picks: [
        { candidateId: "c1", appeals: "a", doesntAppeal: "b" },
        { candidateId: "c1", appeals: "c", doesntAppeal: "d" },
      ],
    });
    expect(() => parseFinalPicks(bad, winners)).toThrow(/suggested twice/);
  });

  it("requires both sides of the appeal for every pick", () => {
    const noAppeal = picksJson({ picks: [{ candidateId: "c1", appeals: "  ", doesntAppeal: "b" }] });
    expect(() => parseFinalPicks(noAppeal, winners)).toThrow(/missing "appeals"/);

    const noObjection = picksJson({ picks: [{ candidateId: "c1", appeals: "a", doesntAppeal: "" }] });
    expect(() => parseFinalPicks(noObjection, winners)).toThrow(/missing "doesntAppeal"/);
  });

  it("rejects an empty pick list", () => {
    expect(() => parseFinalPicks(picksJson({ picks: [] }), winners)).toThrow(/non-empty array/);
  });

  it("can require a minimum number of picks", () => {
    expect(() => parseFinalPicks(picksJson(), winners, 3)).toThrow(/at least 3 picks, got 2/);
  });

  it("rejects candidate ids leaking into reader-facing text", () => {
    const inAppeals = picksJson({
      picks: [{ candidateId: "c1", appeals: "Maya voted yes on c1.", doesntAppeal: "b" }],
    });
    expect(() => parseFinalPicks(inAppeals, winners)).toThrow(/leaked into appeals/);

    const inObjection = picksJson({
      picks: [{ candidateId: "c1", appeals: "a", doesntAppeal: "Dev voted no on c6 and c13." }],
    });
    expect(() => parseFinalPicks(inObjection, winners)).toThrow(/leaked into doesntAppeal/);
  });

  it("rejects an answer that opens by restating the venue name", () => {
    const bad = picksJson({
      picks: [
        {
          candidateId: "c1",
          appeals: "Venue 1 appeals to Maya and Nazar because it is vegan.",
          doesntAppeal: "Dev. Closes early.",
        },
      ],
    });
    expect(() => parseFinalPicks(bad, winners)).toThrow(/restates the venue name/);
  });

  it("allows the venue name later in the sentence", () => {
    const ok = picksJson({
      picks: [
        {
          candidateId: "c1",
          appeals: "Maya and Nazar — Venue 1 is fully vegan and nothing is over $20.",
          doesntAppeal: "Dev. Closes early.",
        },
      ],
    });
    expect(parseFinalPicks(ok, winners).picks[0]?.appeals).toMatch(/^Maya and Nazar/);
  });

  it("leaves ordinary prose alone", () => {
    const ok = picksJson({
      picks: [
        {
          candidateId: "c1",
          appeals: "Maya and Nazar. Real vegan al pastor, nothing over $20.",
          doesntAppeal: "Dev. Closes early, no music.",
        },
      ],
    });
    expect(parseFinalPicks(ok, winners).picks[0]?.appeals).toMatch(/^Maya and Nazar/);
  });
});

describe("parseSearchPlan", () => {
  it("accepts queries plus a transcript line", () => {
    const out = parseSearchPlan(JSON.stringify({ queries: ["a", "b", "c"], text: "looking for..." }));
    expect(out.queries).toHaveLength(3);
  });

  it("rejects an empty query list", () => {
    expect(() => parseSearchPlan(JSON.stringify({ queries: ["  "], text: "x" }))).toThrow(/non-empty/);
  });
});

describe("attemptTwice", () => {
  it("returns the first attempt when it validates", async () => {
    const produce = vi.fn().mockResolvedValue(voteJson());
    await attemptTwice(produce, (raw) => parseVote(raw, candidates));
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it("retries exactly once and keeps the good second attempt", async () => {
    const produce = vi.fn().mockResolvedValueOnce("{broken").mockResolvedValueOnce(voteJson());
    const vote = await attemptTwice(produce, (raw) => parseVote(raw, candidates));
    expect(produce).toHaveBeenCalledTimes(2);
    expect(vote.yes).toEqual(["c1", "c2"]);
  });

  it("tells the second attempt what was wrong with the first", async () => {
    const produce = vi.fn().mockResolvedValueOnce(voteJson({ no: ["c4"] })).mockResolvedValueOnce(voteJson());
    await attemptTwice(produce, (raw) => parseVote(raw, candidates));

    expect(produce.mock.calls[0]?.[0]).toBeUndefined();
    expect(produce.mock.calls[1]?.[0]).toMatch(/c5 appears 0 times/);
  });

  it("carries both failures into the thrown message, not just the second", async () => {
    const produce = vi
      .fn()
      .mockResolvedValueOnce(voteJson({ yes: [{ id: "c1" }] }))
      .mockResolvedValueOnce(voteJson({ no: ["c4"] }));

    await expect(attemptTwice(produce, (raw) => parseVote(raw, candidates))).rejects.toThrow(
      /yes must be an array of strings \| then: candidate c5 appears 0 times/,
    );
  });

  it("throws after two failures and never calls a third time", async () => {
    const produce = vi.fn().mockResolvedValue("{broken");
    await expect(attemptTwice(produce, (raw) => parseVote(raw, candidates))).rejects.toThrow(/failed twice/);
    expect(produce).toHaveBeenCalledTimes(2);
  });
});
