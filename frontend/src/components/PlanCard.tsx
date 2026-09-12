import type { Plan } from "../types.ts";

export const PlanCard = ({ plan }: { plan: Plan }) => (
  <section className="plan" aria-label="the plan">
    <h2 className="plan__title">{plan.title}</h2>

    <ol className="plan__steps">
      {plan.steps.map((step, i) => (
        <li className="step" key={`${step.time}-${i}`}>
          <span className="step__time">{step.time}</span>
          <div className="step__body">
            <a className="step__title" href={step.url} target="_blank" rel="noreferrer">
              {step.title}
            </a>
            <p className="step__what">{step.what}</p>
          </div>
        </li>
      ))}
    </ol>

    <p className="plan__compromise">
      <span className="plan__compromiseLabel">who compromised</span>
      {plan.compromise}
    </p>
  </section>
);
