/** Mirrors the backend contract. Locked at "minute 10" — see CONTEXT.md. */

export type TranscriptKind = "search" | "vote" | "final";

export type TranscriptTurn = {
  speaker: string;
  kind: TranscriptKind;
  text: string;
};

export type PlanStep = { time: string; what: string; title: string; url: string };

export type Plan = { title: string; steps: PlanStep[]; compromise: string };

export type RunResult = { transcript: TranscriptTurn[]; plan: Plan | null };

export type Member = { id: string; name: string; context: string };
