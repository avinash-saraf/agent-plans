# Kusama frontend

React + TypeScript + Vite. Use Node 22.18+ (or Node 24+), run `npm ci`, then `npm run dev` from this directory. Open http://127.0.0.1:5173/g/hackathon?demo=1.

`npm run build` typechecks and builds `dist/`. `npm run lint` runs Oxlint. `npm test` checks transcript ordering, response validation, URL safety, room storage, and the auth HTTP contract. `npm run format` formats the frontend.

## Product

The [source context](../context.md) defines one round: search, four independent votes in member order, then the final plan. This frontend renders that exact response, without assuming structured vote counts or parsing prose.

- Open a group at `/g/:slug`. The initial `hackathon` group contains four sample personas; other unvisited slugs start empty.
- Edit a person through their avatar: name and one freeform context field.
- Add people to an empty group, change the city, or create another local group.
- Explore a six-turn example, reveal it sequentially, follow venue links, and copy the itinerary.
- See the named compromise beside the plan. On phones, the plan follows the transcript.
- Optionally sign in or register. Exploring the app never requires an account.

Groups persist under `kusama.rooms.v2.<slug>` in local storage. They are local previews, not shared Supabase records. Copying the URL shares the slug only; the UI says profiles stay on the device. Editing group inputs clears the previous result.

## Planning handoff

The teammate is building the real pipeline and group endpoints. No planning route is assumed. `VITE_PLANNER_API_PATH` is intentionally empty, so the live action stays disabled.

When the route and request DTO are agreed, configure the path and update `src/lib/planningApi.ts` as needed. Its proposed input is `{city, members: [{id, name, context}]}`; the source context specifies pipeline inputs but not an HTTP request DTO. Do not assume this adapter already matches an unpublished route.

The required response is:

```ts
{
  transcript: [
    { speaker: 'Orchestrator', kind: 'search', text: string },
    // Four {speaker: member.name, kind: 'vote', text: string} in input order.
    { speaker: 'Orchestrator', kind: 'final', text: string }
  ],
  plan: {
    title: string,
    steps: Array<{time: string, what: string, title: string, url: string}>,
    compromise: string
  }
}
```

`src/lib/room.ts` validates this shape and order before rendering. URLs must be HTTP(S) without embedded credentials; actual Exa grounding remains the backend's responsibility. The UI renders text as text, never HTML. The route adapter propagates cancellation and errors; it never silently substitutes example data.

The live action uses one request and a spinner. A completed response is revealed afterward, not streamed. Reduced-motion users see the completed round immediately. No artificial multi-round negotiation is added.

Wire shared member reads/writes next when the teammate publishes those routes. Keep database credentials server-side. A `DATABASE_URL` is never a `VITE_*` variable.

## Example fixture

`src/fixtures/round.json` is handwritten sample data, including illustrative votes and a plan with official venue links. It is explicitly labeled as an example in the UI and has not been produced by a live model or Exa run. `?demo=1` loads it reliably; replay uses the same sample group without changing saved profiles. The sample does not claim current venue prices, hours, or availability.

Replace it with a reviewed successful pipeline response for the hackathon cache once that exists. Keep the six-turn contract and a visible compromise.

## Backend and accounts

The Nest service lives in `../backend` on port 3000. Vite proxies `/api` and strips the prefix, so `/api/auth/login` reaches `/auth/login`. See [backend setup](../backend/INTEGRATION.md).

Accounts use the real register, login, and profile routes. Tokens stay in memory and are discarded on reload/sign-out; passwords and tokens never enter local storage. Signing in does not upload profiles or change their storage scope. Account tests mock HTTP responses; live verification requires a running backend.

The local backend dependency install is currently blocked by the package safety scanner's minimum-age policy on several upstream locked packages. The lockfile is preserved, and the scanner has not been bypassed. Environment configuration alone does not start the backend or apply database migrations.

## Design

See [DESIGN.md](./DESIGN.md). Inter Variable is bundled locally through Fontsource under its OFL license. The interface uses CSS, existing Lucide icons, and Kusama's original dot mark; no remote fonts or media services are required.
