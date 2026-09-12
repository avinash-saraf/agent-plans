import { describe, expect, it } from "vitest";
import { buildServer } from "../src/server.ts";
import { memoryStore } from "../src/store.ts";
import { fakeChat, fakeSearch, scriptedVote } from "./fakes.ts";
import type { ChatRequest } from "../src/ports.ts";

const reply = (req: ChatRequest): string => {
  if (req.system.includes("web search queries")) {
    return JSON.stringify({ queries: ["q1", "q2", "q3"], text: "Looking." });
  }
  if (req.system.startsWith("You are the agent for")) return scriptedVote(req.user, (i) => i % 2 === 0);
  const allowed = req.system.match(/Allowed candidateIds: (.+)/)?.[1]?.split(", ") ?? [];
  return JSON.stringify({
    title: "A night",
    steps: [{ time: "7:00pm", candidateId: allowed[0], what: "go" }],
    compromise: "Sam gave up quiet.",
  });
};

const app = async () => {
  const { chat } = fakeChat(reply);
  const { search } = fakeSearch();
  return buildServer({
    store: memoryStore(),
    chat,
    search,
    models: { cheap: "c", strong: "s" },
    corsOrigin: "*",
  });
};

describe("POST /api/groups/:slug/members", () => {
  it("creates a member and echoes it back with an id", async () => {
    const server = await app();
    const res = await server.inject({
      method: "POST",
      url: "/api/groups/hackathon/members",
      payload: { name: "Maya", context: "vegan, won't budge" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().member).toMatchObject({ name: "Maya", context: "vegan, won't budge" });
    expect(res.json().member.id).toBeTruthy();
  });

  it("rejects an empty blurb", async () => {
    const server = await app();
    const res = await server.inject({
      method: "POST",
      url: "/api/groups/hackathon/members",
      payload: { name: "Maya", context: "   " },
    });
    expect(res.statusCode).toBe(400);
  });

  it("treats the slug as access — no auth, no invite", async () => {
    const server = await app();
    await server.inject({
      method: "POST",
      url: "/api/groups/whatever-i-typed/members",
      payload: { name: "Maya", context: "vegan" },
    });
    const res = await server.inject({ url: "/api/groups/whatever-i-typed/members" });
    expect(res.json().members).toHaveLength(1);
  });
});

describe("POST /api/groups/:slug/plan", () => {
  it("refuses to plan for fewer than two people", async () => {
    const server = await app();
    await server.inject({
      method: "POST",
      url: "/api/groups/g/members",
      payload: { name: "Maya", context: "vegan" },
    });
    const res = await server.inject({ method: "POST", url: "/api/groups/g/plan" });
    expect(res.statusCode).toBe(400);
  });

  it("runs the pipeline and returns a transcript plus a plan", async () => {
    const server = await app();
    for (const name of ["Maya", "Dev", "Sam", "Nazar"]) {
      await server.inject({
        method: "POST",
        url: "/api/groups/g/members",
        payload: { name, context: `${name} wants something specific` },
      });
    }
    const res = await server.inject({ method: "POST", url: "/api/groups/g/plan", payload: { city: "Austin" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().transcript.map((t: { kind: string }) => t.kind)).toEqual([
      "search",
      "vote",
      "vote",
      "vote",
      "vote",
      "final",
    ]);
    expect(res.json().plan.compromise).toBeTruthy();
  });

  it("serves the cached fixture behind ?demo=1 without touching the store or a model", async () => {
    const server = await buildServer({
      store: {
        list: async () => {
          throw new Error("store must not be touched in demo mode");
        },
        add: async () => {
          throw new Error("store must not be touched in demo mode");
        },
      },
      chat: async () => {
        throw new Error("no model call in demo mode");
      },
      search: async () => {
        throw new Error("no search in demo mode");
      },
      models: { cheap: "c", strong: "s" },
      corsOrigin: "*",
    });

    const res = await server.inject({ method: "POST", url: "/api/groups/anything/plan?demo=1" });
    expect(res.statusCode).toBe(200);
    expect(res.json().transcript).toHaveLength(6);
    expect(res.json().plan.steps).toHaveLength(3);
  });
});

describe("GET /health", () => {
  it("answers", async () => {
    const server = await app();
    expect((await server.inject({ url: "/health" })).json()).toEqual({ ok: true });
  });
});
