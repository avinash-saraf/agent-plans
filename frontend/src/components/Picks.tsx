import type { Pick } from "../types.ts";

/**
 * Distinct suggestions, not an itinerary — so there is deliberately no time
 * column, no step number and no line connecting one card to the next. Each card
 * stands alone and states both sides. See DESIGN_DECISIONS.md §19.
 */
export const Picks = ({ picks }: { picks: Pick[] }) => (
  <section className="picks" aria-label="suggested spots">
    <h2 className="panel__heading">{picks.length} spots worth your time</h2>

    <ul className="picks__list">
      {picks.map((pick) => (
        <li className="pick" key={pick.url}>
          <a className="pick__title" href={pick.url} target="_blank" rel="noreferrer">
            {pick.title}
          </a>

          <p className="pick__side pick__side--for">
            <span className="pick__label">works for</span>
            {pick.appeals}
          </p>
          <p className="pick__side pick__side--against">
            <span className="pick__label">not for</span>
            {pick.doesntAppeal}
          </p>
        </li>
      ))}
    </ul>
  </section>
);
