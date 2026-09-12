import { afterAll, describe, expect, it } from "vitest";
import { createPool, ensureSchema, postgresStore } from "../src/store.ts";

/**
 * Runs against a real database only when DATABASE_URL is set, and is skipped
 * otherwise — `pnpm test` must stay green with no network and no credentials.
 *
 *   DATABASE_URL="postgresql://..." pnpm --filter backend test
 *
 * It writes to a throwaway slug and deletes its own rows afterwards.
 */
const url = process.env.DATABASE_URL ?? "";
const slug = `test-${Math.random().toString(36).slice(2, 10)}`;

describe.skipIf(url === "")("postgres store against a live database", () => {
  const pool = createPool(url, process.env.DATABASE_SSL_STRICT !== "false");
  const store = postgresStore(pool);

  afterAll(async () => {
    if (url === "") return;
    await pool.query("delete from members where group_slug = $1", [slug]);
    await pool.end();
  });

  it("connects and applies the schema", async () => {
    await ensureSchema(pool);
    const { rows } = await pool.query<{ count: string }>(
      `select count(*)::text as count from information_schema.columns where table_name = 'members'`,
    );
    expect(Number(rows[0]?.count)).toBeGreaterThanOrEqual(5);
  });

  it("round-trips a member and keeps groups apart", async () => {
    const saved = await store.add(slug, { name: "Maya", context: "vegan, won't budge" });
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);

    expect(await store.list(slug)).toEqual([saved]);
    expect(await store.list(`${slug}-other`)).toEqual([]);
  });

  it("preserves join order", async () => {
    await store.add(slug, { name: "Dev", context: "out until 3am" });
    expect((await store.list(slug)).map((m) => m.name)).toEqual(["Maya", "Dev"]);
  });
}, 30_000);
