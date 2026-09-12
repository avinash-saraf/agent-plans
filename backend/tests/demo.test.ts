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

  it("carries a compromise that names a person", () => {
    const names = demoMembers.map((m) => m.name);
    expect(names.some((n) => demoRun.plan!.compromise.includes(n))).toBe(true);
  });

  it("has a real url on every step", () => {
    for (const step of demoRun.plan!.steps) expect(step.url).toMatch(/^https:\/\/.+\..+/);
  });

  it("ships four personas with genuine friction between them", () => {
    expect(demoMembers).toHaveLength(4);
    expect(new Set(demoMembers.map((m) => m.context)).size).toBe(4);
  });
});
