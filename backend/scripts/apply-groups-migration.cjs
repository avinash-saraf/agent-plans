// Additive, scoped migration runner for the development transaction pooler.
// Standard deployments should use `prisma migrate deploy` with a direct URL.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const db = new PrismaClient();
const name = '20260912190000_shared_groups';
const sql = readFileSync(
  join(__dirname, '../prisma/migrations', name, 'migration.sql'),
  'utf8',
);
const checksum = createHash('sha256').update(sql).digest('hex');
(async () => {
  try {
    await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(719004021)`;
        const history =
          await tx.$queryRaw`SELECT checksum, finished_at FROM _prisma_migrations WHERE migration_name = ${name} AND rolled_back_at IS NULL`;
        if (history.length) {
          if (
            history.length !== 1 ||
            !history[0].finished_at ||
            history[0].checksum !== checksum
          )
            throw new Error(
              'Migration history does not match. Inspect before applying.',
            );
          return;
        }
        // CREATE TABLE deliberately fails if an untracked table already exists.
        await tx.$executeRawUnsafe(sql);
        await tx.$executeRaw`INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at, finished_at, applied_steps_count) VALUES (${randomUUID()}, ${checksum}, ${name}, NOW(), NOW(), 1)`;
      },
      { timeout: 20000 },
    );
    console.log(
      'Shared group migration applied and recorded. Existing tables preserved.',
    );
  } catch (e) {
    console.error('Migration failed:', e.code || e.message);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
})();
