import { describe, expect, it } from "vitest";
import { MAX_CANDIDATES, SNIPPET_CHARS, toCandidates } from "../src/candidates.ts";

describe("toCandidates", () => {
  it("assigns sequential ids starting at c1", () => {
    const out = toCandidates([
      { title: "A", text: "a", url: "https://a.test" },
      { title: "B", text: "b", url: "https://b.test" },
    ]);
    expect(out.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("trims page text to the snippet budget", () => {
    const [only] = toCandidates([{ title: "A", text: "x".repeat(5000), url: "https://a.test" }]);
    expect(only?.snippet).toHaveLength(SNIPPET_CHARS);
  });

  it("dedupes by url and keeps the first occurrence", () => {
    const out = toCandidates([
      { title: "First", text: "", url: "https://a.test" },
      { title: "Second", text: "", url: "https://a.test" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.title).toBe("First");
  });

  it("caps at 15 candidates", () => {
    const raw = Array.from({ length: 40 }, (_, i) => ({
      title: `T${i}`,
      text: "",
      url: `https://t${i}.test`,
    }));
    expect(toCandidates(raw)).toHaveLength(MAX_CANDIDATES);
  });

  it("drops results with no url", () => {
    const out = toCandidates([{ title: "A", text: "", url: null }, { title: "B", text: "", url: "https://b.test" }]);
    expect(out).toEqual([{ id: "c1", title: "B", snippet: "", url: "https://b.test" }]);
  });

  it("falls back to the url when a title is missing", () => {
    const [only] = toCandidates([{ title: "", text: "", url: "https://a.test" }]);
    expect(only?.title).toBe("https://a.test");
  });

  it("survives missing text without throwing", () => {
    const [only] = toCandidates([{ title: "A", url: "https://a.test" }]);
    expect(only?.snippet).toBe("");
  });
});
