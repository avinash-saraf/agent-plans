import { describe, expect, it } from "vitest";
import { MAX_CANDIDATES, SNIPPET_CHARS, hostOf, toCandidates } from "../src/candidates.ts";

describe("toCandidates", () => {
  it("assigns sequential ids starting at c1", () => {
    const out = toCandidates([
      [
        { title: "A", text: "a", url: "https://a.test" },
        { title: "B", text: "b", url: "https://b.test" },
      ],
    ]);
    expect(out.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("trims page text to the snippet budget", () => {
    const [only] = toCandidates([[{ title: "A", text: "x".repeat(5000), url: "https://a.test" }]]);
    expect(only?.snippet).toHaveLength(SNIPPET_CHARS);
  });

  it("dedupes by url and keeps the first occurrence", () => {
    const out = toCandidates([
      [{ title: "First", text: "", url: "https://a.test" }],
      [{ title: "Second", text: "", url: "https://a.test" }],
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
    expect(toCandidates([raw])).toHaveLength(MAX_CANDIDATES);
  });

  it("drops results with no url", () => {
    const out = toCandidates([[{ title: "A", text: "", url: null }, { title: "B", text: "", url: "https://b.test" }]]);
    expect(out).toEqual([{ id: "c1", title: "B", snippet: "", url: "https://b.test", bucket: 0 }]);
  });

  it("falls back to the url when a title is missing", () => {
    const [only] = toCandidates([[{ title: "", text: "", url: "https://a.test" }]]);
    expect(only?.title).toBe("https://a.test");
  });

  it("survives missing text without throwing", () => {
    const [only] = toCandidates([[{ title: "A", url: "https://a.test" }]]);
    expect(only?.snippet).toBe("");
  });
});

describe("toCandidates — query provenance", () => {
  it("records which query found each candidate", () => {
    const out = toCandidates([
      [{ title: "Vegan place", text: "", url: "https://v.test" }],
      [{ title: "Loud bar", text: "", url: "https://l.test" }],
      [{ title: "Quiet bar", text: "", url: "https://q.test" }],
    ]);
    expect(out.map((c) => c.bucket)).toEqual([0, 1, 2]);
  });

  it("still numbers ids sequentially across queries", () => {
    const out = toCandidates([
      [{ title: "A", text: "", url: "https://a.test" }, { title: "B", text: "", url: "https://b.test" }],
      [{ title: "C", text: "", url: "https://c.test" }],
    ]);
    expect(out.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
    expect(out.map((c) => c.bucket)).toEqual([0, 0, 1]);
  });

  it("caps at 15 across all queries combined, not per query", () => {
    const q = (n: string) =>
      Array.from({ length: 10 }, (_, i) => ({ title: `${n}${i}`, text: "", url: `https://${n}${i}.test` }));
    expect(toCandidates([q("a"), q("b"), q("c")])).toHaveLength(MAX_CANDIDATES);
  });

  it("keeps the first query's find when two queries return the same url", () => {
    const out = toCandidates([
      [{ title: "From query 0", text: "", url: "https://same.test" }],
      [{ title: "From query 1", text: "", url: "https://same.test" }],
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.bucket).toBe(0);
  });
});

describe("hostOf", () => {
  it("ignores www so a homepage and its www twin are one host", () => {
    expect(hostOf("https://www.mohawkaustin.com/shows")).toBe("mohawkaustin.com");
    expect(hostOf("https://mohawkaustin.com/")).toBe("mohawkaustin.com");
  });

  it("falls back to the raw string rather than throwing on junk", () => {
    expect(hostOf("not a url")).toBe("not a url");
  });
});
