# Kusama design foundations

The conversation is the product. Four people bring different constraints; the final plan makes the compromise visible. The visual system serves that exchange.

- White canvas, warm neutral surfaces, fine dividers, restrained weights, and room between ideas.
- Inter Variable is hosted locally. Use the shared tokens in `src/index.css`; body text remains readable rather than decorative.
- One small icon rail on desktop becomes a compact header on phones. Familiar actions use accessible icon buttons; names, votes, and the primary action retain text.
- Each person has a quiet tinted avatar shared between their context and their vote. Personal context stays a single text area.
- Search and final turns use Kusama's dot mark. Vote turns use member avatars. Styling depends on `kind`, never on parsed prose.
- The itinerary is a single warm surface beside the transcript, then below it on narrow screens. The named compromise stays visible.
- Use native form semantics, visible focus, 44px primary touch targets, Radix focus containment, and reduced-motion support. Dialogs keep phone inputs at 16px to avoid browser zoom.
- Keep sample data visibly identified. A completed response may reveal sequentially; the UI does not pretend that playback is a live model stream.

Inspiration: [OpenAI's brand foundations](https://openai.com/brand/), [Linear's interface redesign](https://linear.app/now/how-we-redesigned-the-linear-ui), and [Linear's latest design refresh](https://linear.app/now/behind-the-latest-design-refresh). These informed typography, quiet navigation, neutral contrast, and reduced labeling. Kusama has its own identity and components.

The [source context](../context.md) supplies the interaction model. The user's later choice keeps account actions optional while leaving the demo open to explore.
