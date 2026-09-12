/**
 * One live end-to-end run: real OpenRouter, real Exa, six LLM calls, printed as
 * a transcript. No server, no database, no frontend.
 *
 *   pnpm --filter backend plan:live
 *   pnpm --filter backend plan:live "New York"
 *
 * This is the standalone script CONTEXT.md asks for — the fastest way to find
 * out whether the keys, the models and the grounding all actually work.
 */
import { config, models } from "../src/env.ts";
import { demoMembers } from "../src/demo.ts";
import { exaSearch } from "../src/exa.ts";
import { openRouterChat } from "../src/llm.ts";
import { runPlan } from "../src/pipeline.ts";

const city = process.argv[2] ?? "Austin";

const missing = [
  ["OPENROUTER_API_KEY", config.openrouterKey],
  ["EXA_API_KEY", config.exaKey],
].filter(([, v]) => v === "");

if (missing.length > 0) {
  console.error(`missing in backend/.env: ${missing.map(([k]) => k).join(", ")}`);
  process.exit(1);
}

console.log(`planning a night in ${city} for ${demoMembers.map((m) => m.name).join(", ")}`);
console.log(`models: ${models().cheap} (agents), ${models().strong} (orchestrator)\n`);

const started = Date.now();
const { transcript, picks } = await runPlan({
  members: demoMembers,
  city,
  chat: openRouterChat(config.openrouterKey),
  search: exaSearch(config.exaKey),
  models: models(),
});

for (const turn of transcript) {
  console.log(`[${turn.kind.padEnd(6)}] ${turn.speaker}`);
  console.log(`         ${turn.text}\n`);
}

for (const pick of picks ?? []) {
  console.log(`── ${pick.title}`);
  console.log(`   ${pick.url}`);
  console.log(`   works for:     ${pick.appeals}`);
  console.log(`   does not:      ${pick.doesntAppeal}\n`);
}

console.log(`done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
