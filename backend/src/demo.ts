import type { Member, RunResult } from "./types.ts";

/**
 * Demo personas. Maximum friction on purpose: if the four agents agree, every
 * candidate scores +4, the compromise line is empty and the demo is boring.
 * The conflict is the product.
 */
export const demoMembers: Member[] = [
  {
    id: "m1",
    name: "Maya",
    context:
      "vegan, and not the chill kind — if the only thing I can eat is a side salad I'm not coming. I'd rather do one good place than three mediocre ones.",
  },
  {
    id: "m2",
    name: "Dev",
    context:
      "I want to be out until 3am. Music, preferably live, preferably loud. If we're home by midnight what was the point.",
  },
  {
    id: "m3",
    name: "Sam",
    context:
      "crowds wreck me. loud rooms wreck me. I will genuinely have a good time somewhere I can hear the person next to me, and a bad time anywhere else.",
  },
  {
    id: "m4",
    name: "Nazar",
    context:
      "broke. like actually broke. $20 is my hard cap for the night and that includes whatever we eat. cheap or free or I'm out.",
  },
];

/**
 * One cached good run, served behind `?demo=1`. Conference wifi will betray
 * you; the fixture is not optional. Every url here was checked by hand.
 */
export const demoRun: RunResult = {
  transcript: [
    {
      speaker: "Orchestrator",
      kind: "search",
      text: "Four people, four different nights. Looking for cheap eats with a real vegan option, somewhere quiet enough to talk, and live music that runs late.",
    },
    { speaker: "Maya", kind: "vote", text: "4 yes, 2 maybe, 9 no — top pick: Veracruz All Natural" },
    { speaker: "Dev", kind: "vote", text: "5 yes, 1 maybe, 9 no — top pick: Mohawk Austin" },
    { speaker: "Sam", kind: "vote", text: "2 yes, 3 maybe, 10 no — top pick: The Elephant Room" },
    { speaker: "Nazar", kind: "vote", text: "6 yes, 2 maybe, 7 no — top pick: Veracruz All Natural" },
    {
      speaker: "Orchestrator",
      kind: "final",
      text: "Tacos, jazz, then the loud one — 7:00pm Veracruz All Natural, 9:00pm The Elephant Room, 11:30pm Mohawk Austin. Sam voted no on Mohawk and is getting it anyway, because Dev put it first and nobody else vetoed it — Sam gets the quiet middle of the night in exchange.",
    },
  ],
  plan: {
    title: "Tacos, jazz, then the loud one",
    steps: [
      {
        time: "7:00pm",
        what: "Start cheap. Vegan al pastor exists here, and nothing on the menu breaks Nazar's $20.",
        title: "Veracruz All Natural",
        url: "https://www.veracruzallnatural.com/",
      },
      {
        time: "9:00pm",
        what: "Basement jazz club. Sam can actually hear people, and the cover is small.",
        title: "The Elephant Room",
        url: "https://www.elephantroom.com/",
      },
      {
        time: "11:30pm",
        what: "Outdoor stage, late set. Dev's night starts here; anyone who is done can leave.",
        title: "Mohawk Austin",
        url: "https://www.mohawkaustin.com/",
      },
    ],
    compromise:
      "Sam gave up the most — they voted no on Mohawk and it won anyway. The jazz club at 9 is their half of the deal, and the 11:30 slot is deliberately last so leaving early costs nobody anything.",
  },
};
