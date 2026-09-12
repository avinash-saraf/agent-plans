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

export type PlanStep = {
  time: string;
  what: string;
  title: string;
  url: string;
};

export type Plan = {
  title: string;
  steps: PlanStep[];
  compromise: string;
};

export type RunResult = {
  transcript: TranscriptTurn[];
  plan: Plan | null;
};

/** Orchestrator turn 1 output. */
export type SearchPlan = {
  queries: string[];
  text: string;
};

/** Orchestrator turn 2 output — ids only, never URLs. */
export type FinalPlan = {
  title: string;
  steps: { time: string; candidateId: string; what: string }[];
  compromise: string;
};
