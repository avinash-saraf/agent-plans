import { describe, expect, it, vi } from "vitest";
import {
  ValidationError,
  attemptTwice,
  parseFinal,
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

describe("parseFinal", () => {
  const finalJson = (over: Record<string, unknown> = {}) =>
    JSON.stringify({
      title: "Arcade bar + late tacos",
      steps: [{ time: "7:00pm", candidateId: "c1", what: "start here" }],
      compromise: "Maya gave up the early night.",
      ...over,
    });

  it("accepts steps that reference winners", () => {
    expect(parseFinal(finalJson(), winners).steps[0]?.candidateId).toBe("c1");
  });

  it("rejects a step referencing a candidate that did not win", () => {
    const bad = finalJson({ steps: [{ time: "7:00pm", candidateId: "c5", what: "x" }] });
    expect(() => parseFinal(bad, winners)).toThrow(/not one of the winners/);
  });

  it("rejects a hallucinated candidate id outright", () => {
    const bad = finalJson({ steps: [{ time: "7:00pm", candidateId: "c42", what: "x" }] });
    expect(() => parseFinal(bad, winners)).toThrow(/c42 is not one of the winners/);
  });

  it("requires a compromise line", () => {
    expect(() => parseFinal(finalJson({ compromise: "" }), winners)).toThrow(/compromise is required/);
  });

  it("requires a title", () => {
    expect(() => parseFinal(finalJson({ title: "  " }), winners)).toThrow(/title is required/);
  });

  it("requires at least one step", () => {
    expect(() => parseFinal(finalJson({ steps: [] }), winners)).toThrow(/non-empty array/);
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
