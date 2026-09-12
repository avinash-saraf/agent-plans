import { describe, expect, it } from "vitest";
import { DEFAULT_SLUG, isDemo, slugFromPath } from "../src/slug.ts";

describe("slugFromPath", () => {
  it("reads the slug out of /g/:slug", () => {
    expect(slugFromPath("/g/hackathon")).toBe("hackathon");
  });

  it("ignores anything after the slug", () => {
    expect(slugFromPath("/g/hackathon/extra")).toBe("hackathon");
  });

  it("decodes an escaped slug", () => {
    expect(slugFromPath("/g/my%20group")).toBe("my group");
  });

  it("falls back to the default off any other path", () => {
    expect(slugFromPath("/")).toBe(DEFAULT_SLUG);
    expect(slugFromPath("/g/")).toBe(DEFAULT_SLUG);
  });
});

describe("isDemo", () => {
  it("is true only for demo=1", () => {
    expect(isDemo("?demo=1")).toBe(true);
    expect(isDemo("?demo=0")).toBe(false);
    expect(isDemo("")).toBe(false);
  });
});
