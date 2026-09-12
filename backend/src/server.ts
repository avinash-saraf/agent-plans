import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { demoMembers, demoRun } from "./demo.ts";
import { runPlan } from "./pipeline.ts";
import type { Models } from "./env.ts";
import type { ChatPort, SearchPort } from "./ports.ts";
import type { MemberStore } from "./store.ts";

export type ServerDeps = {
  store: MemberStore;
  chat: ChatPort;
  search: SearchPort;
  models: Models;
  corsOrigin: string;
};

const MIN_MEMBERS = 2;

export const buildServer = async (deps: ServerDeps): Promise<FastifyInstance> => {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: deps.corsOrigin });

  app.get("/health", async () => ({ ok: true }));

  app.get<{ Params: { slug: string } }>("/api/groups/:slug/members", async (req) => ({
    members: await deps.store.list(req.params.slug),
  }));

  app.post<{ Params: { slug: string }; Body: { name?: string; context?: string } }>(
    "/api/groups/:slug/members",
    async (req, reply) => {
      const name = req.body?.name?.trim();
      const context = req.body?.context?.trim();
      if (!name || !context) {
        return reply.code(400).send({ error: "name and context are both required" });
      }
      return reply.code(201).send({ member: await deps.store.add(req.params.slug, { name, context }) });
    },
  );

  /**
   * The demo path is checked before anything else runs. At 2:15 this is what
   * you present, and it must not depend on a key, a network or a model.
   */
  app.post<{ Params: { slug: string }; Querystring: { demo?: string }; Body: { city?: string } }>(
    "/api/groups/:slug/plan",
    async (req, reply) => {
      if (req.query.demo === "1") return demoRun;

      const members = await deps.store.list(req.params.slug);
      if (members.length < MIN_MEMBERS) {
        return reply.code(400).send({ error: `need at least ${MIN_MEMBERS} people before planning` });
      }

      return runPlan({
        members,
        city: req.body?.city?.trim() || "Austin",
        chat: deps.chat,
        search: deps.search,
        models: deps.models,
      });
    },
  );

  app.get("/api/demo/members", async () => ({ members: demoMembers }));

  return app;
};
