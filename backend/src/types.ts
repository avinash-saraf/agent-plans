/** Shapes shared across the pipeline. Locked at "minute 10" per CONTEXT.md. */

export type Member = {
  /** Identity travels with the payload so votes are never matched by array position. */
  id: string;
  name: string;
  /** The one freeform blurb. The only preference data in the system. */
  context: string;
};

/** A trimmed Exa result. Ids (c1..c15) are assigned by us, never by a model. */
export type Candidate = {
  id: string;
  title: string;
  snippet: string;
  url: string;
  /**
   * Index of the search query that found it. Each query is aimed at a different
   * person's needs, so this is the group's own notion of "a different kind of
   * place" — which is what the tally spreads the winners across.
   */
  bucket: number;
};

/** Raw agent output: every candidate id in exactly one bucket. */
export type Vote = {
  yes: string[];
  maybe: string[];
  no: string[];
  top3: string[];
};

/** A vote with its owner attached. */
export type MemberVote = Vote & {
  memberId: string;
  name: string;
};

export type Ranked = Candidate & {
  /** yes count minus no count. `maybe` is deliberately worth zero. */
  score: number;
  /** how many agents put it in their top3 — the tiebreak. */
  picks: number;
};

export type TranscriptKind = "search" | "vote" | "final";

export type TranscriptTurn = {
  speaker: string;
  kind: TranscriptKind;
  text: string;
};

/**
 * One suggested spot. Not a step in an evening — there is no time, no order and
 * no dependency on any other pick. See DESIGN_DECISIONS.md §19.
 */
export type Pick = {
  title: string;
  url: string;
  /** Who it works for, named, and why. */
  appeals: string;
  /** Who it does not work for, named, and why. */
  doesntAppeal: string;
};

export type RunResult = {
  transcript: TranscriptTurn[];
  picks: Pick[] | null;
};

/** Orchestrator turn 1 output. */
export type SearchPlan = {
  queries: string[];
  text: string;
};

/** Orchestrator turn 2 output — ids only, never URLs. */
export type FinalPicks = {
  picks: { candidateId: string; appeals: string; doesntAppeal: string }[];
};
