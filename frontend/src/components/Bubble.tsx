import type { TranscriptTurn } from "../types.ts";

/**
 * The frontend styles off `kind` and needs nothing else — that is the whole
 * contract. A new speaker never needs a code change here.
 */
export const Bubble = ({ turn }: { turn: TranscriptTurn }) => (
  <li className={`bubble bubble--${turn.kind}`} data-kind={turn.kind} data-testid="bubble">
    <div className="bubble__speaker">{turn.speaker}</div>
    <p className="bubble__text">{turn.text}</p>
  </li>
);
