# Kusama

Four people, one plan. Create a group, share its link, add a name and freeform blurb for each friend, then let their agents vote on real places found by Exa.

The React frontend and Nest backend implement shared groups, member editing/removal, city changes, one planning round, saved transcripts and itineraries, and optional accounts. Supabase stores the group and its result. Anyone with the group link can join or edit; sign-in is optional.

## Run locally

Prerequisites: **Node 24** (see `.nvmrc`), npm, a PostgreSQL database, and working OpenRouter and Exa API keys. Use a database you can apply migrations to. Accounts are optional; the database is still required to save groups.

1. Clone and select the app branch (until it is merged into main):

```sh
git clone git@github.com:avinash-saraf/agent-plans.git
cd agent-plans
git checkout codex/frontend-app
```

2. Install backend dependencies and copy its environment template. Run these commands from the repository root. `cp` works in macOS/Linux shells and PowerShell; PowerShell also supports `Copy-Item`.

```sh
cd backend
npm ci
cp .env.example .env
npm run prisma:generate
```

Edit **`backend/.env`** before continuing:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string for your database. URL-encode special characters in the password. The template targets a local database named `app`; create it first or replace the URL with your Supabase connection. |
| `JWT_SECRET` | A long random secret for optional accounts; generate one with the command below. |
| `OPENROUTER_API_KEY` | Your OpenRouter key, with credits and access to the configured models. |
| `EXA_API_KEY` | Your Exa search key. |
| `ORCHESTRATOR_MODEL` | Optional; defaults to `openai/gpt-4.1`. |
| `AGENT_MODEL` | Optional; defaults to `openai/gpt-4.1-mini`. |

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep `.env` private; it is gitignored. Obtain shared credentials privately from the project owner. Never put API keys or database credentials in frontend variables.

3. Apply migrations and start Nest, still from `backend/`:

```sh
npx prisma migrate deploy
npm run start:dev
```

For a **fresh local database or direct Supabase connection**, use the migration command above. For **Supabase transaction pooling**, first apply migrations with `DATABASE_URL` set to a reachable direct connection, then change it to the runtime pooler URL on port `6543` with `?pgbouncer=true&connection_limit=1&connect_timeout=10` (use `&` if the URL already has parameters). A separate `DIRECT_URL` value is not automatically read by this schema. On the existing shared database only, `npm run db:groups` is a narrow alternative if the migration CLI stalls; see [migration details](backend/INTEGRATION.md#migrations). It is not a fresh-database bootstrap.

4. Open a **second terminal**, start from the repository root, and run the frontend:

```sh
cd frontend
npm ci
npm run dev
```

No frontend environment file is required locally. Vite forwards `/api` to Nest on port 3000; `frontend/.env.example` documents the optional prefix override. Keep both terminals running.

5. Open [Kusama](http://127.0.0.1:5173/g/hackathon), create a group, enter a city and four people's names/preferences, then make a plan. Share `/g/your-group-slug` with another browser to see the saved group. The [cached demo](http://127.0.0.1:5173/g/hackathon?demo=1) can replay without provider requests; real group operations need the backend/database.

Check [backend health](http://localhost:3000) for `Hello World!` and [planning configuration](http://127.0.0.1:5173/api/planning/status) for `{"ready":true}`. Readiness checks that both keys are present; a real planning run verifies credentials and connectivity.

## Common setup issues

- **Database errors / `P1001`:** confirm the database is reachable, the password is URL-encoded, and the runtime pooler is configured correctly. The shared Supabase session pooler on port 5432 intermittently rejected connections; the transaction pooler on 6543 worked with the parameters above.
- **AI request fails:** use Node 24, check provider keys/credits, and keep TLS certificate verification enabled. On a corporate proxy, Node can use trusted system certificates with `NODE_USE_SYSTEM_CA=1`; an approved PEM bundle can be supplied through `NODE_EXTRA_CA_CERTS`. These are process environment variables, set before starting Node.
- **Port already in use:** stop the older server on 3000 or 5173. Vite deliberately fails instead of silently changing ports.
- **Build/watch conflict:** stop `start:dev` before `npm run build`. For a compiled server, run `npm run build` then `npm run start:prod`.

## Planning behavior

Searches cover different activities based on the group. Venue classification merges duplicate listings, then code picks the highest-ranked option in each activity category, up to three distinct options. Each person's isolated agent supplies a short fit reason for every option. Plans have no suggested times. If search finds fewer activity categories, the result stays shorter instead of repeating the same kind of stop. The saved transcript, source links, ballots, and selection evidence remain available through the group API.

## Verify

- Backend: `npm run build`, `npm test -- --runInBand`.
- Frontend: `npm run build`, `npm run lint`, `npm test`.
- With both servers running: `cd backend && npm run test:smoke` exercises the real group API and removes its disposable group.

See [frontend notes](frontend/README.md), [integration QA](backend/QA.md), and the original [context](context.md). The later user request adds persisted group creation and retains optional accounts beyond the original hackathon cut list.
