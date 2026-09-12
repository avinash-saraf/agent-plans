import type { Candidate } from "./types.ts";

export const MAX_CANDIDATES = 15;
export const SNIPPET_CHARS = 200;

/** What an Exa /search result looks like once we only keep what we use. */
export type RawResult = {
  title?: string | null;
  text?: string | null;
  url?: string | null;
};

/**
 * Trim, dedupe and id the Exa results.
 *
 * Trimming happens here and nowhere else: Exa returns full page contents and
 * would blow the agent prompt up ~20x. Ids are assigned by us so models can
 * reference c1..c15 and never have to emit a URL.
 *
 * Takes results grouped by query rather than flattened, because which query
 * found a venue is the only record of who it was searched for — flattening
 * throws that away, and the tally needs it to spread the winners.
 */
export const toCandidates = (resultsByQuery: RawResult[][]): Candidate[] => {
  const seen = new Set<string>();
  const out: Candidate[] = [];

  for (const [bucket, results] of resultsByQuery.entries()) {
    for (const r of results) {
      const url = r.url?.trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);

      out.push({
        id: `c${out.length + 1}`,
        title: r.title?.trim() || url,
        snippet: (r.text ?? "").slice(0, SNIPPET_CHARS),
        url,
        bucket,
      });

      if (out.length === MAX_CANDIDATES) return out;
    }
  }

  return out;
};

/** Same venue, two urls (a homepage and a review of it) should not both win. */
export const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
