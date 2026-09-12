import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import type { Member } from "./types.ts";

export type NewMember = { name: string; context: string };

/**
 * There is no users table and no groups table. A group is a string column, and
 * a link is access — `/g/hackathon` is the whole access model.
 */
export type MemberStore = {
  list(groupSlug: string): Promise<Member[]>;
  add(groupSlug: string, member: NewMember): Promise<Member>;
};

/** Default store. Runs the whole product with no database attached. */
export const memoryStore = (): MemberStore => {
  const rows: (Member & { groupSlug: string })[] = [];

  return {
    async list(groupSlug) {
      return rows.filter((r) => r.groupSlug === groupSlug).map(({ groupSlug: _g, ...m }) => m);
    },
    async add(groupSlug, member) {
      const row = { id: crypto.randomUUID(), groupSlug, ...member };
      rows.push(row);
      const { groupSlug: _g, ...saved } = row;
      return saved;
    },
  };
};

/**
 * The one thing the Postgres store needs from a driver. Narrow on purpose: the
 * store's SQL and row mapping are testable against a fake, with no database.
 */
export type Queryable = {
  query<R extends pg.QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: R[] }>;
};

/**
 * Supabase's pooler serves a certificate issued by Supabase's own root CA, which
 * is in no system trust store — so a plain connection fails with "self-signed
 * certificate in certificate chain". The published root is bundled in
 * [certs/](../certs/README.md) and trusted explicitly, which keeps verification
 * ON. See DESIGN_DECISIONS.md §9.
 */
export const SUPABASE_CA_PATH = join(import.meta.dirname, "..", "certs", "supabase-prod-ca-2021.crt");

export type SslOptions = { ca?: string; rejectUnauthorized: boolean };

/**
 * `rejectUnauthorized: false` is the fix everyone reaches for here. It accepts
 * any certificate at all, which means handing the database password to whoever
 * answers the connection — so it is opt-in via DATABASE_SSL_STRICT=false, never
 * the default, and never silently applied when the CA is missing.
 */
export const sslOptions = (strict = true, caPath = SUPABASE_CA_PATH): SslOptions => {
  if (!strict) return { rejectUnauthorized: false };

  try {
    return { ca: readFileSync(caPath, "utf8"), rejectUnauthorized: true };
  } catch {
    // Trust the system store instead — correct for any non-Supabase Postgres.
    return { rejectUnauthorized: true };
  }
};

/**
 * A direct Postgres connection to Supabase — the connection string, not the
 * project URL and anon key. See DESIGN_DECISIONS.md §9.
 *
 * TLS is configured here rather than in the DSN because node-postgres ignores
 * `?sslmode=` in a connection string: a pasted `sslmode=require` is silently a
 * no-op, which is a good way to think you have TLS when you do not.
 */
export const createPool = (connectionString: string, sslStrict = true): pg.Pool =>
  new pg.Pool({
    connectionString,
    ssl: sslOptions(sslStrict),
    // A hackathon demo opens a handful of connections; the pooler charges for
    // idle ones, so keep the ceiling low and hang up quickly.
    max: 4,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

/**
 * Exactly the table from CONTEXT.md track A. A direct connection can run DDL,
 * which the anon key could not — so the schema ships with the code instead of
 * living in a SQL snippet someone has to remember to paste.
 */
export const ensureSchema = async (db: Queryable): Promise<void> => {
  await db.query(`
    create table if not exists members (
      id uuid primary key default gen_random_uuid(),
      group_slug text not null,
      name text not null,
      context text not null,
      created_at timestamptz default now()
    )
  `);
  await db.query(`create index if not exists members_group_slug_idx on members (group_slug)`);
};

export const postgresStore = (db: Queryable): MemberStore => ({
  async list(groupSlug) {
    const { rows } = await db.query<Member>(
      `select id, name, context
         from members
        where group_slug = $1
        order by created_at, id`,
      [groupSlug],
    );
    return rows;
  },

  async add(groupSlug, member) {
    const { rows } = await db.query<Member>(
      `insert into members (group_slug, name, context)
       values ($1, $2, $3)
       returning id, name, context`,
      [groupSlug, member.name, member.context],
    );
    const saved = rows[0];
    if (!saved) throw new Error("insert returned no row");
    return saved;
  },
});
