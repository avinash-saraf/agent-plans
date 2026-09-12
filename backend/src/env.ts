/**
 * Model slugs were confirmed against OpenRouter's live /models list rather than
 * recalled from memory; both are overridable without a code change.
 */
export const config = {
  openrouterKey: process.env.OPENROUTER_API_KEY ?? "",
  exaKey: process.env.EXA_API_KEY ?? "",
  /** cheap model for the four agent turns */
  modelCheap: process.env.MODEL_CHEAP ?? "openai/gpt-4o-mini",
  /** stronger model for the two orchestrator turns */
  modelStrong: process.env.MODEL_STRONG ?? "openai/gpt-4.1",
  /** "supabase" is kept as an alias — the database is Supabase-hosted either way. */
  store: (process.env.STORE ?? "memory") as "memory" | "postgres" | "supabase",
  /**
   * A Postgres connection string, not a project URL. SUPABASE_URL is read as a
   * fallback so a DSN pasted under the old name still works.
   */
  databaseUrl: process.env.DATABASE_URL ?? process.env.SUPABASE_URL ?? "",
  /** Opt-out only, for a network that rewrites certificates. */
  dbSslStrict: process.env.DATABASE_SSL_STRICT !== "false",
  port: Number(process.env.PORT ?? 8787),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
};

export type Models = { cheap: string; strong: string };

export const models = (): Models => ({ cheap: config.modelCheap, strong: config.modelStrong });
