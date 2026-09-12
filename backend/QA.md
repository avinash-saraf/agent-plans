# Full app integration check — September 12, 2026

The running React app (5173), Vite API proxy, Nest backend (3000), Supabase database, OpenRouter, and Exa were exercised together. Live planning used the supplied keys in ignored local environment configuration. Provider responses were not mocked for the live runs.

## Shared groups and members

Passed through the browser: create a group, add four named members with freeform blurbs, generate a live six-turn transcript and three-stop plan, refresh the page, open the shared link in a second tab, copy the group URL, edit a member on mobile, observe the change from the first tab after refresh, remove a member, and create a second group with a custom slug/city. Editing a member cleared the previous plan; removing one reopened a seat and disabled planning until four people join.

`npm run test:smoke` passed against the actual frontend proxy/database: create/read, duplicate slug 409, whitespace validation 400, simultaneous joins competing for the fourth seat (one 201, one 409), maximum four members, stale revision 409, member edit/remove, city edit, and incomplete-roster planning 400. Its disposable group was removed.

## Live planning

An earlier default-group round completed in 8.3 seconds and verified source URLs, ballot partitions, deterministic tallying, and the named compromise. The current cached round has since been regenerated with the activity-diversity change; its metadata is in `frontend/src/fixtures/round.provenance.json` and sample member IDs are normalized to lowercase names.

The user-created Queens group was regenerated after the diversity change in 10.6 seconds, preserving all four IDs, names, and blurbs. Its final options were Flushing Meadows Corona Park, Queens Craft Brigade, and a Mexican pizzeria: three distinct activity categories. Every option contains four attributed fit notes, with yes/maybe/no indicators and no time field. The frontend shows all twelve notes. The default Brooklyn fixture now contains food and an outdoor walk; it intentionally stays at two options when search supplies only two categories.

A follow-up live run exposed a rejected final narrative. Validation retries now include the specific schema failure and request full exact display names, without replaying malformed model prose. The next live run completed successfully. This remains a bounded two-attempt policy, not an unbounded generation loop.

Earlier live testing exposed duplicate calendar pages from the same venue and a narrative that could choose the wrong person as the biggest compromiser. Candidate normalization now collapses common calendar/events/ticket subdomains, and the final validator requires someone with the lowest net support to be named. The latest live result was generated after both changes.

Mobile layout and forms were visually checked at 390px and 320px. The 320px form stayed within the viewport without horizontal overflow. Desktop transcript/itinerary layout was also inspected. Copy itinerary and the cached six-turn replay passed. Both browser-created QA groups were removed; the Hackathon demo group is retained.

## Automated checks

- Backend build and lint of changed source passed.
- Thirteen backend tests passed, including advocate isolation, ballot/reason completeness, tally tie-breaking, URL grounding, venue deduplication across websites, activity diversity when the highest-scoring options are all museums, deterministic compromise selection, invalid-output retry limits, transcript ordering, and preservation of partial turns on final failure. The read-retry tests prove recovery from transient P1001 failures, the three-attempt cap, and no retry of writes or unrelated errors.
- Frontend build, lint, and fourteen tests passed for shared-group HTTP contracts, conflict propagation, response validation, auth handling, transcript/link validation, exact member attribution, and copied plans omitting legacy time fields. The new event notes were visually checked at 390px and 320px without horizontal overflow, as well as the wide-screen layout.

## Accounts

Previously verified against this same Nest/Supabase integration: registration 201 with bcrypt storage, browser sign-in, profile 200, wrong password 401, duplicate email 409, invalid fields 400, expired JWT 401, sign-out, reload clearing the in-memory token, and rejection of a deleted test account’s session. Both disposable auth accounts and temporary credential files were removed. Accounts remain optional and their implementation is preserved. Registration, login, and profile loading were rechecked on the final Node 24 runtime, and that additional disposable account was removed.

A final idle-connection check reproduced Supabase P1001 failures. The backend now retries only safe reads for that specific error and reconnects after startup failures. The full shared-group smoke test passed again on the final runtime. This reduces transient failures; it does not establish an uptime guarantee for the external database.

## Runtime scope

Local demo only. Provider and database uptime are external dependencies; this is a functional check, not a sustained load test. Plans no longer suggest times; source links and fit reasons do not verify opening hours or book venues. Classification and personal-fit wording remain model-derived. Anyone holding a group link can read/edit it, matching the requested link-based demo access model. Original `users` and teammate-owned `members` tables were preserved; the new group table has a recorded additive migration.
