import type { RawResult } from "./candidates.ts";

/**
 * The two things that touch the network, expressed as functions.
 *
 * Everything downstream depends on these types rather than on the OpenAI SDK or
 * on fetch, so the entire pipeline runs in tests with no keys and no network.
 */

export type ChatRequest = {
  model: string;
  system: string;
  user: string;
};

/** Returns the raw assistant message content — parsing is validation's job. */
export type ChatPort = (req: ChatRequest) => Promise<string>;

export type SearchPort = (query: string) => Promise<RawResult[]>;
