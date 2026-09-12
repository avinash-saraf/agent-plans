# CONTEXT.md

Read this, find your track, start building. Don't wait for anyone.

---

## What we're building

Four friends each write a freeform blurb about themselves. Each gets an AI agent. The agents look at **real venues and events pulled from Exa**, vote as their person's advocate, code tallies the votes, and an orchestrator turns the winners into a plan — naming who compromised and why.

The demo is the **transcript**: orchestrator, then four agents disagreeing in character, then a verdict. That's the product. Everything else is plumbing.

Sponsors: **OpenAI** (SDK) → **OpenRouter** (routing) + **Exa** (grounding).

---

## Cut list — do not build these

- No auth, no registration, no invites. A group is a URL slug: `/g/hackathon`. Link = access.
- No preference schema. No checkboxes, no date pickers, no schedule parser. **One freeform textarea.**
- No agent framework. No LangGraph, no message bus, no tool-calling loop. `fetch` in a loop.
- No negotiation rounds. **One round, hard cap.**
- No realtime. A button and a spinner.
- No users table, no groups table. The slug is a string column.
- No error handling beyond the validation rules below.

If you're building something not in this file, stop.

---

## The pipeline

```
orchestrator  ->  3 exa queries
exa           ->  15 candidates
agent 1..4    ->  vote (parallel, 4 calls)
tally         ->  plain code, picks the winners
orchestrator  ->  final plan + who compromised
```

Six LLM calls. ~8 seconds. No loop, no branch — it cannot fail to terminate.

---

## Transcript

Strict order: one orchestrator turn, then all four agents, then the verdict.

```json
{
  "transcript": [
    { "speaker": "Orchestrator", "kind": "search", "text": "..." },
    { "speaker": "Maya",  "kind": "vote", "text": "3 yes, 1 maybe, 11 no — top pick: Arcade Bar" },
    { "speaker": "Dev",   "kind": "vote", "text": "..." },
    { "speaker": "Sam",   "kind": "vote", "text": "..." },
    { "speaker": "Nazar", "kind": "vote", "text": "..." },
    { "speaker": "Orchestrator", "kind": "final", "text": "..." }
  ],
  "plan": {
    "title": "Arcade bar + late tacos",
    "steps": [{ "time": "7:00pm", "what": "...", "title": "...", "url": "https://..." }],
    "compromise": "Maya gave up the early night so Dev could get his set."
  }
}
```

`kind` is `search | vote | final`. Frontend styles off `kind` and needs nothing else.

Agents return no prose, so **build the vote `text` in code** from the counts plus the `top3[0]` title. Deterministic, free, and it still reads as a turn in a conversation.

Votes come back from `Promise.all`, which preserves input order — but **sort by `members` order before pushing** so the transcript is stable if someone swaps in `allSettled` later.

---

## Orchestrator turn 1 — search

In: 4 blobs + city. Out: `{ "queries": ["...","...","..."], "text": "..." }` — `text` is the transcript line saying what it's looking for.

**Exa** (not an LLM call). 3 queries, `numResults: 5`. **Trim first** — Exa returns full page contents and will blow the prompt up 20x:

```js
const candidates = results.map((r, i) => ({
  id: `c${i + 1}`,
  title: r.title,
  snippet: (r.text || "").slice(0, 200),
  url: r.url
}));
```

**You assign the ids.** Models reference `c1..c15` and never emit URLs. Dedupe by url, cap at 15.

---

## Agent turn

Each agent sees **only its own person's blob** + the candidate list.

```json
{
  "yes":   ["c1", "c4", "c9"],
  "maybe": ["c2"],
  "no":    ["c3", "c7", "c11"],
  "top3":  ["c4", "c1", "c9"]
}
```

Pure data, no prose. Every candidate id lands in **exactly one** of yes/maybe/no.

`top3` is ordered, drawn from `yes` (fall back to `maybe` if fewer than 3 yeses). Ranking 3 items is reliable; ranking 15 isn't, which is why we don't.

```js
const voteCall = (member, candidates) => client.chat.completions.create({
  model: CHEAP,
  response_format: { type: "json_object" },
  messages: [
    { role: "system", content:
`You are the agent for ${member.name}. You represent their interests only — you are their advocate, not a neutral assistant.

What ${member.name} told us about themselves:
${member.context}

Sort EVERY candidate id into exactly one of yes, maybe, or no.
Be decisive — if ${member.name} would not actually show up, it is a no.
Then pick your top 3 in order from your yes list (fall back to maybe if you have fewer than 3 yeses).

Reply with JSON only, no prose:
{"yes":[],"maybe":[],"no":[],"top3":[]}` },
    { role: "user", content: JSON.stringify(candidates) }
  ]
});
```

All 15 candidates go in **one call per agent** — never one call per candidate. Judged in isolation everything looks fine; judged against 14 alternatives a mediocre option is visibly seventh-best. Also 4 calls instead of 60.

---

## Tally

Plain code. No LLM. This is the actual decision — the orchestrator doesn't choose, it narrates.

```js
const ranked = candidates
  .map(c => ({
    ...c,
    score: votes.filter(v => v.yes.includes(c.id)).length
         - votes.filter(v => v.no.includes(c.id)).length,
    picks: votes.filter(v => v.top3.includes(c.id)).length
  }))
  .sort((a, b) => b.score - a.score || b.picks - a.picks);

const winners = ranked.slice(0, 3);
```

Net yes = yes count minus no count. `maybe` is worth zero — that's the whole point of having it. Ties break on how many agents put it in their `top3`.

Nothing is eliminated outright, so the list can't empty. A candidate three people love and one hates still scores +2 and can win — which is correct, and the final turn is where that dissent gets named.

---

## Orchestrator turn 2 — final

In: `winners` (already chosen), all four vote objects, the members list. Out:

```json
{ "title": "...",
  "steps": [{ "time": "7:00pm", "candidateId": "c4", "what": "..." }],
  "compromise": "..." }
```

The model's job is **sequencing and narrative only** — order the winners into an evening, assign plausible times, and write the compromise line. It does not pick; the tally already did.

Since the agents no longer speak for themselves, this turn carries the entire narrative load. Pass it the raw vote objects with names attached and tell it to **name people directly** — "Maya voted no on both bars" — so the dissent shows up somewhere.

**Ids only, never URLs.** You look up title and url from your own `candidates` array when building the response.

`compromise` is required — name the person who gave up the most and what they gave up. Without it the model produces bland consensus mush.

---

## Validation

The only error handling in the project. Each rule retries the call **once**, then throws.

| Where | Check |
| --- | --- |
| all | `JSON.parse` succeeds — use `response_format: { type: "json_object" }` and still wrap it |
| agent | every candidate id appears exactly once across `yes`/`maybe`/`no` |
| agent | `top3` ⊆ `yes ∪ maybe`, length ≤ 3 |
| final | every `candidateId` is one of the `winners` |

**That last one is the important one.** Nothing else stops the final turn from inventing a plausible bar with a plausible URL, and the whole Exa-grounding pitch dies live when a judge clicks it.

---

## The isolation invariant

What **never** goes in an agent prompt:

- another member's `context`
- another member's vote
- the running transcript

Each agent sees exactly: its own person, plus the candidate list. Break this and you get anchoring (first speaker frames everything) and sycophantic convergence (everyone agrees and the vegan signs off on the steakhouse).

One line in code review: **if it isn't the loop variable, it doesn't go in the prompt.**

Have each worker return `{ memberId, name, ...parsed }` so identity travels with the payload. Don't rely on array position — a positional bug attributes Maya's vetoes to Dev and you get a nonsense plan with no idea why.

---

## Setup

```js
import OpenAI from "openai";
const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});
```

Cheap model for agent turns, stronger for the two orchestrator turns. **Pick from OpenRouter's live model list — 5 minutes, not 20.** Don't trust a model slug from memory, confirm it resolves.

Push to the transcript **inside each turn**, not at the end. If the final turn dies you still have something to demo.

```
OPENROUTER_API_KEY=
EXA_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## Tracks

Agree on shapes at minute 10, then don't block on each other.

**A — DB + join page.** Supabase, one table, anon key, RLS off, public insert:

```sql
create table members (
  id uuid primary key default gen_random_uuid(),
  group_slug text not null,
  name text not null,
  context text not null,
  created_at timestamptz default now()
);
```

Then the join form: name + one textarea. ~45 min, then go help D.

**B — Orchestrator turns + Exa.** Start with 4 hardcoded blobs. **Don't wait for the database.** First 10 minutes: hand-write a fake transcript JSON and commit it so D isn't blocked.

**C — Agent turn + tally + validation.** Same hardcoded blobs. Agree `candidates[]` and the vote schema with B at minute 10, then work independently until integration.

**D — Frontend transcript.** Bubbles keyed on `kind`, name label, sequential reveal. Build against B's fake JSON. This is the entire visual product — make it look good.

---

## Schedule

| Time | What |
| --- | --- |
| 0:00–0:15 | Contracts locked, keys in shared `.env`, **hello-world deployed** |
| 0:15–1:00 | Parallel. B and C each runnable as standalone scripts |
| 1:00–1:20 | B + C merge into one `runPlan()`, still hardcoded inputs |
| 1:20–1:45 | A and D wire to real endpoints |
| 1:45–2:15 | End-to-end runs, fix what breaks |
| 2:15–2:30 | **FREEZE.** Cache one good run to a fixture behind `?demo=1` |
| 2:30–2:45 | Seed demo group, rehearse the pitch out loud twice |
| 2:45–3:00 | Buffer. Something will be on fire |

Deploy at 0:15 so deployment isn't a surprise at 2:45. Conference wifi **will** betray you — the fixture is not optional.

**Not shipped by 2:15 doesn't exist.**

---

## Demo personas

Write these in the first 15 minutes while setup runs. **Maximum friction.** If the four agents agree, every candidate scores +4, the compromise line is empty, and the demo is boring. The conflict is the product.

- vegan, won't compromise on food
- hates crowds and loud rooms
- broke, hard cap around $20
- wants to be out until 3am

First person, funny, the way someone actually types into a box.
