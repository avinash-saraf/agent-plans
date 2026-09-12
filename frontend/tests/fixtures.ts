import type { RunResult } from "../src/types.ts";

export const runResult: RunResult = {
  transcript: [
    { speaker: "Orchestrator", kind: "search", text: "Looking for cheap vegan food and a late set." },
    { speaker: "Maya", kind: "vote", text: "3 yes, 1 maybe, 11 no — top pick: Veracruz All Natural" },
    { speaker: "Dev", kind: "vote", text: "5 yes, 1 maybe, 9 no — top pick: Mohawk Austin" },
    { speaker: "Sam", kind: "vote", text: "2 yes, 3 maybe, 10 no — top pick: The Elephant Room" },
    { speaker: "Nazar", kind: "vote", text: "6 yes, 2 maybe, 7 no — top pick: Veracruz All Natural" },
    { speaker: "Orchestrator", kind: "final", text: "Tacos, jazz, then the loud one." },
  ],
  picks: [
    {
      title: "Veracruz All Natural",
      url: "https://www.veracruzallnatural.com/",
      appeals: "Maya and Nazar. Real vegan al pastor, and nothing on the menu breaks $20.",
      doesntAppeal: "Dev. It is a taco trailer that closes early — no music, nothing after 10.",
    },
    {
      title: "The Elephant Room",
      url: "https://www.elephantroom.com/",
      appeals: "Sam. Small basement jazz room, quiet enough to hear people.",
      doesntAppeal: "Maya gets bar snacks at best, and Dev wants volume.",
    },
    {
      title: "Mohawk Austin",
      url: "https://www.mohawkaustin.com/",
      appeals: "Dev. Outdoor stage, loud, late sets most nights.",
      doesntAppeal: "Sam will not last twenty minutes. Tickets are over Nazar's cap.",
    },
  ],
};
