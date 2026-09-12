import { useCallback, useEffect, useState } from "react";
import { JoinForm } from "./components/JoinForm.tsx";
import { PlanCard } from "./components/PlanCard.tsx";
import { Transcript } from "./components/Transcript.tsx";
import { joinGroup, listMembers, runPlan } from "./api.ts";
import type { Member, RunResult } from "./types.ts";

export const App = ({
  slug,
  demo = false,
  revealMs,
}: {
  slug: string;
  demo?: boolean;
  revealMs?: number;
}) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listMembers(slug)
      .then(setMembers)
      .catch((e: Error) => setError(e.message));
  }, [slug]);

  useEffect(refresh, [refresh]);

  const join = async (name: string, context: string) => {
    setError(null);
    try {
      const member = await joinGroup(slug, name, context);
      setMembers((prev) => [...prev, member]);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // A button and a spinner. No realtime, no streaming, no websocket.
  const plan = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      setResult(await runPlan(slug, "Austin", demo));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="app">
      <header className="header">
        <h1 className="header__title">four friends, four agents, one night</h1>
        <p className="header__slug">
          group <code>/g/{slug}</code> — anyone with this link is in
        </p>
      </header>

      <section className="panel">
        <h2 className="panel__heading">who's coming</h2>
        {members.length === 0 ? (
          <p className="empty">nobody yet. you first.</p>
        ) : (
          <ul className="members">
            {members.map((m) => (
              <li className="member" key={m.id}>
                <span className="member__name">{m.name}</span>
                <span className="member__context">{m.context}</span>
              </li>
            ))}
          </ul>
        )}

        <JoinForm onJoin={join} disabled={running} />
      </section>

      <section className="panel">
        <button className="button button--go" onClick={plan} disabled={running}>
          {running ? "the agents are arguing…" : demo ? "run the cached demo" : "make a plan"}
        </button>
        {running && <div className="spinner" role="status" aria-label="working" />}
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {result && (
        <section className="panel panel--transcript">
          <h2 className="panel__heading">the argument</h2>
          <Transcript turns={result.transcript} {...(revealMs === undefined ? {} : { revealMs })} />
          {result.plan && <PlanCard plan={result.plan} />}
        </section>
      )}
    </main>
  );
};
