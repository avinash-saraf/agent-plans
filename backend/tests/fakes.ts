import { vi } from "vitest";
import type { RawResult } from "../src/candidates.ts";
import type { ChatPort, ChatRequest, SearchPort } from "../src/ports.ts";

/** Records every prompt so tests can assert on what an agent was allowed to see. */
export const fakeChat = (reply: (req: ChatRequest) => string) => {
  const calls: ChatRequest[] = [];
  const chat: ChatPort = vi.fn(async (req: ChatRequest) => {
    calls.push(req);
    return reply(req);
  });
  return { chat, calls };
};

export const fakeSearch = (perQuery = 5): { search: SearchPort; queries: string[] } => {
  const queries: string[] = [];
  const search: SearchPort = vi.fn(async (q: string) => {
    queries.push(q);
    const idx = queries.length;
    return Array.from({ length: perQuery }, (_, i): RawResult => ({
      title: `Venue ${idx}-${i}`,
      text: "page contents ".repeat(200),
      url: `https://venue.test/${idx}-${i}`,
    }));
  });
  return { search, queries };
};

/** A retry appends a correction note after the JSON; strip it before parsing. */
export const candidateIds = (user: string): string[] =>
  (JSON.parse(user.split("\n\nYour previous reply")[0]!) as { id: string }[]).map((c) => c.id);

/** Sorts every candidate it is shown, so it satisfies the validator by construction. */
export const scriptedVote = (user: string, likes: (i: number) => boolean): string => {
  const ids = candidateIds(user);
  const yes = ids.filter((_id, i) => likes(i));
  const no = ids.filter((_id, i) => !likes(i));
  return JSON.stringify({ yes, maybe: [], no, top3: yes.slice(0, 3) });
};
