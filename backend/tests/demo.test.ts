import { describe, expect, it } from "vitest";
import { demoMembers, demoRun } from "../src/demo.ts";

describe("the demo fixture", () => {
  it("has the strict transcript order the frontend styles off", () => {
    expect(demoRun.transcript.map((t) => t.kind)).toEqual([
      "search",
      "vote",
      "vote",
      "vote",
      "vote",
      "final",
    ]);
  });

  it("names every member exactly once in the vote turns", () => {
    const speakers = demoRun.transcript.filter((t) => t.kind === "vote").map((t) => t.speaker);
    expect(speakers.sort()).toEqual(demoMembers.map((m) => m.name).sort());
  });

  it("suggests 3-5 distinct spots", () => {
    expect(demoRun.picks!.length).toBeGreaterThanOrEqual(3);
    expect(demoRun.picks!.length).toBeLessThanOrEqual(5);
    expect(new Set(demoRun.picks!.map((p) => p.url)).size).toBe(demoRun.picks!.length);
  });

  it("says who each spot works for and who it does not, by name", () => {
    const names = demoMembers.map((m) => m.name);
    for (const pick of demoRun.picks!) {
      expect(names.some((n) => pick.appeals.includes(n))).toBe(true);
      expect(names.some((n) => pick.doesntAppeal.includes(n))).toBe(true);
    }
  });

  it("gives every member a spot that works for them", () => {
    for (const member of demoMembers) {
      expect(demoRun.picks!.some((p) => p.appeals.includes(member.name))).toBe(true);
    }
  });

  it("has a real url on every pick", () => {
    for (const pick of demoRun.picks!) expect(pick.url).toMatch(/^https:\/\/.+\..+/);
  });

  it("is a list of spots, not an itinerary", () => {
    const prose = demoRun.picks!.flatMap((p) => [p.appeals, p.doesntAppeal]).join(" ");
    expect(prose).not.toMatch(/\bstart here\b|\bthen head\b|\bafterwards\b/i);
  });

  it("ships four personas with genuine friction between them", () => {
    expect(demoMembers).toHaveLength(4);
    expect(new Set(demoMembers.map((m) => m.context)).size).toBe(4);
  });
});
