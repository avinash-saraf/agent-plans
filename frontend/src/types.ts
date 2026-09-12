/** Mirrors the backend contract. Locked at "minute 10" — see CONTEXT.md. */

export type TranscriptKind = "search" | "vote" | "final";

export type TranscriptTurn = {
  speaker: string;
  kind: TranscriptKind;
  text: string;
};

/** One suggested spot. No time, no order, no relationship to the others. */
export type Pick = {
  title: string;
  url: string;
  /** Who it works for, named, and why. */
  appeals: string;
  /** Who it does not work for, named, and why. */
  doesntAppeal: string;
};

export type RunResult = { transcript: TranscriptTurn[]; picks: Pick[] | null };

export type Member = { id: string; name: string; context: string };
