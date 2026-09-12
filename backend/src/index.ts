import { config, models } from "./env.ts";
import { exaSearch } from "./exa.ts";
import { openRouterChat } from "./llm.ts";
import { buildServer } from "./server.ts";
import { createPool, ensureSchema, memoryStore, postgresStore } from "./store.ts";

const usePostgres = config.store === "postgres" || config.store === "supabase";

if (usePostgres && !config.databaseUrl) {
  throw new Error(`STORE=${config.store} needs DATABASE_URL (a Postgres connection string)`);
}

let store = memoryStore();

if (usePostgres) {
  const pool = createPool(config.databaseUrl, config.dbSslStrict);
  await ensureSchema(pool);
  store = postgresStore(pool);
}

const app = await buildServer({
  store,
  chat: openRouterChat(config.openrouterKey),
  search: exaSearch(config.exaKey),
  models: models(),
  corsOrigin: config.corsOrigin,
});

await app.listen({ port: config.port, host: "0.0.0.0" });
console.log(`backend on http://localhost:${config.port} (store=${usePostgres ? "postgres" : "memory"})`);
