import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SUPABASE_CA_PATH, ensureSchema, memoryStore, postgresStore, sslOptions, type Queryable } from "../src/store.ts";

describe("memoryStore", () => {
  it("keeps groups apart by slug", async () => {
    const store = memoryStore();
    await store.add("hackathon", { name: "Maya", context: "vegan" });
    await store.add("birthday", { name: "Dev", context: "late" });

    expect((await store.list("hackathon")).map((m) => m.name)).toEqual(["Maya"]);
    expect((await store.list("birthday")).map((m) => m.name)).toEqual(["Dev"]);
  });

  it("returns an empty list for an unknown slug", async () => {
    expect(await memoryStore().list("nobody-here")).toEqual([]);
  });

  it("preserves join order", async () => {
    const store = memoryStore();
    for (const name of ["Maya", "Dev", "Sam", "Nazar"]) {
      await store.add("g", { name, context: `${name} context` });
    }
    expect((await store.list("g")).map((m) => m.name)).toEqual(["Maya", "Dev", "Sam", "Nazar"]);
  });

  it("gives every member a distinct id and never leaks the slug", async () => {
    const store = memoryStore();
    const a = await store.add("g", { name: "Maya", context: "x" });
    const b = await store.add("g", { name: "Maya", context: "x" });
    expect(a.id).not.toBe(b.id);
    expect(Object.keys(a).sort()).toEqual(["context", "id", "name"]);
  });
});

/** Records every statement so the SQL and its parameters can be asserted. */
const fakeDb = (rows: Record<string, unknown>[] = []) => {
  const calls: { text: string; values: unknown[] }[] = [];
  const db: Queryable = {
    async query(text: string, values: unknown[] = []) {
      calls.push({ text, values });
      return { rows: rows as never[] };
    },
  };
  return { db, calls };
};

const squash = (sql: string) => sql.replace(/\s+/g, " ").trim();

describe("postgresStore", () => {
  it("scopes list to the group slug through a bound parameter", async () => {
    const { db, calls } = fakeDb();
    await postgresStore(db).list("hackathon");

    expect(calls).toHaveLength(1);
    expect(squash(calls[0]!.text)).toContain("where group_slug = $1");
    expect(calls[0]!.values).toEqual(["hackathon"]);
  });

  it("never interpolates a slug into the SQL text", async () => {
    const { db, calls } = fakeDb();
    await postgresStore(db).list("'; drop table members; --");

    expect(calls[0]!.text).not.toContain("drop table");
    expect(calls[0]!.values).toEqual(["'; drop table members; --"]);
  });

  it("returns rows in join order", async () => {
    const { db, calls } = fakeDb([
      { id: "1", name: "Maya", context: "vegan" },
      { id: "2", name: "Dev", context: "late" },
    ]);
    const members = await postgresStore(db).list("g");

    expect(squash(calls[0]!.text)).toContain("order by created_at, id");
    expect(members.map((m) => m.name)).toEqual(["Maya", "Dev"]);
  });

  it("selects only the three contract columns, never the slug", async () => {
    const { db, calls } = fakeDb();
    await postgresStore(db).list("g");
    expect(squash(calls[0]!.text)).toMatch(/^select id, name, context/);
  });

  it("inserts with bound values and returns the saved row", async () => {
    const { db, calls } = fakeDb([{ id: "abc", name: "Maya", context: "vegan" }]);
    const saved = await postgresStore(db).add("hackathon", { name: "Maya", context: "vegan" });

    expect(calls[0]!.values).toEqual(["hackathon", "Maya", "vegan"]);
    expect(squash(calls[0]!.text)).toContain("returning id, name, context");
    expect(saved).toEqual({ id: "abc", name: "Maya", context: "vegan" });
  });

  it("throws rather than returning a half member when the insert returns nothing", async () => {
    const { db } = fakeDb([]);
    await expect(postgresStore(db).add("g", { name: "Maya", context: "vegan" })).rejects.toThrow(
      /insert returned no row/,
    );
  });
});

describe("ensureSchema", () => {
  it("is idempotent — create if not exists, never a drop", async () => {
    const { db, calls } = fakeDb();
    await ensureSchema(db);

    expect(calls).toHaveLength(2);
    expect(squash(calls[0]!.text)).toContain("create table if not exists members");
    expect(squash(calls[1]!.text)).toContain("create index if not exists");
    for (const call of calls) expect(call.text.toLowerCase()).not.toMatch(/drop|truncate|alter/);
  });

  it("creates exactly the columns the contract needs", async () => {
    const { db, calls } = fakeDb();
    await ensureSchema(db);
    const ddl = squash(calls[0]!.text);
    for (const col of ["id uuid primary key", "group_slug text not null", "name text not null", "context text not null", "created_at timestamptz"]) {
      expect(ddl).toContain(col);
    }
  });
});

describe("sslOptions", () => {
  it("trusts the bundled Supabase CA and keeps verification on", () => {
    const ssl = sslOptions(true);
    expect(ssl.rejectUnauthorized).toBe(true);
    expect(ssl.ca).toContain("BEGIN CERTIFICATE");
  });

  it("ships a CA that is actually a certificate, not a placeholder", () => {
    expect(readFileSync(SUPABASE_CA_PATH, "utf8").trim()).toMatch(
      /^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----$/,
    );
  });

  it("still verifies against the system store when the CA file is missing", () => {
    const ssl = sslOptions(true, "/nonexistent/ca.crt");
    expect(ssl).toEqual({ rejectUnauthorized: true });
    expect(ssl.ca).toBeUndefined();
  });

  it("never disables verification as a fallback — only on explicit opt-out", () => {
    expect(sslOptions(false).rejectUnauthorized).toBe(false);
    expect(sslOptions(true, "/nonexistent/ca.crt").rejectUnauthorized).toBe(true);
  });
});
