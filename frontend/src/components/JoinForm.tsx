import { useState } from "react";

/**
 * No preference schema: no checkboxes, no date picker, no schedule parser.
 * A name and one freeform textarea, which is the entire input to the product.
 */
export const JoinForm = ({
  onJoin,
  disabled = false,
}: {
  onJoin: (name: string, context: string) => Promise<void>;
  disabled?: boolean;
}) => {
  const [name, setName] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);

  const ready = name.trim() !== "" && context.trim() !== "" && !busy && !disabled;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    try {
      await onJoin(name.trim(), context.trim());
      setName("");
      setContext("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="join" onSubmit={submit}>
      <label className="join__label" htmlFor="name">
        your name
      </label>
      <input
        id="name"
        className="join__input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Maya"
        autoComplete="off"
      />

      <label className="join__label" htmlFor="context">
        what should your agent know?
      </label>
      <textarea
        id="context"
        className="join__textarea"
        rows={5}
        value={context}
        onChange={(e) => setContext(e.target.value)}
        placeholder="vegan, and not the chill kind. $30 tops. home before 1 or I'm useless tomorrow."
      />

      <button className="button" type="submit" disabled={!ready}>
        {busy ? "joining…" : "join the group"}
      </button>
    </form>
  );
};
