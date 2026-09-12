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
  plan: {
    title: "Tacos, jazz, then the loud one",
    steps: [
      { time: "7:00pm", what: "Cheap and vegan.", title: "Veracruz All Natural", url: "https://www.veracruzallnatural.com/" },
      { time: "9:00pm", what: "Quiet enough to talk.", title: "The Elephant Room", url: "https://www.elephantroom.com/" },
    ],
    compromise: "Sam gave up the quiet night so Dev could get his set.",
  },
};
