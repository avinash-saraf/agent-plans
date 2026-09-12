import type { Candidate, Member, MemberVote } from "../src/types.ts";

export const members: Member[] = [
  { id: "m1", name: "Maya", context: "vegan, won't budge on food" },
  { id: "m2", name: "Dev", context: "wants to be out until 3am" },
  { id: "m3", name: "Sam", context: "hates crowds and loud rooms" },
  { id: "m4", name: "Nazar", context: "broke, hard cap around $20" },
];

export const candidates: Candidate[] = Array.from({ length: 5 }, (_, i) => ({
  id: `c${i + 1}`,
  title: `Venue ${i + 1}`,
  snippet: `snippet ${i + 1}`,
  url: `https://example.com/${i + 1}`,
}));

/** A vote that satisfies every validation rule, for tweaking in tests. */
export const validVote = (over: Partial<MemberVote> = {}): MemberVote => ({
  memberId: "m1",
  name: "Maya",
  yes: ["c1", "c2"],
  maybe: ["c3"],
  no: ["c4", "c5"],
  top3: ["c2", "c1"],
  ...over,
});
