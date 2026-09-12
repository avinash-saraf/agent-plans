import { describe, expect, it } from "vitest";
import { runPlan } from "../src/pipeline.ts";
import { MAX_CANDIDATES } from "../src/candidates.ts";
import { candidateIds, fakeChat, fakeSearch, scriptedVote } from "./fakes.ts";
import { members } from "./fixtures.ts";
import type { ChatRequest } from "../src/ports.ts";

const models = { cheap: "cheap-model", strong: "strong-model" };

/** Everyone likes a different slice, so the tally has something to decide. */
const reply = (req: ChatRequest): string => {
  if (req.system.includes("web search queries")) {
    return JSON.stringify({ queries: ["q1", "q2", "q3"], text: "Looking for a night out." });
  }
  if (req.system.startsWith("You are the agent for")) {
    const offset = req.system.includes("Maya") ? 0 : req.system.includes("Dev") ? 1 : 2;
    return scriptedVote(req.user, (i) => (i + offset) % 3 === 0);
  }
  const allowed = req.system.match(/Allowed candidateIds: (.+)/)?.[1]?.split(", ") ?? [];
  return JSON.stringify({
    picks: allowed.map((id) => ({
      candidateId: id,
      appeals: "Maya and Nazar. Cheap and actually vegan.",
      doesntAppeal: "Dev. Nothing happening after ten.",
    })),
  });
};

const run = () => {
  const { chat, calls } = fakeChat(reply);
  const { search, queries } = fakeSearch();
  return { calls, queries, result: runPlan({ members, city: "Austin", chat, search, models }) };
};

describe("runPlan", () => {
  it("makes exactly six LLM calls", async () => {
    const { calls, result } = run();
    await result;
    expect(calls).toHaveLength(6);
  });

  it("runs three searches", async () => {
    const { queries, result } = run();
    await result;
    expect(queries).toEqual(["q1", "q2", "q3"]);
  });

  it("caps the candidate list at 15", async () => {
    const { calls, result } = run();
    await result;
    const agentCall = calls.find((c) => c.system.startsWith("You are the agent for"));
    expect(JSON.parse(agentCall!.user)).toHaveLength(MAX_CANDIDATES);
  });

  it("produces the transcript in strict order: search, four votes, final", async () => {
    const { transcript } = await run().result;
    expect(transcript.map((t) => t.kind)).toEqual(["search", "vote", "vote", "vote", "vote", "final"]);
    expect(transcript.map((t) => t.speaker)).toEqual([
      "Orchestrator",
      "Maya",
      "Dev",
      "Sam",
      "Nazar",
      "Orchestrator",
    ]);
  });

  it("orders votes by members order, not by resolution order", async () => {
    const { chat, calls } = fakeChat(reply);
    const slowFirst: typeof chat = async (req) => {
      const out = await chat(req);
      if (req.system.includes("Maya")) await new Promise((r) => setTimeout(r, 20));
      return out;
    };
    const { search } = fakeSearch();
    const { transcript } = await runPlan({ members, city: "Austin", chat: slowFirst, search, models });
    expect(transcript.filter((t) => t.kind === "vote").map((t) => t.speaker)).toEqual([
      "Maya",
      "Dev",
      "Sam",
      "Nazar",
    ]);
    expect(calls.length).toBe(6);
  });

  it("uses the cheap model for agents and the strong model for the orchestrator", async () => {
    const { calls, result } = run();
    await result;
    const agentModels = calls.filter((c) => c.system.startsWith("You are the agent")).map((c) => c.model);
    const orchModels = calls.filter((c) => !c.system.startsWith("You are the agent")).map((c) => c.model);
    expect(agentModels).toEqual(Array(4).fill("cheap-model"));
    expect(orchModels).toEqual(["strong-model", "strong-model"]);
  });

  it("only ever emits urls that came back from search", async () => {
    const { queries, result } = run();
    const { picks } = await result;
    expect(queries.length).toBe(3);
    for (const pick of picks!) expect(pick.url).toMatch(/^https:\/\/venue-\d+-\d+\.test\/$/);
  });

  it("suggests 3-5 distinct spots, each with both sides", async () => {
    const { picks } = await run().result;
    expect(picks!.length).toBeGreaterThanOrEqual(3);
    expect(picks!.length).toBeLessThanOrEqual(5);
    expect(new Set(picks!.map((p) => p.url)).size).toBe(picks!.length);
    for (const pick of picks!) {
      expect(pick.appeals).not.toBe("");
      expect(pick.doesntAppeal).not.toBe("");
    }
  });

  it("carries no times and no ordering language", async () => {
    const { transcript, picks } = await run().result;
    const prose = picks!.flatMap((p) => [p.appeals, p.doesntAppeal]).join(" ") + transcript.at(-1)!.text;
    expect(prose).not.toMatch(/\d{1,2}:\d{2}\s*(am|pm)/i);
    expect(prose).not.toMatch(/\bstart here\b|\bthen head\b|\bafterwards\b/i);
  });

  it("throws when search comes back empty rather than inventing venues", async () => {
    const { chat } = fakeChat(reply);
    const search = async () => [];
    await expect(runPlan({ members, city: "Austin", chat, search, models })).rejects.toThrow(/no candidates/);
  });
});

describe("the isolation invariant", () => {
  it("never shows an agent another member's context", async () => {
    const { calls, result } = run();
    await result;
    const agentCalls = calls.filter((c) => c.system.startsWith("You are the agent for"));
    expect(agentCalls).toHaveLength(4);

    for (const call of agentCalls) {
      const mine = members.find((m) => call.system.includes(`agent for ${m.name}`))!;
      const others = members.filter((m) => m.id !== mine.id);
      const prompt = call.system + call.user;
      expect(prompt).toContain(mine.context);
      for (const other of others) expect(prompt).not.toContain(other.context);
    }
  });

  it("never shows an agent another agent's vote or the running transcript", async () => {
    const { calls, result } = run();
    await result;
    for (const call of calls.filter((c) => c.system.startsWith("You are the agent for"))) {
      const parsed = JSON.parse(call.user) as Record<string, unknown>[];
      expect(parsed.every((c) => Object.keys(c).sort().join() === "id,snippet,title")).toBe(true);
      expect(call.system + call.user).not.toMatch(/top pick:|Orchestrator/);
    }
  });

  it("never puts a url in an agent prompt", async () => {
    const { calls, result } = run();
    await result;
    for (const call of calls.filter((c) => c.system.startsWith("You are the agent for"))) {
      expect(call.user).not.toContain("https://");
    }
  });
});

describe("the winners, end to end", () => {
  it("gives each person a spot they asked for, across all three searches", async () => {
    // Each member champions a venue from a different search, and one member is
    // an outlier whose pick the other three veto.
    const favourite = new Map([
      ["Maya", 0],
      ["Dev", 5],
      ["Sam", 10],
      ["Nazar", 1],
    ]);

    const { chat } = fakeChat((req) => {
      if (req.system.startsWith("You are the agent for")) {
        const ids = candidateIds(req.user);
        const name = [...favourite.keys()].find((n) => req.system.includes(`agent for ${n}`))!;
        const mine = ids[favourite.get(name)!]!;
        const theirs = [...favourite.values()].filter((i) => i !== favourite.get(name));
        return JSON.stringify({
          yes: [mine],
          maybe: ids.filter((id, i) => id !== mine && !theirs.includes(i)),
          no: theirs.map((i) => ids[i]!),
          top3: [mine],
        });
      }
      return reply(req);
    });

    const { search } = fakeSearch();
    const { picks } = await runPlan({ members, city: "Austin", chat, search, models });

    const hosts = picks!.map((p) => new URL(p.url).hostname);
    expect(new Set(hosts).size).toBe(hosts.length);

    // Dev's pick is vetoed by the other three and would score -2 under pure
    // net-yes. It still has to be on the list.
    expect(hosts).toContain("venue-2-0.test");
    expect(new Set(hosts.map((h) => h.split("-")[1])).size).toBe(3);
  });
});

describe("the corrective retry, end to end", () => {
  it("recovers a run when one agent drops a candidate on its first try", async () => {
    let firstTryForDev = true;

    const { chat, calls } = fakeChat((req) => {
      if (req.system.startsWith("You are the agent for") && req.system.includes("Dev") && firstTryForDev) {
        firstTryForDev = false;
        // Sorts only the first two ids and silently drops the rest.
        const ids = candidateIds(req.user);
        return JSON.stringify({ yes: [ids[0]], maybe: [], no: [ids[1]], top3: [ids[0]] });
      }
      return reply(req);
    });

    const { search } = fakeSearch();
    const { transcript, picks } = await runPlan({ members, city: "Austin", chat, search, models });

    // Seven calls, not six: one retry. And the run still completes.
    expect(calls).toHaveLength(7);
    expect(transcript.map((t) => t.kind)).toEqual(["search", "vote", "vote", "vote", "vote", "final"]);
    expect(picks).not.toBeNull();

    const devCalls = calls.filter((c) => c.system.includes("agent for Dev"));
    expect(devCalls[1]?.user).toMatch(/previous reply was rejected/);
  });

  it("tells the agent how many candidates it must sort", async () => {
    const { calls, result } = run();
    await result;
    const agentCall = calls.find((c) => c.system.startsWith("You are the agent for"));
    expect(agentCall!.system).toContain("There are 15 candidates");
    expect(agentCall!.system).toMatch(/id STRING such as "c1"/);
  });
});
