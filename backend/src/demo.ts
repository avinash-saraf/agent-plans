import type { Member, RunResult } from "./types.ts";

/**
 * Demo personas. Maximum friction on purpose: if the four agents agree, every
 * candidate scores +4, every spot reads "works for everyone", and the demo is boring.
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
      text: "5 spots worth your time: Veracruz All Natural, The Elephant Room, Mohawk Austin, Casa de Luz, Pinballz Arcade.",
    },
  ],
  picks: [
    {
      title: "Veracruz All Natural",
      url: "https://www.veracruzallnatural.com/",
      appeals:
        "Maya and Nazar. Real vegan al pastor, not a side salad, and nothing on the menu breaks $20.",
      doesntAppeal:
        "Dev. It is a taco trailer that closes early — no music, nothing happening after 10.",
    },
    {
      title: "The Elephant Room",
      url: "https://www.elephantroom.com/",
      appeals: "Sam. Basement jazz club, small room, quiet enough to actually hear people. Cover is $10.",
      doesntAppeal:
        "Maya gets nothing to eat beyond bar snacks, and Dev wants volume, not a jazz trio.",
    },
    {
      title: "Mohawk Austin",
      url: "https://www.mohawkaustin.com/",
      appeals: "Dev. Outdoor stage, loud, late sets most nights. This is the whole reason he came out.",
      doesntAppeal:
        "Sam will not last twenty minutes. Tickets run $20-35, which is over Nazar's cap on its own.",
    },
    {
      title: "Casa de Luz",
      url: "https://www.casadeluz.org/",
      appeals: "Maya and Sam. Entirely plant-based, calm room, no music at all.",
      doesntAppeal: "Dev. It is a community center that serves dinner and closes. Nazar: $18 fixed plate, no cheaper option.",
    },
    {
      title: "Pinballz Arcade",
      url: "https://www.pinballz.com/",
      appeals: "Nazar and Dev. Free entry, open till 2am, and you can spend $5 or $50.",
      doesntAppeal: "Sam — it is a room full of noise by design. Maya: the food is fried bar stuff.",
    },
  ],
};
