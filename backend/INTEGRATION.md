# Kusama backend

NestJS, Prisma/PostgreSQL, and the OpenAI SDK routed through OpenRouter. The teammate’s auth service is preserved. `kusama_groups` adds shared group profiles and saved planning runs without modifying the existing `users` or teammate-owned `members` table.

## Setup

Use Node 24. `npm ci`, configure `.env` from `.env.example`, run `npm run prisma:generate`, apply migrations, then `npm run start:dev`. The server listens on port 3000. Vite forwards `/api/*` to these routes without the prefix.

Required private environment values: `DATABASE_URL`, `JWT_SECRET`, `OPENROUTER_API_KEY`, and `EXA_API_KEY`. Optional `ORCHESTRATOR_MODEL` and `AGENT_MODEL` default to `openai/gpt-4.1` and `openai/gpt-4.1-mini`; both were verified in OpenRouter’s live model catalog. No secret belongs in a `VITE_*` variable.

Local runtime notes:

- The supplied session pooler (5432) intermittently rejected startup connections. Local `.env` uses the same project’s transaction pooler (6543), with `pgbouncer=true&connection_limit=1&connect_timeout=10`. The original `DIRECT_URL` is preserved locally, but Prisma does not consume it automatically.
- Node 26 produced an HTTP/2 stream error for OpenRouter in this environment. Node 24 passed the real requests. The local process loads the machine’s trusted CA bundle; certificate verification remains enabled.
- Prisma attempts to warm its connection before Nest accepts requests, retrying initialization at most three times with a fresh connection. A temporary startup outage keeps HTTP available so later requests can reconnect. Read operations retry only P1001 connection failures, at most twice, with bounded delays. Writes and unrelated errors are never automatically replayed.
- Compatible scanner-approved build overrides: `enhanced-resolve@5.24.5`, `electron-to-chromium@1.5.425`.

### Migrations

For normal deployment, run `prisma migrate deploy` using a verified direct PostgreSQL URL. The shared local pooler stalled Prisma’s migration CLI before any migration was applied. `npm run db:groups` is a deliberately narrow alternative for this existing database: it applies only `20260912190000_shared_groups`, records its checksum in existing Prisma migration history, and uses one transaction with a transaction-scoped advisory lock. It refuses a mismatched migration history or an untracked pre-existing table. It neither resets the database nor alters existing tables. Its SQL file must retain LF line endings.

[Prisma/Supabase connection guidance](https://www.prisma.io/docs/orm/v6/overview/databases/supabase).

## Group API

Group links are the access mechanism. No account is needed, and anyone holding a link can read/edit that group. Slugs are 1–60 lowercase letters/numbers separated by hyphens. Cities are 1–100 characters. Members need a 1–80 character name and 1–4000 character context. Blank or unknown fields are rejected.

| Method | Route | JSON body |
| --- | --- | --- |
| GET | `/planning/status` | None; returns `{ready}` for credential presence |
| POST | `/groups` | `{slug, city}` |
| GET | `/groups/:slug` | None |
| PATCH | `/groups/:slug` | `{revision, city}` |
| POST | `/groups/:slug/members` | `{revision, name, context}` |
| PATCH | `/groups/:slug/members/:id` | `{revision, name, context}` |
| DELETE | `/groups/:slug/members/:id` | `{revision}` |
| POST | `/groups/:slug/plan` | `{revision}` |

All group reads/writes return `{slug, city, members, revision, run}`. Members have server-assigned IDs. Missing groups/members return 404; duplicate slugs, a fifth member, stale revisions, and edits during planning return 409. Compare-and-update revisions prevent lost edits and simultaneous overfilling. Edits invalidate the old plan.

Planning requires exactly four saved members. The POST waits for the bounded pipeline and returns the updated group. `run.status` is `running`, `complete`, or `failed`; inspect it even after HTTP 200. The run contains `startedAt`, a partial `transcript`, optional `result`, and an error on failure. Turns are saved as each stage completes. A reload can fetch the ongoing run; the UI offers a progress refresh. Interrupted runs become retryable after seven minutes, covering the added classification stage and bounded validation retries. A newer revision prevents an old run from overwriting new input.

## Planning

One round: three orchestrator search queries covering different interests, three parallel Exa searches with five results each, a venue classification call, four parallel independent advocate calls, a deterministic tally, then an orchestrator narrative. Typically seven LLM calls and six visible transcript turns; invalid JSON or schema gets one retry per call, then failure. Provider failures remain visible and never become fixture data.

Candidates receive local IDs, safe HTTP(S) source URLs, and snippets trimmed to 700 characters. URLs are deduplicated; common event/calendar subdomains are collapsed so a venue and its calendar cannot become separate stops. At most one page per venue hostname enters classification, capped at fifteen candidates. Fewer than three distinct sources produces an explicit error. Classification assigns a broad activity and a normalized venue key; duplicate venues on different platforms are merged before voting. Classification is model-derived, so source quality still matters.

Every advocate receives only their own member and the candidates. Every ID must occur exactly once in yes/maybe/no, with a personal reason of at most 160 characters. Top choices prioritize yes, then maybe, and never no. Code ranks net yes-minus-no, then top-three pick count, with stable source order for ties, selecting at most one venue per activity category and at most three total. It returns fewer options if too few distinct categories were found. The final call must include each winning ID once. Titles and URLs come from Exa’s candidates, never from the narrator. Each step's `fit` array is built directly from the validated ballots as `{memberId, name, vote, reason}`, in member order. The compromise must name someone whose net support for the winners was lowest. Actual queries, classified candidates, votes/reasons, and winner IDs are persisted under `result.evidence` for review.

New results use `schemaVersion: 2`; steps contain `{title, what, url, fit}` with no time field. The frontend can read older saved rounds but no longer displays or copies their time fields. It requires complete, correctly attributed fit notes on version 2 rounds. The pipeline does not verify opening hours, live ticket availability, or reservations, and does not book or purchase anything.

[OpenRouter SDK setup](https://openrouter.ai/docs/quickstart), [Exa search API](https://exa.ai/docs/reference/search).

## Optional accounts

`POST /auth/register {name,email,password}` returns 201 `{user,accessToken}`; `POST /auth/login {email,password}` returns 200. `GET /auth/me` uses the bearer token. Passwords are bcrypt hashes. Tokens expire after fifteen minutes; the frontend holds them in memory and clears them on reload or sign-out. Account actions do not gate group access.

Registration validates name length 2–100, valid email, and password length 8–72. Invalid requests return 400, invalid credentials/sessions return 401, duplicate email returns 409. CORS is not enabled: use the Vite proxy or a same-origin production reverse proxy.
