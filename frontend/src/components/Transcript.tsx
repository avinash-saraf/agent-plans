import { useEffect, useState } from "react";
import { Bubble } from "./Bubble.tsx";
import type { TranscriptTurn } from "../types.ts";

export const REVEAL_MS = 600;

/**
 * Sequential reveal. The transcript is the product, so the turns land one at a
 * time rather than all at once — the disagreement has to be readable as it
 * happens. The delay is a prop so tests can run it at zero.
 */
export const Transcript = ({
  turns,
  revealMs = REVEAL_MS,
}: {
  turns: TranscriptTurn[];
  revealMs?: number;
}) => {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setShown(0);
    if (turns.length === 0) return;

    let i = 0;
    const tick = () => setShown(++i);
    tick();
    const timer = setInterval(() => {
      if (i >= turns.length) return clearInterval(timer);
      tick();
    }, revealMs);

    return () => clearInterval(timer);
  }, [turns, revealMs]);

  return (
    <ol className="transcript" aria-label="transcript">
      {turns.slice(0, shown).map((turn, i) => (
        <Bubble key={`${turn.speaker}-${i}`} turn={turn} />
      ))}
    </ol>
  );
};
