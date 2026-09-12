import type { RawResult } from "./candidates.ts";
import type { SearchPort } from "./ports.ts";

export const EXA_RESULTS_PER_QUERY = 5;

/** Exa search. Not an LLM call — it is the grounding, and the only source of urls. */
export const exaSearch = (apiKey: string): SearchPort => {
  return async (query: string): Promise<RawResult[]> => {
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        query,
        numResults: EXA_RESULTS_PER_QUERY,
        contents: { text: true },
      }),
    });

    if (!res.ok) throw new Error(`exa ${res.status}: ${await res.text()}`);

    const body = (await res.json()) as { results?: RawResult[] };
    return body.results ?? [];
  };
};
