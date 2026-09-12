# agent plans

Four friends each write one freeform blurb. Each gets an agent. The agents look at real
venues pulled from **Exa**, vote as their person's advocate, plain code tallies the votes,
and an orchestrator turns the winners into a shortlist of distinct spots — each one
saying plainly who it works for and who it does not.

The demo is the transcript. See [CONTEXT.md](CONTEXT.md) for the spec and
[DESIGN_DECISIONS.md](DESIGN_DECISIONS.md) for why everything is the way it is.

```
orchestrator  ->  3 exa queries
exa           ->  15 candidates
agent 1..4    ->  vote (parallel, 4 calls)
tally         ->  plain code, picks the winners
orchestrator  ->  3-5 distinct spots + who each one is for
```

Six LLM calls, ~8 seconds, no loop and no branch.

## Setup

Runtime and package manager are both pinned. One-time, on a new machine:

```bash
nvm install && nvm use     # reads .nvmrc -> Node 24.21.0
corepack enable            # activates pnpm 10.20.0 from package.json
pnpm install
```

Then copy the env template. **Nothing below is needed for tests or for `?demo=1`.**

```bash
cp .env.example backend/.env
# fill in OPENROUTER_API_KEY and EXA_API_KEY for a live run
```

Real keys go in `backend/.env`, which is gitignored. `.env.example` is a committed
template — keep it empty.

## Run it

```bash
pnpm dev        # backend on :8787, frontend on :5173
```

Open <http://localhost:5173/g/hackathon>. Any slug works — the link is the access model.
Add `?demo=1` to serve the cached run instead of calling a model.

## What comes out

Not an itinerary — no times, no ordering, nothing that says "start here, then head to".
Just 3-5 distinct spots, each with both sides stated plainly:

```
── Elephant Room
   works for:   Dev and Nazar — live jazz, open late, cheap cover.
   does not:    Maya and Sam — nothing vegan but bar snacks, music is loud and crowded.
```

## Run a live test

The four demo personas (vegan / night owl / hates crowds / broke) live in
[backend/src/demo.ts](backend/src/demo.ts). Two ways to put them to work.

**Straight to the transcript** — no server, no database, no browser. Fastest way to find
out whether the keys, the models and the grounding all work:

```bash
pnpm --filter backend plan:live            # Austin
pnpm --filter backend plan:live "New York"
```

Six real LLM calls, ~8 seconds, prints the transcript and the spots with live Exa URLs.

**Through the whole stack** — seed the personas into a group, then drive it from the UI:

```bash
pnpm --filter backend seed                 # seeds /g/hackathon
pnpm --filter backend seed birthday        # or any slug
pnpm dev
```

Open <http://localhost:5173/g/hackathon> and press **find us some spots**. Seeding needs
`STORE=postgres`; re-running replaces that group's members rather than stacking up eight
people. Add `?demo=1` to the URL to serve the cached run instead of spending credits.

## Test it

```bash
pnpm test        # 144 tests, both packages, no keys and no network
pnpm typecheck
pnpm build

pnpm --filter backend test:db   # +3 tests against a real database, needs DATABASE_URL
```

## Layout

```
backend/          Fastify API + the pipeline. No DOM, no bundler.
  src/ports.ts    The only two things that touch the network, as function types.
  src/pipeline.ts The straight line: search -> exa -> vote -> tally -> final.
  src/tally.ts    The actual decision. Plain code, no LLM. Coverage, then score.
  src/validate.ts Four rules, each retried once then thrown.
  src/demo.ts     One cached run with hand-verified urls.
frontend/         Vite + React. Transcript bubbles keyed on `kind`, then the spots.
```

## Config

| Var | Default | Notes |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | — | Required for a live run |
| `EXA_API_KEY` | — | Required for a live run |
| `MODEL_CHEAP` | `openai/gpt-4o-mini` | The four agent turns |
| `MODEL_STRONG` | `openai/gpt-4.1` | The two orchestrator turns |
| `STORE` | `memory` | Set to `postgres` to persist |
| `DATABASE_URL` | — | Postgres connection string; only when `STORE=postgres` |
| `DATABASE_SSL_STRICT` | `true` | Set `false` only if your network rewrites TLS certs |
| `PORT` | `8787` | |
| `CORS_ORIGIN` | `http://localhost:5173` | |

Both model slugs were confirmed against OpenRouter's live `/models` list, not recalled.

### Connecting to Supabase

`DATABASE_URL` is a **direct Postgres connection string**, not the project URL and anon
key. Supabase dashboard → **Connect** → **Session pooler**:

```
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
```

Two things that will cost you ten minutes otherwise:

- **URL-encode the password.** `?` → `%3F`, `#` → `%23`, `@` → `%40`. Quote the whole value.
- **`?sslmode=require` in the DSN does nothing** — node-postgres ignores it. TLS is
  configured in [createPool](backend/src/store.ts) instead, and verification is on by default.

The table is created at startup by `ensureSchema` — no SQL to paste:

```sql
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  group_slug text not null,
  name text not null,
  context text not null,
  created_at timestamptz default now()
);
```
