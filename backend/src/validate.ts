import type { Candidate, FinalPlan, Ranked, Vote } from "./types.ts";

/** The only error type in the project. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const asStringArray = (value: unknown, field: string): string[] => {
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    throw new ValidationError(`${field} must be an array of strings`);
  }
  return value as string[];
};

/** JSON.parse, wrapped. `response_format: json_object` is not a guarantee. */
export const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new ValidationError(`response was not valid JSON: ${raw.slice(0, 120)}`);
  }
};

/**
 * Every candidate id must land in exactly one of yes/maybe/no, and top3 must be
 * an ordered subset of yes ∪ maybe with at most 3 entries.
 */
export const parseVote = (raw: string, candidates: Candidate[]): Vote => {
  const obj = parseJson(raw) as Record<string, unknown>;
  if (typeof obj !== "object" || obj === null) {
    throw new ValidationError("vote must be a JSON object");
  }

  const vote: Vote = {
    yes: asStringArray(obj.yes, "yes"),
    maybe: asStringArray(obj.maybe, "maybe"),
    no: asStringArray(obj.no, "no"),
    top3: asStringArray(obj.top3, "top3"),
  };

  const sorted = [...vote.yes, ...vote.maybe, ...vote.no];
  const counts = new Map<string, number>();
  for (const id of sorted) counts.set(id, (counts.get(id) ?? 0) + 1);

  for (const c of candidates) {
    const n = counts.get(c.id) ?? 0;
    if (n !== 1) {
      throw new ValidationError(`candidate ${c.id} appears ${n} times across yes/maybe/no, expected 1`);
    }
  }

  const known = new Set(candidates.map((c) => c.id));
  const unknown = sorted.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw new ValidationError(`unknown candidate ids: ${unknown.join(", ")}`);
  }

  if (vote.top3.length > 3) {
    throw new ValidationError(`top3 has ${vote.top3.length} entries, expected at most 3`);
  }

  const allowed = new Set([...vote.yes, ...vote.maybe]);
  const strays = vote.top3.filter((id) => !allowed.has(id));
  if (strays.length > 0) {
    throw new ValidationError(`top3 entries not in yes or maybe: ${strays.join(", ")}`);
  }

  return vote;
};

/**
 * The important one. Nothing else stops the final turn from inventing a
 * plausible bar with a plausible URL, and the Exa-grounding pitch dies live
 * when a judge clicks it.
 */
export const parseFinal = (raw: string, winners: Ranked[]): FinalPlan => {
  const obj = parseJson(raw) as Record<string, unknown>;
  if (typeof obj !== "object" || obj === null) {
    throw new ValidationError("final must be a JSON object");
  }
  if (typeof obj.title !== "string" || obj.title.trim() === "") {
    throw new ValidationError("title is required");
  }
  if (typeof obj.compromise !== "string" || obj.compromise.trim() === "") {
    throw new ValidationError("compromise is required");
  }
  if (!Array.isArray(obj.steps) || obj.steps.length === 0) {
    throw new ValidationError("steps must be a non-empty array");
  }

  const allowed = new Set(winners.map((w) => w.id));
  const steps = obj.steps.map((s: unknown) => {
    const step = s as Record<string, unknown>;
    if (typeof step?.candidateId !== "string" || !allowed.has(step.candidateId)) {
      throw new ValidationError(
        `step candidateId ${String(step?.candidateId)} is not one of the winners (${[...allowed].join(", ")})`,
      );
    }
    if (typeof step.time !== "string" || typeof step.what !== "string") {
      throw new ValidationError("each step needs a string time and what");
    }
    return { time: step.time, candidateId: step.candidateId, what: step.what };
  });

  return { title: obj.title, steps, compromise: obj.compromise };
};

export const parseSearchPlan = (raw: string): { queries: string[]; text: string } => {
  const obj = parseJson(raw) as Record<string, unknown>;
  if (typeof obj !== "object" || obj === null) {
    throw new ValidationError("search plan must be a JSON object");
  }
  const queries = asStringArray(obj.queries, "queries").filter((q) => q.trim() !== "");
  if (queries.length === 0) throw new ValidationError("queries must be a non-empty array");
  if (typeof obj.text !== "string" || obj.text.trim() === "") {
    throw new ValidationError("text is required");
  }
  return { queries, text: obj.text };
};

/**
 * Each rule retries the call once, then throws. Two attempts, never a loop.
 *
 * The retry is **corrective**: the second attempt is told what was wrong with
 * the first. A blind retry re-sends the identical prompt, so a model that
 * misread the schema misreads it again and both attempts fail with the same
 * message — which is exactly what happened on the first live run (one agent
 * echoed candidate objects into `yes` instead of ids; another silently dropped
 * two candidates). Handing the error back fixes both on attempt two.
 */
export const attemptTwice = async <T>(
  produce: (correction?: string) => Promise<string>,
  check: (raw: string) => T,
): Promise<T> => {
  try {
    return check(await produce());
  } catch (first) {
    const why = (first as Error).message;
    try {
      return check(await produce(why));
    } catch (second) {
      throw new ValidationError(`failed twice: ${why} | then: ${(second as Error).message}`);
    }
  }
};

/** Appended to the user message on a retry. */
export const correctionNote = (correction: string): string =>
  `\n\nYour previous reply was rejected: ${correction}\nFix exactly that. Reply with the same JSON shape and nothing else.`;
