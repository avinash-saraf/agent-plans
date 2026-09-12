# Design decisions

Every decision made while building this, and why. CONTEXT.md is the spec; where I
followed it I say so briefly, and where I deviated I say so loudly.

---

## 1. Repository shape: pnpm workspace, two packages

**Decision.** `backend/` and `frontend/` are separate packages in one pnpm workspace,
not one Next.js app.

**Why.** You asked for a separate backend and frontend. CONTEXT.md implies Next.js
(it lists `NEXT_PUBLIC_*` env vars), so this is a deliberate deviation. The split buys
two things the single app does not: the pipeline is testable with no DOM and no
bundler, and the backend can be deployed and scaled on its own — the six LLM calls
take ~8 seconds, which is a bad fit for a serverless function default timeout.

**Cost.** CORS, and one contract duplicated in two places
([backend/src/types.ts](backend/src/types.ts) and [frontend/src/types.ts](frontend/src/types.ts)).
I duplicated ~30 lines of type rather than adding a third shared package — a workspace
dependency for one file is more machinery than it saves, and the contract is small
and frozen. Both copies are asserted against real payloads by tests on both sides.

**Rejected.** A `shared/` workspace package (over-engineered for 30 lines); codegen
from an OpenAPI spec (a build step for a 3-endpoint API).

---

## 2. Runtime version manager: `.nvmrc` + `.node-version`, Node 24.21.0

**Decision.** Two identical pin files at the repo root, pinned to Node **24.21.0**.

**Why.** `nvm` is what is installed on this machine and reads `.nvmrc`. `.node-version`
is the same string read by `fnm`, `asdf`, `volta` and `nodenv`, so a teammate on any of
those gets the same runtime without converting anything. 24.21.0 is the current active
LTS — confirmed against `nodejs.org/dist/index.json` rather than recalled.

**Consequence.** `engines.node` is `>=24.21.0`. Node 24 runs TypeScript directly, which
is why [backend/src/index.ts](backend/src/index.ts) is the actual entrypoint in dev with
no build step and no `ts-node`.

**Honest note.** I developed and ran the tests on Node 25.6.1, the version already
active on this machine. It satisfies the `engines` range, and nothing here uses a 25-only
feature, but the pinned 24.21.0 is what CI should use and I have not run it there.

---

## 3. Package manager: pnpm 10.20.0, pinned via `packageManager`

**Decision.** `"packageManager": "pnpm@10.20.0"` in the root package.json, activated
through Corepack. Every dependency is pinned to an exact version — no `^`, no `~`.

**Why.** The `packageManager` field is the standard pin: Corepack downloads and uses
exactly that pnpm, so nobody silently installs with a different resolver. pnpm's strict
`node_modules` also means a package cannot import something it did not declare, which
matters with two packages that must not accidentally couple.

Exact versions because this is demo software with a hard deadline. A patch release that
changes behaviour at 2:40 in the afternoon is a category of problem worth spending disk
space to eliminate. `pnpm-lock.yaml` is committed.

**Setup cost.** A fresh machine needs `corepack enable` once. That is in the README.

**Rejected.** npm workspaces (looser hoisting, no strictness guarantee); pnpm 12 (newer,
but 10.20.0 is the version I actually verified installing and running here).

---

## 4. The pipeline is a straight line with ports at the edges

**Decision.** [backend/src/pipeline.ts](backend/src/pipeline.ts) is one function with no
loop and no branch. The only two things that touch the network are expressed as function
types in [backend/src/ports.ts](backend/src/ports.ts):

```ts
type ChatPort   = (req: { model, system, user }) => Promise<string>
type SearchPort = (query: string) => Promise<RawResult[]>
```

**Why.** CONTEXT.md is emphatic that the pipeline cannot fail to terminate, and a
straight line is the only shape where that is true by inspection rather than by argument.

The ports exist for one reason: **the entire pipeline runs in tests with no API key and
no network.** [backend/tests/pipeline.test.ts](backend/tests/pipeline.test.ts) asserts the
call count, the model routing, the transcript order and the isolation invariant against
fakes, in ~60ms. That is not achievable if `pipeline.ts` imports the OpenAI SDK directly.

**Why two function types instead of interfaces or classes.** There is exactly one method
each. A type alias for a function is the whole abstraction; a class would be ceremony.

**Rejected.** Mocking the OpenAI SDK with `vi.mock` — it tests that I called a library
correctly rather than that the pipeline behaves correctly, and it breaks on SDK upgrades.

---

## 5. The isolation invariant is enforced by a test, not by a convention

**Decision.** Three tests in `pipeline.test.ts` assert that an agent prompt contains its
own member's blurb and **no** other member's blurb, no other agent's vote, and no
transcript text.

**Why.** CONTEXT.md calls this the invariant that, if broken, produces anchoring and
sycophantic convergence — "the vegan signs off on the steakhouse". It is also the single
easiest thing to break later, because breaking it looks like a helpful improvement
("give the agent more context"). A code-review rule catches it only if someone reviews.
A test catches it always. This is the most valuable test in the repo.

---

## 6. Agents never see a URL

**Decision.** [backend/src/agents.ts](backend/src/agents.ts) strips `url` from the
candidate list before it reaches an agent. Agents see `{ id, title, snippet }` only.

**Why.** This is a deviation — CONTEXT.md's sample passes the whole candidate object. But
CONTEXT.md's own reasoning is that models reference `c1..c15` and never emit URLs, and the
most reliable way to guarantee a model does not echo a URL is to never show it one. It
also cuts agent prompt tokens. The orchestrator's final turn gets ids only for the same
reason, and URLs are looked up from our own candidate array in `hydratePlan()`.

**Test.** "never puts a url in an agent prompt" in `pipeline.test.ts`.

---

## 7. The tally is plain code and the orchestrator only narrates

**Decision.** [backend/src/tally.ts](backend/src/tally.ts) is array methods, no model.
Net yes minus no, `maybe` worth zero, ties broken on top3 appearances, nothing eliminated.
Scoring is exactly CONTEXT.md's; winner *selection* is coverage-first (§17).

**Why.** Straight from the spec, and it is the right call: the decision is deterministic,
free, instant, and explainable to a judge in one sentence. The final LLM turn is told the
winners are locked and its job is sequencing and narrative only.

**One thing the tests pinned down that the spec did not.** When candidates tie on both
score and picks, `Array.prototype.sort` is stable, so they come back in candidate order —
which is Exa relevance order. My first test asserted the wrong thing here; the code was
right and the test was wrong. There is now an explicit test documenting that ordering, so
it is a decision rather than an accident.

---

## 8. Validation: a **corrective** retry, and the rule that matters

**Decision.** One helper in [backend/src/validate.ts](backend/src/validate.ts) calls,
validates, retries once on failure, then throws. Two attempts, never a loop. The second
attempt is **told what was wrong with the first**.

**Why a helper rather than retry logic at each call site.** The retry-once rule applies
identically to all four validation rules, and a loop written four times is a loop written
wrong at least once.

**Why the retry is corrective — found by running it for real.** The first live run against
OpenRouter died on the agent turn, and the failure was instructive:

- one agent echoed whole candidate objects (`{"id":"c1","title":"Fabrik Austin"}`) into
  `yes` instead of the id string
- another silently dropped `c6` and `c7` — 13 of 15 ids sorted, no error, no mention

The validator caught both, exactly as designed. But the retry re-sent a byte-identical
prompt, so the model made the identical mistake and the run died with
`failed twice: <same message> | then: <same message>`. A blind retry only helps with
transient noise; it cannot help with a model that misread the schema.

`attemptTwice` now passes the validation error into the second attempt, which is appended
to the user message by `correctionNote()`. Same two-attempt cap, materially better odds.
The agent prompt also got two lines targeting exactly those observed failures: the
candidate count ("there are 15 candidates, all 15 ids must appear exactly once") and
"every entry is an id STRING such as \"c1\" — never an object, never a title, never a url".

Both failure modes are now pinned by tests, and one pipeline test drives an agent that
drops a candidate on its first try and asserts the run recovers in seven calls instead of
dying at six.

**The rule that matters.** `parseFinal` rejects any step whose `candidateId` is not one of
the winners. CONTEXT.md is right that this is the important one: without it the final turn
can invent a plausible bar with a plausible URL, and the Exa-grounding pitch dies live when
a judge clicks it. It has its own test (`rejects a hallucinated candidate id outright`).

## 9. Member store: an interface, a memory default, and a direct Postgres connection

**Decision.** [backend/src/store.ts](backend/src/store.ts) defines a two-method
`MemberStore`, with a `memoryStore()` default and a `postgresStore()` selected by
`STORE=postgres`. The database is reached over a **direct Postgres connection string**,
using `pg` — not the Supabase JS client and anon key.

**Why a direct connection instead of `@supabase/supabase-js`.** Changed on request, and
it is the better fit here:

- **No second auth model.** The anon-key path only works with RLS configured to allow
  public insert. CONTEXT.md's answer to that was "RLS off", which means the anon key is
  a shared password with extra steps. A connection string is one credential doing one job.
- **DDL.** A direct connection can run `create table if not exists`, so the schema ships
  with the code ([`ensureSchema`](backend/src/store.ts), applied at startup) instead of
  living in a SQL snippet somebody has to remember to paste into the dashboard at 0:15.
- **One less dependency.** `@supabase/supabase-js` is a large client for what is two
  queries; `pg` is the driver underneath it either way.
- **Portability.** Nothing in the backend is now Supabase-specific. Any Postgres works.

**Cost.** A connection string is a stronger credential than an anon key — it is the
database, not a scoped role. It belongs only in `backend/.env`, which is gitignored.
The pool is capped at 4 connections with a 10s idle timeout, because Supabase's pooler
charges for idle connections and this app opens a handful.

**TLS is set in code, not in the DSN.** node-postgres ignores `?sslmode=` in a connection
string, so a pasted `sslmode=require` is silently a no-op — a real footgun. `createPool`
sets `ssl: { rejectUnauthorized: true }` explicitly, with `DATABASE_SSL_STRICT=false` as
a documented opt-out for networks that rewrite certificates.

**Why the store takes a `Queryable`, not a `Pool`.** The store depends on a one-method
type (`query(text, values)`), the same trick as the network ports in §4. That makes the
SQL and the row mapping testable against a fake: eight tests assert that the slug is
always a bound parameter and never interpolated, that only the three contract columns are
selected, that `ensureSchema` contains no `drop`/`truncate`/`alter`, and that a
zero-row insert throws instead of returning a half member.

**The memory store stays the default.** Making the database the only option means the
product cannot run, or be tested, until someone provisions it and pastes a credential.
Both implementations satisfy the same type. Switching is one env var.

**Live verification.** `pnpm --filter backend test:db` runs
[postgres.integration.test.ts](backend/tests/postgres.integration.test.ts) against a real
database: it applies the schema, round-trips a member, checks group separation, and
deletes its own rows. It `describe.skipIf`s itself when `DATABASE_URL` is unset, so the
default `pnpm test` stays green with no credentials and no network.

**Rejected.** SQLite (a file to manage, for four rows nobody needs after the demo);
a migration tool such as Prisma or Drizzle (a schema DSL, a generate step and a migrations
folder, for one table of four columns).

## 10. HTTP layer: Fastify, three endpoints, dependencies injected

**Decision.** `buildServer(deps)` takes the store, both ports and the models, and returns
a Fastify instance. [backend/src/index.ts](backend/src/index.ts) is the only file that
constructs real adapters.

**Why.** `server.test.ts` drives the real routing stack via `app.inject()` — no port bound,
no network, full request/response coverage. The demo-mode test proves something a curl
check cannot: it passes a store and ports that **throw if touched**, so `?demo=1` is proven
to depend on nothing at all.

**Fastify over Express.** `inject()` for tests, schema-aware typing of params and body, and
async handlers without a wrapper.

**Endpoints.** `GET/POST /api/groups/:slug/members`, `POST /api/groups/:slug/plan`,
`GET /health`. No auth, no groups table — the slug is a string column, and the link is
the access model, per the cut list.

**The one error case I added beyond the spec.** Planning with fewer than 2 members returns
400. One person has nobody to disagree with, so the run costs six calls to produce nothing
worth showing.

---

## 11. Frontend: Vite + React, no router, no state library

**Decision.** Vite, React 19, ~250 lines of component code, a 20-line
[slug.ts](frontend/src/slug.ts) instead of a router, `useState` instead of a store.

**Why no router.** There is one route shape, `/g/:slug`, and it is read once at startup.
A regex and a fallback is the entire requirement.

**Why no state library.** Three pieces of state in one component.

**Sequential reveal.** The transcript is the product, so turns land one at a time rather
than all at once — the disagreement has to be readable as it happens. The delay is a prop
(`revealMs`) so tests run it at 1ms instead of waiting 3.6 seconds.

**Styling keys off `kind` and nothing else.** `bubble--search`, `bubble--vote`,
`bubble--final`, exactly as the contract promises. A new speaker never needs a CSS change.
A test asserts it.

**Dev proxy.** Vite proxies `/api` to `localhost:8787`, so no frontend file knows a backend
host and there is no API base URL to configure or forget in production.

---

## 12. Testing: 90 tests, written alongside the code

**Decision.** Vitest in both packages. 118 backend, 26 frontend, plus 3 database tests that
skip unless `DATABASE_URL` is set. Written module by module and run before the next module
was started.

**What each layer covers.**

| Layer | Tests | What it protects |
| --- | --- | --- |
| `candidates` | 13 | The 200-char trim, url dedupe, the 15 cap, query provenance |
| `tally` | 21 | Net yes, `maybe` = 0, tiebreak, no mutation, **coverage + spread** |
| `validate` | 31 | All rules, corrective retry, live failure modes, id leak, name echo |
| `voteText` | 4 | The transcript line built in code is deterministic |
| `pipeline` | 16 | 6 calls, model routing, transcript order, retry recovery, coverage, **the isolation invariant** |
| `store` | 12 | Slug separation, join order, bound params, idempotent DDL |
| `server` | 7 | Real routing, 400s, and demo mode touching nothing |
| `demo` | 5 | The fixture still satisfies the contract it is standing in for |
| frontend | 26 | Slug parsing, reveal order, `kind` styling, form rules, error path, no-itinerary rendering |

**One deliberate omission.** There is no test that calls OpenRouter or Exa for real. Those
would need keys, cost money, and fail on conference wifi — the exact failure the fixture
exists to avoid. The adapters in `llm.ts` and `exa.ts` are thin and untested by design;
everything downstream of them is tested exhaustively.

**The live run earned its keep.** Once keys were added, the first real run failed
immediately — and it failed on something no fake had produced (§8). Two more live runs
surfaced a second, subtler problem: the orchestrator's three search queries all skewed
toward the loudest constraint, so all 15 candidates came back vegan and there was nothing
left to argue about. Both fixes came from running it, not from reasoning about it. The
lesson is the obvious one: fakes prove the pipeline is correct, and only real calls prove
the prompts are.

**Honest limits.** There are no browser-level end-to-end tests; I drove the real servers by
hand instead. `llm.ts` and `exa.ts` remain untested by the suite by design — see above.

---

## 13. The demo fixture ships with verified URLs

**Decision.** [backend/src/demo.ts](backend/src/demo.ts) holds one complete cached run,
served by `?demo=1`.

**Why.** CONTEXT.md: "the fixture is not optional". The demo-mode test proves it needs no
key, no store and no model.

**The URLs are real and were checked.** Every venue link in the fixture returned HTTP 200
when I wrote it. A canned demo with a dead link fails in precisely the way the fixture
exists to prevent — a judge clicking through.

**The personas are maximum-friction on purpose**: vegan, hates crowds, $20 cap, out until
3am. If the four agents agree, everything scores +4, the compromise line is empty and the
demo is boring. The conflict is the product.

---

## 14. TypeScript: strict, plus `erasableSyntaxOnly`

**Decision.** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and
`erasableSyntaxOnly` in both packages.

**Why `erasableSyntaxOnly`.** It bans `enum` and parameter properties — the TypeScript
features Node's built-in type stripping cannot handle. With it on, the compiler guarantees
`node src/index.ts` will keep working, instead of it breaking at runtime in dev.

**Why `noUncheckedIndexedAccess`.** The pipeline is full of array indexing
(`vote.top3[0]`, `choices[0]`). It forces each one to be handled rather than assumed, which
is the difference between a missing top pick rendering as "3 yes, 1 maybe, 11 no" and it
crashing the transcript.

**Build split.** `tsconfig.json` type-checks src and tests with `noEmit`;
`tsconfig.build.json` emits src only, so tests never reach `dist/`.

---

## 15. What I did not build

Held to the cut list: no auth, no registration, no invites, no preference schema, no agent
framework, no negotiation rounds, no realtime, no users or groups table, and no error
handling beyond the four validation rules plus two form 400s.

The two additions to the cut list are named above and both are small: the `< 2 members`
guard (§10) and the memory store (§9).

---

## 16. Two scripts, because "run it live" should be one command

**Decision.** [`scripts/live.ts`](backend/scripts/live.ts) (`pnpm --filter backend plan:live`)
runs the six real calls and prints the transcript — no server, no database, no browser.
[`scripts/seed.ts`](backend/scripts/seed.ts) (`pnpm --filter backend seed [slug]`) puts the
four demo personas into a group so the UI has something to plan for.

**Why.** CONTEXT.md asks for the pipeline to be runnable as a standalone script, and the
reason is debugging surface: when a live run breaks, you want the failure without a browser,
a proxy and a database between you and it. That is precisely how §8's bug was found and
fixed. `seed.ts` exists because the personas were written but there was no way to *use*
them — every live test started with typing four blurbs into a form by hand.

`seed.ts` clears the group's existing members first, so re-running leaves four people
rather than eight. It refuses to run under `STORE=memory`, where a seed would vanish the
moment the process exits.

---

## 17. Selection is coverage-first, not consensus

**CONTEXT.md's rule.** `winners = ranked.slice(0, 3)` — the three highest net-yes scores.
It is the right rule for picking *one thing a group will do together*. It is the wrong
rule for a list of suggestions, and two live runs showed why.

**Failure one: it concentrates.** Scoring is per-candidate and context-free, so if a
category appeals to a majority then *every* venue in that category outscores everything
else. Runs returned three, then four, vegan restaurants — near-duplicates of each other,
with nothing in the list to choose between.

**Failure two, worse: it deletes the minority.** A spot one person loves and three veto
scores **negative**, precisely *because* it is polarising. So the one venue Dev would
actually show up to could never appear, and every card read "Dev won't like this" with
nothing anywhere for Dev. A product whose whole pitch is four people with conflicting
needs had quietly become a vegan restaurant finder.

I made this worse before I made it better: an intermediate version skipped negative-scoring
candidates outright, on the reasoning that you should not suggest something the group
rejected. That is sound for a single decision and exactly backwards here — it filtered out
the only interesting spots. The live run is what caught it.

**The rule now.** Four passes, in [tally.ts](backend/src/tally.ts):

1. **one champion per person**, walking members in order — each person's own highest
   preference that is still available. This is the one place an individual's ranking
   outranks the group's score, and it is what guarantees everybody appears somewhere.
2. fill toward `MAX_PICKS` by score, across unused searches and unused sites
3. fill toward `MAX_PICKS` by score, unused sites only
4. only if still under `MIN_PICKS`, drop the remaining fussiness

**What survives from the spec.** The tally still decides and the orchestrator still only
narrates — no LLM is involved in choosing. Scoring is untouched: `rank()` is CONTEXT.md's
formula character for character. The top scorer still takes a slot. What changed is which
of the ranked candidates fill the *other* slots.

**Query provenance.** Candidates carry the index of the query that found them
([candidates.ts](backend/src/candidates.ts)); the pipeline used to `.flat()` the result
sets and throw that away. Since the orchestrator aims one query per clashing person (§8),
that index is the group's own notion of "a different kind of place" — better than any
category list I could hardcode, because it comes from the four blurbs.

**Hostname is preferred, never absolute.** Two urls on one host can be a venue's homepage
and its events page (one spot, counted twice) or five events on one listings site (five
spots, counted once). Preferring fresh hosts handles the first; pass 4 stops the second
from starving the list down to a single suggestion. `www.` is stripped so a site cannot
beat itself.

**Result.** A live run now returns two music venues for Dev, two vegan spots for Maya, a
quiet cafe for Sam, and a cheap option for Nazar — five distinct places, everyone covered.

**This is a deliberate deviation from CONTEXT.md**, flagged before it was made and made on
request. Nineteen tests pin it, including the exact regression: a spot scoring −2 because
three of four vetoed it still has to appear.

## 18. Internal ids never reach the reader

**Decision.** `parseFinal` rejects a plan whose `title`, `compromise` or any step's `what`
contains a bare candidate id (`/\bc\d{1,2}\b/`).

**Why.** A live run produced: *"Sam gave up a quieter night... even though they voted no on
c6 and c13."* `c6` is plumbing — meaningless to the person reading it, and it makes the
product look like a debug dump on the one screen that is the entire demo.

The final prompt now says the ids are internal and that `title`, `what` and `compromise`
must use venue names. The validation rule is the belt to that suspenders: a model that
ignores the instruction gets the error handed back on the corrective retry (§8) and fixes
itself, rather than shipping the leak to the screen.

**Why a validator and not just a better prompt.** Prompts are advisory; this is the class of
defect that shows up in front of a judge. The check is four lines and its failure mode is
self-healing.

---

## 19. Suggestions, not an itinerary

**Decision.** The output is 3-5 distinct spots. Each carries a name, a url, `appeals` and
`doesntAppeal`. There is no time, no ordering, no overall title, and no compromise line.

**Why the old shape went.** The product used to emit a sequenced evening — `7:00pm`,
`9:00pm`, `10:40pm` — with one narrative compromise at the bottom. That is a stronger
claim than the system can actually support: it has no opening hours, no travel times, no
day of the week, and no idea whether two venues are forty minutes apart. Times were
plausible-looking fabrication. The new shape only asserts what the votes actually
established — who each place works for, and who it does not.

**The two-sided explanation replaces the compromise line.** One compromise sentence for a
whole evening forced the model to pick a single loser and editorialise. Per-spot appeal
puts the same information where it is useful and makes it four or five times denser: every
card names people on both sides.

**Enforced, not just requested:**

| Rule | Where |
| --- | --- |
| every pick is one of the tallied winners | `parseFinalPicks` |
| no spot suggested twice | `parseFinalPicks` |
| both `appeals` and `doesntAppeal` non-empty | `parseFinalPicks` |
| no internal ids in reader-facing text | `parseFinalPicks` (§18) |
| no opening restatement of the venue name | `parseFinalPicks` |
| no times, no "start here / then head to" | prompt + pipeline and UI tests |

The name-echo rule is the subtlest and came from a live run: the model kept opening with
*"Fabrik Austin | Plant-Based Fine Dining appeals to Maya and Sam because..."* — spending
the whole first line restating the heading directly above it. Rejected, it retries
correctively (§8) and returns *"Maya and Sam — high-end plant-based, all vegan."*

**The UI followed the data.** [Picks.tsx](frontend/src/components/Picks.tsx) renders an
unordered list of cards with no time column, no step number and nothing joining one card
to the next — a test asserts the `<ul>` and the absence of an `<ol>`, because an ordered
list would imply a sequence that no longer exists.
