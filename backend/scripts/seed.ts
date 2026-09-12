/**
 * Seed a group with the four demo personas.
 *
 *   pnpm --filter backend seed            # seeds /g/hackathon
 *   pnpm --filter backend seed birthday   # seeds /g/birthday
 *
 * Talks to the store directly, so it works whether STORE is memory or postgres
 * and needs no server running. Re-running replaces that group's members rather
 * than stacking eight people into it.
 */
import { config } from "../src/env.ts";
import { demoMembers } from "../src/demo.ts";
import { createPool, ensureSchema, postgresStore } from "../src/store.ts";

const slug = process.argv[2] ?? "hackathon";
const usePostgres = config.store === "postgres" || config.store === "supabase";

if (!usePostgres) {
  console.error("STORE is 'memory', so a seed would vanish when this script exits.");
  console.error("Set STORE=postgres in backend/.env to seed a real group.");
  process.exit(1);
}

const pool = createPool(config.databaseUrl, config.dbSslStrict);
await ensureSchema(pool);
const store = postgresStore(pool);

const { rowCount } = await pool.query("delete from members where group_slug = $1", [slug]);
if (rowCount) console.log(`cleared ${rowCount} existing member(s) from /g/${slug}`);

for (const member of demoMembers) {
  await store.add(slug, { name: member.name, context: member.context });
  console.log(`  + ${member.name}`);
}

await pool.end();
console.log(`\nseeded ${demoMembers.length} people into /g/${slug}`);
console.log(`open http://localhost:5173/g/${slug} and press "make a plan"`);
