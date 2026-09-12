# Kusama frontend

React + TypeScript + Vite. Use Node 24, `npm ci`, then `npm run dev`. Open [the live group](http://127.0.0.1:5173/g/hackathon) or [cached demo](http://127.0.0.1:5173/g/hackathon?demo=1).

## App flow

- Create a group with a URL slug and city. Share its link with friends.
- Add up to four people, each with a name and one freeform context field. Edit or remove them through their cards.
- Make a plan once all four seats are filled. The backend searches Exa, classifies distinct activities, runs independent agent votes, tallies them, and returns a six-turn transcript and linked options with brief per-person fit notes. No times are displayed or copied.
- Refresh or open the link in another browser to retrieve the same members and result from Supabase. The refresh icon checks for edits from friends. There is no realtime subscription.
- Copy the group link or itinerary. Changing a city or member invalidates the previous plan.
- Sign in/register optionally. Browsing, joining, and planning require no account.

The UI stays light, monochrome, spacious, and responsive. The itinerary follows the transcript on phones. Inter Variable and Lucide icons are bundled locally.

## Integration

`src/lib/groupsApi.ts` calls the shared group routes documented in [backend/INTEGRATION.md](../backend/INTEGRATION.md). Each edit carries the server revision. A stale edit stays in the form and offers Refresh group; it never silently overwrites another person’s work. Group data no longer uses local storage. Older local preview records are left untouched but not loaded or uploaded.

`src/lib/room.ts` validates six turns (search, members in order, final), the required compromise, and safe HTTP(S) itinerary links. New version 2 results also require a vote/reason for every member in the correct order, matching their IDs and names. Older saved plans remain readable without their old time fields being rendered. Text is rendered as text. The backend supplies grounded URLs and persists the full result. Errors and partial transcripts remain visible; no failure silently changes into a sample result.

The cached fixture at `?demo=1` is explicitly labeled. It is independent of the editable group, so replay does not replace anyone’s saved profiles. Reduced-motion users see all completed turns immediately; otherwise the completed response is revealed sequentially.

Vite proxies `/api` to Nest on port 3000. `VITE_API_BASE_URL` defaults to `/api`. No separate planning-path configuration is needed. Account tokens remain only in memory. Database and provider credentials stay in `backend/.env`.

## Verify

`npm run build`, `npm run lint`, `npm test`. Tests cover API request contracts, conflict propagation, auth errors, transcript ordering, and safe itinerary links. See [live integration QA](../backend/QA.md) for browser and real database checks. See [DESIGN.md](DESIGN.md) for the visual direction.
