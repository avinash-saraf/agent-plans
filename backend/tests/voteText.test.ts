import { describe, expect, it } from "vitest";
import { voteLine, voteTurn } from "../src/voteText.ts";
import { candidates, validVote } from "./fixtures.ts";

describe("voteLine", () => {
  it("reads as a turn in a conversation", () => {
    expect(voteLine(validVote(), candidates)).toBe("2 yes, 1 maybe, 2 no — top pick: Venue 2");
  });

  it("omits the top pick when top3 is empty", () => {
    expect(voteLine(validVote({ top3: [] }), candidates)).toBe("2 yes, 1 maybe, 2 no");
  });

  it("is deterministic", () => {
    const v = validVote();
    expect(voteLine(v, candidates)).toBe(voteLine(v, candidates));
  });
});

describe("voteTurn", () => {
  it("speaks as the member and is kind=vote", () => {
    expect(voteTurn(validVote(), candidates)).toEqual({
      speaker: "Maya",
      kind: "vote",
      text: "2 yes, 1 maybe, 2 no — top pick: Venue 2",
    });
  });
});
